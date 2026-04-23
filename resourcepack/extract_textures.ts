#!/usr/bin/env -S deno run --allow-read --allow-write

import { join } from 'node:path';

import { parseWadData } from './wad.ts';
import { parsePalette } from './palette.ts';
import { parsePnames, parseTextureDefs } from './texture_defs.ts';
import { PatchCache } from './patch.ts';
import { compositeTexture } from './composite.ts';
import { extractFlats } from './flats.ts';
import { writeTga } from './tga.ts';
import { generateMaterialFile } from './materials.ts';
import { hasTransparency } from './types.ts';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): never {
  console.error(
    'Usage: deno run --allow-read --allow-write extract_textures.ts <wad> [--out=./out] [--prefix=doom1]',
  );
  Deno.exit(1);
}

interface Args {
  wadPath: string;
  outDir: string;
  prefix: string;
}

function parseArgs(args: string[]): Args {
  let wadPath = '';
  let outDir = 'output';
  let prefix = 'v2d3';

  for (const arg of args) {
    if (arg.startsWith('--out=')) {
      outDir = arg.slice(6);
    } else if (arg.startsWith('--prefix=')) {
      prefix = arg.slice(9);
    } else if (!arg.startsWith('-')) {
      wadPath = arg;
    }
  }

  if (!wadPath) usage();
  return { wadPath, outDir, prefix };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { wadPath, outDir, prefix } = parseArgs(Deno.args);

  // 1. Load WAD
  console.log(`Loading WAD: ${wadPath}`);
  const wad = parseWadData(await Deno.readFile(wadPath));

  // 2. Palette
  const palette = parsePalette(wad);
  console.log('Parsed PLAYPAL');

  // 3. PNAMES + texture definitions
  const pnames = parsePnames(wad);
  console.log(`Parsed ${pnames.length} patch names`);

  const textureDefs = parseTextureDefs(wad);
  console.log(`Parsed ${textureDefs.length} texture definitions`);

  // 4. Patch cache for compositing
  const patchCache = new PatchCache(wad);

  // 5. Prepare output directories
  const textureDir = join(outDir, 'textures', prefix);
  const materialDir = join(outDir, 'materials');
  await Deno.mkdir(textureDir, { recursive: true });
  await Deno.mkdir(materialDir, { recursive: true });

  const allNames: string[] = [];
  const transparentNames = new Set<string>();

  // 6. Composite wall textures → TGA
  console.log('Compositing wall textures...');
  for (const def of textureDefs) {
    const image = compositeTexture(def, pnames, patchCache);
    const alpha = hasTransparency(image);
    if (alpha) transparentNames.add(def.name);
    const tgaPath = join(textureDir, `${def.name}.tga`);
    await writeTga(tgaPath, image, palette, alpha);
    allNames.push(def.name);
  }
  console.log(`Wrote ${textureDefs.length} wall textures (${transparentNames.size} with alpha)`);

  // 7. Extract flats → TGA (always fully opaque, no alpha)
  console.log('Extracting flats...');
  const flats = extractFlats(wad);
  for (const flat of flats) {
    const tgaPath = join(textureDir, `${flat.name}.tga`);
    await writeTga(tgaPath, flat.image, palette, false);
    allNames.push(flat.name);
  }
  console.log(`Wrote ${flats.length} flats`);

  // 8. Doom 3 material file
  const mtrContent = generateMaterialFile(prefix, allNames, transparentNames);
  const mtrPath = join(materialDir, `${prefix}.mtr`);
  await Deno.writeTextFile(mtrPath, mtrContent);
  console.log(`Wrote material file: ${mtrPath}`);

  console.log(`Done! ${allNames.length} textures extracted to ${outDir}`);
}

main();
