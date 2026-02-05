import { TRANSPARENT, type ImageBuffer } from './types.ts';
import { paletteRGB, type Palette } from './palette.ts';

/**
 * Encode an indexed-color ImageBuffer into an uncompressed 32-bit TGA (type 2).
 *
 * TGA pixel order: bottom-to-top rows, BGRA byte order.
 * Transparent pixels get alpha=0 (and magenta RGB so they're visible if alpha
 * is ever ignored). Opaque pixels get alpha=255.
 */
export function encodeTga(image: ImageBuffer, palette: Palette): Uint8Array {
  const { width, height, pixels } = image;
  const HEADER_SIZE = 18;
  const BPP = 4; // BGRA
  const dataSize = width * height * BPP;
  const tga = new Uint8Array(HEADER_SIZE + dataSize);

  // TGA header
  tga[0] = 0; // ID length
  tga[1] = 0; // no color map
  tga[2] = 2; // uncompressed true-color
  // bytes 3-7: color map spec (all zero)
  // bytes 8-9: x origin
  // bytes 10-11: y origin
  tga[12] = width & 0xff;
  tga[13] = (width >> 8) & 0xff;
  tga[14] = height & 0xff;
  tga[15] = (height >> 8) & 0xff;
  tga[16] = 32; // bits per pixel (BGRA)
  tga[17] = 8; // image descriptor: 8 alpha bits

  let offset = HEADER_SIZE;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y * width + x];
      if (idx === TRANSPARENT || idx >= 256) {
        tga[offset++] = 255; // B  (magenta fallback)
        tga[offset++] = 0; // G
        tga[offset++] = 255; // R
        tga[offset++] = 0; // A  = fully transparent
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

/** Encode and write a TGA file to disk. */
export async function writeTga(
  path: string,
  image: ImageBuffer,
  palette: Palette,
): Promise<void> {
  await Deno.writeFile(path, encodeTga(image, palette));
}
