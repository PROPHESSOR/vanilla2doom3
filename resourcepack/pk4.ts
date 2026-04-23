export interface Pk4Entry {
  path: string;
  data: Uint8Array | string;
}

const textEncoder = new TextEncoder();

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === 'string' ? textEncoder.encode(data) : data;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function append(out: number[], data: Uint8Array) {
  for (const byte of data) out.push(byte);
}

/** Build a Doom 3 pk4 file. A pk4 is a ZIP archive; entries are stored uncompressed. */
export function createPk4(entries: Pk4Entry[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];

  for (const entry of entries) {
    const path = entry.path.replace(/\\/g, '/');
    const name = textEncoder.encode(path);
    const data = toBytes(entry.data);
    const crc = crc32(data);
    const localHeaderOffset = out.length;

    writeU32(out, 0x04034b50);
    writeU16(out, 20);
    writeU16(out, 0x0800);
    writeU16(out, 0);
    writeU16(out, 0);
    writeU16(out, 0);
    writeU32(out, crc);
    writeU32(out, data.length);
    writeU32(out, data.length);
    writeU16(out, name.length);
    writeU16(out, 0);
    append(out, name);
    append(out, data);

    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, crc);
    writeU32(central, data.length);
    writeU32(central, data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, localHeaderOffset);
    append(central, name);
  }

  const centralOffset = out.length;
  out.push(...central);

  writeU32(out, 0x06054b50);
  writeU16(out, 0);
  writeU16(out, 0);
  writeU16(out, entries.length);
  writeU16(out, entries.length);
  writeU32(out, central.length);
  writeU32(out, centralOffset);
  writeU16(out, 0);

  return new Uint8Array(out);
}
