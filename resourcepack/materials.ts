/**
 * Generate a Doom 3 .mtr material file declaring every extracted texture.
 *
 * Textures listed in `transparentNames` get an additional `alphaTest 0.5`
 * so Doom 3 cuts out transparent pixels using the TGA alpha channel.
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
    if (transparentNames.has(name)) {
      lines.push(`    alphaTest 0.5`);
    }
    lines.push(`    diffusemap ${matPath}`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
