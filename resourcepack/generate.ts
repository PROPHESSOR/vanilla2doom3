import { compositeTexture } from './composite.ts';
import { extractFlats } from './flats.ts';
import { generateMaterialFile } from './materials.ts';
import { PatchCache } from './patch.ts';
import { parsePalette } from './palette.ts';
import { createPk4, type Pk4Entry } from './pk4.ts';
import { encodeTga } from './tga.ts';
import { hasTransparency } from './types.ts';
import { parsePnames, parseTextureDefs } from './texture_defs.ts';
import { parseWadData } from './wad.ts';

export interface ResourcepackResult {
  data: Uint8Array;
  textureCount: number;
  flatCount: number;
  transparentCount: number;
}

export function generateResourcepackPk4(
  wadData: ArrayBuffer | Uint8Array,
  prefix = 'v2d3',
): ResourcepackResult {
  const wad = parseWadData(wadData);
  const palette = parsePalette(wad);
  const pnames = parsePnames(wad);
  const textureDefs = parseTextureDefs(wad);
  const patchCache = new PatchCache(wad);
  const entries: Pk4Entry[] = [];
  const allNames: string[] = [];
  const transparentNames = new Set<string>();

  for (const def of textureDefs) {
    const image = compositeTexture(def, pnames, patchCache);
    const alpha = hasTransparency(image);
    if (alpha) transparentNames.add(def.name);
    entries.push({
      path: `textures/${prefix}/${def.name}.tga`,
      data: encodeTga(image, palette, alpha),
    });
    allNames.push(def.name);
  }

  const flats = extractFlats(wad);
  for (const flat of flats) {
    entries.push({
      path: `textures/${prefix}/${flat.name}.tga`,
      data: encodeTga(flat.image, palette, false),
    });
    allNames.push(flat.name);
  }

  entries.push({
    path: `materials/${prefix}.mtr`,
    data: generateMaterialFile(prefix, allNames, transparentNames),
  });

  return {
    data: createPk4(entries),
    textureCount: textureDefs.length,
    flatCount: flats.length,
    transparentCount: transparentNames.size,
  };
}
