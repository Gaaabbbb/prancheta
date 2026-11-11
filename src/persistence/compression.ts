/**
 * Compactação do save: gzip + base64 com prefixo `Z:` (ou `J:` = JSON puro).
 * Mesmo formato do Prancheta.html original, então saves antigos continuam abrindo.
 */
export const gzip = async (str: string): Promise<string> => {
  if (typeof CompressionStream === 'undefined') return 'J:' + str;
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return 'Z:' + btoa(bin);
};

export const gunzip = async (s: string): Promise<string> => {
  if (s.startsWith('J:')) return s.slice(2);
  if (!s.startsWith('Z:')) return s;
  const bin = atob(s.slice(2));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
};
