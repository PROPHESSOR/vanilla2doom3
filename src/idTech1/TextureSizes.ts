// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { WadParser } from './WadParser';

export type TextureSizeMap = Map<string, { width: number; height: number }>;

/**
 * Parse TEXTURE1 and TEXTURE2 lumps from a WAD to build a name → dimensions
 * lookup for wall textures. Flats are always 64×64 and not included.
 */
export function parseTextureSizes(wad: WadParser): TextureSizeMap {
  const sizes: TextureSizeMap = new Map();

  for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
    const lumps = wad.getLumpsByName(lumpName);
    if (!lumps.length) continue;

    const buf = lumps[0]!.read();

    const numTextures = buf.readUInt32();

    // Read offset table
    const offsets: number[] = [];
    for (let i = 0; i < numTextures; i++) {
      offsets.push(buf.readUInt32());
    }

    // Read each maptexture_t header for name, width, height
    for (const offset of offsets) {
      buf.seek(offset, 'START');

      const name = buf.readString(8).toUpperCase();
      buf.skipInt32(); // masked
      const width = buf.readUInt16();
      const height = buf.readUInt16();

      if (!sizes.has(name)) {
        sizes.set(name, { width, height });
      }
    }
  }

  return sizes;
}
