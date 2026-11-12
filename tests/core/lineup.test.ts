import { describe, expect, it } from 'vitest';
import { BENCH_SIZE, createWorld, loadDefaultDb, squad, swapSpots, validateLineup } from '../../src/core';

describe('escalação manual', async () => {
  const db = await loadDefaultDb();
  const W = createWorld(7, db);
  W.user = 0;
  const me = W.clubs[0];
  validateLineup(W, me);

  it('troca titular com reserva e mantém o banco escolhido', () => {
    const inXI = new Set([...me.lineup!, ...me.bench!]);
    const res = squad(W, 0).find((p) => !inXI.has(p.id) && p.inj <= 0 && p.sus <= 0)!;
    const starter = me.lineup![3]!;
    const bench = me.bench!.slice();
    expect(swapSpots(W, me, { z: 'xi', i: 3 }, { z: 'res', pid: res.id })).toBeNull();
    expect(me.lineup![3]).toBe(res.id);
    expect(me.bench).toEqual(bench);
    expect(me.lineup).not.toContain(starter);
    validateLineup(W, me);
    expect(me.bench).toEqual(bench);
  });

  it('troca banco com titular e banco com reserva', () => {
    const b0 = me.bench![0];
    const s5 = me.lineup![5]!;
    swapSpots(W, me, { z: 'bench', i: 0 }, { z: 'xi', i: 5 });
    expect(me.lineup![5]).toBe(b0);
    expect(me.bench![0]).toBe(s5);
    const used = new Set([...me.lineup!, ...me.bench!]);
    const res = squad(W, 0).find((p) => !used.has(p.id) && p.inj <= 0 && p.sus <= 0)!;
    swapSpots(W, me, { z: 'res', pid: res.id }, { z: 'bench', i: 2 });
    expect(me.bench![2]).toBe(res.id);
    expect(me.bench!.length).toBe(BENCH_SIZE);
  });

  it('não deixa vaga de titular vazia nem escala indisponível', () => {
    const before = me.lineup!.slice();
    me.bench = me.bench!.slice(0, 8);
    expect(swapSpots(W, me, { z: 'xi', i: 1 }, { z: 'bench', i: 8 })).toMatch(/titular/);
    expect(me.lineup).toEqual(before);
    const used = new Set([...me.lineup!, ...me.bench!]);
    const hurt = squad(W, 0).find((p) => !used.has(p.id))!;
    hurt.inj = 3;
    expect(swapSpots(W, me, { z: 'res', pid: hurt.id }, { z: 'xi', i: 2 })).toMatch(/disponível/);
    hurt.inj = 0;
  });
});
