/**
 * Rodadas de negociação. Cada conversa guarda a posição atual do outro lado (`ask`), um limite escondido (`lim`) e a
 * paciência (quantas rodadas ele ainda aceita). A cada proposta o outro lado cede uma parte da diferença; proposta
 * ofensiva gasta mais paciência e quase não o faz ceder. Sem paciência, a conversa acaba.
 */

export interface TalkMsg {
  /** quem falou */
  by: 'me' | 'them';
  /** valor proposto (dinheiro, salário mensal ou parte do salário 0..1) */
  v: number;
  /** anos de contrato (conversa com o jogador) */
  yrs?: number;
  txt: string;
}

export interface Talk {
  /** posição atual do outro lado: o que ele pede (quando o usuário paga) ou oferece (quando o usuário recebe) */
  ask: number;
  /** limite escondido: o mínimo que aceita receber ou o máximo que aceita pagar */
  lim: number;
  /** paciência que resta e a inicial */
  pat: number;
  pat0: number;
  /** quanto da diferença ele cede por rodada (0..1) */
  cs: number;
  log: TalkMsg[];
  /** fim da conversa */
  end?: 'deal' | 'off';
}

export type TalkResult =
  /** fechado no valor `v` */
  | { r: 'accept'; v: number }
  /** nova posição do outro lado; `insult` quando a proposta foi ofensiva */
  | { r: 'counter'; v: number; insult: boolean }
  /** desistiu */
  | { r: 'off' };

export const newTalk = (ask: number, lim: number, pat: number, cs: number): Talk => ({
  ask,
  lim,
  pat,
  pat0: pat,
  cs,
  log: [],
});

/**
 * O usuário paga (compra, empréstimo, salário): o outro lado pede alto e desce aos poucos até o limite.
 * Proposta igual ou acima do pedido fecha na hora (pelo pedido). Na última rodada, qualquer valor acima do limite fecha.
 */
export const haggleDown = (t: Talk, offer: number, round: (v: number) => number): TalkResult => {
  if (t.end) return t.end === 'deal' ? { r: 'accept', v: t.ask } : { r: 'off' };
  if (offer >= t.ask) return close(t, Math.min(offer, t.ask));
  const insult = offer < t.lim * 0.75;
  t.pat -= insult ? 2 : 1;
  const next = Math.max(t.lim, round(t.ask - (t.ask - offer) * (insult ? t.cs * 0.25 : t.cs)));
  if (offer >= next * 0.985 || (offer >= t.lim && t.pat <= 0)) return close(t, offer);
  if (t.pat <= 0) return quit(t);
  t.ask = Math.max(next, round(offer * 1.01));
  return { r: 'counter', v: t.ask, insult };
};

/**
 * O usuário recebe (venda e empréstimo de um jogador seu): o outro lado oferece baixo e sobe aos poucos até o limite.
 * Pedido igual ou abaixo da oferta fecha na hora (pela oferta). Na última rodada, qualquer valor abaixo do limite fecha.
 */
export const haggleUp = (t: Talk, want: number, round: (v: number) => number): TalkResult => {
  if (t.end) return t.end === 'deal' ? { r: 'accept', v: t.ask } : { r: 'off' };
  if (want <= t.ask) return close(t, t.ask);
  const insult = want > t.lim * 1.3;
  t.pat -= insult ? 2 : 1;
  const next = Math.min(t.lim, round(t.ask + (want - t.ask) * (insult ? t.cs * 0.25 : t.cs)));
  if (want <= next * 1.015 || (want <= t.lim && t.pat <= 0)) return close(t, want);
  if (t.pat <= 0) return quit(t);
  t.ask = Math.min(next, round(want * 0.99));
  return { r: 'counter', v: t.ask, insult };
};

const close = (t: Talk, v: number): TalkResult => {
  t.end = 'deal';
  t.ask = v;
  return { r: 'accept', v };
};

const quit = (t: Talk): TalkResult => {
  t.end = 'off';
  return { r: 'off' };
};

/** Registra uma fala na conversa. */
export const say = (t: Talk, by: 'me' | 'them', v: number, txt: string, yrs?: number): void => {
  t.log.push(yrs == null ? { by, v, txt } : { by, v, yrs, txt });
};
