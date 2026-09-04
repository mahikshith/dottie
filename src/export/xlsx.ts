/**
 * Dottie — .xlsx workbook writer (pure, no dependencies)
 *
 * Turns a plain description of sheets, columns, rows and charts into a real
 * SpreadsheetML workbook: the one the owner asked for, "an Excel sheet with
 * beautiful graphs embedded", openable in Excel, Numbers, Google Sheets and
 * LibreOffice with the charts already drawn.
 *
 * ─── WHY WE HAND-WRITE IT ───────────────────────────────────────────
 *
 *  The two obvious libraries both fail this brief on a phone. SheetJS's
 *  community build writes cells but cannot write charts at all. ExcelJS can,
 *  but it is a Node-shaped package (streams, zlib, Buffer) that does not belong
 *  in a React Native bundle. Since an .xlsx is just a ZIP of XML, and our zip
 *  writer is 130 dependency-free lines, writing the XML ourselves is smaller
 *  than either dependency AND is the only route that gets real charts.
 *
 * ─── CHARTS ARE NATIVE, NOT PICTURES ────────────────────────────────
 *
 *  Each chart is a DrawingML `chartSpace` part referencing cell RANGES on the
 *  sheet, not a rendered image. So the graph is live: it recolours with the
 *  user's Excel theme, and if they edit or filter a row the chart follows. A
 *  screenshot pasted into a sheet would have been easier and dead on arrival.
 *
 * ─── DATES ARE TEXT, DELIBERATELY ───────────────────────────────────
 *
 *  Serial dates in xlsx count days from an epoch that Excel gets wrong by
 *  design (the 1900 leap-year bug) and that shifts under a spreadsheet's own
 *  locale. Dottie's whole date layer is civil `YYYY-MM-DD` strings for exactly
 *  the reason that bit us in device-test-7 — local in, UTC out. So dates are
 *  written as ISO text: unambiguous everywhere, sorts correctly as a string,
 *  and charts fine as a category axis.
 */

import { zipSync, utf8, type ZipEntry } from './zip';

// ─── PUBLIC MODEL ────────────────────────────────────────────────────

export type CellValue = string | number | null;

export interface SheetColumn {
  header: string;
  /** Approximate character width in the spreadsheet. */
  width?: number;
}

export type ChartKind = 'bar' | 'line';

export interface ChartSpec {
  kind: ChartKind;
  title: string;
  /** 1-based column index used for the category (x) axis. */
  categoryCol: number;
  /** 1-based column indices plotted as series. */
  valueCols: number[];
  /** Top-left cell of the chart frame, 0-based {col,row}. */
  anchor: { col: number; row: number };
  /** Frame size in cells. */
  widthCells?: number;
  heightCells?: number;
}

export interface SheetSpec {
  /** Sheet tab name. Excel forbids : \ / ? * [ ] and caps at 31 chars. */
  name: string;
  columns: SheetColumn[];
  rows: readonly CellValue[][];
  charts?: readonly ChartSpec[];
}

export interface WorkbookSpec {
  sheets: readonly SheetSpec[];
}

// ─── XML HELPERS ─────────────────────────────────────────────────────

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Escape for XML text and attributes, and drop the control characters that are
 * illegal in XML 1.0 outright. A user note pasted from elsewhere can carry a
 * stray 0x0B, and one of those turns the whole workbook into "unreadable
 * content" in Excel — a silent, total failure of the export.
 */
export function esc(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    const code = value.charCodeAt(i);
    if (code < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') continue;
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else if (ch === "'") out += '&apos;';
    else out += ch;
  }
  return out;
}

/** 1 → A, 27 → AA. */
export function colLetter(index1: number): string {
  let n = index1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * A sheet name safe for both the tab and a formula reference. Excel's rules,
 * enforced here rather than trusted: no : \ / ? * [ ], never empty, 31 chars.
 */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned.length === 0 ? 'Sheet' : cleaned).slice(0, 31);
}

