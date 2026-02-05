import { TRANSPARENT, type ImageBuffer } from './types.ts';
import { paletteRGB, type Palette } from './palette.ts';

/**
 * Encode an indexed-color ImageBuffer into an uncompressed 24-bit TGA (type 2).
 * No alpha channel — fully opaque. Use for the majority of textures.
 *
 * TGA pixel order: bottom-to-top rows, BGR byte order.
 */
function encodeTga24(image: ImageBuffer, palette: Palette): Uint8Array {
  const { width, height, pixels } = image;
  const HEADER_SIZE = 18;
  const dataSize = width * height * 3;
  const tga = new Uint8Array(HEADER_SIZE + dataSize);

  tga[0] = 0; // ID length
  tga[1] = 0; // no color map
  tga[2] = 2; // uncompressed true-color
  tga[12] = width & 0xff;
  tga[13] = (width >> 8) & 0xff;
  tga[14] = height & 0xff;
  tga[15] = (height >> 8) & 0xff;
  tga[16] = 24; // bpp
  tga[17] = 0; // image descriptor

  let offset = HEADER_SIZE;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y * width + x];
      if (idx === TRANSPARENT || idx >= 256) {
        // Should not happen for opaque textures; fall back to black
        tga[offset++] = 0;
        tga[offset++] = 0;
        tga[offset++] = 0;
      } else {
        const [r, g, b] = paletteRGB(palette, idx);
        tga[offset++] = b;
        tga[offset++] = g;
        tga[offset++] = r;
      }
    }
  }
  return tga;
}

/**
 * Encode an indexed-color ImageBuffer into an uncompressed 32-bit TGA (type 2).
 * Includes alpha channel: 0 for transparent pixels, 255 for opaque.
 * Transparent pixels get magenta RGB as a visible fallback.
 */
function encodeTga32(image: ImageBuffer, palette: Palette): Uint8Array {
  const { width, height, pixels } = image;
  const HEADER_SIZE = 18;
  const dataSize = width * height * 4;
  const tga = new Uint8Array(HEADER_SIZE + dataSize);

  tga[0] = 0; // ID length
  tga[1] = 0; // no color map
  tga[2] = 2; // uncompressed true-color
  tga[12] = width & 0xff;
  tga[13] = (width >> 8) & 0xff;
  tga[14] = height & 0xff;
  tga[15] = (height >> 8) & 0xff;
  tga[16] = 32; // bpp (BGRA)
  tga[17] = 8; // image descriptor: 8 alpha bits

  let offset = HEADER_SIZE;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y * width + x];
      if (idx === TRANSPARENT || idx >= 256) {
        tga[offset++] = 255; // B (magenta fallback)
        tga[offset++] = 0; // G
        tga[offset++] = 255; // R
        tga[offset++] = 0; // A = fully transparent
      } else {
        const [r, g, b] = paletteRGB(palette, idx);
        tga[offset++] = b;
        tga[offset++] = g;
        tga[offset++] = r;
        tga[offset++] = 255; // A = fully opaque
      }
    }
  }
  return tga;
}

/** Encode and write a TGA file to disk.
 *  Set `alpha` to true only for textures that contain transparent pixels. */
export async function writeTga(
  path: string,
  image: ImageBuffer,
  palette: Palette,
  alpha = false,
): Promise<void> {
  const data = alpha ? encodeTga32(image, palette) : encodeTga24(image, palette);
  await Deno.writeFile(path, data);
}
