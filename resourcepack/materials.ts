/**
 * Generate a Doom 3 .mtr material file declaring every extracted texture.
 *
 * Uses the `diffusemap` shorthand which properly sets GL_REPEAT (tiling).
 * The explicit stage syntax `{ blend diffusemap; map ...; }` can cause
 * clamping in some engine versions — avoid it.
 *
 * Textures listed in `transparentNames` get alphaTest for cutout transparency.
 */
export function generateMaterialFile(
  prefix: string,
  textureNames: string[],
  transparentNames: ReadonlySet<string>,
): string {
  const lines: string[] = [];

  for (const name of textureNames) {
    const matPath = `textures/${prefix}/${name}`;
    lines.push(matPath);
    lines.push('{');
    lines.push('    noSelfShadow');
    lines.push('    noshadows');
    if (transparentNames.has(name)) {
      lines.push('    alphaTest 0.5');
    }
    lines.push(`    diffusemap ${matPath}`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
