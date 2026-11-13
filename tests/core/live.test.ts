import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import sulaDb from '../../src/data/sula-db.json';
import {
  buildSeason,
  clubLevel,
  createWorld,
  ensureMarket,
  expandDb,
  mergeDb,
  ovr,
  prepareMatch,
  rng,
  setForSale,
  squad,
  stepDay,
  userFixture,
  type RawDb,
  type World,
} from '../../src/core';

const career = (seed = 51, sula = false): World => {
  const db = sula
    ? mergeDb(expandDb(rawDb as unknown as RawDb), expandDb(sulaDb as unknown as RawDb))
    : expandDb(rawDb as unknown as RawDb);
  const W = createWorld(seed, db);
  W.user = 0;
  W.coach = 'T';
  rng.seed(seed);
  buildSeason(W);
  ensureMarket(W);
  return W;
};

const firstMatch = (W: World) => {
  let n = 0;
  while (!userFixture(W, W.day + 1) && n++ < 60) stepDay(W);
  const uf = userFixture(W, W.day + 1)!;
  return { uf, side: uf.f.h === W.user ? 0 : 1 };
};

describe('partida ao vivo', () => {
  it('lesão no time do usuário: ao vivo ninguém entra sozinho; ao pular para o fim, a IA troca', () => {
    const W = career();
    const { uf, side } = firstMatch(W);
    const m = prepareMatch(W, uf.comp, uf.f, { userSide: side });
    m.manual = true;
    const s = m.sides[side];
    for (let i = 0; i < 30; i++) m.step();
    m.injury(s);
    const hurt = s.on.find((o) => s.out[o.pl.id] === 'inj');
    expect(hurt).toBeDefined();
    expect(s.subs).toBe(0);
    expect(hurt!.pl.f).toBeLessThanOrEqual(35);
    m.handOver();
    expect(s.subs).toBe(1);
    expect(s.on.some((o) => o.pl.id === hurt!.pl.id)).toBe(false);
  });

  it('o cansaço pesa: titulares terminam o jogo bem mais cansados', () => {
    const W = career();
    const { uf, side } = firstMatch(W);
    const m = prepareMatch(W, uf.comp, uf.f, { userSide: side });
    const s = m.sides[side];
    const start = s.on.map((o) => o.pl.f);
    m.runToEnd();
    const drop = s.on.reduce((t, o, i) => t + (start[i] ?? o.pl.f) - o.pl.f, 0) / s.on.length;
    expect(drop).toBeGreaterThan(22);
  });

  it('clubes sul-americanos também fazem propostas pelos jogadores do usuário', () => {
    const W = career(52, true);
    const sul = W.clubs.filter((c) => c.div === 'SUL');
    // o nível dos sul-americanos acompanha a força real do elenco
    for (const c of sul.slice(0, 20)) {
      const top = squad(W, c.id)
        .map(ovr)
        .sort((a, b) => b - a)
        .slice(0, 13);
      const avg = top.reduce((a, b) => a + b, 0) / top.length;
      expect(Math.abs(clubLevel(c) - (avg - 5))).toBeLessThan(6);
    }
    for (const p of squad(W, 0)) setForSale(W, p.id, p.val);
    const from = new Set<number>();
    for (let d = 0; d < 60 && W.mk!.offers.length < 200; d++) {
      stepDay(W);
      for (const o of W.mk!.offers) from.add(o.from);
      W.mk!.offers = [];
    }
    expect([...from].some((id) => W.clubs[id].div === 'SUL')).toBe(true);
  }, 60000);
});
