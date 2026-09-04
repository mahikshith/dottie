/**
 * Dottie — Data Export Harness
 *
 * The export writes a REAL .xlsx: a ZIP of XML parts assembled by hand
 * (src/export/zip.ts + xlsx.ts) from a pure sheet model (build-export.ts).
 * Nothing about that is eyeballable — a file either opens in Excel or throws a
 * "we found a problem with some content" repair dialog, and the difference can
 * be one malformed attribute. So this harness opens the archive it just wrote
 * and reads it back with an independent reader.
 *
 * What it checks, and why each one is here rather than trusted:
 *
 *  E1 ZIP CONTAINER   — local headers, CRCs and the central directory must
 *                       agree. Written by hand; a wrong offset is invisible
 *                       until a reader chokes on it.
 *  E2 PARTS + XML     — every part the OOXML package needs is present, every
 *                       part is well-formed, and every relationship target
 *                       actually exists in the archive. A dangling rId is the
 *                       classic cause of the repair dialog.
 *  E3 CHARTS          — the graphs are the whole point of the ask. Each chart
 *                       part must exist, be declared in [Content_Types], be
 *                       reachable from its sheet through the drawing, and
 *                       point at ranges that match the rows actually written.
 *  E4 HONESTY         — an unlogged day is a blank cell and never a zero; the
 *                       mood distribution divides by logged days; a pending
 *                       prediction has no error score; no population claims.
 *  E5 ESCAPING        — a note containing & < > " ' or a control character
 *                       must not be able to corrupt the workbook. This is the
 *                       one path where user text becomes markup.
 *  E6 DETERMINISM     — same input, byte-identical file.
 *  E7 EMPTY           — a brand-new user gets a valid file, not a crash and not
 *                       a stack of empty sheets.
 *
 * Run: npm run test:export
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildXlsx, safeSheetName, colLetter, esc } from '../src/export/xlsx';
import { crc32, utf8, bytesToBase64, zipSync } from '../src/export/zip';
import {
  buildExportWorkbook,
  countExport,
  exportFileName,
  type ExportInput,
} from '../src/export/build-export';
import { addDays } from '../src/utils/civil-date';

let failures = 0;
let current = '';

function scenario(name: string, fn: () => void): void {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✗ threw: ${(err as Error).message}\x1b[0m`);
  }
}

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${current}")`);
}

// ─── AN INDEPENDENT ZIP READER ───────────────────────────────────────
//
// Reading the archive back with the same code that wrote it would prove
// nothing. This walks the central directory the way any other reader does —
// following each entry's offset into its local header — and re-verifies every
// CRC against the bytes it finds there.

interface ReadEntry {
  path: string;
  text: string;
  crcOk: boolean;
}

function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('no end-of-central-directory record');
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  const out: ReadEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error(`bad central header at ${ptr}`);
    const crc = view.getUint32(ptr + 16, true);
    const size = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const offset = view.getUint32(ptr + 42, true);
    const path = decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    if (view.getUint32(offset, true) !== 0x04034b50)
      throw new Error(`bad local header for ${path}`);
    const lName = view.getUint16(offset + 26, true);
    const lExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + lName + lExtra;
    const data = bytes.subarray(start, start + size);

    out.push({ path, text: decode(data), crcOk: crc32(data) === crc });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function decode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

/** Tags must balance, with no stray markup left open. */
function xmlBalanced(xml: string): boolean {
  const stack: string[] = [];
  const tag = /<\/?([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(xml)) !== null) {
    const raw = m[0]!;
    if (raw.startsWith('<?') || raw.startsWith('<!')) continue;
    const name = m[1]!;
    if (raw.startsWith('</')) {
      if (stack.pop() !== name) return false;
    } else if (m[3] === '/') {
      continue;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

// ─── FIXTURE ─────────────────────────────────────────────────────────

const START = '2026-01-01';
/** 0x0B — legal in a JS string, illegal in XML 1.0. The escaper must drop it. */
const VERTICAL_TAB = String.fromCharCode(11);

function fixture(): ExportInput {
  const cycles = Array.from({ length: 6 }, (_, i) => ({
    startDate: addDays(START, i * 28),
    endDate: addDays(START, i * 28 + 4),
    cycleLength: 27 + (i % 3),
    periodLength: 4 + (i % 2),
    averageFlow: 2 + (i % 3),
  }));
  const periodDays = cycles.flatMap((c) =>
    Array.from({ length: c.periodLength }, (_, d) => ({
      date: addDays(c.startDate, d),
      flowLevel: d === 1 ? 4 : 2,
      phase: 'menstrual',
    }))
  );
  const checkIns = Array.from({ length: 40 }, (_, i) => ({
    date: addDays(START, i),
    // Deliberate holes: days 7..11 were never logged. They must stay blank.
    moodScore: i >= 7 && i <= 11 ? null : (i % 5) + 1,
    energyLevel: i % 4 === 0 ? null : (i % 5) + 1,
    sleepQuality: 3,
    stressLevel: (i % 3) + 1,
    notes: i === 3 ? `Rough day <b>&</b> "tired"${VERTICAL_TAB} — 5 > 3` : null,
  }));
  const symptoms = Array.from({ length: 18 }, (_, i) => ({
    date: addDays(START, i * 2),
    category: 'physical',
    symptomType: ['cramps', 'headache', 'nausea', 'bloating'][i % 4]!,
    severity: (i % 5) + 1,
    phaseAtLog: 'luteal',
  }));
  const predictions = cycles.map((c, i) => ({
    predictedNextPeriod: addDays(c.startDate, 28),
    windowDays: 3,
    confidence: 0.6,
    // The last one hasn't happened yet.
    actualStart: i === cycles.length - 1 ? null : addDays(c.startDate, 28 + (i % 3) - 1),
  }));

  return {
    generatedOn: '2026-09-04',
    appVersion: '0.1.0 (42)',
    profile: {
      displayName: 'Test & Co "user"',
      age: 29,
      averageCycleLength: 28,
      averagePeriodLength: 5,
      conditions: ['pcos'],
    },
    cycles,
    periodDays,
    checkIns,
    symptoms,
    predictions,
  };
}

const INPUT = fixture();
const SPEC = buildExportWorkbook(INPUT);
const BYTES = buildXlsx(SPEC);
const ENTRIES = readZip(BYTES);
const byPath = new Map(ENTRIES.map((e) => [e.path, e]));

// ─── E1 — the container ──────────────────────────────────────────────

scenario('E1 · the archive is a valid ZIP another reader can walk', () => {
  ok('has entries', ENTRIES.length > 0, String(ENTRIES.length));
  ok('every CRC matches the bytes at its local-header offset', ENTRIES.every((e) => e.crcOk));
  ok('starts with a local file header', BYTES[0] === 0x50 && BYTES[1] === 0x4b);
  ok('no duplicate paths', new Set(ENTRIES.map((e) => e.path)).size === ENTRIES.length);
  ok('no leading slashes in paths', ENTRIES.every((e) => !e.path.startsWith('/')));

  ok('crc32("123456789") is the standard 0xCBF43926', crc32(utf8('123456789')) === 0xcbf43926);
  ok(
    'base64 matches Node for multi-byte text',
    bytesToBase64(utf8('Dottie 🌙')) === Buffer.from('Dottie 🌙', 'utf8').toString('base64')
  );
  ok(
    'base64 pads both remainder cases',
    bytesToBase64(utf8('a')) === 'YQ==' && bytesToBase64(utf8('ab')) === 'YWI='
  );
  ok('an empty archive is still a valid ZIP', zipSync([]).length >= 22);
});

// ─── E2 — the OOXML package ──────────────────────────────────────────

scenario('E2 · every part the package needs is present, well-formed and reachable', () => {
  for (const required of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
  ]) {
    ok(`has ${required}`, byPath.has(required));
  }
  ok(
    'every part is well-formed XML',
    ENTRIES.every((e) => xmlBalanced(e.text)),
    ENTRIES.filter((e) => !xmlBalanced(e.text)).map((e) => e.path).join(', ')
  );
  ok('every part declares the XML prolog', ENTRIES.every((e) => e.text.startsWith('<?xml')));

  const dangling: string[] = [];
  for (const entry of ENTRIES) {
    if (!entry.path.endsWith('.rels')) continue;
    const dir = entry.path.replace(/_rels\/[^/]+$/, '');
    for (const m of entry.text.matchAll(/Target="([^"]+)"/g)) {
      const resolved = normalise(dir + m[1]!);
      if (!byPath.has(resolved)) dangling.push(`${entry.path} -> ${m[1]}`);
    }
  }
  ok('no dangling relationship targets', dangling.length === 0, dangling.join(' | '));

  const types = byPath.get('[Content_Types].xml')!.text;
  const undeclared = ENTRIES.filter(
    (e) =>
      e.path !== '[Content_Types].xml' &&
      !e.path.endsWith('.rels') &&
      !types.includes(`PartName="/${e.path}"`)
  ).map((e) => e.path);
  ok('every non-default part is declared in [Content_Types].xml', undeclared.length === 0, undeclared.join(', '));

  const workbook = byPath.get('xl/workbook.xml')!.text;
  const declared = [...workbook.matchAll(/<sheet /g)].length;
  const sheetParts = ENTRIES.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.path)).length;
  ok('declared sheets match sheet parts', declared === sheetParts, `${declared} vs ${sheetParts}`);
  ok('the workbook has the sheets we asked for', declared === SPEC.sheets.length);
  ok(
    'every sheet freezes its header row',
    ENTRIES.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.path)).every((e) =>
      e.text.includes('state="frozen"')
    )
  );
});

