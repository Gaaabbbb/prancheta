import { DIV_MIN_SAL, type Div } from '../constants/divisions';
import type { Player } from '../types';
import { ovr } from './ratings';

export const baseValue = (o: number): number => 30000 * Math.pow(1.27, o - 50);

export const ageFactor = (a: number): number =>
  a <= 21 ? 1.5 : a <= 24 ? 1.3 : a <= 28 ? 1.1 : a <= 30 ? 0.85 : a <= 32 ? 0.55 : a <= 34 ? 0.35 : 0.18;

/** Valor de mercado (R$). */
export const calcValue = (pl: Player): number => {
  const o = ovr(pl);
  const pot = Math.max(o, pl.pt || o);
  const v = baseValue(o * 0.8 + pot * 0.2) * ageFactor(pl.a);
  return Math.round(v / 10000) * 10000 || 5000;
};

/** Salário mensal (R$). */
export const calcWage = (pl: Player, div: Div): number =>
  Math.max(DIV_MIN_SAL[div] || 3000, Math.round((baseValue(ovr(pl)) * 0.03) / 1000) * 1000);
