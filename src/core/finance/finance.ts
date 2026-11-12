import { SEASON_DAYS, TICKET } from '../constants/divisions';
import { clamp } from '../math';
import { rand } from '../rng';
import type { Club, Competition, FinDay, Fixture, World } from '../types';
import { squad } from '../world/squad';

/** Categorias do extrato: bil = bilheteria, pat = patrocínio, sal = salários, inv = investimentos */
export type FinKey = 'bil' | 'pat' | 'sal' | 'inv';

/** Linha do extrato do dia atual (cria se ainda não existir). */
const finDay = (W: World): FinDay => {
  W.finLog = W.finLog || [];
  let it = W.finLog[W.finLog.length - 1];
  if (!it || it.d !== W.day || it.y !== W.year) {
    it = { y: W.year, d: W.day, bil: 0, pat: 0, sal: 0, inv: 0, bal: 0 };
    W.finLog.push(it);
  }
  return it;
};

export const addMoney = (W: World, c: Club, k: FinKey, v: number): void => {
  c.bal += v;
  if (c.id === W.user) {
    W.fin = W.fin || {};
    W.fin[k] = (W.fin[k] || 0) + v;
    const it = finDay(W);
    it[k] += v;
    it.bal = c.bal;
  }
};

/** Taxa de ocupação base do estádio (sem o sorteio do dia). */
const baseFill = (h: Club, oppRep: number): number => 0.22 + h.rep / 190 + (oppRep - 50) / 400;

/** Efeito do preço do ingresso no público (1 = preço padrão). */
export const ticketElasticity = (h: Club, price: number): number =>
  clamp(Math.pow(TICKET[h.div] / price, 0.6), 0.3, 1.6);

/** Público e bilheteria do mandante. */
export const matchMoney = (W: World, _comp: Competition, f: Fixture): void => {
  const h = W.clubs[f.h];
  const fill = clamp(baseFill(h, W.clubs[f.a].rep) + (rand() * 0.1 - 0.05), 0.08, 0.98);
  const att = Math.round(h.cap * fill);
  const price = h.id === W.user && W.ticket ? W.ticket : TICKET[h.div];
  const elastic = h.id === W.user && W.ticket ? ticketElasticity(h, W.ticket) : 1;
  const att2 = Math.min(h.cap, Math.round(att * elastic));
  f.att = att2;
  addMoney(W, h, 'bil', att2 * price);
  if (h.id === W.user) {
    const it = finDay(W);
    it.att = att2;
    it.opp = f.a;
  }
};

/** Público e renda esperados (média, sem o sorteio do dia) de um jogo em casa. */
export const expectedGate = (h: Club, oppRep: number, price: number): { att: number; rev: number } => {
  const fill = clamp(baseFill(h, oppRep), 0.08, 0.98);
  const att = Math.min(h.cap, Math.round(Math.round(h.cap * fill) * ticketElasticity(h, price)));
  return { att, rev: att * price };
};

/** Patrocínio anual (calculado uma vez por temporada). */
export const sponsorYear = (W: World, c: Club, wages?: number | null): number => {
  if (c.spon == null) {
    if (wages == null) wages = squad(W, c.id).reduce((t, p) => t + p.sal, 0);
    c.spon = Math.round((wages * 10 * (0.8 + c.rep / 250)) / 1e5) * 1e5;
  }
  return c.spon;
};

/** Folha salarial mensal do elenco profissional. */
export const monthlyWages = (W: World, clubId: number): number =>
  squad(W, clubId).reduce((t, p) => t + (p.y ? 0 : p.sal), 0);

/** Receitas e despesas de cada dia de jogos (a temporada tem 40). */
export const dailyMoney = (W: World): void => {
  const wages: Record<number, number> = {};
  for (const p of W.players) if (p.c >= 0 && !p.y) wages[p.c] = (wages[p.c] || 0) + p.sal;
  for (const c of W.clubs) {
    addMoney(W, c, 'pat', sponsorYear(W, c, wages[c.id] || 0) / SEASON_DAYS);
    addMoney(W, c, 'sal', (-(wages[c.id] || 0) * 10) / SEASON_DAYS);
  }
};

/** Saldo do usuário no início da temporada atual. */
export const seasonStartBalance = (W: World): number => {
  const c = W.clubs[W.user!];
  const f = W.fin || {};
  return c.bal - (f.bil || 0) - (f.pat || 0) - (f.sal || 0) - (f.inv || 0);
};

/** Jogos em casa do usuário ainda não disputados (só os já marcados no calendário). */
export const remainingHomeGames = (W: World): { f: Fixture; comp: Competition }[] => {
  const out: { f: Fixture; comp: Competition }[] = [];
  for (const comp of Object.values(W.comps))
    for (const f of comp.fx) if (!f.pl && f.h === W.user) out.push({ f, comp });
  return out.sort((a, b) => a.f.d - b.f.d);
};

/** Projeção do saldo no fim da temporada, com patrocínio, salários e bilheteria esperada. */
export const seasonProjection = (W: World): { bal: number; gate: number; daily: number; days: number } => {
  const c = W.clubs[W.user!];
  const days = Math.max(0, SEASON_DAYS - W.day);
  const daily = sponsorYear(W, c) / SEASON_DAYS - (monthlyWages(W, c.id) * 10) / SEASON_DAYS;
  const price = W.ticket || TICKET[c.div];
  const gate = remainingHomeGames(W).reduce((t, { f }) => t + expectedGate(c, W.clubs[f.a].rep, price).rev, 0);
  return { bal: c.bal + daily * days + gate, gate, daily, days };
};

/** Custo de cada lugar novo no estádio. */
export const seatCost = (c: Club): number => TICKET[c.div] * 50;
export const MAX_CAPACITY = 90000;

/** Amplia o estádio do usuário. Retorna false se não houver dinheiro ou espaço. */
export const expandStadium = (W: World, seats: number): boolean => {
  const c = W.clubs[W.user!];
  const n = Math.min(seats, MAX_CAPACITY - c.cap);
  const cost = n * seatCost(c);
  if (n <= 0 || cost > c.bal) return false;
  addMoney(W, c, 'inv', -cost);
  c.cap += n;
  return true;
};

/** Fecha as contas da temporada (chamado na virada de ano, antes de zerar o extrato). */
export const closeFinances = (W: World): void => {
  if (W.user == null) return;
  const c = W.clubs[W.user];
  const f = W.fin || {};
  W.finHist = W.finHist || [];
  W.finHist.push({
    year: W.year,
    div: c.div,
    bil: f.bil || 0,
    pat: f.pat || 0,
    sal: f.sal || 0,
    inv: f.inv || 0,
    bal: c.bal,
  });
  W.finLog = [];
};
