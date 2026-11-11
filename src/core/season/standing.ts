import type { Competition, LeagueStage, TableRow, World } from '../types';
import { table } from './table';

export interface UserStanding {
  comp: Competition;
  si: number;
  gi: number;
  pos: number;
  row: TableRow;
  table: TableRow[];
  stage: LeagueStage;
}

/** Posição do usuário na fase de liga mais recente em que ele está. */
export const userStanding = (W: World): UserStanding | null => {
  if (W.user == null) return null;
  const comp = W.comps[W.clubs[W.user].div];
  let best: { si: number; gi: number } | null = null;
  comp.stages.forEach((s, i) => {
    if (s.type === 'league')
      s.groups.forEach((g, gi) => {
        if (g.includes(W.user!)) best = { si: i, gi };
      });
  });
  if (!best) return null;
  const { si, gi } = best;
  const t = table(W, comp, si, gi);
  const idx = t.findIndex((r) => r.c === W.user);
  return { comp, si, gi, pos: idx + 1, row: t[idx], table: t, stage: comp.stages[si] as LeagueStage };
};
