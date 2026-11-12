import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import sulaDb from '../../src/data/sula-db.json';
import {
  buildSeason,
  createWorld,
  dateOf,
  ensureMarket,
  ensureSponsors,
  expandDb,
  mergeDb,
  rng,
  stepDay,
  type KOStage,
  type RawDb,
  type World,
} from '../../src/core';

const career = (user = 0, seed = 21): World => {
  const W = createWorld(seed, mergeDb(expandDb(rawDb as unknown as RawDb), expandDb(sulaDb as unknown as RawDb)));
  W.user = user;
  W.coach = 'T';
  rng.seed(seed);
  buildSeason(W);
  ensureSponsors(W);
  ensureMarket(W);
  return W;
};

/** Nenhum clube com dois jogos com menos de 2 dias de intervalo. */
const noClash = (W: World) => {
  const days = new Map<number, number[]>();
  for (const c of Object.values(W.comps))
    for (const f of c.fx)
      for (const id of [f.h, f.a]) {
        const l = days.get(id) || [];
        l.push(f.d);
        days.set(id, l);
      }
  let clashes = 0;
  for (const [, l] of days) {
    l.sort((a, b) => a - b);
    for (let i = 1; i < l.length; i++) if (l[i] - l[i - 1] < 2) clashes++;
  }
  return clashes;
};

describe('copas', () => {
  let W: World;
  it('temporada inteira por dias com a Copa do Brasil', () => {
    W = career();
    const cdb = W.comps.CDB;
    expect(cdb).toBeDefined();
    expect((cdb.stages[0] as KOStage).ties.length).toBe(14);
    let n = 0;
    while (!W.seasonDone && n++ < 400) stepDay(W);
    expect(W.seasonDone).toBe(true);
    expect(cdb.done).toBe(true);
    expect(cdb.res.champ).not.toBeNull();
    // 126 clubes diferentes jogaram
    const clubs = new Set(cdb.fx.flatMap((f) => [f.h, f.a]));
    expect(clubs.size).toBe(126);
    expect(cdb.stages.map((s) => s.name)).toEqual([
      '1ª fase',
      '2ª fase',
      '3ª fase',
      '4ª fase',
      '5ª fase',
      'Oitavas de final',
      'Quartas de final',
      'Semifinal',
      'Final',
    ]);
    const final = cdb.fx[cdb.fx.length - 1];
    expect(final.neu).toBe(true);
    const fd = dateOf(W, final.d);
    expect(fd.getMonth()).toBe(11);
    expect(Math.abs(fd.getDate() - 6)).toBeLessThanOrEqual(3);
    // todos os clubes da Série A entram na 5ª fase
    const p5 = new Set((cdb.stages[4] as KOStage).ties.flatMap((t) => [t.a, t.b]));
    for (const c of W.clubs.filter((c) => c.div === 'A')) expect(p5.has(c.id)).toBe(true);
    expect(noClash(W)).toBe(0);
    expect(W.fin!.pre || 0).toBeGreaterThan(0);
  }, 300000);
});
