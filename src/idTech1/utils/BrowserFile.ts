/**
 * Copyright (c) 2022-2026 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

import ByteTools from './ByteTools';

/**
 * @param {HTMLInputElement} input
 * @returns {DataView | null}
 */
export const readFileFromInput = (input: HTMLInputElement) => new Promise<DataView | null>((res) => {
  const { files } = input;

  if (!files) return res(null);
  if (!files[0]) return res(null);

  const reader = new FileReader();

  reader.onload = (ev) => {
    if (!ev.target) return res(null);
    if (!ev.target.result) return res(null);
    return res(new DataView(ev.target.result as ArrayBuffer));
  };

  reader.readAsArrayBuffer(files[0]);
});

/**
 *
 * @param {HTMLInputElement} input
 * @returns {ByteTools}
 */
export async function readByteToolsBufferFromInput(input: HTMLInputElement) {
  const dataView = await readFileFromInput(input);

  if (!dataView) return null;

  return new ByteTools(dataView);
}

/**
 * Read a File object directly into ByteTools.
 */
export function readFileToByteTools(file: File): Promise<ByteTools> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (!result) return reject(new Error('Failed to read file'));
      resolve(new ByteTools(new DataView(result as ArrayBuffer)));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}