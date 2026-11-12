import { SEASON_DAYS } from '../constants/divisions';
import { dateOf } from '../season/calendar';
import type { Club, FinDay, World } from '../types';
import { squad } from '../world/squad';

/** Categorias do extrato: bilheteria, patrocínio, bônus de patrocínio, salários, multas e rescisões. */
export type FinKey = 'bil' | 'pat' | 'bon' | 'sal' | 'mul';
export const FIN_KEYS: FinKey[] = ['bil', 'pat', 'bon', 'sal', 'mul'];

/** Salários e patrocínios são pagos 10 vezes por temporada (de fevereiro a novembro). */
export const PAYDAYS = 10;

/** O dia de jogos é o primeiro do mês? Nele saem salários e parcelas de patrocínio. */
export const isPayday = (W: World, d: number = W.day): boolean =>
  d >= 2 && d <= SEASON_DAYS && dateOf(W, d).getMonth() !== dateOf(W, d - 1).getMonth();

/** Quantos pagamentos mensais ainda faltam na temporada (depois do dia atual). */
export const remainingPaydays = (W: World): number => {
  let n = 0;
  for (let d = W.day + 1; d <= SEASON_DAYS; d++) if (isPayday(W, d)) n++;
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

/** Folha salarial mensal do elenco profissional. */
export const monthlyWages = (W: World, clubId: number): number =>
  squad(W, clubId).reduce((t, p) => t + (p.y ? 0 : p.sal), 0);
