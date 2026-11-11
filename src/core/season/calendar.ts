import { DIVS } from '../constants/divisions';
import type { Competition, Fixture, World } from '../types';

export interface FixtureRef {
  comp: Competition;
  f: Fixture;
}

/** Data (no calendário) de um dia de jogos. */
export const dateOf = (W: World, d: number): Date => {
  const t = new Date(W.year, 0, 28);
  t.setDate(t.getDate() + Math.round((d - 1) * 7.7));
  return t;
};

export const fmtDate = (dt: Date): string => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** Jogos ainda não disputados num dia. */
export const dayFixtures = (W: World, day: number): FixtureRef[] => {
  const out: FixtureRef[] = [];
  for (const div of DIVS) {
    const comp = W.comps[div];
    for (const f of comp.fx) if (f.d === day && !f.pl) out.push({ comp, f });
  }
  return out;
};

export const userFixture = (W: World, day: number): FixtureRef | undefined =>
  dayFixtures(W, day).find((x) => x.f.h === W.user || x.f.a === W.user);

export const nextUserFixture = (W: World): FixtureRef | null => {
  let best: FixtureRef | null = null;
  for (const div of DIVS)
    for (const f of W.comps[div].fx)
      if (!f.pl && (f.h === W.user || f.a === W.user) && (!best || best.f.d > f.d)) best = { comp: W.comps[div], f };
  return best;
};
