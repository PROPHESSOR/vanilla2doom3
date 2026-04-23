// Copyright (c) 2026 PROPHESSOR
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/**
 * Coordinate scale factor from Doom units to Doom 3 units.
 * Doom coordinates are scaled by 1.5 to match Doom 3's scale.
 */
export const COORD_SCALE = 1.5;

/**
 * Convert Doom X coordinate to Doom 3 coordinate
 */
export const mapX = (x: number) => x * COORD_SCALE;

/**
 * Convert Doom Y coordinate to Doom 3 coordinate
 */
export const mapY = (y: number) => y * COORD_SCALE;

/**
 * Convert Doom Z coordinate to Doom 3 coordinate
 */
export const mapZ = (z: number) => z * COORD_SCALE;

/**
 * Default texture sizes for Doom textures
 */
export const DEFAULT_FLAT_SIZE = 64;
export const DEFAULT_WALL_SIZE = 128;
