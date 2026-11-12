import { isForeignLeague, serieCRelegations, type Competition, type LeagueStage, type World } from '@/core';

/** Classe CSS da faixa colorida (acesso, rebaixamento etc.) para a posição. */
export const zoneOf = (W: World, comp: Competition, si: number, pos: number, n: number): string => {
  const div = comp.id,
    st = comp.stages[si] as LeagueStage;
  if (div === 'A') return pos <= 6 ? 'z-lib' : pos <= 12 ? 'z-sul' : pos > n - 4 ? 'z-dn' : '';
  if (div === 'B') return pos <= 2 ? 'z-up' : pos <= 6 ? 'z-po' : pos > n - 4 ? 'z-dn' : '';
  if (div === 'C') {
    if (si === 0) {
      const relN = serieCRelegations(comp, W.year);
      const per = st.groups.length > 1 ? Math.ceil(relN / 2) : relN;
      const q = st.groups.length > 1 ? 4 : 8;
      return pos <= q ? 'z-po' : pos > n - per ? 'z-dn' : '';
    }
    return pos <= 2 ? 'z-up' : '';
  }
  if (div === 'LIB') return pos <= 2 ? 'z-up' : pos === 3 ? 'z-sul' : '';
  if (div === 'SULA') return pos === 1 ? 'z-up' : pos === 2 ? 'z-po' : '';
  if (isForeignLeague(div)) {
    // vagas na Libertadores (grupos + preliminares) e na Sul-Americana
    const lib = div === 'ARG' ? 6 : 4,
      sul = div === 'ARG' ? 6 : 4;
    return pos <= lib ? 'z-lib' : pos <= lib + sul ? 'z-sul' : '';
  }
  return pos <= 4 ? 'z-po' : '';
};
