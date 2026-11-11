export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);

/** Normaliza nomes para comparação: sem acentos, minúsculo, espaços simples. */
export const normName = (s: unknown): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
