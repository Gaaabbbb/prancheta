import { type Div } from '../constants/divisions';
import { deadlineTxt, perTick, seasonLastDay, ticks } from '../season/calendar';
import { clamp } from '../math';
import { news } from '../news';
import { hash } from '../rng';
import type { SponsorContract, SponsorOffer, SponsorSlot, SponsorState, World } from '../types';
import { addMoney, monthlyWages, PAYDAYS, remainingPaydays, sponsorFactor } from './ledger';
import { SPONSOR_BY_ID, SPONSORS, type SponsorDef } from './sponsorCatalog';

export const SLOTS: SponsorSlot[] = ['master', 'sec'];
export const SLOT_NAME: Record<SponsorSlot, string> = { master: 'Patrocinador master', sec: 'Patrocinador secundário' };
/** Parte do potencial de patrocínio do clube que cada espaço vale. */
const SLOT_SHARE: Record<SponsorSlot, number> = { master: 0.68, sec: 0.32 };
/** Fixo paga o valor cheio; longo, um pouco menos por durar mais; exigente, um pouco mais por 1 ano só. */
const STYLE_FACTOR = { fixo: 1, longo: 0.92, desempenho: 1.06 };
/** Multa por rescisão: parte do que ainda falta pagar no contrato. */
const FEE_RATE = 0.4;
/** Dias de espera entre duas buscas ativas por patrocinador. */
export const SEEK_COOLDOWN = 5;