// ─── E3 — the charts ─────────────────────────────────────────────────

scenario('E3 · the graphs are really in the file, wired to the right cells', () => {
  const charts = ENTRIES.filter((e) => e.path.startsWith('xl/charts/'));
  ok('chart parts exist', charts.length >= 6, String(charts.length));
  ok('each chart names a series', charts.every((c) => c.text.includes('<c:ser>')));
  ok(
    'each chart has both axes',
    charts.every((c) => c.text.includes('<c:catAx>') && c.text.includes('<c:valAx>'))
  );
  ok('each chart has a title', charts.every((c) => c.text.includes('<c:title>')));

  const axisIds = charts.map((c) => [...c.text.matchAll(/<c:axId val="(\d+)"\/>/g)].map((m) => m[1]!));
  ok('each chart uses exactly two distinct axis ids', axisIds.every((ids) => new Set(ids).size === 2));
  const seen = new Set<string>();
  let shared = false;
  for (const ids of axisIds) {
    for (const id of new Set(ids)) {
      if (seen.has(id)) shared = true;
      seen.add(id);
    }
  }
  ok('no two charts share an axis id', !shared);

  const cyclesChart = charts.find((c) => c.text.includes('Cycle length over time'));
  ok('the cycle chart exists', cyclesChart !== undefined);
  // Sheet names in a formula are quoted, and the writer escapes those quotes as
  // &apos; — correct XML, so the assertion reads the decoded text.
  const cyclesFormulas = decodeEntities(cyclesChart!.text);
  ok(
    'its category range ends at the last data row',
    cyclesFormulas.includes(`'Cycles'!$A$2:$A$${INPUT.cycles.length + 1}`),
    cyclesFormulas.match(/\$A\$2:\$A\$\d+/)?.[0]
  );
  ok('its series name points at the header cell', cyclesFormulas.includes(`'Cycles'!$C$1`));
  ok('the apostrophes around the sheet name are escaped in the raw XML', cyclesChart!.text.includes('&apos;Cycles&apos;!'));
  ok(
    'blanks are drawn as gaps, never as zeros',
    charts.every((c) => c.text.includes('<c:dispBlanksAs val="gap"/>'))
  );

  const multi = charts.find((c) => c.text.includes('Mood, energy, sleep and stress'));
  ok(
    'the four-series check-in chart has four series',
    multi !== undefined && [...multi.text.matchAll(/<c:ser>/g)].length === 4
  );
  ok('and it gets a legend, since one is needed to tell them apart', multi!.text.includes('<c:legend>'));

  const drawings = ENTRIES.filter((e) => /^xl\/drawings\/drawing\d+\.xml$/.test(e.path));
  ok('drawings exist', drawings.length > 0);
  const sheetsWithDrawing = ENTRIES.filter(
    (e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.path) && e.text.includes('<drawing r:id=')
  ).length;
  ok('every drawing is claimed by a sheet', sheetsWithDrawing === drawings.length, `${sheetsWithDrawing} vs ${drawings.length}`);
  const anchors = drawings.reduce((n, d) => n + [...d.text.matchAll(/<xdr:twoCellAnchor/g)].length, 0);
  ok('every chart part is anchored exactly once', anchors === charts.length, `${anchors} anchors vs ${charts.length} charts`);

  const thin = buildXlsx({
    sheets: [
      {
        name: 'Thin',
        columns: [{ header: 'a' }, { header: 'b' }],
        rows: [['x', 1]],
        charts: [{ kind: 'bar', title: 't', categoryCol: 1, valueCols: [2], anchor: { col: 3, row: 1 } }],
      },
    ],
  });
  const thinParts = readZip(thin);
  ok('a one-row sheet gets no chart', !thinParts.some((e) => e.path.startsWith('xl/charts/')));
  ok('and no orphan drawing either', !thinParts.some((e) => e.path.startsWith('xl/drawings/')));
});

