import type { ImageBuffer } from './types.ts';
import type { WadFile } from './wad.ts';

export interface FlatImage {
  name: string;
  image: ImageBuffer;
}

/**
 * Extract all flats (floor/ceiling textures) from the WAD.
 *
 * Flats live between F_START/F_END (and optionally FF_START/FF_END) markers.
 * Each flat is a raw 64×64 block of palette indices (4096 bytes).
 */
export function extractFlats(wad: WadFile): FlatImage[] {
  const flats: FlatImage[] = [];

  // Collect marker ranges
  const ranges: [number, number][] = [];
  for (const [startName, endName] of [
    ['F_START', 'F_END'],
    ['FF_START', 'FF_END'],
  ]) {
    const startIdx = wad.lumps.findIndex((l) => l.name === startName);
    const endIdx = wad.lumps.findIndex((l) => l.name === endName);
    if (startIdx >= 0 && endIdx > startIdx) {
      ranges.push([startIdx, endIdx]);
    }
  }

  if (ranges.length === 0) {
    console.warn('No flat markers (F_START/F_END or FF_START/FF_END) found');
    return flats;
  }

  const seen = new Set<string>();
  const wadAB = wad.buffer.buffer.buffer as ArrayBuffer;

  for (const [startIdx, endIdx] of ranges) {
    for (let i = startIdx + 1; i < endIdx; i++) {
      const lump = wad.lumps[i];
      if (lump.size !== 4096) continue;

      const name = lump.name.toUpperCase();
      if (seen.has(name)) continue;
      seen.add(name);

      const raw = new Uint8Array(wadAB.slice(lump.pos, lump.pos + 4096));
      const pixels = new Uint16Array(4096);
      for (let j = 0; j < 4096; j++) {
        pixels[j] = raw[j];
      }

      flats.push({ name, image: { width: 64, height: 64, pixels } });
    }
  }

  console.log(`Extracted ${flats.length} flats`);
  return flats;
}
