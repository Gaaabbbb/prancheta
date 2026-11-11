import { promD, targetC } from '../constants/divisions';
import type { Competition, KOStage, LeagueStage, World } from '../types';
import { addKOStage, addLeagueStage } from './fixtures';
import { stageDone, table, tieResult } from './table';

/** Quantos clubes caem da Série C (o formato muda até 2028). */
export const serieCRelegations = (comp: Competition, year: number): number =>
  Math.max(0, comp.n + 4 + promD(year) - 4 - targetC(year + 1));

/**
 * Quando a fase atual termina, apura o resultado e cria a próxima fase.
 * Regras de cada divisão (formato 2026):
 * - A: 38 rodadas, 4 caem.
 * - B: 38 rodadas, 1º e 2º sobem; 3º–6º disputam playoff por mais 2 vagas.
 * - C: primeira fase, 2 quadrangulares (2 sobem de cada), final entre os líderes.
 * - D: 16 grupos, mata-mata; semifinalistas sobem; repescagem dos eliminados nas quartas.
 */
export const advanceComp = (W: World, comp: Competition): void => {
  const div = comp.id;
  const cur = comp.stages[comp.si];
  if (!stageDone(comp, comp.si)) return;
  // fases paralelas (repescagem da D) também precisam estar concluídas
  for (let i = 0; i < comp.stages.length; i++) if (!stageDone(comp, i)) return;
  comp.stages.forEach((st) => {
    if (st.type === 'ko' && !st.done) {
      st.ties.forEach((t) => (t.w = tieResult(comp, t, st.seedDecides)));
      st.done = true;
    } else if (st.type === 'league') st.done = true;
  });
  const next = W.day + 1;
  const rows = (gi: number) => table(W, comp, comp.si, gi);
  const N = comp.stages.length;
  if (div === 'A') {
    const t = rows(0);
    comp.res.champ = t[0].c;
    comp.res.rel = t.slice(-4).map((r) => r.c);
    comp.done = true;
    comp.res.lib = t.slice(0, 6).map((r) => r.c);
  } else if (div === 'B') {
    if (N === 1) {
      const t = rows(0);
      comp.res.champ = t[0].c;
      comp.res.prom = [t[0].c, t[1].c];
      comp.res.rel = t.slice(-4).map((r) => r.c);
      addKOStage(
        comp,
        'Playoff de acesso',
        [
          { a: t[5].c, b: t[2].c },
          { a: t[4].c, b: t[3].c },
        ],
        next,
        { seedDecides: true },
      );
    } else {
      comp.res.prom.push(...(cur as KOStage).ties.map((t) => t.w!));
      comp.done = true;
    }
  } else if (div === 'C') {
    if (N === 1) {
      let q1: number[], q2: number[], rel: number[];
      const relN = serieCRelegations(comp, W.year);
      if ((cur as LeagueStage).groups.length === 1) {
        const t = rows(0);
        q1 = [t[0], t[3], t[4], t[7]].map((r) => r.c);
        q2 = [t[1], t[2], t[5], t[6]].map((r) => r.c);
        rel = t.slice(t.length - relN).map((r) => r.c);
      } else {
        const a = rows(0),
          b = rows(1);
        q1 = [a[0], b[1], a[2], b[3]].map((r) => r.c);
        q2 = [b[0], a[1], b[2], a[3]].map((r) => r.c);
        const ra = Math.ceil(relN / 2),
          rb = relN - ra;
        rel = [...a.slice(a.length - ra), ...b.slice(b.length - rb)].map((r) => r.c);
      }
      comp.res.rel = relN ? rel : [];
      addLeagueStage(comp, 'Quadrangulares', [q1, q2], true, next);
    } else if (N === 2) {
      const a = rows(0),
        b = rows(1);
      comp.res.prom = [a[0].c, a[1].c, b[0].c, b[1].c];
      addKOStage(comp, 'Final', [{ a: b[0].c, b: a[0].c }], next);
    } else {
      comp.res.champ = (cur as KOStage).ties[0].w;
      comp.done = true;
    }
  } else if (div === 'D') {
    if (N === 1) {
      const gs = (cur as LeagueStage).groups.map((_g, gi) => rows(gi));
      const pts: Record<number, number> = {};
      gs.forEach((t) => t.forEach((r, i) => (pts[r.c] = r.pts * 10 + (r.gp - r.gc) + (4 - i) * 1000)));
      comp.seedPts = pts;
      const ties: { a: number; b: number }[] = [];
      for (let g = 0; g < gs.length; g += 2) {
        const A = gs[g],
          B = gs[g + 1] || gs[g];
        ties.push(
          { a: B[3].c, b: A[0].c },
          { a: B[2].c, b: A[1].c },
          { a: A[3].c, b: B[0].c },
          { a: A[2].c, b: B[1].c },
        );
      }
      addKOStage(comp, 'Segunda fase', ties, next, { tag: 'r64' });
    } else {
      const last = comp.stages[comp.si] as KOStage;
      const winners = last.ties.map((t) => t.w!);
      const seed = (c: number) => comp.seedPts![c] || 0;
      const mk = (list: number[]) => {
        const out: { a: number; b: number }[] = [];
        for (let i = 0; i < list.length; i += 2) {
          const x = list[i],
            y = list[i + 1];
          out.push(seed(x) >= seed(y) ? { a: y, b: x } : { a: x, b: y });
        }
        return out;
      };
      const names: Record<number, string> = {
        32: 'Terceira fase',
        16: 'Oitavas de final',
        8: 'Quartas de final',
        4: 'Semifinal',
        2: 'Final',
      };
      if (winners.length >= 2) {
        if (winners.length === 4) {
          // semifinalistas sobem
          comp.res.prom = winners.slice();
          if (promD(W.year) === 6) {
            const losers = last.ties.map((t) => (t.w === t.a ? t.b : t.a));
            addKOStage(comp, 'Repescagem de acesso', mk(losers), next, { parallel: true, tag: 'po' });
          }
        }
        const nm = names[winners.length] || 'Mata-mata';
        // não confundir com a repescagem: comp.si aponta para a chave principal
        addKOStage(comp, nm, mk(winners), next, { tag: 'main' });
      } else {
        comp.res.champ = winners[0];
        const po = comp.stages.find((s) => s.type === 'ko' && s.tag === 'po') as KOStage | undefined;
        if (po) comp.res.prom.push(...po.ties.map((t) => t.w!));
        comp.done = true;
      }
    }
  }
  if (comp.done && comp.stages.some((s) => s.type === 'ko' && s.tag === 'po' && !s.done)) comp.done = false;
};