// ─── E4 — honesty ────────────────────────────────────────────────────

scenario('E4 · the file keeps the promises the app makes', () => {
  const checkIns = byPath.get(sheetPathFor('Daily check-ins'))!.text;
  // Day index 8 (2026-01-09) was never logged — sheet row 10.
  const row10 = checkIns.match(/<row r="10">.*?<\/row>/)?.[0] ?? '';
  ok('an unlogged mood is an empty cell', /<c r="B10"\/>/.test(row10), row10.slice(0, 160));
  ok('and is definitely not a zero', !/<c r="B10"[^/]*><v>0<\/v>/.test(row10));

  const dist = byPath.get(sheetPathFor('Mood dynamics'))!.text;
  const loggedMoods = INPUT.checkIns.filter((c) => c.moodScore !== null).length;
  ok(
    'the distribution states its denominator',
    dist.includes('Days logged') && dist.includes(`<v>${loggedMoods}</v>`),
    String(loggedMoods)
  );
  ok('the denominator is logged days, not calendar days', loggedMoods !== INPUT.checkIns.length);

  const preds = byPath.get(sheetPathFor('Predictions'))!.text;
  const lastRow = preds.match(new RegExp(`<row r="${INPUT.predictions.length + 1}">.*?</row>`))?.[0] ?? '';
  ok(
    'a prediction with no outcome yet has no error score',
    /<c r="E\d+"\/>/.test(lastRow) && /<c r="F\d+"\/>/.test(lastRow),
    lastRow.slice(0, 200)
  );

  const overview = byPath.get(sheetPathFor('Overview'))!.text;
  ok(
    'every derived figure carries its sample size',
    overview.includes('based on this many cycles') && overview.includes('based on this many logged days')
  );
  ok('the file says blanks are not zeros', overview.includes('It does not mean zero'));
  ok('the file says it is not medical advice', overview.includes('not a diagnosis'));
  ok('the file says where it was made', overview.includes('built on your phone'));

  const allText = ENTRIES.map((e) => e.text).join(' ');
  ok('no population statistic anywhere in the workbook', !/\d+\s*%\s*of (people|users|women)/i.test(allText));
  ok('no "others like you" claim', !/others like you|people like you/i.test(allText));
});

