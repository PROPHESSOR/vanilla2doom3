import { TRANSPARENT, type ImageBuffer } from './types.ts';
import type { TextureDef } from './texture_defs.ts';
import type { PatchCache } from './patch.ts';

/**
 * Composite a wall texture from its patch definitions.
 *
 * Allocates a width×height buffer, then blits each patch at its origin.
 * Transparent pixels in patches are skipped so earlier patches show through.
 */
export function compositeTexture(
  def: TextureDef,
  pnames: string[],
  patchCache: PatchCache,
): ImageBuffer {
  const { width, height, patches } = def;
  const pixels = new Uint16Array(width * height);
  pixels.fill(TRANSPARENT);

  for (const tp of patches) {
    const patchName = pnames[tp.patchIndex];
    if (!patchName) {
      console.warn(`Texture "${def.name}": invalid patch index ${tp.patchIndex}`);
      continue;
    }

    const patch = patchCache.get(patchName);
    if (!patch) continue;

    for (let py = 0; py < patch.height; py++) {
      const destY = tp.originY + py;
      if (destY < 0 || destY >= height) continue;

      for (let px = 0; px < patch.width; px++) {
        const destX = tp.originX + px;
        if (destX < 0 || destX >= width) continue;

        const srcPixel = patch.pixels[py * patch.width + px]!;
        if (srcPixel === TRANSPARENT) continue;

        pixels[destY * width + destX] = srcPixel;
      }
    }
  }

  return { width, height, pixels };
}
