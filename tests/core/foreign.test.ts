import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import sulaDb from '../../src/data/sula-db.json';
import {
  addForeignClubs,
  buildSeason,
  createWorld,
  endSeason,
  ensureMarket,
  expandDb,
  mergeDb,
  stepDay,
  rng,
  squad,
  youth,
  type RawDb,
} from '../../src/core';

const br = () => expandDb(rawDb as unknown as RawDb);
const sul = () => expandDb(sulaDb as unknown as RawDb);

describe('clubes sul-americanos', () => {
  it('entram no mundo com elenco, caixa e sem base', () => {
    const W = createWorld(5, mergeDb(br(), sul()));
    const f = W.clubs.filter((c) => c.div === 'SUL');
    expect(f.length).toBe(158);
    expect(new Set(f.map((c) => c.country)).size).toBe(9);
    for (const c of f) {
      expect(squad(W, c.id).length).toBeGreaterThanOrEqual(18);
      expect(youth(W, c.id).length).toBe(0);
      expect(c.bal).toBeGreaterThan(0);
    }
    expect(new Set(W.clubs.map((c) => c.s)).size).toBe(W.clubs.length);
    const river = W.clubs.find((c) => c.n === 'River Plate')!;
    expect(river.country).toBe('ARG');
    expect(squad(W, river.id).some((p) => p.real)).toBe(true);
  });

  it('saves antigos ganham os clubes estrangeiros uma vez só', () => {
    const W = createWorld(5, br());
    const n = W.clubs.length;
    expect(addForeignClubs(W, sul())).toBe(158);
    expect(W.clubs.length).toBe(n + 158);
    expect(W.clubs.every((c, i) => c.id === i)).toBe(true);
    expect(addForeignClubs(W, sul())).toBe(0);
  });

  it('o mercado da IA movimenta jogadores entre Brasil e exterior numa temporada', () => {
    const W = createWorld(8, mergeDb(br(), sul()));
    W.user = 0;
    W.coach = 'T';
    rng.seed(8);
    buildSeason(W);
    ensureMarket(W);
    while (!W.seasonDone) stepDay(W);
    // ligas nacionais simuladas: todas terminam, com campeão e classificação completa
    for (const k of ['ARG', 'BOL', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'URU', 'VEN']) {
      const c = W.comps[k];
      expect(c.done).toBe(true);
      expect(c.res.champ).not.toBeNull();
      expect(c.res.lib!.length).toBe(c.n);
      expect(c.fx.every((f) => f.pl)).toBe(true);
    }
    expect(W.comps.ARG.fx.length).toBe((30 * 29) / 2);
    expect(W.comps.COL.fx.length).toBe(20 * 19);
    const log = W.mk!.log;
    const foreign = (id: number) => id >= 0 && W.clubs[id].div === 'SUL';
    expect(log.some((r) => foreign(r.from) || foreign(r.to))).toBe(true);
    endSeason(W);
    expect(W.clubs.filter((c) => c.div === 'SUL').length).toBe(158);
  }, 120000);
});
