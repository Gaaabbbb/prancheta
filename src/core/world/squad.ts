import type { Player, SquadIndex, World } from '../types';

/** Índice (em cache) de jogadores por clube, separando profissional e base. */
export const sqIdx = (W: World): SquadIndex => {
  if (W._sq) return W._sq;
  const p: Record<number, Player[]> = {},
    y: Record<number, Player[]> = {};
  for (const pl of W.players) {
    if (pl.c < 0) continue;
    const t = pl.y ? y : p;
    (t[pl.c] = t[pl.c] || []).push(pl);
  }
  return (W._sq = { p, y });
};

/** Invalida o cache: chame depois de mudar o clube ou o status de base de alguém. */
export const dirty = (W: World): void => {
  W._sq = null;
};

/** Elenco profissional (cópia). */
export const squad = (W: World, cid: number): Player[] => (sqIdx(W).p[cid] || []).slice();
/** Categoria de base (cópia). */
export const youth = (W: World, cid: number): Player[] => (sqIdx(W).y[cid] || []).slice();

/** Reconstrói o mapa id → jogador. */
export const rebuildPmap = (W: World): void => {
  W.pmap = {};
  W.players.forEach((p) => (W.pmap[p.id] = p));
};

/** Tira o jogador da escalação e do banco do clube. */
export const removeFromLineups = (W: World, pid: number, clubIds?: number[]): void => {
  const clubs = clubIds ? clubIds.map((id) => W.clubs[id]) : W.clubs;
  for (const c of clubs) {
    if (!c) continue;
    if (c.lineup) c.lineup = c.lineup.map((id) => (id === pid ? null : id));
    if (c.bench) c.bench = c.bench.filter((id) => id !== pid);
  }
};

/** Remove o jogador do jogo. */
export const release = (W: World, p: Player): void => {
  const c = W.clubs[p.c];
  W.players = W.players.filter((x) => x !== p);
  delete W.pmap[p.id];
  dirty(W);
  if (c) removeFromLineups(W, p.id, [c.id]);
};
