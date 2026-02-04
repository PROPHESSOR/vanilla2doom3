/**
 * Copyright (c) 2022-2026 PROPHESSOR
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

export const setImmediate = () => new Promise((res) => setTimeout(res, 0));

export function download(data: string, filename: string, filetype: string = 'text/plain') {
  const file = new Blob([data], { type: filetype });
  const a = document.createElement('a');
  const url = URL.createObjectURL(file);

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 0);
}