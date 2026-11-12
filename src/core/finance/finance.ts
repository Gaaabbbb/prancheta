import { TICKET } from '../constants/divisions';
import { clamp } from '../math';
import { rand } from '../rng';
import { RULES } from '../rules';
import type { Club, Competition, Fixture, World } from '../types';
import { squad } from '../world/squad';
import {
  addMoney,
  finDay,
  monthlyWages,
  paydayMonths,
  PAYDAYS,
  remainingPaydays,
  sponsorFactor,
  wageBills,
} from './ledger';
import { ensureSponsors, sponsorAnnual, sponsorPay } from './sponsors';

/** Taxa de ocupação base do estádio (sem o sorteio do dia). Modelo original. */
const baseFill = (h: Club, oppRep: number): number => 0.22 + h.rep / 190 + (oppRep - 50) / 400;

/** Torcida que costuma ir ao estádio num jogo comum, pela reputação (rep 90 ≈ 59 mil, rep 50 ≈ 20 mil, rep 30 ≈ 8 mil). */
export const fanBase = (rep: number): number => 2000 + rep * rep * 7;

/** Parte da torcida que vai num jogo, pelo tamanho do adversário (sem o sorteio do dia). */
const demandShare = (oppRep: number): number => 0.5 + (oppRep - 50) / 300;

/**
 * Público do jogo. `noise` é o sorteio do dia (-0,05 a 0,05); `elastic`, o efeito do preço do ingresso.
 * No modelo de torcida, o preço mexe na procura e o estádio só limita depois (estádio lotado aguenta preço maior).
 */
const gateAttendance = (h: Club, oppRep: number, noise: number, elastic: number): number => {
  if (RULES.gateModel === 'demand')
    return Math.round(Math.min(h.cap, fanBase(h.rep) * clamp(demandShare(oppRep) + noise, 0.15, 0.95) * elastic));
  const att = Math.round(h.cap * clamp(baseFill(h, oppRep) + noise, 0.08, 0.98));
  return Math.min(h.cap, Math.round(att * elastic));
};

/**
 * Efeito do preço do ingresso no público (1 = preço padrão). No modelo de torcida, acima do padrão o público cai mais
 * rápido que o preço sobe: só compensa cobrar mais quando o estádio lota.
 */
export const ticketElasticity = (h: Club, price: number): number => {
  const r = TICKET[h.div] / price;
  if (RULES.gateModel === 'demand') return clamp(Math.pow(r, r >= 1 ? 0.6 : 1.4), 0.15, 1.6);
  return clamp(Math.pow(r, 0.6), 0.3, 1.6);
};

/** Público e bilheteria do mandante. */
export const matchMoney = (W: World, _comp: Competition, f: Fixture): void => {
  const h = W.clubs[f.h];
  const noise = rand() * 0.1 - 0.05;
  const price = h.id === W.user && W.ticket ? W.ticket : TICKET[h.div];
  const elastic = h.id === W.user && W.ticket ? ticketElasticity(h, W.ticket) : 1;
  const att2 = gateAttendance(h, W.clubs[f.a].rep, noise, elastic);
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
  const att = gateAttendance(h, oppRep, 0, ticketElasticity(h, price));
  return { att, rev: att * price };
};

/** Patrocínio anual dos clubes da IA (calculado uma vez por temporada). */
export const sponsorYear = (W: World, c: Club, wages?: number | null): number => {
  if (c.spon == null) {
    if (wages == null) wages = squad(W, c.id).reduce((t, p) => t + p.sal, 0);
    c.spon = Math.round((wages * 10 * sponsorFactor(c)) / 1e5) * 1e5;
  }
  return c.spon;
};

/**
 * Movimento do dia. No primeiro dia de jogos de cada mês (10 por temporada) saem os salários do mês
 * e entram as parcelas de patrocínio. O usuário recebe dos contratos dele; a IA, do patrocínio genérico.
 */
export const dailyMoney = (W: World): void => {
  if (W.user != null) ensureSponsors(W);
  const months = paydayMonths(W);
  if (!months) return;
  const wages = wageBills(W);
  for (const c of W.clubs) {
    if (c.id === W.user && W.sp) sponsorPay(W, months);
    else addMoney(W, c, 'pat', (sponsorYear(W, c, wages[c.id] || 0) / PAYDAYS) * months);
    addMoney(W, c, 'sal', -(wages[c.id] || 0) * months);
  }
};

/** Saldo do usuário no início da temporada atual. */
export const seasonStartBalance = (W: World): number => {
  const c = W.clubs[W.user!];
  const f = W.fin || {};
  return c.bal - Object.values(f).reduce((t, v) => t + (v || 0), 0);
};

/** Jogos em casa do usuário ainda não disputados (só os já marcados no calendário). */
export const remainingHomeGames = (W: World): { f: Fixture; comp: Competition }[] => {
  const out: { f: Fixture; comp: Competition }[] = [];
  for (const comp of Object.values(W.comps))
    for (const f of comp.fx) if (!f.pl && f.h === W.user) out.push({ f, comp });
  return out.sort((a, b) => a.f.d - b.f.d);
};

/** Projeção do saldo no fim da temporada: parcelas de patrocínio, salários e bilheteria esperada. */
export const seasonProjection = (W: World): { bal: number; gate: number; monthly: number; months: number } => {
  const c = W.clubs[W.user!];
  const months = remainingPaydays(W);
  const annual = W.sp ? sponsorAnnual(W) : sponsorYear(W, c);
  const monthly = annual / PAYDAYS - monthlyWages(W, c.id);
  const price = W.ticket || TICKET[c.div];
  const gate = remainingHomeGames(W).reduce((t, { f }) => t + expectedGate(c, W.clubs[f.a].rep, price).rev, 0);
  return { bal: c.bal + monthly * months + gate, gate, monthly, months };
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
    bon: f.bon || 0,
    sal: f.sal || 0,
    mul: f.mul || 0,
    tra: f.tra || 0,
    pre: f.pre || 0,
    bal: c.bal,
  });
  W.finLog = [];
};