// ─── E5 — escaping ───────────────────────────────────────────────────

scenario('E5 · user text can never break the workbook', () => {
  ok('ampersand escaped', esc('a & b') === 'a &amp; b');
  ok('angle brackets escaped', esc('<b>') === '&lt;b&gt;');
  ok('quotes escaped', esc(`"x" 'y'`) === '&quot;x&quot; &apos;y&apos;');
  ok('illegal control characters dropped', esc(`ab${VERTICAL_TAB}c`) === 'abc');
  ok('tabs and newlines survive', esc('a\tb\nc') === 'a\tb\nc');

  const checkIns = byPath.get(sheetPathFor('Daily check-ins'))!.text;
  ok('the note with markup in it is escaped in the sheet', checkIns.includes('Rough day &lt;b&gt;&amp;&lt;/b&gt;'));
  ok('and did not leave a raw tag behind', !checkIns.includes('<b>&</b>'));
  ok('the illegal character never reached the file', !checkIns.includes(VERTICAL_TAB));
  ok(
    "the profile name's quotes survive escaping",
    byPath.get(sheetPathFor('Overview'))!.text.includes('Test &amp; Co &quot;user&quot;')
  );

  const nasty = buildXlsx({
    sheets: [{ name: 'N', columns: [{ header: 'x' }], rows: [['</is></c></row></sheetData><evil/>']] }],
  });
  const read = readZip(nasty);
  ok('an injected closing tag cannot break the sheet', read.every((e) => xmlBalanced(e.text)));
  ok('and never appears as real markup', !read.some((e) => e.text.includes('<evil/>')));

  ok('sheet names are stripped of characters Excel forbids', safeSheetName('a/b:c[d]') === 'a b c d');
  ok('and truncated to 31 characters', safeSheetName('x'.repeat(60)).length === 31);
  ok('and never empty', safeSheetName('///') === 'Sheet');
  ok('column letters carry past Z', colLetter(1) === 'A' && colLetter(26) === 'Z' && colLetter(27) === 'AA');

  const weird = buildXlsx({
    sheets: [{ name: 'W', columns: [{ header: 'n' }], rows: [[NaN], [Infinity], [0]] }],
  });
  const weirdSheet = readZip(weird).find((e) => e.path === 'xl/worksheets/sheet1.xml')!.text;
  ok('NaN never reaches the file as a literal', !weirdSheet.includes('NaN') && !weirdSheet.includes('Infinity'));
  ok('but a real zero still does', weirdSheet.includes('<v>0</v>'));
});

// ─── E6 — determinism ────────────────────────────────────────────────

