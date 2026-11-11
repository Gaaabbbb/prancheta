import { POS, type Pos } from '../constants/attributes';
import { FORM_KEYS, FORMATION_WEIGHTS } from '../constants/formations';
import type { Div } from '../constants/divisions';
import { clamp, normName } from '../math';
import { calcValue, calcWage } from '../player/value';
import { seed, wpick } from '../rng';
import type { Club, Competition, Database, Tactic, World } from '../types';
import { seedYouth } from '../youth/youth';
import { makePlayer, uniqueShort } from './factory';
import { fillSquad } from './fillSquad';

export const WORLD_VERSION = 2;
export const START_YEAR = 2026;

export const defaultTac = (): Tactic => ({ f: '4-4-2', men: 2, pres: 1, temp: 1, lin: 1 });

/** Caixa inicial de acordo com a divisão e a reputação. */
const startBalance = (c: Club): number =>
  Math.round(
    (c.div === 'A'
      ? 15e6 + c.rep * 6e5
      : c.div === 'B'
        ? 3e6 + c.rep * 1e5
        : c.div === 'C'
          ? 8e5 + c.rep * 2e4
          : 2e5 + c.rep * 5e3) / 1e5,
  ) * 1e5;

/** Cria um mundo novo (clubes, elencos e bases) a partir de um banco de dados. */
export const createWorld = (worldSeed: number | null, db: Database): World => {
  seed(worldSeed || Date.now() >>> 0);
  const W: World = {
    v: WORLD_VERSION,
    year: START_YEAR,
    day: 0,
    clubs: [],
    players: [],
    pmap: {},
    nextPid: 1,
    news: [],
    user: null,
    comps: {} as Record<Div, Competition>,
    hist: [],
    seasonDone: false,
  };
  const usedShort = new Set(db.clubs.filter((c) => c.s).map((c) => c.s!));
  for (const d of db.clubs) {
    const s = d.s || uniqueShort(d.n, usedShort);
    W.clubs.push({
      id: W.clubs.length,
      n: d.n,
      s,
      div: d.div as Div,
      c1: d.c1 || '#888888',
      c2: d.c2 || '#FFFFFF',
      rep: clamp(+(d.rep ?? 0) || 40, 1, 99),
      cap: +(d.cap ?? 0) || 10000,
      uf: d.uf || 'SP',
      std: d.std || 'Estádio ' + d.n,
      grp: d.grp == null ? -1 : d.grp,
    } as Club);
  }
  const bySig: Record<string, Club> = {},
    byName: Record<string, Club> = {};
  W.clubs.forEach((c) => {
    bySig[c.s.toUpperCase()] = c;
    byName[normName(c.n)] = c;
  });
  for (const c of W.clubs) {
    c.tac = defaultTac();
    c.tac.f = wpick(FORM_KEYS, (k) => FORMATION_WEIGHTS[k]);
    c.bal = startBalance(c);
    c.lineup = null;
    c.bench = null;
  }
  const isPos = (p: string): p is Pos => (POS as readonly string[]).includes(p);
  for (const d of db.players) {
    const c = bySig[String(d.club).toUpperCase()] || byName[normName(d.club)];
    if (!c) continue;
    if (!isPos(d.p)) continue;
    makePlayer(W, c.id, d.n, d.p, clamp(+d.a || 25, 15, 50), clamp(+d.o || 50, 25, 99), !!d.real, {
      nat: d.nat,
      pt: d.pt,
    });
  }
  const hasYouth = new Set<number>();
  for (const d of db.youth || []) {
    const c = bySig[String(d.club).toUpperCase()] || byName[normName(d.club)];
    if (!c || !isPos(d.p)) continue;
    makePlayer(W, c.id, d.n, d.p, clamp(+d.a || 17, 14, 21), clamp(+d.o || 40, 20, 99), !!d.real, {
      y: 1,
      nat: d.nat,
      pt: d.pt || +d.o + 10,
    });
    hasYouth.add(c.id);
  }
  for (const c of W.clubs) if (!hasYouth.has(c.id)) seedYouth(W, c);
  for (const c of W.clubs) fillSquad(W, c);
  for (const pl of W.players) {
    pl.val = calcValue(pl);
    pl.sal = calcWage(pl, W.clubs[pl.c].div);
  }
  return W;
};
