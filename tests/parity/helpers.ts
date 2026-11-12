import type { World } from '../../src/core';

/**
 * Snapshot comparável de um mundo (sem caches e sem referências cíclicas).
 * Tira também o que só existe na versão nova e não muda as regras: estado de leitura das mensagens,
 * extrato diário e histórico financeiro.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const snapshot = (W: World | any): unknown => {
  const o = Object.assign({}, W);
  delete o.pmap;
  delete o._sq;
  delete o.finLog;
  delete o.finHist;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Array.isArray(o.news)) o.news = o.news.map(({ y, d, t, b, k }: any) => ({ y, d, t, b, k }));
  return JSON.parse(JSON.stringify(o));
};
