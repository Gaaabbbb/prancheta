import { DIVS, type Div } from '../constants/divisions';
import { normName } from '../math';
import type { Database } from '../types';

/** Valida um banco vindo da planilha antes de começar uma carreira nova. */
export const validateDb = (db: Database) => {
  const errs: string[] = [],
    cnt: Record<Div, number> = { A: 0, B: 0, C: 0, D: 0, SUL: 0 };
  const names = new Set<string>(),
    sigs = new Set<string>();
  for (const c of db.clubs) {
    if (!(DIVS as readonly string[]).includes(c.div) && c.div !== 'SUL') {
      errs.push('Divisão inválida para ' + c.n + ': "' + c.div + '"');
      continue;
    }
    cnt[c.div as Div]++;
    const k = normName(c.n);
    if (names.has(k)) errs.push('Clube repetido: ' + c.n);
    names.add(k);
    if (c.s) {
      if (sigs.has(c.s)) errs.push('Sigla repetida: ' + c.s);
      sigs.add(c.s);
    }
  }
  if (cnt.A !== 20) errs.push('A Série A precisa ter 20 clubes (tem ' + cnt.A + ').');
  if (cnt.B !== 20) errs.push('A Série B precisa ter 20 clubes (tem ' + cnt.B + ').');
  if (cnt.C !== 20) errs.push('A Série C precisa ter 20 clubes (tem ' + cnt.C + ').');
  if (cnt.D < 64 || cnt.D > 96) errs.push('A Série D precisa ter entre 64 e 96 clubes (tem ' + cnt.D + ').');
  return { errs, cnt };
};
