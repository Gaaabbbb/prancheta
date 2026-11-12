import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import { buildSeason, createWorld, endSeason, expandDb, playDay, rng, type RawDb, type World } from '../../src/core';
import { loadLegacyCore } from './legacyCore';
import { snapshot } from './helpers';
import { applyLegacyRules } from '../../src/core/rules';

// a paridade compara com as regras do original (a versão nova muda cansaço e evolução da base)
applyLegacyRules();

const G = loadLegacyCore();
const db = () => expandDb(rawDb as unknown as RawDb);

/** Executa o mesmo roteiro nos dois núcleos e compara o estado. */
const startCareer = (W: World | Record<string, unknown>, legacy: boolean, user: number, seedValue: number) => {
  W.user = user;
  W.coach = 'Teste';
  if (legacy) {
    G.seed(seedValue);
    G.buildSeason(W);
  } else {
    rng.seed(seedValue);
    buildSeason(W as World);
  }
};

describe('paridade com o Prancheta.html original', () => {
  it('o banco padrão expandido é idêntico', () => {
    expect(db()).toEqual(JSON.parse(JSON.stringify(G.defaultDB())));
  });

  it('createWorld gera o mesmo mundo que newWorld', () => {
    const a = createWorld(20260128, db());
    const b = G.newWorld(20260128);
    expect(snapshot(a)).toEqual(snapshot(b));
    expect(rng.rngState.s).toBe(G.rng.s);
  });

  for (const user of [0, 45, 100]) {
    it(`temporada completa + virada de ano iguais (clube ${user})`, () => {
      const a = createWorld(777, db());
      const b = G.newWorld(777);
      startCareer(a, false, user, 4242);
      startCareer(b, true, user, 4242);
      expect(snapshot(a)).toEqual(snapshot(b));

      let guard = 0;
      while (!a.seasonDone && guard++ < 80) {
        playDay(a);
        G.playDay(b);
      }
      expect(a.seasonDone).toBe(true);
      expect(b.seasonDone).toBe(true);
      expect(snapshot(a)).toEqual(snapshot(b));

      endSeason(a);
      G.endSeason(b);
      expect(snapshot(a)).toEqual(snapshot(b));
      expect(rng.rngState.s).toBe(G.rng.s);

      // mais meia temporada no ano seguinte
      for (let i = 0; i < 20; i++) {
        playDay(a);
        G.playDay(b);
      }
      expect(snapshot(a)).toEqual(snapshot(b));
    });
  }
});
