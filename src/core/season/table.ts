import type { Competition, LeagueStage, Tie, TableRow, World } from '../types';

/** Classificação de um grupo de uma fase de liga. */
export const table = (W: World, comp: Competition, si: number, gi: number): TableRow[] => {
  const st = comp.stages[si] as LeagueStage;
  const rows: Record<number, TableRow> = {};
  for (const c of st.groups[gi]) rows[c] = { c, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0, form: [] };
  for (const f of comp.fx) {
    if (f.st !== si || f.g !== gi || !f.pl) continue;
    const h = rows[f.h],
      a = rows[f.a];
    if (!h || !a) continue;
    const hg = f.hg!,
      ag = f.ag!;
    h.j++;
    a.j++;
    h.gp += hg;
    h.gc += ag;
    a.gp += ag;
    a.gc += hg;
    if (hg > ag) {
      h.v++;
      a.d++;
      h.pts += 3;
      h.form.push('V');
      a.form.push('D');
    } else if (hg < ag) {
      a.v++;
      h.d++;
      a.pts += 3;
      a.form.push('V');
      h.form.push('D');
    } else {
      h.e++;
      a.e++;
      h.pts++;
      a.pts++;
      h.form.push('E');
      a.form.push('E');
    }
  }
  // critérios: pontos, vitórias, saldo, gols pró, reputação
  return Object.values(rows).sort(
    (x, y) =>
      y.pts - x.pts || y.v - x.v || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp || W.clubs[y.c].rep - W.clubs[x.c].rep,
  );
};

/** Vencedor de um confronto de mata-mata (null se ainda não terminou). */
export const tieResult = (comp: Competition, tie: Tie, seedDecides: boolean): number | null => {
  const f1 = comp.fx[tie.f[0]],
    f2 = comp.fx[tie.f[1]];
  // jogo único: quem fez mais gols, ou os pênaltis
  if (tie.f[0] === tie.f[1]) {
    if (!f1.pl) return null;
    if (f1.hg! !== f1.ag!) return f1.hg! > f1.ag! ? f1.h : f1.a;
    return (f1.hp ?? 0) > (f1.ap ?? 0) ? f1.h : f1.a;
  }
  if (!f1.pl || !f2.pl) return null;
  const ga = f1.hg! + f2.ag!,
    gb = f1.ag! + f2.hg!;
  if (ga > gb) return tie.a;
  if (gb > ga) return tie.b;
  if (seedDecides) return tie.b;
  return f2.hp! > f2.ap! ? tie.b : tie.a;
};

export const stageDone = (comp: Competition, si: number): boolean => comp.fx.every((f) => f.st !== si || f.pl);
