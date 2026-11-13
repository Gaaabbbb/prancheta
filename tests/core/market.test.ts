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
  stepDay,
  playerDemand,
  releasePlayer,
  renewContract,
  rng,
  sellBlock,
  setForSale,
  squad,
  windowState,
  marketDate,
  keyRole,
  untouchable,
  calcValue,
  counterIncoming,
  getTalk,
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
  W.players.find(
    (p) => p.c >= 0 && p.c !== W.user && !p.y && ovr(p) <= maxOvr && ovr(p) >= 60 && !sellBlock(W, p) && !keyRole(W, p),
  )!;

describe('mercado', () => {
  it('janelas: 5/jan a 3/mar, complementar de 4 a 27/mar e 20/jul a 11/set', () => {
    const W = career();
    expect(windowState(W).open).toBe(true); // pré-temporada
    const names = new Set<string>();
    let closed = 0;
    for (let d = W.day; d < 360; d += 3) {
      W.day = d;
      const ws = windowState(W);
      const dt = marketDate(W);
      const md = dt.getMonth() * 100 + dt.getDate();
      const inside = (md >= 5 && md <= 227) || (md >= 620 && md <= 811);
      expect(ws.open).toBe(inside);
      if (ws.open) names.add(ws.name);
      else closed++;
    }
    expect([...names].sort()).toEqual(['1ª janela', '2ª janela', 'Janela complementar']);
    expect(closed).toBeGreaterThan(10);
  });

  it('destaques: custam bem mais, às vezes são inegociáveis, e a IA não os tira', () => {
    const W = career();
    const stars = W.players.filter((p) => p.c >= 0 && p.c !== W.user && keyRole(W, p) === 'star').slice(0, 60);
    expect(stars.length).toBeGreaterThan(20);
    for (const p of stars.filter((x) => x.ct >= W.year + 2).slice(0, 10))
      expect(askingPrice(W, p)).toBeGreaterThan(calcValue(p) * 1.5);
    const locked = stars.filter((p) => untouchable(W, p));
    expect(locked.length).toBeGreaterThan(0);
    expect(locked.length).toBeLessThan(stars.length);
    const p = locked.find((x) => !sellBlock(W, x));
    if (p) expect(offerToClub(W, p.id, askingPrice(W, p) * 3).r).toBe('reject');
  });

  it('compra: clube aceita o preço pedido e o jogador assina', () => {
    const W = career();
    const p = target(W);
    const from = p.c;
    const ask = askingPrice(W, p);
    // proposta ofensiva: o clube nem se mexe e a paciência cai duas rodadas
    const low = offerToClub(W, p.id, Math.round(ask * 0.5));
    expect(low.r).toBe('counter');
    expect(getTalk(W, p.id, 'club')!.pat).toBe(getTalk(W, p.id, 'club')!.pat0 - 2);
    expect(offerToClub(W, p.id, ask).r).toBe('accept');
    // fecha pelo pedido atual do clube (que pode ter descido um pouco)
    const fee = W.mk!.agreed[p.id].fee;
    expect(fee).toBeLessThanOrEqual(ask);
    const d = playerDemand(W, p, 'buy');
    if (d.refuse) return;
    const bal = W.clubs[0].bal,
      sellerBal = W.clubs[from].bal;
    const ans = offerContract(W, p.id, d.wage, d.years[0]);
    expect(ans.r).toBe('accept');
    expect(p.c).toBe(0);
    expect(p.sal).toBe(d.wage);
    expect(W.clubs[0].bal).toBe(bal - fee);
    expect(W.clubs[from].bal).toBe(sellerBal + fee);
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

  it('empréstimo: a parte do salário é negociada e o jogador volta no fim da temporada', () => {
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
    // proposta baixa: o clube responde com a parte que quer que o usuário pague
    const c = loanRequest(W, p.id, 0);
    expect(c.r).toBe('counter');
    const sh = c.r === 'counter' ? c.share! : 0;
    expect(sh).toBeGreaterThan(0);
    expect(sh).toBeLessThanOrEqual(1);
    expect(loanRequest(W, p.id, sh).r).toBe('accept');
    expect(offerContract(W, p.id, 0, 1).r).toBe('accept');
    expect(p.c).toBe(0);
    expect(p.loan).toEqual({ from: owner, share: sh });
    expect(monthlyWages(W, 0)).toBeCloseTo(before + p.sal * sh, 0);
    while (!W.seasonDone) stepDay(W);
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

  it('negociação em rodadas: o clube desce a cada proposta e fecha antes de perder a paciência', () => {
    const W = career();
    const p = target(W);
    const ask = askingPrice(W, p);
    let offer = Math.round(ask * 0.8);
    const asks: number[] = [];
    let r = offerToClub(W, p.id, offer);
    while (r.r === 'counter') {
      asks.push(r.fee);
      offer = Math.round((offer + r.fee) / 2);
      r = offerToClub(W, p.id, offer);
    }
    expect(r.r).toBe('accept');
    // o pedido só desce
    for (let i = 1; i < asks.length; i++) expect(asks[i]).toBeLessThanOrEqual(asks[i - 1]);
    expect(W.mk!.agreed[p.id].fee).toBeLessThan(ask);
    const t = getTalk(W, p.id, 'club')!;
    expect(t.log[0].by).toBe('them');
    expect(t.log.length).toBeGreaterThanOrEqual(3);
  });

  it('teimosia: proposta baixa repetida acaba a conversa na janela', () => {
    const W = career();
    const p = target(W);
    const ask = askingPrice(W, p);
    let r = offerToClub(W, p.id, Math.round(ask * 0.4));
    let n = 1;
    while (r.r === 'counter' && n++ < 10) r = offerToClub(W, p.id, Math.round(ask * 0.4));
    expect(r.r).toBe('reject');
    expect(n).toBeLessThanOrEqual(3);
    expect(offerToClub(W, p.id, ask * 2).r).toBe('reject');
  });

  it('proposta recebida: pedir mais faz o clube subir; pedido aceito vende na hora', () => {
    const W = career();
    const p = squad(W, 0).sort((a, b) => ovr(a) - ovr(b))[6];
    W.mk!.offers.push({ id: 77, pid: p.id, from: 5, kind: 'buy', fee: 1e6, share: 1, exp: 99, max: 1.4e6 });
    const r1 = counterIncoming(W, 77, 2e6);
    expect(r1.r).toBe('counter');
    const o = W.mk!.offers.find((x) => x.id === 77)!;
    expect(o.fee).toBeGreaterThan(1e6);
    expect(o.fee).toBeLessThanOrEqual(1.4e6);
    const bal = W.clubs[0].bal;
    // pedir abaixo do que eles já oferecem fecha pela oferta deles
    const now = o.fee;
    const r2 = counterIncoming(W, 77, Math.min(now, 1.35e6));
    expect(r2.r).toBe('sold');
    expect(p.c).toBe(5);
    expect(W.clubs[0].bal).toBe(bal + now);
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
    while (!W.seasonDone) stepDay(W);
    endSeason(W);
    for (const p of ending) if (W.pmap[p.id]) expect(W.pmap[p.id].c).not.toBe(45);
    expect(W.mk!.log.some((r) => r.kind === 'compra' || r.kind === 'livre')).toBe(true);
    for (const c of W.clubs) expect(squad(W, c.id).length).toBeGreaterThanOrEqual(18);
    expect(W.players.filter((p) => p.c < 0).length).toBeGreaterThan(10);
  }, 90000);
});
