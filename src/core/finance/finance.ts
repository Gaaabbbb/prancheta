import { TICKET } from '../constants/divisions';
import { clamp } from '../math';
import { rand } from '../rng';
import type { Club, Competition, Fixture, World } from '../types';
import { squad } from '../world/squad';

/** Categorias do extrato: bil = bilheteria, pat = patrocínio, sal = salários */
export type FinKey = 'bil' | 'pat' | 'sal';

export const addMoney = (W: World, c: Club, k: FinKey, v: number): void => {
  c.bal += v;
  if (c.id === W.user) {
    W.fin = W.fin || {};
    W.fin[k] = (W.fin[k] || 0) + v;
  }
};

/** Público e bilheteria do mandante. */
export const matchMoney = (W: World, _comp: Competition, f: Fixture): void => {
  const h = W.clubs[f.h];
  const fill = clamp(0.22 + h.rep / 190 + (W.clubs[f.a].rep - 50) / 400 + (rand() * 0.1 - 0.05), 0.08, 0.98);
  const att = Math.round(h.cap * fill);
  const price = h.id === W.user && W.ticket ? W.ticket : TICKET[h.div];
  const elastic = h.id === W.user && W.ticket ? clamp(Math.pow(TICKET[h.div] / W.ticket, 0.6), 0.3, 1.6) : 1;
  const att2 = Math.min(h.cap, Math.round(att * elastic));
  f.att = att2;
  addMoney(W, h, 'bil', att2 * price);
};

/** Patrocínio anual (calculado uma vez por temporada). */
export const sponsorYear = (W: World, c: Club, wages?: number | null): number => {
  if (c.spon == null) {
    if (wages == null) wages = squad(W, c.id).reduce((t, p) => t + p.sal, 0);
    c.spon = Math.round((wages * 10 * (0.8 + c.rep / 250)) / 1e5) * 1e5;
  }
  return c.spon;
};

/** Receitas e despesas de cada dia de jogos (a temporada tem 40). */
export const dailyMoney = (W: World): void => {
  const wages: Record<number, number> = {};
  for (const p of W.players) if (p.c >= 0 && !p.y) wages[p.c] = (wages[p.c] || 0) + p.sal;
  for (const c of W.clubs) {
    addMoney(W, c, 'pat', sponsorYear(W, c, wages[c.id] || 0) / 40);
    addMoney(W, c, 'sal', (-(wages[c.id] || 0) * 10) / 40);
  }
};
