import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import {
  acceptIncoming,
  askingPrice,
  buildSeason,
  createWorld,
  endSeason,
  ensureMarket,
  expandDb,
  loanRequest,
  monthlyWages,
  offerContract,
  offerToClub,
  ovr,
  playDay,
  playerDemand,
  releasePlayer,
  renewContract,
  rng,
  sellBlock,
  setForSale,
  squad,
  windowState,
  type RawDb,
  type World,
} from '../../src/core';

const career = (user = 0, seed = 41): World => {
  const W = createWorld(seed, expandDb(rawDb as unknown as RawDb));
  W.user = user;
  W.coach = 'Teste';
  rng.seed(seed);
  buildSeason(W);
  ensureMarket(W);
  W.clubs[user].bal = 5e9;
  return W;
};

/** Um jogador de outro clube que pode ser vendido. */
const target = (W: World, maxOvr = 75) =>
  W.players.find((p) => p.c >= 0 && p.c !== W.user && !p.y && ovr(p) <= maxOvr && ovr(p) >= 60 && !sellBlock(W, p))!;

describe('mercado', () => {
  it('janelas: pré-temporada e meio do ano', () => {
    const W = career();
    expect(windowState(W).open).toBe(true);
    W.day = 8;
    expect(windowState(W).open).toBe(false);
    let opened = false;
    for (let d = 5; d < 40; d++) {
      W.day = d;
      if (windowState(W).open) opened = true;
    }
    expect(opened).toBe(true);
  });

  it('compra: clube aceita o preço pedido e o jogador assina', () => {
    const W = career();
    const p = target(W);
    const from = p.c;
    const ask = askingPrice(W, p);
    expect(offerToClub(W, p.id, Math.round(ask * 0.5)).r).toBe('reject');
    expect(offerToClub(W, p.id, ask).r).toBe('accept');
    const d = playerDemand(W, p, 'buy');
    if (d.refuse) return;
    const bal = W.clubs[0].bal,
      sellerBal = W.clubs[from].bal;
    const ans = offerContract(W, p.id, d.wage, d.years[0]);
    expect(ans.r).toBe('accept');
    expect(p.c).toBe(0);
    expect(p.sal).toBe(d.wage);
    expect(W.clubs[0].bal).toBe(bal - ask);
    expect(W.clubs[from].bal).toBe(sellerBal + ask);
    expect(W.mk!.log[0].kind).toBe('compra');
  });

  it('jogador livre assina sem custo de transferência; renovação muda salário e prazo', () => {
    const W = career();
    const fa = W.players.find((p) => p.c < 0)!;
    const d = playerDemand(W, fa, 'free');
    expect(offerContract(W, fa.id, d.wage, d.years[0]).r).toBe('accept');
    expect(fa.c).toBe(0);
    const mine = squad(W, 0)[3];
    mine.mo = 80;
    const r = playerDemand(W, mine, 'renew');
    expect(renewContract(W, mine.id, r.wage, r.years[1]).r).toBe('accept');
    expect(mine.ct).toBe(W.year + r.years[1]);
  });

  it('empréstimo: divide o salário e volta no fim da temporada', () => {
    const W = career();
    const p = W.players.find((x) => {
      if (x.c < 0 || x.c === 0 || x.y || sellBlock(W, x)) return false;
      const rank = squad(W, x.c)
        .sort((a, b) => ovr(b) - ovr(a))
        .findIndex((y) => y.id === x.id);
      return rank >= 18;
    })!;
    const owner = p.c;
    const before = monthlyWages(W, 0);
    expect(loanRequest(W, p.id, 0.5).r).toBe('accept');
    expect(offerContract(W, p.id, 0, 1).r).toBe('accept');
    expect(p.c).toBe(0);
    expect(p.loan).toEqual({ from: owner, share: 0.5 });
    expect(monthlyWages(W, 0)).toBeCloseTo(before + p.sal * 0.5, 0);
    while (!W.seasonDone) playDay(W);
    endSeason(W);
    expect(p.c).toBe(owner);
    expect(p.loan).toBeUndefined();
  }, 60000);

  it('venda: proposta recebida aceita leva o jogador e paga o clube', () => {
    const W = career();
    const p = squad(W, 0).sort((a, b) => ovr(a) - ovr(b))[5];
    setForSale(W, p.id, 1e6);
    W.mk!.offers.push({ id: 99, pid: p.id, from: 5, kind: 'buy', fee: 9e5, share: 1, exp: 10, max: 1e6 });
    const bal = W.clubs[0].bal;
    expect(acceptIncoming(W, 99)).toBeNull();
    expect(p.c).toBe(5);
    expect(W.clubs[0].bal).toBe(bal + 9e5);
    expect(W.mk!.sell[p.id]).toBeUndefined();
  });

  it('dispensar paga metade do que falta do contrato e deixa o jogador livre', () => {
    const W = career();
    const p = squad(W, 0)[8];
    expect(releasePlayer(W, p.id)).toBeNull();
    expect(p.c).toBe(-1);
  });

  it('contratos vencidos: quem é do usuário sai; a temporada roda com o mercado vivo', () => {
    const W = career(45, 77);
    const ending = squad(W, 45).filter((p) => p.ct <= W.year);
    while (!W.seasonDone) playDay(W);
    endSeason(W);
    for (const p of ending) if (W.pmap[p.id]) expect(W.pmap[p.id].c).not.toBe(45);
    expect(W.mk!.log.some((r) => r.kind === 'compra' || r.kind === 'livre')).toBe(true);
    for (const c of W.clubs) expect(squad(W, c.id).length).toBeGreaterThanOrEqual(18);
    expect(W.players.filter((p) => p.c < 0).length).toBeGreaterThan(10);
  }, 90000);
});
