import { describe, expect, it } from 'vitest';
import {
  BENCH_SIZE,
  createWorld,
  lineupIssues,
  loadDefaultDb,
  squad,
  swapSpots,
  tidyLineup,
  validateLineup,
} from '../../src/core';

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
    expect(swapSpots(W, me, { z: 'res', pid: hurt.id }, { z: 'xi', i: 2 })).toMatch(/lesionado/);
    hurt.inj = 0;
  });
});

describe('desfalques são trocados à mão', async () => {
  const db = await loadDefaultDb();
  const W = createWorld(11, db);
  W.user = 0;
  const me = W.clubs[0];
  validateLineup(W, me);

  it('tidyLineup não tira lesionado nem suspenso; lineupIssues aponta os dois', () => {
    const a = W.pmap[me.lineup![4]!],
      b = W.pmap[me.bench![1]];
    a.inj = 2;
    b.sus = 1;
    tidyLineup(W, me);
    expect(me.lineup![4]).toBe(a.id);
    expect(me.bench).toContain(b.id);
    const issues = lineupIssues(W, me);
    expect(issues).toEqual(
      expect.arrayContaining([
        { pid: a.id, where: 'xi', why: 'lesionado' },
        { pid: b.id, where: 'bench', why: 'suspenso' },
      ]),
    );
  });

  it('trocar o lesionado por alguém do banco manda o lesionado para as reservas', () => {
    const hurt = me.lineup![4]!;
    const sub = me.bench![0];
    expect(swapSpots(W, me, { z: 'bench', i: 0 }, { z: 'xi', i: 4 })).toBeNull();
    expect(me.lineup![4]).toBe(sub);
    expect(me.bench).not.toContain(hurt);
    expect(me.lineup).not.toContain(hurt);
  });
});
