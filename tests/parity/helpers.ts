import type { World } from '../../src/core';

/** Snapshot comparável de um mundo (sem caches e sem referências cíclicas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const snapshot = (W: World | any): unknown => {
  const o = Object.assign({}, W);
  delete o.pmap;
  delete o._sq;
  return JSON.parse(JSON.stringify(o));
};
