import type { World } from '../../src/core';

/**
 * Snapshot comparável de um mundo (sem caches e sem referências cíclicas).
 * Tira também o que só existe na versão nova e não muda as regras esportivas: estado de leitura das
 * mensagens, cartões da temporada, extrato, patrocínios e saldo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const snapshot = (W: World | any): unknown => {
  const o = Object.assign({}, W);
  delete o.pmap;
  delete o._sq;
  delete o.finLog;
  delete o.finHist;
  delete o.sp;
  delete o.fin;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (Array.isArray(o.news)) o.news = o.news.map(({ y, d, t, b, k }: any) => ({ y, d, t, b, k }));
  const out = JSON.parse(JSON.stringify(o));
  // dinheiro: a versão nova paga salários e patrocínios uma vez por mês e tem contratos de patrocínio;
  // o saldo não influencia nenhuma decisão esportiva, então fica de fora da comparação
  for (const c of out.clubs || []) {
    delete c.bal;
    delete c.spon;
  }
  for (const p of out.players || []) {
    delete p.st?.ca;
    delete p.st?.cv;
  }
  // mensagens só da versão nova saem da comparação; como a caixa guarda no máximo 120, compara as 60 mais recentes
  if (Array.isArray(out.news))
    out.news = out.news.filter((n: { k: string }) => n.k !== 'spon' && n.k !== 'apt' && n.k !== 'mkt').slice(0, 60);
  return out;
};
