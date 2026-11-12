import { dateOf, type FinDay, type World } from '@/core';

export const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTH_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Movimento de um mês do extrato. */
export interface FinMonth {
  m: number;
  bil: number;
  pat: number;
  bon: number;
  sal: number;
  mul: number;
  tra: number;
  /** premiação das copas */
  pre: number;
  /** receitas - despesas */
  net: number;
  /** saldo no fim do mês (ou no último dia registrado) */
  bal: number;
  /** jogos em casa do mês */
  games: FinDay[];
  /** dias com multa ou rescisão */
  fines: FinDay[];
}

/** Agrupa o extrato diário por mês do calendário. */
export const monthBuckets = (W: World, log: FinDay[]): FinMonth[] => {
  const out: FinMonth[] = [];
  for (const it of log) {
    const m = dateOf(W, it.d).getMonth();
    let b = out[out.length - 1];
    if (!b || b.m !== m) {
      b = { m, bil: 0, pat: 0, bon: 0, sal: 0, mul: 0, tra: 0, pre: 0, net: 0, bal: it.bal, games: [], fines: [] };
      out.push(b);
    }
    b.bil += it.bil || 0;
    b.pat += it.pat || 0;
    b.bon += it.bon || 0;
    b.sal += it.sal || 0;
    b.mul += it.mul || 0;
    b.tra += it.tra || 0;
    b.pre += it.pre || 0;
    b.net = b.bil + b.pat + b.bon + b.sal + b.mul + b.tra + b.pre;
    b.bal = it.bal;
    if (it.att != null) b.games.push(it);
    if (it.mul) b.fines.push(it);
  }
  return out;
};
