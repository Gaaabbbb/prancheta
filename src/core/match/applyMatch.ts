import { clamp } from '../math';
import { RULES } from '../rules';
import { chance, ri } from '../rng';
import type { World } from '../types';
import type { Match } from './engine';

/** Aplica os efeitos pós-jogo nos jogadores: estatísticas, cartões, lesões e moral. */
export const applyMatch = (W: World, m: Match) => {
  const res = m.result();
  for (const s of m.sides) {
    const opp = m.sides[1 - s.idx];
    const outcome = s.goals > opp.goals ? 1 : s.goals < opp.goals ? -1 : 0;
    for (const pid of s.played) {
      const pl = W.pmap[pid];
      if (!pl) continue;
      const rt = clamp(s.rat[pid] === undefined ? 6 : s.rat[pid], 3, 10);
      pl.st.j++;
      pl.st.nt += rt;
      pl.car.j++;
      pl.mo = clamp(pl.mo + outcome * 4 + (rt - 6.5) * 2, 10, 100);
      if (s.yel[pid] >= 1) pl.st.ca = (pl.st.ca || 0) + 1;
      if (s.out[pid] === 'red') pl.st.cv = (pl.st.cv || 0) + 1;
      if (s.yel[pid] === 1) {
        pl.yc++;
        if (pl.yc >= 3) {
          pl.sus = Math.max(pl.sus, 1);
          pl.yc = 0;
        }
      }
      if (s.out[pid] === 'red') pl.sus = Math.max(pl.sus, s.yel[pid] >= 2 ? 1 : 2);
      if (pl._injNow) {
        pl.inj = chance(RULES.longInjury) ? ri(6, 16) : ri(1, 4);
        delete pl._injNow;
      }
    }
    // reservas não usados perdem um pouco de moral
    for (const pl of s.bench) if (!s.played.has(pl.id)) pl.mo = clamp(pl.mo - 0.5, 10, 100);
  }
  for (const g of m.goals) {
    const pl = W.pmap[g.pid];
    if (pl) {
      pl.st.g++;
      pl.car.g++;
    }
    if (g.aid) {
      const a = W.pmap[g.aid];
      if (a) a.st.as++;
    }
  }
  return res;
};
