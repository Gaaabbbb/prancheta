import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import {
  askingPrice,
  backFromInjury,
  buildSeason,
  clubTalk,
  compList,
  createWorld,
  ensureMarket,
  expandDb,
  injuryRisk,
  keyRole,
  offerToClub,
  ovr,
  rivalBids,
  rng,
  sellBlock,
  stepDay,
  type RawDb,
  type World,
} from '../../src/core';

const career = (seed = 61): World => {
  const W = createWorld(seed, expandDb(rawDb as unknown as RawDb));
  W.user = 0;
  W.coach = 'T';
  rng.seed(seed);
  buildSeason(W);
  ensureMarket(W);
  W.clubs[0].bal = 5e9;
  return W;
};

describe('lesões ligadas ao desgaste', () => {
  it('risco: cansado ≥ 3x, veterano e quem volta de lesão têm mais risco', () => {
    const W = career();
    const p = W.players.find((x) => x.c === 1 && x.a >= 22 && x.a <= 27)!;
    p.f = 100;
    const fresh = injuryRisk(W, p).w;
    p.f = 40;
    expect(injuryRisk(W, p).w).toBeGreaterThanOrEqual(fresh * 3);
    p.f = 100;
    backFromInjury(p);
    expect(p.f).toBeLessThanOrEqual(70);
    expect(injuryRisk(W, p).w).toBeGreaterThan(injuryRisk(W, { ...p, rtn: undefined, f: 70 }).w);
    const old = { ...p, a: 35, rtn: undefined, f: 100 };
    expect(injuryRisk(W, old).w).toBeGreaterThan(fresh);
  });

  it('temporada inteira: entre 0,2 e 0,34 lesão por jogo, com tipos e poucas lesões longas', () => {
    const W = career(62);
    let inj = 0,
      long = 0;
    const types = new Set<string>();
    let n = 0;
    while (!W.seasonDone && n++ < 400) {
      const before = new Map(W.players.map((p) => [p.id, p.inj]));
      stepDay(W);
      for (const p of W.players)
        if (p.inj > (before.get(p.id) ?? 0) && p.injD) {
          inj++;
          if (p.injD > 28) long++;
          types.add(p.injT!);
        }
    }
    const matches = compList(W).reduce((t, c) => t + c.fx.filter((f) => f.pl).length, 0);
    expect(inj / matches).toBeGreaterThan(0.2);
    expect(inj / matches).toBeLessThan(0.34);
    expect(long / inj).toBeLessThan(0.25);
    expect(types.size).toBeGreaterThanOrEqual(4);
  }, 120000);

  it('concorrência: um rival sobe o pedido e, sem acordo no prazo, leva o jogador', () => {
    const W = career(63);
    const p = W.players.find(
      (x) => x.c > 0 && !x.y && ovr(x) >= 62 && ovr(x) <= 72 && !sellBlock(W, x) && !keyRole(W, x),
    )!;
    const t = clubTalk(W, p);
    expect(offerToClub(W, p.id, Math.round(askingPrice(W, p) * 0.7)).r).toBe('counter');
    const ask0 = t.ask;
    rivalBids(W, true);
    expect(t.rival).toBeDefined();
    expect(t.ask).toBeGreaterThan(ask0);
    const owner = p.c;
    for (let i = 0; i < 6 && !t.end; i++) {
      stepDay(W);
      rivalBids(W);
    }
    expect(t.end).toBe('off');
    expect(p.c).not.toBe(owner);
    expect(p.c).not.toBe(0);
  }, 60000);
});
