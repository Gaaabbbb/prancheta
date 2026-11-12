import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import { buildSeason, createWorld, expandDb, prepareMatch, rng, userFixture, type RawDb } from '../../src/core';
import { loadLegacyCore } from './legacyCore';
import { applyLegacyRules } from '../../src/core/rules';

// a paridade compara com as regras do original (a versão nova muda cansaço e evolução da base)
applyLegacyRules();

const G = loadLegacyCore();

describe('motor de partida (modo narrado) igual ao original', () => {
  it('mesmos eventos, narração e resultado', () => {
    const a = createWorld(99, expandDb(rawDb as unknown as RawDb));
    const b = G.newWorld(99);
    for (const [W, legacy] of [
      [a, false],
      [b, true],
    ] as const) {
      W.user = 3;
      if (legacy) {
        G.seed(123);
        G.buildSeason(W);
      } else {
        rng.seed(123);
        buildSeason(a);
      }
    }
    const ua = userFixture(a, 1)!;
    const ub = G.userFixture(b, 1);
    const ma = prepareMatch(a, ua.comp, ua.f, { userSide: ua.f.h === 3 ? 0 : 1 }).runToEnd();
    const mb = G.prepareMatch(b, ub.comp, ub.f, { userSide: ub.f.h === 3 ? 0 : 1 }).runToEnd();
    expect(JSON.parse(JSON.stringify(ma.events))).toEqual(JSON.parse(JSON.stringify(mb.events)));
    expect(ma.result()).toEqual(mb.result());
    expect(ma.momHist).toEqual(mb.momHist);
  });
});
