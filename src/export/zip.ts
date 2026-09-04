/**
 * Dottie — minimal ZIP writer (pure, no dependencies)
 *
 * An .xlsx file IS a ZIP archive of XML parts. To hand the user a real
 * spreadsheet we need to produce one on the phone, and every JS zip library
 * worth using pulls in a compression codec (pako) plus Node stream shims that
 * do not belong in a React Native bundle for a once-a-month export.
 *
 * ─── WHY STORE-ONLY (no compression) ────────────────────────────────
 *
 *  ZIP method 0 — "stored" — means the bytes go in verbatim. That skips DEFLATE
 *  entirely, which is the only genuinely hard part of writing a ZIP, and every
 *  reader (Excel, Numbers, Google Sheets, LibreOffice, the Android and iOS
 *  share sheets) accepts it: the format has supported stored entries since
 *  1989. The cost is size. A year of one person's cycle data is a few hundred
 *  kilobytes of XML — a rounding error against a single photo — so paying it
 *  buys us a dependency-free, auditable, ~130-line writer instead of a codec.
 *
 * ─── DETERMINISM ────────────────────────────────────────────────────
 *
 *  Every field that could vary — timestamps in particular — is fixed. Two
 *  exports of the same data produce byte-identical archives, which is what
 *  makes the export harness able to assert on the output at all.
 */

export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  path: string;
  /** File contents. */
  data: Uint8Array;
}

// A fixed DOS timestamp (1980-01-01 00:00) — see DETERMINISM above.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

// ─── CRC-32 ──────────────────────────────────────────────────────────

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ─── UTF-8 ───────────────────────────────────────────────────────────

/**
 * Encode without TextEncoder. Hermes has it, but the export also runs under the
 * Node harness and older RN engines, and this is 20 lines.
 */
export function utf8(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    // Surrogate pair → single code point (emoji in a note, for instance).
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000)
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
  }
  return new Uint8Array(out);
}

// ─── Writer ──────────────────────────────────────────────────────────

class ByteWriter {
  private buf: number[] = [];
  get length(): number {
    return this.buf.length;
  }
  u8(v: number): void {
    this.buf.push(v & 0xff);
  }
  u16(v: number): void {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff);
  }
  u32(v: number): void {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  }
  bytes(b: Uint8Array): void {
    for (let i = 0; i < b.length; i++) this.buf.push(b[i]!);
  }
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

/** Build a ZIP archive from entries. Store-only, deterministic. */
export function zipSync(entries: readonly ZipEntry[]): Uint8Array {
  const out = new ByteWriter();
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const name = utf8(entry.path);
    const crc = crc32(entry.data);
    const offset = out.length;

    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(0x0800); // flags: UTF-8 names
    out.u16(0); // method: stored
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(crc);
    out.u32(entry.data.length);
    out.u32(entry.data.length);
    out.u16(name.length);
    out.u16(0); // extra length
    out.bytes(name);
    out.bytes(entry.data);

    central.push({ name, crc, size: entry.data.length, offset });
  }

  const centralStart = out.length;
  for (const e of central) {
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(e.crc);
    out.u32(e.size);
    out.u32(e.size);
    out.u16(e.name.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number
    out.u16(0); // internal attrs
    out.u32(0); // external attrs
    out.u32(e.offset);
    out.bytes(e.name);
  }
  const centralSize = out.length - centralStart;

  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0); // comment length

  return out.toUint8Array();
}

// ─── Base64 ──────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Bytes → base64. expo-file-system writes binary only via a base64 string, and
 * React Native has no Buffer, so the encoder lives here.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + '==';
  } else if (rem === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + '=';
  }
  return out;
}
