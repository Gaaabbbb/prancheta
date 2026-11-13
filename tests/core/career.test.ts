import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import {
  buildSeason,
  createWorld,
  endSeason,
  ensureMarket,
  ensureSponsors,
  expandDb,
  ovr,
  rng,
  stepDay,
  type Player,
  type RawDb,
  type World,
} from '../../src/core';

const career = (seed = 31): World => {
  const W = createWorld(seed, expandDb(rawDb as unknown as RawDb));
  W.user = 0;
  W.coach = 'T';
  rng.seed(seed);
  buildSeason(W);
  ensureSponsors(W);
  ensureMarket(W);
  return W;
};

const season = (W: World) => {
  let n = 0;
  while (!W.seasonDone && n++ < 400) stepDay(W);
};

const avg = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

describe('curva de carreira', () => {
  it('jovens crescem, veteranos caem, e quem vai parar avisa seis meses antes', () => {
    const W = career();
    const start = new Map<number, { o: number; a: number; pt: number }>();
    for (const p of W.players) if (p.c >= 0 && !p.y) start.set(p.id, { o: ovr(p), a: p.a, pt: Math.max(ovr(p), p.pt) });
    let noticeDay = -1;
    let n = 0;
    while (!W.seasonDone && n++ < 400) {
      stepDay(W);
      if (noticeDay < 0 && W.players.some((p) => p.ret != null)) noticeDay = W.day;
    }
    // aviso em 1º de junho (dia 151 do ano), seis meses antes do fim
    expect(noticeDay).toBe(151);
    const retiring = W.players.filter((p) => p.ret != null);
    expect(retiring.length).toBeGreaterThan(30);
    expect(avg(retiring.map((p) => p.a))).toBeGreaterThan(34);

    const delta = (f: (s: { o: number; a: number }, p: Player) => boolean) =>
      W.players.filter((p) => start.has(p.id) && f(start.get(p.id)!, p)).map((p) => ovr(p) - start.get(p.id)!.o);
    const young = delta((s) => s.a <= 20);
    const prime = delta((s) => s.a >= 26 && s.a <= 28);
    const old = delta((s) => s.a >= 33);
    expect(avg(young)).toBeGreaterThan(1.5);
    expect(Math.abs(avg(prime))).toBeLessThan(1);
    expect(avg(old)).toBeLessThan(-1.5);

    const ids = new Set(retiring.map((p) => p.id));
    endSeason(W);
    expect(W.players.some((p) => ids.has(p.id))).toBe(false);
  });

  it('em cinco temporadas, nem todo jovem chega ao potencial que aparecia', () => {
    const W = career(32);
    const kids = W.players.filter((p) => p.c >= 0 && p.a >= 17 && p.a <= 19 && p.pt - ovr(p) >= 8);
    const shown = new Map(kids.map((p) => [p.id, p.pt]));
    const o0 = new Map(kids.map((p) => [p.id, ovr(p)]));
    for (let y = 0; y < 5; y++) {
      season(W);
      endSeason(W);
    }
    const alive = kids.map((k) => W.pmap[k.id]).filter((p) => p && p.c >= 0);
    expect(alive.length).toBeGreaterThan(20);
    const reached = alive.filter((p) => ovr(p) >= shown.get(p.id)! - 1).length / alive.length;
    const grew = avg(alive.map((p) => ovr(p) - o0.get(p.id)!));
    // cresceram bastante, mas uma parte ficou no caminho
    expect(grew).toBeGreaterThan(6);
    expect(reached).toBeGreaterThan(0.15);
    expect(reached).toBeLessThan(0.85);
  }, 120000);
});
