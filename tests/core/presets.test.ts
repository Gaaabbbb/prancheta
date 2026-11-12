import { describe, expect, it } from 'vitest';
import {
  applyTactic,
  autoLineup,
  createWorld,
  deleteTactic,
  loadDefaultDb,
  MAX_TACTICS,
  perfRating,
  saveTactic,
  squad,
  updateTactic,
  validateLineup,
} from '../../src/core';

describe('táticas salvas', async () => {
  const W = createWorld(21, await loadDefaultDb());
  W.user = 0;
  const me = W.clubs[0];
  validateLineup(W, me);

  it('salva, troca e volta para a tática com formação, instruções e escalação', () => {
    const a = saveTactic(W, 'Casa')!;
    const lineupA = me.lineup!.slice();
    me.tac.f = '3-5-2';
    me.tac.men = 3;
    autoLineup(W, me);
    const b = saveTactic(W, 'Fora')!;
    expect(W.tacs!.map((t) => t.name)).toEqual(['Casa', 'Fora']);
    applyTactic(W, a);
    expect(me.tac.f).not.toBe('3-5-2');
    expect(me.lineup).toEqual(lineupA);
    applyTactic(W, b);
    expect(me.tac.f).toBe('3-5-2');
    expect(me.tac.men).toBe(3);
    me.tac.lin = 2;
    updateTactic(W, b);
    expect(W.tacs!.find((t) => t.id === b)!.tac.lin).toBe(2);
    deleteTactic(W, a);
    expect(W.tacs!.length).toBe(1);
  });

  it('tem limite de táticas', () => {
    while ((W.tacs || []).length < MAX_TACTICS) saveTactic(W, 'x');
    expect(saveTactic(W, 'demais')).toBeNull();
  });

  it('o desempenho previsto cai com cansaço e moral baixa', () => {
    const p = squad(W, 0)[0];
    p.f = 100;
    p.mo = 50;
    const fresh = perfRating(p);
    p.f = 50;
    p.mo = 20;
    expect(perfRating(p)).toBeLessThan(fresh);
  });
});
