import { ovr, rebuildPmap, rng, seedYouth, WORLD_VERSION, type World } from '@/core';

type SavedWorld = Omit<World, 'pmap' | '_sq'> & { rng?: number };

/** Converte o mundo em JSON (sem caches) incluindo o estado do RNG. */
export const serialize = (W: World): string => {
  const o: Partial<World> & { rng?: number } = Object.assign({}, W);
  delete o.pmap;
  delete o._sq;
  o.rng = rng.rngState.s;
  return JSON.stringify(o);
};

/**
 * Migrações de versões antigas do save.
 * Para criar uma nova: aumente WORLD_VERSION em core/world/createWorld.ts e adicione um passo aqui.
 */
const migrations: Record<number, (W: World) => void> = {
  // v1 → v2: saves antigos ganham a categoria de base
  1: (o) => {
    o.players.forEach((p) => {
      p.y = 0;
      p.nat = p.nat || 'Brasil';
      p.pk = p.a <= 23 ? 0.5 : 1;
      p.gx = 0;
      p.sy = ovr(p);
      p.dv = p.dv || 1;
    });
    o.clubs.forEach((c) => seedYouth(o, c));
  },
};

export const deserialize = (json: string): World => {
  const raw = JSON.parse(json) as SavedWorld;
  if (!raw || !Array.isArray(raw.players) || !Array.isArray(raw.clubs)) throw new Error('Save inválido');
  const W = raw as World & { rng?: number };
  rebuildPmap(W);
  if (W.rng) rng.seed(W.rng);
  delete W.rng;
  let v = W.v || 1;
  while (v < WORLD_VERSION) {
    migrations[v]?.(W);
    v++;
  }
  W.v = WORLD_VERSION;
  return W;
};
