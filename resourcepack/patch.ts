import ByteTools from '../src/idTech1/utils/ByteTools.ts';
import { TRANSPARENT } from './types.ts';
import { readLump, type Lump, type WadFile } from './wad.ts';

/** A decoded Doom picture (patch). */
export interface DecodedPatch {
  width: number;
  height: number;
  leftOffset: number;
  topOffset: number;
  /** Palette indices; TRANSPARENT (0xFFFF) = no pixel. */
  pixels: Uint16Array;
}

/**
 * Decode a Doom picture-format lump into an indexed-color buffer.
 *
 * Format per column: sequence of "posts" terminated by 0xFF.
 * Each post: topdelta(u8) length(u8) pad(u8) data[length](u8) pad(u8).
 * Tall-patch extension: if topdelta <= previous, accumulate offset.
 */
export function decodePatch(buf: ByteTools): DecodedPatch {
  const width = buf.readUInt16();
  const height = buf.readUInt16();
  const leftOffset = buf.readInt16();
  const topOffset = buf.readInt16();

  // Column offset table
  const columnOffsets: number[] = [];
  for (let c = 0; c < width; c++) {
    columnOffsets.push(buf.readUInt32());
  }

  const pixels = new Uint16Array(width * height);
  pixels.fill(TRANSPARENT);

  for (let col = 0; col < width; col++) {
    buf.seek(columnOffsets[col]!, 'START');

    let prevDelta = -1;

    while (true) {
      const topDelta = buf.readUInt8();
      if (topDelta === 0xff) break;

      // Tall-patch support
      let rowStart: number;
      if (prevDelta >= 0 && topDelta <= prevDelta) {
        rowStart = prevDelta + topDelta;
      } else {
        rowStart = topDelta;
      }
      prevDelta = rowStart;

      const length = buf.readUInt8();
      buf.skipInt8(); // padding

      for (let j = 0; j < length; j++) {
        const row = rowStart + j;
        const px = buf.readUInt8();
        if (row >= 0 && row < height) {
          pixels[row * width + col] = px;
        }
      }

      buf.skipInt8(); // padding
    }
  }

  return { width, height, leftOffset, topOffset, pixels };
}

/**
 * Lazily decodes and caches patches by name.
 * Looks up patch lumps in the WAD by name on first access.
 */
export class PatchCache {
  private cache = new Map<string, DecodedPatch | null>();
  private lumpMap = new Map<string, Lump>();

  constructor(private wad: WadFile) {
    // Build name → first matching lump lookup
    for (const lump of wad.lumps) {
      const upper = lump.name.toUpperCase();
      if (!this.lumpMap.has(upper)) {
        this.lumpMap.set(upper, lump);
      }
    }
  }

  get(name: string): DecodedPatch | null {
    const key = name.toUpperCase();
    if (this.cache.has(key)) return this.cache.get(key)!;

    const lump = this.lumpMap.get(key);
    if (!lump || lump.size === 0) {
      console.warn(`Patch lump "${name}" not found`);
      this.cache.set(key, null);
      return null;
    }

    try {
      const buf = readLump(this.wad, lump);
      const decoded = decodePatch(buf);
      this.cache.set(key, decoded);
      return decoded;
    } catch (e) {
      console.warn(`Failed to decode patch "${name}": ${e}`);
      this.cache.set(key, null);
      return null;
    }
  }
}
