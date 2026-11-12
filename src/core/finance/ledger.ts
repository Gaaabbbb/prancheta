import { DIV_REP_TARGET, type Div } from '../constants/divisions';
import { RULES } from '../rules';
import { dateOf, seasonLastDay } from '../season/calendar';
import type { Club, FinDay, World } from '../types';

/** Categorias do extrato: bilheteria, patrocínio, bônus de patrocínio, salários, multas e rescisões. */
export type FinKey = 'bil' | 'pat' | 'bon' | 'sal' | 'mul' | 'tra';
export const FIN_KEYS: FinKey[] = ['bil', 'pat', 'bon', 'sal', 'mul', 'tra'];

/** Salários e patrocínios são pagos 10 vezes por temporada (de fevereiro a novembro). */
export const PAYDAYS = 10;

/**
 * Quantos meses de salário e patrocínio vencem na rodada `d`: os meses de fevereiro a novembro que começaram desde a
 * rodada anterior. Normalmente 0 ou 1; depois de uma pausa longa pode ser 2.
 */
export const paydayMonths = (W: World, d: number = W.day): number => {
  if (d < 2 || d > seasonLastDay(W)) return 0;
  const a = dateOf(W, d - 1).getMonth(),
    b = dateOf(W, d).getMonth();
  let n = 0;
  for (let m = a + 1; m <= b; m++) if (m >= 1 && m <= 10) n++;
  return n;
};

/** A rodada é dia de pagamento? */
export const isPayday = (W: World, d: number = W.day): boolean => paydayMonths(W, d) > 0;

/** Quantos pagamentos mensais ainda faltam na temporada (depois do dia atual). */
export const remainingPaydays = (W: World): number => {
  let n = 0;
  for (let d = W.day + 1, last = seasonLastDay(W); d <= last; d++) n += paydayMonths(W, d);
  return n;
};

/** Linha do extrato do dia atual (cria se ainda não existir). */
export const finDay = (W: World): FinDay => {
  W.finLog = W.finLog || [];
  let it = W.finLog[W.finLog.length - 1];
  if (!it || it.d !== W.day || it.y !== W.year) {
    it = { y: W.year, d: W.day, bil: 0, pat: 0, bon: 0, sal: 0, mul: 0, bal: 0 };
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
    it[k] = (it[k] || 0) + v;
    it.bal = c.bal;
  }
};

/**
 * Folha mensal de cada clube. Emprestados: quem está com o jogador paga a parte combinada, o dono paga o resto.
 */
export const wageBills = (W: World): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const p of W.players) {
    if (p.c < 0 || p.y) continue;
    if (p.loan) {
      out[p.c] = (out[p.c] || 0) + p.sal * p.loan.share;
      out[p.loan.from] = (out[p.loan.from] || 0) + p.sal * (1 - p.loan.share);
    } else out[p.c] = (out[p.c] || 0) + p.sal;
  }
  return out;
};

/** Folha salarial mensal de um clube (inclui a parte dos emprestados). */
export const monthlyWages = (W: World, clubId: number): number => wageBills(W)[clubId] || 0;

/** Fator de patrocínio por divisão (modelo 'div'). */
const SPONSOR_DIV: Record<Div, number> = { A: 0.7, B: 0.68, C: 0.7, D: 0.85, SUL: 0.8 };

/** Patrocínio anual em relação à folha anual. */
export const sponsorFactor = (c: Club): number =>
  RULES.sponsorModel === 'div'
    ? Math.max(0.45, SPONSOR_DIV[c.div] + (c.rep - DIV_REP_TARGET[c.div]) / 300)
    : 0.8 + c.rep / 250;
