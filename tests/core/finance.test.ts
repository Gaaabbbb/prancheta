import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import {
  acceptOffer,
  buildSeason,
  createWorld,
  endSeason,
  ensureSponsors,
  expandDb,
  haggleOffer,
  isPayday,
  monthlyWages,
  playDay,
  rng,
  SEASON_DAYS,
  seekSponsors,
  sponsorPotential,
  SPONSORS,
  terminateContract,
  terminationFee,
  type RawDb,
  type World,
} from '../../src/core';

const career = (user: number, seed = 99): World => {
  const W = createWorld(seed, expandDb(rawDb as unknown as RawDb));
  W.user = user;
  W.coach = 'Teste';
  rng.seed(seed);
  buildSeason(W);
  ensureSponsors(W);
  return W;
};

describe('finanças mensais', () => {
  it('há exatamente 10 dias de pagamento por temporada (fevereiro a novembro)', () => {
    const W = career(0);
    for (const year of [2026, 2027, 2028]) {
      W.year = year;
      let n = 0;
      for (let d = 1; d <= SEASON_DAYS; d++) if (isPayday(W, d)) n++;
      expect(n).toBe(10);
    }
  });

  it('uma temporada paga 10 meses de salário', () => {
    const W = career(45);
    const wages = monthlyWages(W, 45);
    while (!W.seasonDone) playDay(W);
    expect(Math.round(-W.fin!.sal!)).toBe(Math.round(wages * 10));
  }, 60000);
});

describe('patrocínios', () => {
  it('há pelo menos 30 marcas e todas as divisões têm opções', () => {
    expect(SPONSORS.length).toBeGreaterThanOrEqual(30);
    for (const d of ['A', 'B', 'C', 'D'] as const)
      expect(SPONSORS.filter((s) => s.divs.includes(d)).length).toBeGreaterThan(5);
  });

  it('a carreira começa com master e secundário perto do potencial do clube', () => {
    const W = career(0);
    const total = W.sp!.master!.val + W.sp!.sec!.val;
    const pot = sponsorPotential(W);
    expect(total).toBeGreaterThan(pot * 0.7);
    expect(total).toBeLessThan(pot * 1.4);
    expect(W.sp!.master!.sid).not.toBe(W.sp!.sec!.sid);
  });

  it('os patrocínios não mexem no sorteio dos jogos', () => {
    const W = career(0);
    const before = rng.rngState.s;
    seekSponsors(W);
    for (const o of W.sp!.offers.slice()) haggleOffer(W, o.id);
    expect(rng.rngState.s).toBe(before);
  });

  it('rescindir paga a multa e libera o espaço; aceitar ocupa o espaço', () => {
    const W = career(0);
    const me = W.clubs[0];
    me.bal = 1e10;
    const fee = terminationFee(W, W.sp!.master!);
    const bal = me.bal;
    expect(terminateContract(W, 'master')).toBeNull();
    expect(W.sp!.master).toBeNull();
    expect(me.bal).toBe(bal - fee);
    W.sp!.seek = undefined;
    seekSponsors(W);
    const o = W.sp!.offers.find((x) => x.slot === 'master');
    if (o) {
      expect(acceptOffer(W, o.id)).toBeNull();
      expect(W.sp!.master!.sid).toBe(o.sid);
      expect(W.sp!.offers.some((x) => x.slot === 'master')).toBe(false);
    }
  });

  it('a temporada inteira com patrocínio, virada de ano e renovações funciona', () => {
    const W = career(100, 7);
    while (!W.seasonDone) playDay(W);
    const pat = W.fin!.pat!;
    expect(pat).toBeGreaterThan(0);
    endSeason(W);
    expect(W.finHist!.length).toBe(1);
    expect(W.finHist![0].pat).toBe(pat);
    for (const o of W.sp!.offers) expect(o.exp).toBe(8);
  }, 60000);
});
