export function download(fileName: string, bytes: Uint8Array, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
