import { clamp } from '../math';
import type { World } from '../types';
import { teamStrength } from '../world/strength';

/** Define a meta da diretoria pela força do elenco em relação à divisão. */
export const setBoardGoals = (W: World): void => {
  if (W.user == null) return;
  const me = W.clubs[W.user];
  const peers = W.clubs.filter((c) => c.div === me.div).sort((a, b) => teamStrength(W, b) - teamStrength(W, a));
  const rank = peers.indexOf(me) / peers.length;
  let exp: number;
  if (me.div === 'A') exp = rank < 0.12 ? 4 : rank < 0.4 ? 2 : rank < 0.75 ? 1 : 0;
  else exp = rank < 0.15 ? 4 : rank < 0.35 ? 3 : rank < 0.7 ? 1 : 0;
  if (me.div !== 'A' && exp === 4) exp = 3;
  if (me.div === 'A' && rank < 0.05) exp = 4;
  W.board = { exp, conf: W.board && W.board.conf !== undefined ? clamp(W.board.conf * 0.5 + 30, 30, 80) : 60, rank };
};

/** Ajusta a confiança da diretoria depois de um jogo do usuário. */
export const boardAfterMatch = (W: World, gf: number, ga: number): void => {
  W.board = W.board || { exp: 1, conf: 60 };
  W.board.conf = clamp(W.board.conf + (gf > ga ? 3 : gf < ga ? -3 : 0) * (W.board.exp >= 3 ? 1.2 : 1), 0, 100);
};
