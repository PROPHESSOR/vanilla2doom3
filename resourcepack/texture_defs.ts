import ByteTools from '../src/idTech1/utils/ByteTools.ts';
import { findLump, readLump, type WadFile } from './wad.ts';

/** One patch placement inside a composite texture. */
export interface TexturePatch {
  originX: number;
  originY: number;
  /** Index into the PNAMES array. */
  patchIndex: number;
}

/** A composite wall texture definition from TEXTURE1/TEXTURE2. */
export interface TextureDef {
  name: string;
  width: number;
  height: number;
  patches: TexturePatch[];
}

// ---------------------------------------------------------------------------
// PNAMES
// ---------------------------------------------------------------------------

/** Parse the PNAMES lump: list of patch lump names used by TEXTURE1/2. */
export function parsePnames(wad: WadFile): string[] {
  const lump = findLump(wad, 'PNAMES');
  if (!lump) throw new Error('PNAMES lump not found');

  const buf = readLump(wad, lump);
  const count = buf.readUInt32();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(buf.readString(8).toUpperCase());
  }
  return names;
}

// ---------------------------------------------------------------------------
// TEXTURE1 / TEXTURE2
// ---------------------------------------------------------------------------

function parseTextureLump(buf: ByteTools): TextureDef[] {
  const numTextures = buf.readUInt32();

  const offsets: number[] = [];
  for (let i = 0; i < numTextures; i++) {
    offsets.push(buf.readUInt32());
  }

  const defs: TextureDef[] = [];
  for (const offset of offsets) {
    buf.seek(offset, 'START');

    const name = buf.readString(8).toUpperCase();
    buf.skipInt32(); // masked
    const width = buf.readUInt16();
    const height = buf.readUInt16();
    buf.skipInt32(); // columndirectory (obsolete)
    const patchCount = buf.readUInt16();

    const patches: TexturePatch[] = [];
    for (let p = 0; p < patchCount; p++) {
      const originX = buf.readInt16();
      const originY = buf.readInt16();
      const patchIndex = buf.readUInt16();
      buf.skipInt16(); // stepdir  (unused)
      buf.skipInt16(); // colormap (unused)
      patches.push({ originX, originY, patchIndex });
    }

    defs.push({ name, width, height, patches });
  }

  return defs;
}

/** Parse TEXTURE1 and (optional) TEXTURE2 into texture definitions. */
export function parseTextureDefs(wad: WadFile): TextureDef[] {
  const defs: TextureDef[] = [];

  for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
    const lump = findLump(wad, lumpName);
    if (!lump) continue;
    defs.push(...parseTextureLump(readLump(wad, lump)));
  }

  if (defs.length === 0) {
    throw new Error('No TEXTURE1 or TEXTURE2 lumps found');
  }
  return defs;
}
