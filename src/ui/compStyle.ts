import { DIVS } from '@/core';

/**
 * Cor de cada competição (calendário, página Jogos): Brasileirão verde, Copa do Brasil azul, Libertadores dourado
 * (a taça) e Sul-Americana laranja.
 */
const COLORS: Record<string, string> = {
  BR: '#2fa36b',
  CDB: '#3b82f6',
  LIB: '#e0a800',
  SULA: '#ef6c2f',
};

const isBr = (id: string) => (DIVS as readonly string[]).includes(id);

export const compColor = (id: string): string => COLORS[isBr(id) ? 'BR' : id] || '#8a94a6';

/** Nome curto para etiquetas pequenas. */
export const compShort = (id: string, name: string): string =>
  isBr(id)
    ? name
    : ({ CDB: 'Copa do Brasil', LIB: 'Libertadores', SULA: 'Sul-Americana' } as Record<string, string>)[id] || name;

/** Legenda das cores (só as competições da lista). */
export const compLegend = (ids: string[]): { id: string; label: string; color: string }[] => {
  const seen = new Set<string>();
  const out: { id: string; label: string; color: string }[] = [];
  for (const id of ids) {
    const key = isBr(id) ? 'BR' : id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id,
      label: isBr(id) ? 'Brasileirão' : compShort(id, id),
      color: compColor(id),
    });
  }
  return out;
};
