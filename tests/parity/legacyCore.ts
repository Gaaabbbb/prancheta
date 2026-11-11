/**
 * Carrega o núcleo do jogo ORIGINAL (legacy/Prancheta.html) num contexto isolado do Node.
 * Serve de referência para garantir que o port em TypeScript se comporta igual.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HTML = fileURLToPath(new URL('../../legacy/Prancheta.html', import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegacyG = any;

export const loadLegacyCore = (): LegacyG => {
  const html = readFileSync(HTML, 'utf8');
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.indexOf('// ===== Interface: base');
  const code = html.slice(start, end);
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx, { filename: 'Prancheta.legacy.js' });
  return (ctx as { G: LegacyG }).G;
};
