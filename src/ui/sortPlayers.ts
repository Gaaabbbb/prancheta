import { ovr, POS, type Player, type World } from '@/core';
import type { SortKey } from '@/store/uiStore';

const sorters: Record<SortKey, (p: Player, W?: World) => number | string> = {
  pos: (p) => POS.indexOf(p.p) * 1000 - ovr(p),
  n: (p) => p.n,
  a: (p) => p.a,
  ovr: (p) => ovr(p),
  pt: (p) => Math.max(ovr(p), p.pt),
  f: (p) => p.f,
  mo: (p) => p.mo,
  j: (p) => p.st.j,
  g: (p) => p.st.g,
  as: (p) => p.st.as,
  ca: (p) => p.st.ca || 0,
  cv: (p) => p.st.cv || 0,
  nt: (p) => (p.st.j ? p.st.nt / p.st.j : 0),
  val: (p) => p.val,
  sal: (p) => p.sal,
  ct: (p) => p.ct,
};

export const sortPlayers = (list: Player[], k: SortKey, d: number, W?: World): Player[] => {
  const f = sorters[k] || (() => 0);
  return list.slice().sort((x, y) => {
    const a = f(x, W),
      b = f(y, W);
    return (a < b ? -1 : a > b ? 1 : 0) * d;
  });
};
