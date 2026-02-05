/**
 * Generate a Doom 3 .mtr material file declaring every extracted texture.
 *
 * Each declaration maps a material path to its diffusemap TGA.
 * Format:
 *   textures/<prefix>/<NAME>
 *   {
 *       diffusemap textures/<prefix>/<NAME>
 *   }
 */
export function generateMaterialFile(
  prefix: string,
  textureNames: string[],
): string {
  const lines: string[] = [];

  for (const name of textureNames) {
    const matPath = `textures/${prefix}/${name}`;
    lines.push(matPath);
    lines.push('{');
    lines.push(`    diffusemap ${matPath}`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}