/** `'Name'!$B$2:$B$40` — a fully-qualified absolute range. */
function ref(sheet: string, col: number, row1: number, row2?: number): string {
  const letter = colLetter(col);
  const head = `'${sheet.replace(/'/g, "''")}'!$${letter}$${row1}`;
  return row2 === undefined ? head : `${head}:$${letter}$${row2}`;
}

// ─── SHEET XML ───────────────────────────────────────────────────────

const STYLE_NORMAL = 0;
const STYLE_HEADER = 1;

function cellXml(ref_: string, value: CellValue, style: number): string {
  const s = style === STYLE_NORMAL ? '' : ` s="${style}"`;
  if (value === null || value === '') return `<c r="${ref_}"${s}/>`;
  if (typeof value === 'number') {
    // A non-finite number has no valid XML representation — write a blank
    // rather than the literal "NaN", which Excel reads as a repair-worthy
    // corrupt cell.
    if (!Number.isFinite(value)) return `<c r="${ref_}"${s}/>`;
    return `<c r="${ref_}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref_}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(sheet: SheetSpec, hasDrawing: boolean): string {
  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`)
    .join('');

  const header = sheet.columns
    .map((c, i) => cellXml(`${colLetter(i + 1)}1`, c.header, STYLE_HEADER))
    .join('');

  const body = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((v, i) => cellXml(`${colLetter(i + 1)}${r + 2}`, v, STYLE_NORMAL))
        .join('');
      return `<row r="${r + 2}">${cells}</row>`;
    })
    .join('');

  return (
    `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    // Freeze the header row: a 300-row symptom log is unreadable without it.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    (hasDrawing ? `<drawing r:id="rId1"/>` : '') +
    `</worksheet>`
  );
}

// ─── CHART XML ───────────────────────────────────────────────────────

// Dottie's aurora accents, so the workbook looks like the app that made it.
const SERIES_COLORS = ['54E6C8', '9B7BFF', 'FFC24D', 'FF6FA5', '6FE6A8', '7AB8FF'];

function seriesXml(
  kind: ChartKind,
  sheet: string,
  idx: number,
  valueCol: number,
  categoryCol: number,
  lastRow: number
): string {
  const color = SERIES_COLORS[idx % SERIES_COLORS.length]!;
  const fill =
    kind === 'bar'
      ? `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>`
      : `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>`;
  const marker = kind === 'line' ? `<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>` : '';
  return (
    `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>` +
    `<c:tx><c:strRef><c:f>${esc(ref(sheet, valueCol, 1))}</c:f></c:strRef></c:tx>` +
    fill +
    marker +
    `<c:cat><c:strRef><c:f>${esc(ref(sheet, categoryCol, 2, lastRow))}</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${esc(ref(sheet, valueCol, 2, lastRow))}</c:f></c:numRef></c:val>` +
    (kind === 'line' ? `<c:smooth val="0"/>` : '') +
    `</c:ser>`
  );
}

function chartXml(spec: ChartSpec, sheet: string, lastRow: number, axBase: number): string {
  const catAx = axBase;
  const valAx = axBase + 1;
  const sers = spec.valueCols
    .map((col, i) => seriesXml(spec.kind, sheet, i, col, spec.categoryCol, lastRow))
    .join('');

  const plot =
    spec.kind === 'bar'
      ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}` +
        `<c:gapWidth val="60"/><c:overlap val="-10"/><c:axId val="${catAx}"/><c:axId val="${valAx}"/></c:barChart>`
      : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}` +
        `<c:marker val="1"/><c:axId val="${catAx}"/><c:axId val="${valAx}"/></c:lineChart>`;

  return (
    `${XML_HEAD}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:chart>` +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    `<c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${plot}` +
    `<c:catAx><c:axId val="${catAx}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${valAx}"/></c:catAx>` +
    `<c:valAx><c:axId val="${valAx}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:crossAx val="${catAx}"/></c:valAx>` +
    `</c:plotArea>` +
    (spec.valueCols.length > 1
      ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/>`
      : `<c:plotVisOnly val="1"/>`) +
    // Blanks read as gaps, never as zeros. A day nobody logged is not a day
    // scored zero — the same rule the in-app mood map is held to.
    `<c:dispBlanksAs val="gap"/>` +
    `</c:chart></c:chartSpace>`
  );
}

function drawingXml(charts: readonly ChartSpec[]): string {
  const anchors = charts
    .map((spec, i) => {
      const from = spec.anchor;
      const toCol = from.col + (spec.widthCells ?? 8);
      const toRow = from.row + (spec.heightCells ?? 16);
      return (
        `<xdr:twoCellAnchor editAs="oneCell">` +
        `<xdr:from><xdr:col>${from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>` +
        `<xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
        `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>` +
        `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
      );
    })
    .join('');
  return (
    `${XML_HEAD}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2">` +
  `<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  // Aurora ground, so a header row in the workbook is recognisably Dottie's.
  `<fill><patternFill patternType="solid"><fgColor rgb="FF241F35"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

// ─── ASSEMBLY ────────────────────────────────────────────────────────

/**
 * Build the workbook as raw .xlsx bytes.
 *
 * Deterministic: no timestamps, no ids derived from anything but position, so
 * the same data always produces the same archive. That is what lets the export
 * harness assert on the bytes instead of eyeballing a download.
 */
export function buildXlsx(spec: WorkbookSpec): Uint8Array {
  const sheets = spec.sheets.map((s) => ({ ...s, name: safeSheetName(s.name) }));
  const parts: ZipEntry[] = [];
  const add = (path: string, xml: string) => parts.push({ path, data: utf8(xml) });

  // Charts are numbered across the whole workbook — chart2.xml may belong to
  // sheet 3. Axis ids must be unique per chart or Excel silently merges axes.
  let chartNo = 0;
  const contentOverrides: string[] = [];
  const sheetRels: { sheetIdx: number; charts: number[] }[] = [];

  sheets.forEach((sheet, si) => {
    const lastRow = sheet.rows.length + 1;
    // A chart over one row of data is a bar with nothing to compare it to; a
    // chart over zero rows is a broken frame. Drop them rather than draw them.
    const charts = (sheet.charts ?? []).filter(() => sheet.rows.length >= 2);
    const ids: number[] = [];
    for (const c of charts) {
      chartNo++;
      ids.push(chartNo);
      add(`xl/charts/chart${chartNo}.xml`, chartXml(c, sheet.name, lastRow, 100000 + chartNo * 10));
      contentOverrides.push(
        `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
      );
    }
    if (ids.length > 0) {
      add(`xl/drawings/drawing${si + 1}.xml`, drawingXml(charts));
      add(
        `xl/drawings/_rels/drawing${si + 1}.xml.rels`,
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          ids
            .map(
              (id, i) =>
                `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${id}.xml"/>`
            )
            .join('') +
          `</Relationships>`
      );
      add(
        `xl/worksheets/_rels/sheet${si + 1}.xml.rels`,
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${si + 1}.xml"/>` +
          `</Relationships>`
      );
      contentOverrides.push(
        `<Override PartName="/xl/drawings/drawing${si + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
      );
    }
    sheetRels.push({ sheetIdx: si, charts: ids });
    add(`xl/worksheets/sheet${si + 1}.xml`, sheetXml(sheet, ids.length > 0));
    contentOverrides.push(
      `<Override PartName="/xl/worksheets/sheet${si + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    );
  });

  add(
    '[Content_Types].xml',
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      contentOverrides.join('') +
      `</Types>`
  );

  add(
    '_rels/.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`
  );

  add(
    'xl/workbook.xml',
    `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
      sheets
        .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('') +
      `</sheets></workbook>`
  );

  add(
    'xl/_rels/workbook.xml.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`
  );

  add('xl/styles.xml', STYLES_XML);

  return zipSync(parts);
}
