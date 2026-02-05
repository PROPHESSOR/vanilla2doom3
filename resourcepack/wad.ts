import ByteTools from '../src/idTech1/utils/ByteTools.ts';

/** Minimal lump descriptor with position and size inside the WAD. */
export interface Lump {
  pos: number;
  size: number;
  name: string;
  index: number;
}

/** Parsed WAD file: header info + full lump directory + raw buffer. */
export interface WadFile {
  type: string;
  lumps: Lump[];
  buffer: ByteTools;
}

/** Read and parse a WAD file from disk. */
export async function loadWad(path: string): Promise<WadFile> {
  const raw = await Deno.readFile(path);
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const buffer = new ByteTools(new DataView(ab));

  const type = buffer.readString(4);
  if (!['IWAD', 'PWAD'].includes(type)) {
    throw new Error('Not a WAD file!');
  }

  const numLumps = buffer.readUInt32();
  const dirTableOffset = buffer.readUInt32();

  buffer.seek(dirTableOffset, 'START');

  const lumps: Lump[] = [];
  for (let i = 0; i < numLumps; i++) {
    const pos = buffer.readUInt32();
    const size = buffer.readUInt32();
    const name = buffer.readString(8);
    lumps.push({ pos, size, name, index: i });
  }

  console.log(`Loaded ${type} with ${lumps.length} lumps`);
  return { type, lumps, buffer };
}

/** Find the first lump with the given name (case-sensitive). */
export function findLump(wad: WadFile, name: string): Lump | undefined {
  return wad.lumps.find((l) => l.name === name);
}

/** Find all lumps with the given name (case-sensitive). */
export function findLumps(wad: WadFile, name: string): Lump[] {
  return wad.lumps.filter((l) => l.name === name);
}

/** Slice out a lump's raw data and wrap it in ByteTools for reading. */
export function readLump(wad: WadFile, lump: Lump): ByteTools {
  const ab = wad.buffer.buffer.buffer as ArrayBuffer;
  return new ByteTools(new DataView(ab.slice(lump.pos, lump.pos + lump.size)));
}
