import { ovr, POS, type Player } from '@/core';
import type { SortKey } from '@/store/uiStore';
import { evoDelta } from './format';

const sorters: Record<SortKey, (p: Player) => number | string> = {
  pos: (p) => POS.indexOf(p.p) * 1000 - ovr(p),
  n: (p) => p.n,
  a: (p) => p.a,
  ovr: (p) => ovr(p),
  pt: (p) => p.pt,
  f: (p) => p.f,
  mo: (p) => p.mo,
  evo: (p) => evoDelta(p),
  j: (p) => p.st.j,
  g: (p) => p.st.g,
  as: (p) => p.st.as,
  nt: (p) => (p.st.j ? p.st.nt / p.st.j : 0),
  val: (p) => p.val,
  sal: (p) => p.sal,
  ct: (p) => p.ct,
};

export const sortPlayers = (list: Player[], k: SortKey, d: number): Player[] => {
  const f = sorters[k] || (() => 0);
  return list.slice().sort((x, y) => {
    const a = f(x),
      b = f(y);
    return (a < b ? -1 : a > b ? 1 : 0) * d;
  });
};
