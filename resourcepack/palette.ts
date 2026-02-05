import { findLump, readLump, type WadFile } from './wad.ts';

/** First palette from PLAYPAL: 256 entries × 3 bytes (R, G, B). */
export type Palette = Uint8Array;

/** Extract the first 256-color palette from PLAYPAL. */
export function parsePalette(wad: WadFile): Palette {
  const lump = findLump(wad, 'PLAYPAL');
  if (!lump) throw new Error('PLAYPAL lump not found');

  const buf = readLump(wad, lump);
  const palette = new Uint8Array(768);
  for (let i = 0; i < 768; i++) {
    palette[i] = buf.readUInt8();
  }
  return palette;
}

/** Look up RGB for a palette index. */
export function paletteRGB(
  palette: Palette,
  index: number,
): [r: number, g: number, b: number] {
  const off = index * 3;
  return [palette[off], palette[off + 1], palette[off + 2]];
}
