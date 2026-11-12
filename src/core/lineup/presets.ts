import type { SavedTactic, World } from '../types';
import { tidyLineup } from './lineup';

export const MAX_TACTICS = 8;

const snapshotOf = (W: World) => {
  const me = W.clubs[W.user!];
  return { tac: { ...me.tac }, lineup: (me.lineup || []).slice(), bench: (me.bench || []).slice() };
};

/** Salva a tática atual (formação, instruções, titulares e banco) com um nome. Retorna o id, ou null se cheio. */
export const saveTactic = (W: World, name: string): number | null => {
  W.tacs = W.tacs || [];
  if (W.tacs.length >= MAX_TACTICS) return null;
  const id = Math.max(0, ...W.tacs.map((t) => t.id)) + 1;
  W.tacs.push({ id, name: name.trim() || `Tática ${id}`, ...snapshotOf(W) });
  W.tacActive = id;
  return id;
};

/** Grava a tática atual por cima de uma salva. */
export const updateTactic = (W: World, id: number): void => {
  const t = W.tacs?.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, snapshotOf(W));
  W.tacActive = id;
};

export const renameTactic = (W: World, id: number, name: string): void => {
  const t = W.tacs?.find((x) => x.id === id);
  if (t && name.trim()) t.name = name.trim();
};

export const deleteTactic = (W: World, id: number): void => {
  W.tacs = (W.tacs || []).filter((t) => t.id !== id);
  if (W.tacActive === id) W.tacActive = undefined;
};

/**
 * Usa uma tática salva. Quem saiu do clube dá lugar ao melhor disponível; lesionados e suspensos voltam para
 * onde estavam e aparecem como desfalque (a troca continua sendo do usuário).
 */
export const applyTactic = (W: World, id: number): SavedTactic | null => {
  const t = W.tacs?.find((x) => x.id === id);
  if (!t) return null;
  const me = W.clubs[W.user!];
  me.tac = { ...t.tac };
  me.userTac = { ...t.tac };
  me.lineup = t.lineup.slice();
  me.bench = t.bench.slice();
  tidyLineup(W, me);
  W.tacActive = id;
  return t;
};

/** A tática atual é igual à salva? (formação e instruções) */
export const tacticMatches = (W: World, t: SavedTactic): boolean => {
  const a = W.clubs[W.user!].tac,
    b = t.tac;
  return a.f === b.f && a.men === b.men && a.pres === b.pres && a.temp === b.temp && a.lin === b.lin;
};
