import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import { buildSeason, createWorld, expandDb, playDay, rng, stepDay, type RawDb } from '../../src/core';
import { gunzip, gzip } from '../../src/persistence/compression';
import { deserialize, serialize } from '../../src/persistence/serialize';
import { loadLegacyCore } from '../parity/legacyCore';
import { snapshot } from '../parity/helpers';
import { applyCurrentRules, applyLegacyRules } from '../../src/core/rules';

const newCareer = () => {
  const W = createWorld(11, expandDb(rawDb as unknown as RawDb));
  W.user = 5;
  rng.seed(22);
  buildSeason(W);
  for (let i = 0; i < 30; i++) stepDay(W);
  return W;
};

describe('saves', () => {
  it('serializa, compacta e volta igual (inclusive o RNG)', async () => {
    const W = newCareer();
    const data = await gzip(serialize(W));
    expect(data.startsWith('Z:')).toBe(true);
    const stateBefore = rng.rngState.s;
    rng.seed(1);
    const back = deserialize(await gunzip(data));
    expect(rng.rngState.s).toBe(stateBefore);
    expect(snapshot(back)).toEqual(snapshot(W));
    expect(back.pmap[back.players[0].id]).toBe(back.players[0]);
  });

  it('abre um save gerado pelo Prancheta.html original e continua igual', async () => {
    // a comparação lance a lance só vale com as regras do original
    applyLegacyRules();
    const G = loadLegacyCore();
    const L = G.newWorld(31);
    L.user = 0;
    G.seed(32);
    G.buildSeason(L);
    for (let i = 0; i < 3; i++) G.playDay(L);
    // mesmo formato de UI.serialize do original
    const o = Object.assign({}, L);
    delete o.pmap;
    delete o._sq;
    o.rng = G.rng.s;
    const data = await gzip(JSON.stringify(o));

    const W = deserialize(await gunzip(data));
    for (let i = 0; i < 3; i++) {
      playDay(W);
      G.playDay(L);
    }
    expect(snapshot(W)).toEqual(snapshot(L));
    applyCurrentRules();
  });

  it('migra saves v1 (sem categoria de base)', () => {
    const W = newCareer();
    const o = JSON.parse(serialize(W));
    o.v = 1;
    o.players = o.players.filter((p: { y: number }) => !p.y);
    const back = deserialize(JSON.stringify(o));
    expect(back.v).toBe(2);
    expect(back.players.some((p) => p.y === 1)).toBe(true);
  });
});