// sorteio próprio (mulberry32) para os patrocínios não mexerem no sorteio dos jogos
const rnd = (sp: SponsorState): number => {
  let t = (sp.rs = (sp.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rint = (sp: SponsorState, a: number, b: number) => a + Math.floor(rnd(sp) * (b - a + 1));

/** Valor em reais para as notícias (R$ 1,2 mi / R$ 450 mil). */
const brl = (v: number) =>
  v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : 'R$ ' + Math.round(v / 1e3) + ' mil';

/** Valores redondos (R$ 10 mil ou R$ 100 mil). */
const nice = (v: number) => (v >= 1e7 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4);

export const sponsorDef = (sid: number): SponsorDef => SPONSOR_BY_ID[sid];

/** Quanto o clube atrai de patrocínio por ano (folha, reputação). */
export const sponsorPotential = (W: World): number => {
  const c = W.clubs[W.user!];
  return monthlyWages(W, c.id) * 10 * sponsorFactor(c);
};

/** Patrocinadores que aceitam a divisão do clube e não estão no outro espaço. */
const candidates = (W: World, slot: SponsorSlot, exclude: number[] = []): SponsorDef[] => {
  const sp = W.sp!;
  const div: Div = W.clubs[W.user!].div;
  const other = sp[slot === 'master' ? 'sec' : 'master']?.sid;
  const busy = new Set([other, sp[slot]?.sid, ...exclude, ...sp.offers.map((o) => o.sid)]);
  return SPONSORS.filter((s) => s.divs.includes(div) && !busy.has(s.id));
};

const makeContract = (W: World, def: SponsorDef, slot: SponsorSlot, mult: number): SponsorContract => {
  const sp = W.sp!;
  const base = sponsorPotential(W) * SLOT_SHARE[slot] * def.mult * STYLE_FACTOR[def.style] * mult;
  const val = nice(base * (0.9 + rnd(sp) * 0.2));
  const years = def.style === 'longo' ? rint(sp, 3, 4) : def.style === 'desempenho' ? 1 : rint(sp, 1, 2);
  return {
    sid: def.id,
    slot,
    val,
    win: 0,
    from: W.year,
    to: W.year + years - 1,
  };
};

const pushOffer = (W: World, c: SponsorContract, extra: Partial<SponsorOffer> = {}): SponsorOffer => {
  const sp = W.sp!;
  const o: SponsorOffer = {
    ...c,
    id: sp.nextId++,
    exp: Math.min(seasonLastDay(W), W.day + ticks(W, rint(sp, 4, 7))),
    cover: 0,
    ...extra,
  };
  sp.offers.push(o);
  return o;
};

/** Cria uma proposta nova para o espaço (vaga ou substituição). */
const newOffer = (W: World, slot: SponsorSlot, replace: boolean, silent = false): SponsorOffer | null => {
  const sp = W.sp!;
  const list = candidates(W, slot);
  if (!list.length) return null;
  const def = list[Math.floor(rnd(sp) * list.length)];
  const cur = sp[slot];
  let o: SponsorOffer;
  if (replace && cur) {
    // quem quer tirar o atual paga mais e às vezes ajuda com a multa
    const c = makeContract(W, def, slot, 1);
    c.val = nice(Math.max(c.val, cur.val * (1.12 + rnd(sp) * 0.23) * STYLE_FACTOR[def.style]));
    o = pushOffer(W, c, { cover: [0, 0.25, 0.5][rint(sp, 0, 2)] });
    if (!silent)
      news(
        W,
        `${def.n} quer ser o ${SLOT_NAME[slot].toLowerCase()}`,
        `A ${def.n} oferece mais que o contrato atual com a ${sponsorDef(cur.sid).n}. Veja a proposta em Finanças, aba Patrocínio.`,
        'spon',
      );
  } else {
    o = pushOffer(W, makeContract(W, def, slot, 1));
    if (!silent)
      news(
        W,
        `Proposta de patrocínio: ${def.n}`,
        `A ${def.n} (${def.sec.toLowerCase()}) quer ser o ${SLOT_NAME[slot].toLowerCase()}. Responda até ${deadlineTxt(W, o.exp)} em Finanças, aba Patrocínio.`,
        'spon',
      );
  }
  return o;
};

/** Cria os patrocínios iniciais (carreira nova ou save antigo). Não faz nada se já existirem. */
export const ensureSponsors = (W: World): void => {
  if (W.user == null || W.sp) return;
  const c = W.clubs[W.user];
  W.sp = { master: null, sec: null, offers: [], rs: hash(c.n + W.year) >>> 0 || 1, nextId: 1 };
  for (const slot of SLOTS) {
    const list = candidates(W, slot).filter((s) => s.style !== 'desempenho');
    if (!list.length) continue;
    const def = list[Math.floor(rnd(W.sp) * list.length)];
    const k = makeContract(W, def, slot, 1);
    k.to = W.year + (slot === 'master' ? 0 : 1);
    W.sp[slot] = k;
  }
};

/**
 * O usuário só pode trocar cada espaço uma vez por temporada (rescindir ou aceitar quem quer substituir).
 * Preencher um espaço vazio não conta, nem quando foi a marca que rompeu.
 */
export const slotLocked = (W: World, slot: SponsorSlot): boolean => W.sp?.lock?.[slot] === W.year;

const lockSlot = (W: World, slot: SponsorSlot) => {
  const sp = W.sp!;
  sp.lock = { ...(sp.lock || {}), [slot]: W.year };
};

/** Saves antigos: o bônus por vitória saiu do jogo. */
export const clearWinBonuses = (W: World): void => {
  const sp = W.sp;
  if (!sp) return;
  for (const c of [sp.master, sp.sec, ...sp.offers]) if (c) c.win = 0;
};

/** Satisfação do patrocinador (0..100): resultados recentes e paciência da marca. */
export const sponsorSatisfaction = (W: World, c: SponsorContract): number => {
  const conf = W.board?.conf ?? 60;
  const def = sponsorDef(c.sid);
  return Math.round(clamp(conf * 0.7 + def.pat * 35 - (def.style === 'desempenho' ? 10 : 0), 0, 100));
};

/** Valor que ainda falta receber do contrato. */
export const remainingValue = (W: World, c: SponsorContract): number =>
  (c.val / PAYDAYS) * remainingPaydays(W) + c.val * Math.max(0, c.to - W.year);

/** Multa para encerrar o contrato antes do fim. */
export const terminationFee = (W: World, c: SponsorContract): number => nice(remainingValue(W, c) * FEE_RATE);

/** Total anual dos contratos atuais. */
export const sponsorAnnual = (W: World): number => SLOTS.reduce((t, s) => t + (W.sp?.[s]?.val || 0), 0);

/** Parcela mensal de cada contrato (chamado nos dias de pagamento). */
export const sponsorPay = (W: World, months = 1): void => {
  const me = W.clubs[W.user!];
  for (const s of SLOTS) {
    const c = W.sp![s];
    if (c) addMoney(W, me, 'pat', (c.val / PAYDAYS) * months);
  }
};

/** Aceita uma proposta. Se o espaço estiver ocupado, paga a multa do atual (menos o que o novo cobre). */
export const acceptOffer = (W: World, id: number): string | null => {
  const sp = W.sp!;
  const o = sp.offers.find((x) => x.id === id);
  if (!o) return 'Proposta não encontrada.';
  const me = W.clubs[W.user!];
  const cur = sp[o.slot];
  if (cur && !o.renewal) {
    if (slotLocked(W, o.slot)) return `Você já trocou o ${SLOT_NAME[o.slot].toLowerCase()} nesta temporada.`;
    const fee = nice(terminationFee(W, cur) * (1 - o.cover));
    if (fee > me.bal) return 'Dinheiro insuficiente para pagar a multa do contrato atual.';
    if (fee) addMoney(W, me, 'mul', -fee);
    lockSlot(W, o.slot);
  }
  const { sid, slot, val, from, to } = o;
  sp[slot] = { sid, slot, val, win: 0, from, to };
  sp.offers = sp.offers.filter((x) => x.slot !== slot && x.sid !== sid);
  news(
    W,
    `Novo ${SLOT_NAME[slot].toLowerCase()}: ${sponsorDef(sid).n}`,
    `Contrato assinado até ${to}, ${brl(val)} por ano.`,
    'spon',
  );
  return null;
};

export const rejectOffer = (W: World, id: number): void => {
  W.sp!.offers = W.sp!.offers.filter((x) => x.id !== id);
};

/** Pede mais dinheiro. Pode subir o valor, manter ou fazer a marca desistir. */
export const haggleOffer = (W: World, id: number): 'up' | 'same' | 'gone' | null => {
  const sp = W.sp!;
  const o = sp.offers.find((x) => x.id === id);
  if (!o || o.haggled) return null;
  o.haggled = true;
  const rep = W.clubs[W.user!].rep;
  const r = rnd(sp);
  if (r < 0.5 + (rep - 50) / 250) {
    o.val = nice(o.val * (1.08 + rnd(sp) * 0.08));
    return 'up';
  }
  if (rnd(sp) < 0.4) {
    sp.offers = sp.offers.filter((x) => x.id !== id);
    return 'gone';
  }
  return 'same';
};

/** O clube rompe o contrato e paga a multa. */
export const terminateContract = (W: World, slot: SponsorSlot): string | null => {
  const sp = W.sp!;
  const c = sp[slot];
  if (!c) return null;
  if (slotLocked(W, slot)) return `Você já trocou o ${SLOT_NAME[slot].toLowerCase()} nesta temporada.`;
  const me = W.clubs[W.user!];
  const fee = terminationFee(W, c);
  if (fee > me.bal) return 'Dinheiro insuficiente para pagar a multa.';
  addMoney(W, me, 'mul', -fee);
  sp[slot] = null;
  lockSlot(W, slot);
  news(
    W,
    `Contrato rescindido: ${sponsorDef(c.sid).n}`,
    `O clube pagou a multa e o espaço de ${SLOT_NAME[slot].toLowerCase()} está livre.`,
    'spon',
  );
  return null;
};

/** Dias que faltam para poder buscar patrocinador de novo (0 = pode). */
export const seekWait = (W: World): number => {
  const sp = W.sp;
  if (!sp?.seek) return 0;
  const now = W.year * 1000 + W.day;
  // saves antigos guardavam ano*100+dia
  const seek = sp.seek < W.year * 1000 - 1000 ? sp.seek * 10 : sp.seek;
  return Math.max(0, seek + ticks(W, SEEK_COOLDOWN) - now);
};

/** Busca ativa: o departamento comercial procura marcas. Gera de 1 a 2 propostas. */
export const seekSponsors = (W: World): number => {
  const sp = W.sp!;
  if (seekWait(W) > 0) return 0;
  sp.seek = W.year * 1000 + W.day;
  const empty = SLOTS.filter((s) => !sp[s]);
  const open = empty.length ? empty : SLOTS.filter((s) => !slotLocked(W, s));
  if (!open.length) return 0;
  let n = 0;
  const tries = rint(sp, 1, 2);
  for (let i = 0; i < tries; i++) {
    const slot = open[i % open.length];
    if (newOffer(W, slot, !!sp[slot], true)) n++;
  }
  return n;
};

/** Um dia de patrocínio: propostas vencem, chegam novas, marcas insatisfeitas podem romper. */
export const sponsorTick = (W: World): void => {
  if (W.user == null) return;
  ensureSponsors(W);
  const sp = W.sp!;
  sp.offers = sp.offers.filter((o) => o.exp >= W.day);
  const me = W.clubs[W.user];
  for (const slot of SLOTS) {
    const c = sp[slot];
    if (!c) {
      if (sp.offers.filter((o) => o.slot === slot).length < 2 && rnd(sp) < perTick(W, 0.25)) newOffer(W, slot, false);
      continue;
    }
    const sat = sponsorSatisfaction(W, c);
    if (sat < 35 && rnd(sp) < perTick(W, (0.05 * (35 - sat)) / 35)) {
      // a marca rompe e paga uma compensação menor que a multa cheia
      const comp = nice(terminationFee(W, c) * 0.5);
      if (comp) addMoney(W, me, 'mul', comp);
      sp[slot] = null;
      news(
        W,
        `${sponsorDef(c.sid).n} rompeu o patrocínio`,
        `Insatisfeita com os resultados, a marca encerrou o contrato e pagou ${brl(comp)} de compensação. O espaço de ${SLOT_NAME[slot].toLowerCase()} está livre.`,
        'spon',
      );
      continue;
    }
    if (!slotLocked(W, slot) && !sp.offers.some((o) => o.slot === slot) && rnd(sp) < perTick(W, 0.035))
      newOffer(W, slot, true);
  }
};

/** Virada de temporada (chamado com o ano novo já valendo): contratos vencem, renovações e propostas novas. */
export const sponsorSeasonEnd = (W: World): void => {
  if (W.user == null) return;
  ensureSponsors(W);
  const sp = W.sp!;
  const div = W.clubs[W.user].div;
  sp.offers = [];
  sp.seek = undefined;
  for (const slot of SLOTS) {
    const c = sp[slot];
    if (!c) continue;
    const def = sponsorDef(c.sid);
    if (!def.divs.includes(div)) {
      sp[slot] = null;
      news(
        W,
        `${def.n} encerrou o contrato`,
        `A marca não patrocina clubes da divisão atual. O espaço ficou livre.`,
        'spon',
      );
    } else if (c.to < W.year) {
      sp[slot] = null;
      const sat = sponsorSatisfaction(W, c);
      if (sat >= 45) {
        const k = makeContract(W, def, slot, 1 + (sat - 55) / 200);
        const exp = W.day + ticks(W, 8);
        pushOffer(W, k, { renewal: true, exp });
        news(
          W,
          `${def.n} quer renovar`,
          `O contrato terminou e a marca propôs renovar. Responda até ${deadlineTxt(W, exp)}.`,
          'spon',
        );
      } else news(W, `Fim do contrato com ${def.n}`, `A marca não quis renovar. O espaço ficou livre.`, 'spon');
    }
  }
  for (const slot of SLOTS)
    if (!sp[slot]) {
      const o1 = newOffer(W, slot, false, true);
      const o2 = newOffer(W, slot, false, true);
      for (const o of [o1, o2]) if (o) o.exp = W.day + ticks(W, 8);
    }
  if (sp.offers.some((o) => !o.renewal))
    news(
      W,
      'Propostas de patrocínio',
      'Chegaram propostas para os espaços livres. Veja em Finanças, aba Patrocínio.',
      'spon',
    );
};
