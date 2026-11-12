import { shuffle } from '../rng';
import type { Competition, Fixture, KOStage, LeagueStage, World } from '../types';

/**
 * Dia de uma rodada (`slot`) da competição. No calendário por rodadas é o próprio número da rodada; no calendário
 * por dias vem da lista de datas da competição (passando do fim, uma rodada por semana).
 */
export const slotDay = (comp: Competition, slot: number): number => {
  const ds = comp.dates;
  if (!ds || !ds.length) return slot;
  if (slot <= ds.length) return ds[slot - 1];
  return ds[ds.length - 1] + 7 * (slot - ds.length);
};

/**
 * Primeira rodada livre para uma fase nova: a seguinte (por rodadas) ou a primeira data da competição com pelo menos
 * um dia de folga depois de hoje (por dias).
 */
export const nextSlot = (W: World, comp: Competition): number => {
  const ds = comp.dates;
  if (W.cal !== 'days' || !ds || !ds.length) return W.day + 1;
  const used = comp.fx.reduce((m, f) => Math.max(m, f.r ?? 0), 0);
  for (let i = used; i < ds.length; i++) if (ds[i] >= W.day + 2) return i + 1;
  // acabaram as datas: uma rodada por semana depois da última
  let slot = Math.max(used, ds.length) + 1;
  while (slotDay(comp, slot) < W.day + 2) slot++;
  return slot;
};

/** Tabela de turno (e returno) pelo método do círculo, alternando mandos. */
export const roundRobin = (teams: number[], double: boolean): [number, number][][] => {
  const t = teams.slice();
  if (t.length % 2) t.push(-1);
  const n = t.length,
    rounds: [number, number][][] = [];
  const bal: Record<number, number> = {},
    last: Record<number, string> = {};
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i],
        b = t[n - 1 - i];
      if (a === -1 || b === -1) continue;
      // mandante: quem jogou mais fora / jogou fora na última rodada
      const sa = (bal[a] || 0) * 2 + (last[a] === 'H' ? 1 : last[a] === 'A' ? -1 : 0);
      const sb = (bal[b] || 0) * 2 + (last[b] === 'H' ? 1 : last[b] === 'A' ? -1 : 0);
      const aHome = sa < sb || (sa === sb && (r + i) % 2 === 0);
      const h = aHome ? a : b,
        v = aHome ? b : a;
      pairs.push([h, v]);
      bal[h] = (bal[h] || 0) + 1;
      bal[v] = (bal[v] || 0) - 1;
      last[h] = 'H';
      last[v] = 'A';
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop()!);
  }
  if (double) {
    const n2 = rounds.length;
    for (let r = 0; r < n2; r++) rounds.push(rounds[r].map(([a, b]) => [b, a]));
  }
  return rounds;
};

export const addFx = (
  comp: Competition,
  d: number,
  h: number,
  a: number,
  st: number,
  g: number,
  leg?: number,
): Fixture => {
  const fx: Fixture = {
    id: comp.fx.length,
    d: slotDay(comp, d),
    h,
    a,
    hg: null,
    ag: null,
    pl: false,
    st,
    g,
    leg: leg || 0,
  };
  // no calendário por dias guarda a rodada (no por rodadas ela é o próprio `d`)
  if (comp.dates) fx.r = d;
  comp.fx.push(fx);
  return fx;
};

/** Fase de pontos corridos (um ou mais grupos). */
export const addLeagueStage = (
  comp: Competition,
  name: string,
  groups: number[][],
  double: boolean,
  start: number,
): LeagueStage => {
  const st: LeagueStage = { type: 'league', name, groups, double, start, done: false };
  const si = comp.stages.push(st) - 1;
  let maxR = 0;
  groups.forEach((grp, gi) => {
    const rounds = roundRobin(shuffle(grp.slice()), double);
    rounds.forEach((pairs, r) => pairs.forEach(([h, a]) => addFx(comp, start + r, h, a, si, gi)));
    maxR = Math.max(maxR, rounds.length);
  });
  st.end = start + maxR - 1;
  comp.si = si;
  return st;
};

/** Mata-mata em ida e volta. Em cada confronto, `b` é o melhor cabeça e manda o jogo de volta. */
export const addKOStage = (
  comp: Competition,
  name: string,
  ties: { a: number; b: number }[],
  start: number,
  opts?: { seedDecides?: boolean; tag?: string; parallel?: boolean },
): KOStage => {
  opts = opts || {};
  const st: KOStage = {
    type: 'ko',
    name,
    ties: [],
    start,
    end: start + 1,
    done: false,
    seedDecides: !!opts.seedDecides,
    tag: opts.tag || '',
  };
  const si = comp.stages.push(st) - 1;
  ties.forEach((t, ti) => {
    const f1 = addFx(comp, start, t.a, t.b, si, ti, 1);
    const f2 = addFx(comp, start + 1, t.b, t.a, si, ti, 2);
    st.ties.push({ a: t.a, b: t.b, f: [f1.id, f2.id], w: null });
  });
  if (!opts.parallel) comp.si = si;
  return st;
};