scenario('E6 · the same data always produces the same file', () => {
  const again = buildXlsx(buildExportWorkbook(fixture()));
  ok('same byte length', again.length === BYTES.length, `${again.length} vs ${BYTES.length}`);
  let diff = -1;
  for (let i = 0; i < again.length; i++) {
    if (again[i] !== BYTES[i]) {
      diff = i;
      break;
    }
  }
  ok('byte-identical', diff === -1, `first difference at ${diff}`);
  ok('the filename is derived from the date', exportFileName('2026-09-04') === 'dottie-export-2026-09-04.xlsx');
  ok('a malformed date does not produce a malformed filename', exportFileName('nonsense') === 'dottie-export-export.xlsx');
});

// ─── E7 — the brand-new user ─────────────────────────────────────────

scenario('E7 · a user who has logged nothing still gets a real file', () => {
  const empty: ExportInput = {
    generatedOn: '2026-09-04',
    appVersion: '0.1.0',
    profile: { displayName: null, age: null, averageCycleLength: null, averagePeriodLength: null, conditions: [] },
    cycles: [],
    periodDays: [],
    checkIns: [],
    symptoms: [],
    predictions: [],
  };
  const spec = buildExportWorkbook(empty);
  ok('exactly one sheet — no empty shells', spec.sheets.length === 1, spec.sheets.map((s) => s.name).join(', '));
  ok('and it is the Overview', spec.sheets[0]!.name === 'Overview');

  const read = readZip(buildXlsx(spec));
  ok('the archive is still valid', read.every((e) => e.crcOk) && read.every((e) => xmlBalanced(e.text)));
  ok('no charts over no data', !read.some((e) => e.path.startsWith('xl/charts/')));
  const overview = read.find((e) => e.path === 'xl/worksheets/sheet1.xml')!.text;
  ok('the counts read zero rather than being missing', overview.includes('Cycles recorded'));
  ok('averages read as a dash, not NaN', !overview.includes('NaN'));

  ok('counts are all zero', countExport(empty).total === 0);
  ok(
    'counts add up on the fixture',
    countExport(INPUT).total ===
      INPUT.cycles.length +
        INPUT.periodDays.length +
        INPUT.checkIns.length +
        INPUT.symptoms.length +
        INPUT.predictions.length
  );
});

// ─── E8 — the export must never be able to break app launch ──────────

scenario('E8 · no native module is imported at boot because of the export', () => {
  // expo-router builds its route tree by requiring EVERY file under app/ at
  // startup. expo-file-system and expo-sharing both call requireNativeModule()
  // at module scope, so a static import anywhere in that graph runs native
  // lookup during launch — and throws before React renders if it fails, which
  // is an unrecoverable white screen with no message (device-test-15).
  const service = readFileSync(join(process.cwd(), 'src/services/data-export.ts'), 'utf8');
  const screen = readFileSync(join(process.cwd(), 'app/(profile)/export-data.tsx'), 'utf8');

  const staticImport = /^\s*import\s+[^;]*from\s+'expo-(file-system|sharing)'/m;
  ok('the service does not statically import expo-file-system / expo-sharing', !staticImport.test(service));
  ok('nor does the screen', !staticImport.test(screen));
  ok('it loads them lazily instead', /require\('expo-file-system'\)/.test(service) && /require\('expo-sharing'\)/.test(service));
  ok('and only inside functions, never at module scope', !/^const .*= require\('expo-/m.test(service));

  // The pure builder must stay free of them entirely — it is what the harness
  // exercises, and what makes the workbook testable without a device. (Matches
  // imports and requires only; the files are allowed to MENTION the modules in
  // a comment explaining why they don't use them.)
  const anyLoad = /(?:^\s*import\s+[^;]*from\s+'expo-(?:file-system|sharing)')|(?:require\('expo-(?:file-system|sharing)'\))/m;
  for (const f of ['src/export/xlsx.ts', 'src/export/zip.ts', 'src/export/build-export.ts']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    ok(`${f} loads no native module`, !anyLoad.test(src));
  }
});

// ─── helpers ─────────────────────────────────────────────────────────

function sheetPathFor(name: string): string {
  const idx = SPEC.sheets.findIndex((s) => s.name === name);
  if (idx < 0) throw new Error(`no sheet named ${name}`);
  return `xl/worksheets/sheet${idx + 1}.xml`;
}

function decodeEntities(xml: string): string {
  return xml
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalise(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

console.log(
  failures === 0
    ? `\n\x1b[32m✓ data export: valid, honest and reproducible (${BYTES.length} bytes, ${ENTRIES.length} parts)\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} failure(s)\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
