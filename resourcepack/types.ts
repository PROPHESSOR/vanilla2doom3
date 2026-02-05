/** Sentinel value for transparent pixels in image buffers. */
export const TRANSPARENT = 0xffff;

/** Indexed-color image: palette indices stored in a Uint16Array.
 *  Uint16 is used so we can reserve 0xFFFF as the transparent marker
 *  while keeping valid palette indices 0-255. */
export interface ImageBuffer {
  width: number;
  height: number;
  /** Palette indices; TRANSPARENT (0xFFFF) = no pixel drawn. */
  pixels: Uint16Array;
}
