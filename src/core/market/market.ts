import { POS, POS_GROUP, type Pos } from '../constants/attributes';
import { addMoney, remainingPaydays } from '../finance/ledger';
import { clamp } from '../math';
import { news } from '../news';
import { genName } from '../player/names';
import { ovr } from '../player/ratings';
import { calcValue, calcWage } from '../player/value';
import { hash } from '../rng';
import { RULES } from '../rules';
import type { Club, IncomingOffer, MarketState, Player, TransferRecord, World } from '../types';
import { clubLevel, makePlayer } from '../world/factory';
import { dayOfYear, DAYS_START, deadlineTxt, isDays, perTick } from '../season/calendar';
import { marketDate, marketDateAfter, windowId, windowOn, windowState } from './windows';
import { dirty, removeFromLineups, squad } from '../world/squad';
import { haggleUp, haggleDown, newTalk, say, type Talk, type TalkResult } from './talks';

/** Mínimo de jogadores no elenco profissional para um clube aceitar vender. */
export const MIN_SQUAD = 20;
/** Máximo de jogadores no elenco profissional. */
export const MAX_SQUAD = 40;
const MAX_INCOMING = 4;

// ---------------------------------------------------------------- utilitários

const rnd = (mk: MarketState): number => {
  let t = (mk.rs = (mk.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rint = (mk: MarketState, a: number, b: number) => a + Math.floor(rnd(mk) * (b - a + 1));
const pickOne = <T>(mk: MarketState, arr: T[]): T => arr[Math.floor(rnd(mk) * arr.length)];

/** Valores redondos (R$ 10 mil, R$ 100 mil ou R$ 1 mi). */
export const roundMoney = (v: number): number =>
  v >= 1e7 ? Math.round(v / 1e6) * 1e6 : v >= 1e6 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4;
const roundWage = (v: number) => (v >= 1e5 ? Math.round(v / 5e3) * 5e3 : Math.round(v / 1e3) * 1e3);

const brl = (v: number) =>
  v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : 'R$ ' + Math.round(v / 1e3) + ' mil';

/** Número fixo entre 0 e 1 por jogador e temporada (o "humor" do clube naquela janela). */
const fixed01 = (W: World, pid: number, salt: string) => (hash(salt + pid + ':' + W.year) >>> 0) / 4294967296;

// ---------------------------------------------------------------- estado e janelas

/** Cria o estado do mercado (e alguns jogadores livres) na primeira vez. */
export const ensureMarket = (W: World): MarketState | null => {
  if (!RULES.market || W.user == null) return null;
  if (W.mk) return W.mk;
  W.mk = {
    rs: hash('mercado' + W.year + W.clubs[W.user].n) >>> 0 || 1,
    nextId: 1,
    sell: {},
    loan: [],
    offers: [],
    agreed: {},
    tries: {},
    win: 0,
    log: [],
    watch: [],
  };
  // saves antigos: contratos com ano já passado passam a terminar nesta temporada
  for (const p of W.players) if (p.c >= 0 && !p.y && p.ct < W.year) p.ct = W.year;
  seedFreeAgents(W, 28);
  return W.mk;
};

/** Gera jogadores sem clube, de vários níveis, para o mercado não começar vazio. */
const seedFreeAgents = (W: World, n: number) => {
  const mk = W.mk!;
  const used = new Set(W.players.map((p) => p.n));
  for (let i = 0; i < n; i++) {
    const pos = POS[rint(mk, 0, POS.length - 1)] as Pos;
    const age = rint(mk, 0, 9) < 2 ? rint(mk, 19, 23) : rint(mk, 24, 33);
    const target = rint(mk, 52, 72);
    const p = makePlayer(W, -1, genName(used), pos, age, target, false);
    used.add(p.n);
    p.ct = 0;
    p.fa = W.year;
    p.val = calcValue(p);
    p.sal = calcWage(p, target >= 66 ? 'B' : target >= 60 ? 'C' : 'D');
  }
  dirty(W);
};

const talkKey = (pid: number, stage: string) => pid + ':' + stage;

/** Conversa em andamento com o clube ou o jogador (as conversas valem por janela). */
export const getTalk = (W: World, pid: number, stage: TalkStage): Talk | undefined => {
  const mk = W.mk;
  if (!mk || mk.win !== windowId(W)) return undefined;
  return mk.talks?.[talkKey(pid, stage)];
};

/** Abre (ou continua) uma conversa. Quando a janela muda, as conversas antigas acabam. */
const openTalk = (W: World, pid: number, stage: TalkStage, make: () => Talk): Talk => {
  const mk = W.mk!;
  const id = windowId(W);
  if (mk.win !== id || !mk.talks) {
    mk.win = id;
    mk.talks = {};
    mk.tries = {};
  }
  return (mk.talks[talkKey(pid, stage)] ??= make());
};

const endTalk = (W: World, pid: number, stage: TalkStage) => {
  if (W.mk?.talks) delete W.mk.talks[talkKey(pid, stage)];
};

export type TalkStage = 'club' | 'loan' | 'player' | 'renew';

const pct = (v: number) => Math.round(v * 100) + '%';

// ---------------------------------------------------------------- avaliação

/** Posição do jogador no elenco do clube (0 = melhor). */
const squadRank = (W: World, p: Player): number =>
  squad(W, p.c)
    .sort((a, b) => ovr(b) - ovr(a))
    .findIndex((x) => x.id === p.id);

/** Anos de contrato que faltam depois desta temporada. */
export const yearsLeft = (W: World, p: Player): number => p.ct - W.year;

/** O clube da IA considera vender? (elenco mínimo, posição coberta, não emprestado) */
export const sellBlock = (W: World, p: Player): string | null => {
  if (p.c < 0) return null;
  if (p.y) return 'Jogador da base não está à venda.';
  if (p.loan) return 'Está emprestado: não pode ser vendido agora.';
  const sq = squad(W, p.c);
  if (sq.length <= MIN_SQUAD) return `O ${W.clubs[p.c].n} está com o elenco no limite e não vende ninguém.`;
  if (sq.filter((x) => POS_GROUP[x.p] === POS_GROUP[p.p]).length <= 2)
    return `O ${W.clubs[p.c].n} não tem reposição para a posição dele.`;
  return null;
};

export type KeyRole = 'star' | 'key';

/**
 * Destaques do elenco: os 3 melhores, o artilheiro (5+ gols) e o dono da melhor nota (6+ jogos) são "estrelas";
 * do 4º ao 7º melhor são "titulares importantes". Tirar qualquer um deles do clube custa mais caro e é mais difícil.
 */
export const keyRole = (W: World, p: Player): KeyRole | null => {
  if (p.c < 0 || p.y || p.loan) return null;
  const sq = squad(W, p.c);
  const rank = sq.sort((a, b) => ovr(b) - ovr(a)).findIndex((x) => x.id === p.id);
  if (rank < 3) return 'star';
  if (p.st.g >= 5 && sq.every((x) => x.st.g <= p.st.g)) return 'star';
  if (p.st.j >= 6) {
    const avg = (x: Player) => (x.st.j >= 6 ? x.st.nt / x.st.j : 0);
    if (sq.every((x) => avg(x) <= avg(p))) return 'star';
  }
  return rank < 7 ? 'key' : null;
};

/** Estrela que o clube não aceita negociar nesta janela (sorteio fixo por janela). */
export const untouchable = (W: World, p: Player): boolean =>
  keyRole(W, p) === 'star' && fixed01(W, p.id, 'inegociavel' + windowId(W)) < 0.45;

/** O clube da IA quer se desfazer? (pouco usado no elenco) */
export const aiListed = (W: World, p: Player): boolean =>
  p.c >= 0 && p.c !== W.user && !p.y && !p.loan && squadRank(W, p) >= 18;

/** O clube da IA aceita emprestar? (reserva pouco usado ou jovem que não é titular, com reposição no elenco) */
const loanableRank = (p: Player, rank: number) => rank >= 12 || (p.a <= 22 && rank >= 6);

/**
 * Listas do mercado, calculando a posição no elenco de uma vez: à venda (os clubes da IA querem se desfazer, mais os
 * colocados à venda pelo usuário) e disponíveis para empréstimo (idem).
 */
export const marketLists = (W: World): { sale: Player[]; loan: Player[] } => {
  const user = W.user;
  const mk = W.mk;
  const byClub = new Map<number, Player[]>();
  for (const p of W.players)
    if (p.c >= 0 && !p.y) {
      let l = byClub.get(p.c);
      if (!l) byClub.set(p.c, (l = []));
      l.push(p);
    }
  const sale: Player[] = [],
    loan: Player[] = [];
  for (const [cid, list] of byClub) {
    if (cid === user) {
      for (const p of list) {
        if (mk?.sell[p.id] != null) sale.push(p);
        if (mk?.loan.includes(p.id)) loan.push(p);
      }
      continue;
    }
    if (list.length <= MIN_SQUAD) continue;
    list.sort((a, b) => ovr(b) - ovr(a));
    const perGroup = [0, 0, 0, 0];
    for (const p of list) perGroup[POS_GROUP[p.p]]++;
    list.forEach((p, rank) => {
      if (p.loan || perGroup[POS_GROUP[p.p]] <= 2) return;
      if (rank >= 18) sale.push(p);
      if (loanableRank(p, rank)) loan.push(p);
    });
  }
  return { sale, loan };
};

/** Preço que o clube pede pelo jogador. */
export const askingPrice = (W: World, p: Player): number => {
  const rank = squadRank(W, p);
  const role = keyRole(W, p);
  let f = role === 'star' ? 2.3 : role === 'key' ? 1.6 : rank < 11 ? 1.3 : rank < 18 ? 1.05 : 0.8;
  const left = yearsLeft(W, p);
  // contrato no fim derruba o preço (destaques perdem menos: o clube prefere segurar)
  f *= left <= 0 ? (role ? 0.7 : 0.5) : left === 1 ? (role ? 0.9 : 0.8) : 1;
  if (W.clubs[p.c].bal < 0) f *= 0.85;
  f *= 0.92 + 0.16 * fixed01(W, p.id, 'pede');
  return Math.max(10000, roundMoney(calcValue(p) * f));
};

// ---------------------------------------------------------------- etapa 1: clube

export type ClubAnswer =
  | { r: 'accept'; fee: number; share?: number; msg: string }
  | { r: 'counter'; fee: number; share?: number; msg: string }
  | { r: 'reject'; msg: string };

/**
 * Conversa com o clube pela compra: ele começa pedindo o preço cheio e desce até um limite escondido (destaques quase
 * não descem). Paciência: 3 rodadas para estrelas, 4 para os outros.
 */
export const clubTalk = (W: World, p: Player): Talk =>
  openTalk(W, p.id, 'club', () => {
    const role = keyRole(W, p);
    const ask = askingPrice(W, p);
    const floor =
      (role === 'star' ? 0.9 : role === 'key' ? 0.84 : 0.76) +
      0.06 * (fixed01(W, p.id, 'limite') - 0.5) -
      (yearsLeft(W, p) <= 0 ? 0.08 : 0) -
      (W.clubs[p.c].bal < 0 ? 0.05 : 0);
    const t = newTalk(
      ask,
      roundMoney(ask * floor),
      role === 'star' ? 3 : 4,
      role === 'star' ? 0.3 : role === 'key' ? 0.4 : 0.5,
    );
    say(t, 'them', ask, `O ${W.clubs[p.c].n} pede ${brl(ask)} por ${p.n}.`);
    return t;
  });

/** Proposta de compra ao clube. Se aceitar, o acordo fica guardado e falta acertar com o jogador. */
export const offerToClub = (W: World, pid: number, fee: number): ClubAnswer => {
  const mk = ensureMarket(W)!;
  const p = W.pmap[pid];
  if (!windowState(W).open) return { r: 'reject', msg: 'A janela de transferências está fechada.' };
  const block = sellBlock(W, p);
  if (block) return { r: 'reject', msg: block };
  const club = W.clubs[p.c].n;
  if (untouchable(W, p))
    return { r: 'reject', msg: `${p.n} é inegociável para o ${club} nesta janela. Tente na próxima.` };
  const t = clubTalk(W, p);
  if (t.end === 'off') return { r: 'reject', msg: `O ${club} encerrou as conversas nesta janela.` };
  const me = W.clubs[W.user!];
  if (fee > me.bal) return { r: 'reject', msg: 'O clube não tem esse dinheiro em caixa.' };
  fee = roundMoney(fee);
  say(t, 'me', fee, `Você ofereceu ${brl(fee)}.`);
  const before = t.ask;
  const res = haggleDown(t, fee, roundMoney);
  if (res.r === 'accept') {
    mk.agreed[pid] = { fee: res.v, kind: 'buy', share: 1 };
    const msg = `O ${club} aceitou ${brl(res.v)}. Agora acerte o contrato com o jogador.`;
    say(t, 'them', res.v, msg);
    return { r: 'accept', fee: res.v, msg };
  }
  if (res.r === 'off') {
    const msg = `O ${club} se cansou da negociação e encerrou as conversas nesta janela.`;
    say(t, 'them', 0, msg);
    return { r: 'reject', msg };
  }
  const msg = res.insult
    ? `Proposta muito baixa. O ${club} nem considera e continua pedindo ${brl(res.v)}.`
    : res.v < before
      ? `O ${club} baixou o pedido para ${brl(res.v)}.`
      : `O ${club} não baixa de ${brl(res.v)}.`;
  say(t, 'them', res.v, msg);
  return { r: 'counter', fee: res.v, msg };
};

/** Arredonda a parte do salário para múltiplos de 5%. */
export const roundShare = (v: number): number => Math.round(clamp(v, 0, 1) * 20) / 20;

/**
 * Menor parte do salário que o clube dono aceita que o outro pague num empréstimo.
 * Reserva pouco usado: ~30%; quem joga às vezes: ~50%; jovem promessa: ~60%.
 * Clube endividado quer mais; clube que pede bem maior que o dono paga mais.
 */
export const loanMinShare = (W: World, p: Player, to: number): number => {
  const rank = squadRank(W, p);
  let v = rank >= 18 ? 0.3 : p.a <= 22 && rank >= 6 ? 0.6 : 0.5;
  const from = W.clubs[p.c],
    dest = W.clubs[to];
  if (from.bal < 0) v += 0.15;
  const gap = dest.rep - from.rep;
  if (gap > 15) v += 0.1;
  else if (gap < -15) v -= 0.1;
  v += 0.1 * (fixed01(W, p.id, 'emprestimo') - 0.5);
  return roundShare(clamp(v, 0.1, 1));
};

/** Conversa com o clube pelo empréstimo: ele pede uma parte do salário acima do mínimo e desce até ele. */
export const loanTalk = (W: World, p: Player): Talk =>
  openTalk(W, p.id, 'loan', () => {
    const want = loanMinShare(W, p, W.user!);
    const ask = roundShare(Math.min(1, want + 0.15));
    const t = newTalk(ask, want, 4, 0.5);
    say(t, 'them', ask, `O ${W.clubs[p.c].n} empresta ${p.n} se você pagar ${pct(ask)} do salário.`);
    return t;
  });

/** Motivo para o clube nem conversar sobre empréstimo (titular, ou o jogador não quer descer tanto de patamar). */
export const loanBlock = (W: World, p: Player): string | null => {
  const club = W.clubs[p.c];
  if (!loanableRank(p, squadRank(W, p))) return `${p.n} é importante para o ${club.n}, que não empresta.`;
  if (W.clubs[W.user!].rep < club.rep - 35) return `${p.n} não quer ir para um clube tão menor, nem emprestado.`;
  return null;
};

/** Pedido de empréstimo até o fim da temporada; `share` é a parte do salário que o usuário paga. */
export const loanRequest = (W: World, pid: number, share: number): ClubAnswer => {
  const mk = ensureMarket(W)!;
  const p = W.pmap[pid];
  share = roundShare(share);
  if (!windowState(W).open) return { r: 'reject', msg: 'A janela de transferências está fechada.' };
  const block = sellBlock(W, p);
  if (block) return { r: 'reject', msg: block };
  const club = W.clubs[p.c].n;
  const lb = loanBlock(W, p);
  if (lb) return { r: 'reject', msg: lb };
  const t = loanTalk(W, p);
  if (t.end === 'off') return { r: 'reject', msg: `O ${club} encerrou as conversas nesta janela.` };
  say(t, 'me', share, `Você propôs pagar ${pct(share)} do salário.`);
  const res = haggleDown(t, share, roundShare);
  if (res.r === 'accept') {
    mk.agreed[pid] = { fee: 0, kind: 'loan', share: res.v };
    const msg = `O ${club} aceitou emprestar ${p.n}. Você paga ${pct(res.v)} do salário e o ${club}, ${pct(1 - res.v)}.`;
    say(t, 'them', res.v, msg);
    return { r: 'accept', fee: 0, share: res.v, msg };
  }
  if (res.r === 'off') {
    const msg = `O ${club} desistiu do empréstimo nesta janela.`;
    say(t, 'them', 0, msg);
    return { r: 'reject', msg };
  }
  const msg = res.insult
    ? `Proposta baixa. O ${club} quer que você pague pelo menos ${pct(res.v)} do salário.`
    : `O ${club} topa se você pagar ${pct(res.v)} do salário (eles pagam ${pct(1 - res.v)}).`;
  say(t, 'them', res.v, msg);
  return { r: 'counter', fee: 0, share: res.v, msg };
};

// ---------------------------------------------------------------- etapa 2: jogador

export interface Demand {
  wage: number;
  years: [number, number];
  /** motivo para não aceitar de jeito nenhum */
  refuse?: string;
}

/** O que o jogador pede para assinar (compra, livre) ou renovar. */
export const playerDemand = (W: World, p: Player, kind: 'buy' | 'free' | 'renew'): Demand => {
  const me = W.clubs[W.user!];
  const from = p.c >= 0 ? W.clubs[p.c] : null;
  let wage = calcWage(p, me.div);
  if (kind === 'renew') wage = Math.max(wage, p.sal * (p.mo >= 60 ? 1.05 : 1.15));
  else if (kind === 'buy') wage = Math.max(wage, p.sal * 1.15);
  else wage = Math.max(wage, p.sal * 0.9);
  let refuse: string | undefined;
  if (kind === 'buy' && from) {
    const gap = from.rep - me.rep;
    const role = keyRole(W, p);
    // destaque está bem no clube: pede mais e não aceita descer tanto de patamar
    if (role) wage *= role === 'star' ? 1.2 : 1.1;
    if (gap > (role === 'star' ? 15 : 30)) refuse = `${p.n} não quer jogar num clube tão menor que o ${from.n}.`;
    else if (gap > 0) wage *= 1 + gap / 100;
  }
  if (ovr(p) > clubLevel(me) + 8) wage *= 1.15;
  if (kind === 'renew' && p.mo < 30) refuse = `${p.n} está insatisfeito e não quer renovar.`;
  if (kind === 'renew' && p.ret != null) refuse = `${p.n} vai se aposentar no fim da temporada e não renova.`;
  wage *= 0.96 + 0.08 * fixed01(W, p.id, 'salario');
  // quem já anunciou a aposentadoria só assina até o fim da carreira (o contrato acaba quando ele parar)
  const years: [number, number] =
    p.ret != null ? [1, 1] : p.a >= 32 ? [1, 2] : p.a >= 29 ? [1, 3] : p.a <= 23 ? [2, 5] : [1, 4];
  return { wage: roundWage(wage), years, refuse };
};

export type PlayerAnswer =
  | { r: 'accept'; msg: string }
  | { r: 'counter'; wage: number; years: [number, number]; msg: string }
  | { r: 'reject'; msg: string };

/** Conversa com o jogador sobre o salário: ele pede o que quer e aceita descer até um limite escondido. */
export const playerTalk = (W: World, p: Player, stage: 'player' | 'renew', d: Demand): Talk =>
  openTalk(W, p.id, stage, () => {
    const star = p.c >= 0 && p.c !== W.user && keyRole(W, p) === 'star';
    const t = newTalk(d.wage, roundWage(d.wage * (0.84 + 0.08 * fixed01(W, p.id, 'teto-salario'))), star ? 3 : 4, 0.45);
    say(
      t,
      'them',
      d.wage,
      `${p.n} pede ${brl(d.wage)} por mês e um contrato de ${d.years[0]}${d.years[1] > d.years[0] ? ' a ' + d.years[1] : ''} ano${d.years[1] > 1 ? 's' : ''}.`,
    );
    return t;
  });

/** Responde a uma proposta de contrato. Devolve o salário fechado ou a resposta para mostrar. */
const judgeContract = (
  W: World,
  p: Player,
  d: Demand,
  wage: number,
  years: number,
  stage: 'player' | 'renew',
): { ans: PlayerAnswer } | { wage: number } => {
  if (d.refuse) return { ans: { r: 'reject', msg: d.refuse } };
  const t = playerTalk(W, p, stage, d);
  if (t.end === 'off') return { ans: { r: 'reject', msg: `${p.n} não quer mais conversar por enquanto.` } };
  wage = roundWage(wage);
  say(t, 'me', wage, `Você ofereceu ${brl(wage)} por mês por ${years} ano${years > 1 ? 's' : ''}.`, years);
  if (years < d.years[0] || years > d.years[1]) {
    t.pat--;
    if (t.pat <= 0) {
      t.end = 'off';
      const msg = `${p.n} não gostou da proposta e encerrou a conversa.`;
      say(t, 'them', 0, msg);
      return { ans: { r: 'reject', msg } };
    }
    const msg = `${p.n} quer um contrato de ${d.years[0]} a ${d.years[1]} anos, por ${brl(t.ask)} por mês.`;
    say(t, 'them', t.ask, msg);
    return { ans: { r: 'counter', wage: t.ask, years: d.years, msg } };
  }
  const before = t.ask;
  const res = haggleDown(t, wage, roundWage);
  if (res.r === 'accept') return { wage: res.v };
  if (res.r === 'off') {
    const msg = `${p.n} recusou e encerrou a conversa.`;
    say(t, 'them', 0, msg);
    return { ans: { r: 'reject', msg } };
  }
  const msg = res.insult
    ? `Proposta baixa. ${p.n} continua pedindo ${brl(res.v)} por mês.`
    : res.v < before
      ? `${p.n} aceita baixar para ${brl(res.v)} por mês.`
      : `${p.n} não abre mão de ${brl(res.v)} por mês.`;
  say(t, 'them', res.v, msg);
  return { ans: { r: 'counter', wage: res.v, years: d.years, msg } };
};

/** Fecha a contratação (depois do acordo com o clube) ou de um jogador livre. */
export const offerContract = (W: World, pid: number, wage: number, years: number): PlayerAnswer => {
  const mk = ensureMarket(W)!;
  const p = W.pmap[pid];
  const free = p.c < 0;
  const deal = mk.agreed[pid];
  if (!free && !deal) return { r: 'reject', msg: 'Primeiro acerte o valor com o clube.' };
  if (deal?.kind === 'loan') {
    executeLoan(W, p, W.user!, deal.share);
    delete mk.agreed[pid];
    endTalk(W, pid, 'loan');
    return { r: 'accept', msg: `${p.n} chegou emprestado até o fim da temporada.` };
  }
  const me = W.clubs[W.user!];
  if (squad(W, me.id).length >= MAX_SQUAD)
    return { r: 'reject', msg: `O elenco já tem ${MAX_SQUAD} jogadores. Venda ou dispense alguém antes.` };
  if (deal && deal.fee > me.bal) return { r: 'reject', msg: 'O clube não tem mais esse dinheiro em caixa.' };
  const d = playerDemand(W, p, free ? 'free' : 'buy');
  const j = judgeContract(W, p, d, wage, years, 'player');
  if ('ans' in j) return j.ans;
  const from = p.c;
  executeTransfer(W, p, me.id, deal?.fee || 0, j.wage, years);
  delete mk.agreed[pid];
  endTalk(W, pid, 'club');
  endTalk(W, pid, 'player');
  return {
    r: 'accept',
    msg: free
      ? `${p.n} assinou até ${p.ct}, por ${brl(j.wage)} por mês.`
      : `${p.n} é do ${me.n}! Veio do ${W.clubs[from].n} por ${brl(deal!.fee)}.`,
  };
};

/** Renovação de contrato de um jogador do usuário (a qualquer momento). */
export const renewContract = (W: World, pid: number, wage: number, years: number): PlayerAnswer => {
  ensureMarket(W);
  const p = W.pmap[pid];
  const d = playerDemand(W, p, 'renew');
  const j = judgeContract(W, p, d, wage, years, 'renew');
  if ('ans' in j) return j.ans;
  p.sal = j.wage;
  p.ct = W.year + years;
  p.mo = clamp(p.mo + 8, 10, 100);
  endTalk(W, pid, 'renew');
  news(W, 'Renovação: ' + p.n, `${p.n} renovou até ${p.ct}, com salário de ${brl(j.wage)} por mês.`, 'mkt', { pid });
  return { r: 'accept', msg: `${p.n} renovou até ${p.ct}, por ${brl(j.wage)} por mês.` };
};

// ---------------------------------------------------------------- execução

const record = (W: World, p: Player, from: number, to: number, fee: number, kind: TransferRecord['kind']) => {
  const mk = W.mk!;
  mk.log.unshift({ y: W.year, d: W.day, pid: p.id, n: p.n, from, to, fee, kind });
  if (mk.log.length > 400) mk.log.length = 400;
};

/** Avisa sobre jogadores da lista de observação. */
const watchNews = (W: World, p: Player, txt: string) => {
  if (W.mk?.watch.includes(p.id)) news(W, 'Observado: ' + p.n, txt, 'mkt', { pid: p.id });
};

/** Muda o jogador de clube (compra ou jogador livre). */
export const executeTransfer = (W: World, p: Player, to: number, fee: number, wage: number, years: number): void => {
  const from = p.c;
  const buyer = W.clubs[to];
  if (fee) {
    addMoney(W, buyer, 'tra', -fee);
    if (from >= 0) addMoney(W, W.clubs[from], 'tra', fee);
  }
  if (from >= 0) removeFromLineups(W, p.id, [from]);
  p.c = to;
  p.sal = wage;
  // no 1º semestre a temporada atual conta como o 1º ano do contrato
  p.ct = W.year + years - (marketDate(W).getMonth() < 6 ? 1 : 0);
  p.mo = clamp(Math.max(p.mo, 70), 10, 100);
  delete p.fa;
  delete p.loan;
  if (W.mk) {
    delete W.mk.sell[p.id];
    W.mk.loan = W.mk.loan.filter((x) => x !== p.id);
    W.mk.offers = W.mk.offers.filter((o) => o.pid !== p.id);
    delete W.mk.agreed[p.id];
  }
  dirty(W);
  record(W, p, from, to, fee, from < 0 ? 'livre' : 'compra');
  const user = W.user;
  if (to === user || from === user) {
    const txt =
      from < 0
        ? `${p.n} (${p.p}, ${p.a} anos) assinou até ${p.ct}.`
        : to === user
          ? `${p.n} chega do ${W.clubs[from].n} por ${brl(fee)}. Contrato até ${p.ct}.`
          : `${p.n} foi vendido ao ${buyer.n} por ${brl(fee)}.`;
    news(W, (to === user ? 'Contratado: ' : 'Vendido: ') + p.n, txt, 'mkt', { pid: p.id });
  } else
    watchNews(
      W,
      p,
      `${p.n} foi ${from < 0 ? 'contratado' : 'vendido'} pelo ${buyer.n}${fee ? ' por ' + brl(fee) : ''}.`,
    );
};

/** Empréstimo até o fim da temporada. `share` é a parte do salário que `to` paga. */
export const executeLoan = (W: World, p: Player, to: number, share: number): void => {
  const from = p.c;
  removeFromLineups(W, p.id, [from]);
  p.loan = { from, share };
  p.c = to;
  if (W.mk) {
    W.mk.loan = W.mk.loan.filter((x) => x !== p.id);
    delete W.mk.sell[p.id];
    W.mk.offers = W.mk.offers.filter((o) => o.pid !== p.id);
  }
  dirty(W);
  record(W, p, from, to, 0, 'empréstimo');
  if (to === W.user || from === W.user)
    news(
      W,
      (to === W.user ? 'Chegou emprestado: ' : 'Emprestado: ') + p.n,
      `${p.n} ${to === W.user ? 'chega do ' + W.clubs[from].n : 'vai para o ' + W.clubs[to].n} até o fim da temporada. ` +
        `${W.clubs[to].n} paga ${Math.round(share * 100)}% do salário.`,
      'mkt',
      { pid: p.id },
    );
};

/** Custo para dispensar: metade do que falta pagar de salário no contrato. */
export const releaseCost = (W: World, p: Player): number =>
  roundMoney(p.sal * (remainingPaydays(W) + 10 * Math.max(0, p.ct - W.year)) * 0.5);

/** Dispensa um jogador do usuário (ele fica livre no mercado). */
export const releasePlayer = (W: World, pid: number): string | null => {
  ensureMarket(W);
  const p = W.pmap[pid];
  const me = W.clubs[W.user!];
  if (p.loan) return 'Jogador emprestado não pode ser dispensado.';
  const cost = releaseCost(W, p);
  if (cost > me.bal) return 'Dinheiro insuficiente para pagar a rescisão.';
  if (cost) addMoney(W, me, 'mul', -cost);
  removeFromLineups(W, p.id, [me.id]);
  p.c = -1;
  p.fa = W.year;
  p.ct = 0;
  delete W.mk!.sell[p.id];
  W.mk!.loan = W.mk!.loan.filter((x) => x !== p.id);
  dirty(W);
  record(W, p, me.id, -1, 0, 'saída');
  news(
    W,
    'Dispensado: ' + p.n,
    `${p.n} teve o contrato rescindido${cost ? ' (custo de ' + brl(cost) + ')' : ''}.`,
    'mkt',
    { pid },
  );
  return null;
};

// ---------------------------------------------------------------- lista de venda e propostas recebidas

export const setForSale = (W: World, pid: number, price: number | null): void => {
  const mk = ensureMarket(W)!;
  if (price == null) delete mk.sell[pid];
  else mk.sell[pid] = Math.max(10000, roundMoney(price));
};

export const setForLoan = (W: World, pid: number, on: boolean): void => {
  const mk = ensureMarket(W)!;
  mk.loan = mk.loan.filter((x) => x !== pid);
  if (on) mk.loan.push(pid);
};

/** Aceita uma proposta recebida. */
export const acceptIncoming = (W: World, id: number): string | null => {
  const mk = W.mk!;
  const o = mk.offers.find((x) => x.id === id);
  if (!o) return 'Proposta não encontrada.';
  const p = W.pmap[o.pid];
  if (!p || p.c !== W.user) return 'O jogador não está mais no clube.';
  if (o.kind === 'loan') executeLoan(W, p, o.from, o.share);
  else executeTransfer(W, p, o.from, o.fee, Math.max(p.sal, calcWage(p, W.clubs[o.from].div)), rint(mk, 2, 4));
  mk.offers = mk.offers.filter((x) => x.id !== id);
  return null;
};

export const rejectIncoming = (W: World, id: number): void => {
  W.mk!.offers = W.mk!.offers.filter((x) => x.id !== id);
};

/** Conversa de uma proposta recebida: o clube oferece `fee` (ou a parte do salário) e sobe até o máximo escondido. */
export const offerTalk = (W: World, o: IncomingOffer): Talk => {
  if (!o.talk) {
    const loan = o.kind === 'loan';
    const v = loan ? o.share : o.fee;
    const lim = Math.max(v, loan ? Math.max(o.share, o.max || 0) : o.max);
    o.talk = newTalk(v, lim, 3, 0.5);
    const p = W.pmap[o.pid];
    say(
      o.talk,
      'them',
      v,
      loan
        ? `O ${W.clubs[o.from].n} quer ${p?.n ?? 'o jogador'} emprestado e paga ${pct(v)} do salário.`
        : `O ${W.clubs[o.from].n} oferece ${brl(v)} por ${p?.n ?? 'o jogador'}.`,
    );
  }
  return o.talk;
};

export interface CounterAnswer {
  r: 'sold' | 'counter' | 'gone';
  msg: string;
}

/**
 * Contraproposta do usuário numa proposta recebida: pede mais dinheiro (venda) ou que o clube pague mais do salário
 * (empréstimo). Se o clube aceitar, o negócio fecha na hora; se perder a paciência, a proposta some.
 */
export const counterIncoming = (W: World, id: number, want: number): CounterAnswer => {
  const mk = W.mk!;
  const o = mk.offers.find((x) => x.id === id);
  if (!o) return { r: 'gone', msg: 'A proposta não existe mais.' };
  const p = W.pmap[o.pid];
  const club = W.clubs[o.from].n;
  const loan = o.kind === 'loan';
  const t = offerTalk(W, o);
  const round = loan ? roundShare : roundMoney;
  want = round(want);
  say(t, 'me', want, loan ? `Você pediu que paguem ${pct(want)} do salário.` : `Você pediu ${brl(want)}.`);
  const before = t.ask;
  const res: TalkResult = haggleUp(t, want, round);
  if (res.r === 'accept') {
    if (loan) o.share = res.v;
    else o.fee = res.v;
    const err = acceptIncoming(W, id);
    if (err) return { r: 'gone', msg: err };
    const msg = loan
      ? `Fechado: ${p.n} vai emprestado ao ${club}, que paga ${pct(res.v)} do salário.`
      : `Fechado: ${p.n} foi vendido ao ${club} por ${brl(res.v)}.`;
    say(t, 'them', res.v, msg);
    return { r: 'sold', msg };
  }
  if (res.r === 'off') {
    mk.offers = mk.offers.filter((x) => x.id !== id);
    const msg = `O ${club} achou que não ia dar acordo e desistiu da proposta.`;
    say(t, 'them', 0, msg);
    return { r: 'gone', msg };
  }
  if (loan) o.share = res.v;
  else o.fee = res.v;
  const msg = res.insult
    ? `O ${club} achou o pedido absurdo. ${loan ? `Continua pagando ${pct(res.v)} do salário.` : `Mantém ${brl(res.v)}.`}`
    : res.v > before
      ? loan
        ? `O ${club} sobe para ${pct(res.v)} do salário.`
        : `O ${club} melhora a proposta para ${brl(res.v)}.`
      : loan
        ? `O ${club} não passa de ${pct(res.v)} do salário.`
        : `O ${club} não passa de ${brl(res.v)}.`;
  say(t, 'them', res.v, msg);
  return { r: 'counter', msg };
};

// ---------------------------------------------------------------- IA no mercado

const planSize = (c: Club) => (c.div === 'D' ? 24 : 27);

/** Clubes da IA compram entre si e contratam livres. */
const aiTransfers = (W: World) => {
  const mk = W.mk!;
  const ai = W.clubs.filter((c) => c.id !== W.user && c.bal > 5e5);
  const free = W.players.filter((p) => p.c < 0 && !p.y);
  // por rodada: 4 a 8 tentativas; por dia: ~0,7 (o mesmo ritmo ao longo da janela)
  const tries = isDays(W) ? rint(mk, 0, 1) + (rnd(mk) < 0.2 ? 1 : 0) : rint(mk, 4, 8);
  for (let k = tries; k > 0; k--) {
    if (!ai.length) break;
    const buyer = pickOne(mk, ai);
    const sq = squad(W, buyer.id);
    if (sq.length >= planSize(buyer) + 12) continue;
    const lvl = clubLevel(buyer);
    // posição mais fraca: segundo melhor da linha mais distante do nível do clube
    let g = 0,
      worst = Infinity;
    for (let gi = 0; gi < 4; gi++) {
      const best = sq
        .filter((p) => POS_GROUP[p.p] === gi)
        .map(ovr)
        .sort((a, b) => b - a);
      const v = (best[gi === 0 ? 0 : 1] ?? 40) - lvl;
      if (v < worst) {
        worst = v;
        g = gi;
      }
    }
    const minO = Math.round(lvl - 2),
      maxO = Math.round(lvl + 6);
    // livre primeiro (sai mais barato)
    const fa = free.filter(
      (p) => p.c < 0 && p.ret == null && POS_GROUP[p.p] === g && ovr(p) >= minO - 2 && ovr(p) <= maxO,
    );
    if (fa.length && (sq.length < planSize(buyer) || rnd(mk) < 0.35)) {
      const p = pickOne(mk, fa);
      executeTransfer(W, p, buyer.id, 0, calcWage(p, buyer.div), rint(mk, 1, 3));
      continue;
    }
    const cands = W.players.filter((p) => {
      if (p.c < 0 || p.c === W.user || p.c === buyer.id || p.y || p.loan || p.ret != null || POS_GROUP[p.p] !== g)
        return false;
      const o = ovr(p);
      if (o < minO || o > maxO) return false;
      const seller = W.clubs[p.c];
      return seller.rep <= buyer.rep + 8;
    });
    if (!cands.length) continue;
    const p = pickOne(mk, cands.slice(0, 400));
    if (sellBlock(W, p)) continue;
    const role = keyRole(W, p);
    if (role === 'star' || (role === 'key' && rnd(mk) < 0.7)) continue;
    const fee = roundMoney(askingPrice(W, p) * (0.95 + rnd(mk) * 0.2));
    if (fee > buyer.bal * 0.5) continue;
    // negociações entre outros clubes não vão para a caixa de entrada (ficam em Mercado > Movimentações)
    executeTransfer(W, p, buyer.id, fee, Math.max(p.sal, calcWage(p, buyer.div)), rint(mk, 2, 4));
  }
};

/** Clubes da IA mandam propostas pelos jogadores do usuário. */
const aiOffersToUser = (W: World) => {
  const mk = W.mk!;
  mk.offers = mk.offers.filter((o) => o.exp >= W.day && W.pmap[o.pid]?.c === W.user);
  if (mk.offers.length >= MAX_INCOMING) return;
  const me = W.clubs[W.user!];
  const mine = squad(W, me.id).filter((p) => !p.loan);
  const busy = new Set(mk.offers.map((o) => o.pid));
  const buyerFor = (p: Player, minRep: number) => {
    const o = ovr(p);
    const list = W.clubs.filter(
      (c) =>
        c.id !== me.id && c.rep >= minRep && Math.abs(clubLevel(c) - o) <= 7 && squad(W, c.id).length < MAX_SQUAD - 1,
    );
    return list.length ? pickOne(mk, list) : null;
  };
  const push = (o: Omit<IncomingOffer, 'id' | 'exp'>) => {
    const ws = windowState(W);
    const span = isDays(W) ? Math.max(3, Math.min(10, ws.rounds)) : Math.max(1, Math.min(3, ws.rounds));
    const off: IncomingOffer = { ...o, id: mk.nextId++, exp: W.day + span };
    mk.offers.push(off);
    offerTalk(W, off);
    busy.add(o.pid);
    const p = W.pmap[o.pid];
    news(
      W,
      `Proposta por ${p.n}`,
      o.kind === 'loan'
        ? `O ${W.clubs[o.from].n} quer ${p.n} emprestado e pagaria ${Math.round(o.share * 100)}% do salário.`
        : `O ${W.clubs[o.from].n} oferece ${brl(o.fee)} por ${p.n}. Responda no Mercado até ${deadlineTxt(W, off.exp)}.`,
      'mkt',
      { pid: p.id },
    );
  };
  // jogadores à venda
  for (const [k, price] of Object.entries(mk.sell)) {
    const p = W.pmap[+k];
    if (!p || p.c !== me.id || busy.has(p.id) || rnd(mk) > perTick(W, 0.3)) continue;
    const b = buyerFor(p, 0);
    if (!b) continue;
    const fee = roundMoney(price * (0.8 + rnd(mk) * 0.25));
    if (fee > b.bal) continue;
    push({ pid: p.id, from: b.id, kind: 'buy', fee, share: 1, max: roundMoney(price * (1 + rnd(mk) * 0.2)) });
    if (mk.offers.length >= MAX_INCOMING) return;
  }
  // disponíveis para empréstimo
  for (const pid of mk.loan) {
    const p = W.pmap[pid];
    if (!p || p.c !== me.id || busy.has(pid) || rnd(mk) > perTick(W, 0.3)) continue;
    const b = buyerFor(p, 0);
    if (!b) continue;
    const sh = roundShare(0.3 + rnd(mk) * 0.6);
    push({ pid, from: b.id, kind: 'loan', fee: 0, share: sh, max: roundShare(sh + 0.1 + rnd(mk) * 0.25) });
    if (mk.offers.length >= MAX_INCOMING) return;
  }
  // às vezes um clube maior tenta tirar um destaque
  if (rnd(mk) < perTick(W, 0.05)) {
    const top = mine
      .sort((a, b) => ovr(b) - ovr(a))
      .slice(0, 6)
      .filter((p) => !busy.has(p.id));
    if (top.length) {
      const p = pickOne(mk, top);
      const b = buyerFor(p, me.rep + 1);
      if (b) {
        const fee = roundMoney(calcValue(p) * (1.1 + rnd(mk) * 0.3));
        if (fee <= b.bal)
          push({ pid: p.id, from: b.id, kind: 'buy', fee, share: 1, max: roundMoney(fee * (1.05 + rnd(mk) * 0.2)) });
      }
    }
  }
};

/** Um dia de mercado (depois dos jogos). */
export const marketTick = (W: World): void => {
  if (!ensureMarket(W)) return;
  const mk = W.mk!;
  const me = W.user!;
  // contratos terminando: avisos no começo da temporada e na reta final (rodadas 1 e 30, ou 5/jan e 1º/out)
  const first = isDays(W) ? W.day === DAYS_START + 1 : W.day === 1;
  const late = isDays(W) ? W.day === dayOfYear(new Date(W.year, 9, 1)) : W.day === 30;
  // janela abrindo: aviso na caixa de entrada
  const nowWin = windowOn(marketDate(W));
  if (nowWin && W.day > (isDays(W) ? DAYS_START : 0) && windowOn(marketDateAfter(W, W.day - 1))?.id !== nowWin.id) {
    const end = new Date(W.year, nowWin.to[0], nowWin.to[1]);
    news(
      W,
      'Janela de transferências aberta',
      `A ${nowWin.name.toLowerCase()} vai até ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}. ${nowWin.note}.`,
      'mkt',
    );
  }
  if (first || late) {
    const ending = squad(W, me).filter((p) => !p.loan && p.ct <= W.year);
    if (ending.length)
      news(
        W,
        'Contratos terminando em ' + W.year,
        ending.map((p) => p.n).join(', ') + '. Renove no Mercado ou eles saem de graça no fim da temporada.',
        'mkt',
      );
    if (first)
      for (const pid of mk.watch) {
        const p = W.pmap[pid];
        if (p && p.c >= 0 && p.c !== me && p.ct <= W.year)
          watchNews(W, p, `${p.n} está no último ano de contrato com o ${W.clubs[p.c].n}.`);
      }
  }
  if (!windowState(W).open) {
    mk.offers = [];
    mk.agreed = {};
    return;
  }
  aiTransfers(W);
  aiOffersToUser(W);
};

/**
 * Virada de temporada (chamado antes de a IA completar os elencos, com o ano ainda antigo):
 * empréstimos voltam, livres envelhecem e se aposentam, contratos vencidos acabam.
 */
export const marketSeasonEnd = (W: World): void => {
  if (!ensureMarket(W)) return;
  const mk = W.mk!;
  const user = W.user!;
  // empréstimos voltam
  const back: string[] = [];
  for (const p of W.players)
    if (p.loan) {
      if (p.c === user || p.loan.from === user) {
        back.push(p.n);
        record(W, p, p.c, p.loan.from, 0, 'retorno');
      }
      removeFromLineups(W, p.id, [p.c]);
      p.c = p.loan.from;
      delete p.loan;
    }
  if (back.length) news(W, 'Fim dos empréstimos', back.join(', ') + ' voltaram para os clubes de origem.', 'mkt');
  // quem já estava livre: envelhece; veteranos e quem está há muito tempo sem clube saem do jogo
  const gone = new Set<number>();
  for (const p of W.players) {
    if (p.c >= 0) continue;
    p.a++;
    if (p.ret != null || p.a >= 36 || (p.a >= 33 && rnd(mk) < 0.4) || W.year - (p.fa ?? W.year) >= 2) gone.add(p.id);
  }
  // contratos que acabam nesta temporada
  const left: string[] = [];
  for (const p of W.players) {
    if (p.c < 0 || p.y || p.ct > W.year) continue;
    const c = W.clubs[p.c];
    if (p.c !== user) {
      const keep = (ovr(p) >= clubLevel(c) - 4 ? 0.85 : 0.45) * (p.a >= 33 ? 0.6 : 1);
      if (rnd(mk) < keep) {
        p.ct = W.year + rint(mk, 1, 3);
        p.sal = calcWage(p, c.div);
        continue;
      }
    } else left.push(p.n);
    removeFromLineups(W, p.id, [p.c]);
    if (p.c === user || ovr(p) >= 70) record(W, p, p.c, -1, 0, 'saída');
    watchNews(W, p, `${p.n} terminou o contrato com o ${c.n} e está livre no mercado.`);
    p.c = -1;
    p.fa = W.year + 1;
    p.ct = 0;
  }
  if (left.length) news(W, 'Fim de contrato', left.join(', ') + ' terminaram o contrato e deixaram o clube.', 'mkt');
  if (gone.size) W.players = W.players.filter((p) => !gone.has(p.id));
  for (const id of gone) delete W.pmap[id];
  for (const k of Object.keys(mk.sell)) if (W.pmap[+k]?.c !== user) delete mk.sell[+k];
  mk.loan = mk.loan.filter((pid) => W.pmap[pid]?.c === user);
  mk.watch = mk.watch.filter((pid) => W.pmap[pid]);
  mk.offers = [];
  mk.agreed = {};
  mk.tries = {};
  dirty(W);
  // repõe alguns livres para o mercado não secar
  const nFree = W.players.filter((p) => p.c < 0).length;
  if (nFree < 40) seedFreeAgents(W, 40 - nFree);
};

/** Liga/desliga a observação de um jogador. */
export const toggleWatch = (W: World, pid: number): boolean => {
  const mk = ensureMarket(W)!;
  const on = !mk.watch.includes(pid);
  mk.watch = on ? [...mk.watch, pid] : mk.watch.filter((x) => x !== pid);
  return on;
};
