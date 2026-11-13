import { clamp } from '../math';
import { news } from '../news';
import { chance, gauss, hash } from '../rng';
import { RULES } from '../rules';
import { dayOfYear, isDays } from '../season/calendar';
import type { Player, World } from '../types';
import { clubLevel } from '../world/factory';
import { youthFac } from '../youth/youth';
import { ovr, shiftOvr } from './ratings';

// ---------------------------------------------------------------- regras antigas (paridade)

/** Faixa de variação do OVR na virada de temporada para quem tem mais de 21 anos (idade já virada). */
export const ageEvoRange = (age: number): [number, number] =>
  age <= 24 ? [0, 3] : age <= 28 ? [-1, 2] : age <= 31 ? [-2, 1] : age <= 33 ? [-4, 0] : [-6, -1];

/** Bônus de evolução de quem tem até 24 anos e jogou mais de 20 partidas na temporada. */
export const seasonPlayBonus = (p: Player): number => (p.st.j > 20 && p.a <= 24 ? 1 : 0);

// ---------------------------------------------------------------- curva de carreira

/*
 * Curva de carreira (regras atuais), parecida com a dos jogos de futebol:
 * - o jogador cresce rápido quando é jovem e desacelera perto do auge (por volta dos 27 anos);
 * - o crescimento depende de jogar: titular evolui bem mais rápido que reserva;
 * - o potencial que aparece no jogo é uma estimativa. O teto real (`pr`) fica escondido e pode ser um pouco
 *   maior ou menor. Quem joga pouco ou tem desenvolvimento lento (`dv`) pode parar antes do teto;
 * - entre o auge e os 30 anos o OVR fica estável; depois cai, cada vez mais rápido. Goleiros duram dois anos a mais;
 * - a evolução acontece aos poucos durante a temporada (toda semana), não só na virada.
 */

/** Sorteio fixo por jogador (0..1), para não precisar guardar nada novo no save. */
const fixed = (p: Player, salt: string): number => (hash(salt + ':' + p.id) >>> 0) / 4294967296;

/** Quantos anos o auge do jogador fica antes (−1) ou depois (+1) da média. Goleiro: +2. */
export const peakShift = (p: Player): number => Math.floor(fixed(p, 'auge') * 3) - 1 + (p.p === 'GOL' ? 2 : 0);

/** Teto real escondido para quem ainda não tem (saves antigos e jogadores novos). */
export const initCeiling = (p: Player): number => {
  const o = ovr(p);
  if (p.a >= 28) return Math.max(o, p.pt);
  // normal centrada um pouco abaixo da estimativa: a maioria não chega exatamente ao potencial mostrado
  const u = fixed(p, 'teto'),
    v = fixed(p, 'teto2');
  const g = Math.sqrt(-2 * Math.log(u || 1e-9)) * Math.cos(2 * Math.PI * v);
  return clamp(Math.round(p.pt - 1 + g * 3), o, 99);
};

const ceilingOf = (p: Player): number => (p.pr == null ? (p.pr = initCeiling(p)) : p.pr);

/** Ritmo anual de crescimento (fração do que falta até o teto) pela idade relativa ao auge. */
const growRate = (rel: number): number =>
  rel <= 18 ? 0.3 : rel <= 20 ? 0.28 : rel <= 22 ? 0.24 : rel <= 24 ? 0.17 : rel <= 26 ? 0.1 : rel <= 28 ? 0.05 : 0;

/** Pontos de OVR perdidos por ano a partir dos 30 (idade relativa ao auge). */
const declinePerYear = (rel: number): number =>
  rel < 30 ? 0 : (([0.8, 1.2, 1.8, 2.5, 3.2] as const)[rel - 30] ?? 4 + (rel - 35) * 0.6);

/** Quanto o jogador tem jogado: 0 (nunca) a 1 (sempre), em relação a quem mais jogou no clube. */
const playShare = (p: Player, clubMax: number): number => (clubMax < 3 ? 0.5 : Math.min(1, p.st.j / clubMax));

/**
 * Pontos de OVR por temporada no ritmo atual (positivo: evolui; negativo: cai). `clubMax` é o número de jogos de
 * quem mais jogou no clube (para medir a minutagem).
 */
export const yearlyGrowth = (W: World, p: Player, clubMax: number): number => {
  const rel = p.a - peakShift(p);
  const decline = declinePerYear(rel);
  if (decline > 0) return -decline;
  const gap = ceilingOf(p) - ovr(p);
  if (gap <= 0) return 0;
  const c = W.clubs[p.c];
  // base: treina e joga nas categorias de base; profissional: depende da minutagem
  const play = p.y ? 0.85 : 0.6 + 0.6 * playShare(p, clubMax);
  const club = c ? youthFac(c) : 1;
  // parte proporcional ao que falta mais um ritmo mínimo até os 24 anos: assim dá para chegar ao teto
  const base = rel <= 22 ? 1 : rel <= 24 ? 0.5 : 0;
  return Math.min(gap, (gap * growRate(rel) + base) * play * club * (p.dv || 1));
};

/** Tiques de evolução por temporada: um por semana (calendário por dias) ou um por rodada. */
const TICKS_DAYS = 52;
const TICKS_ROUNDS = 40;

/** Evolução contínua de todos os jogadores com clube (regras atuais). Roda uma vez por semana ou por rodada. */
export const careerTick = (W: World): void => {
  if (isDays(W) && W.day % 7 !== 0) return;
  const n = isDays(W) ? TICKS_DAYS : TICKS_ROUNDS;
  const noise = 0.05 * Math.sqrt(TICKS_ROUNDS / n);
  const clubMax: Record<number, number> = {};
  for (const p of W.players) if (p.c >= 0 && !p.y && p.st.j > (clubMax[p.c] || 0)) clubMax[p.c] = p.st.j;
  for (const p of W.players) {
    if (p.c < 0) continue;
    const g = yearlyGrowth(W, p, clubMax[p.c] || 0);
    if (!g) continue;
    p.gx = (p.gx || 0) + g / n + gauss() * noise * (g > 0 ? 1 : 0.5);
    let k = 0;
    while (p.gx >= 1 && k++ < 3) {
      const o = ovr(p);
      shiftOvr(p, 1);
      if (ovr(p) > o || chance(0.5)) p.gx -= 1;
    }
    while (p.gx <= -1 && k++ < 3) {
      const o = ovr(p);
      shiftOvr(p, -1);
      if (ovr(p) < o || chance(0.5)) p.gx += 1;
    }
    // a estimativa nunca fica abaixo do que ele já é
    const o = ovr(p);
    if (o > p.pt) p.pt = o;
    if (o > (p.pr ?? 0)) p.pr = o;
  }
};

/**
 * Virada de temporada (regras atuais, idade já virada): a estimativa do potencial se aproxima do teto real e o teto
 * muda um pouco com a temporada (quem foi muito bem ganha +1, quem foi mal perde 1). Depois do auge, o potencial
 * mostrado é o próprio OVR.
 */
export const careerSeasonEnd = (p: Player): void => {
  const o = ovr(p);
  let pr = ceilingOf(p);
  if (p.st.j >= 15) {
    const avg = p.st.nt / p.st.j;
    if (avg >= 7.2 && p.a <= 26) pr += 1;
    else if (avg <= 6.1) pr -= 1;
  }
  pr = clamp(pr, o, 99);
  p.pr = pr;
  const rel = p.a - peakShift(p);
  if (rel >= 29 || pr <= o) p.pt = o;
  else p.pt = clamp(Math.round(p.pt + (pr - p.pt) * 0.4 + gauss() * 1.2), o, 99);
  p.gx = clamp(p.gx || 0, -0.9, 0.9);
};

// ---------------------------------------------------------------- aposentadoria anunciada

/** Chance de um jogador encerrar a carreira na virada (pela idade que terá e pelo nível no clube). */
export const retireChance = (W: World, p: Player): number => {
  const age = p.a + 1;
  const o = ovr(p);
  const c = W.clubs[p.c];
  let v = age >= 40 ? 1 : age >= 37 ? 0.55 : age >= 35 ? 0.3 : age >= 33 && c && o < clubLevel(c) - 10 ? 0.2 : 0;
  if (p.p === 'GOL' && age < 40) v *= 0.7;
  if (p.c === W.user && age < 38) v *= 0.6;
  return v;
};

/** Dia em que os jogadores avisam que vão parar: 1º de junho (dias) ou rodada 20 (rodadas). Seis meses antes. */
export const retireNoticeDay = (W: World): number => (isDays(W) ? dayOfYear(new Date(W.year, 5, 1)) : 20);

/**
 * Seis meses antes do fim da temporada, quem vai parar avisa o clube. Com o aviso (`ret`), o jogador encerra a carreira
 * na virada; até lá ele joga normalmente, mas não renova e nenhum clube da IA o contrata.
 */
export const announceRetirements = (W: World): void => {
  if (W.day !== retireNoticeDay(W)) return;
  W.retAnn = W.year;
  for (const p of W.players) {
    if (p.c < 0 || p.y || p.ret != null) continue;
    if (!chance(retireChance(W, p))) continue;
    p.ret = W.year;
    if (p.c === W.user)
      news(
        W,
        'Aposentadoria: ' + p.n,
        `${p.n} (${p.a} anos) comunicou à diretoria que vai encerrar a carreira no fim da temporada, daqui a cerca de seis meses. Até lá ele segue à disposição.`,
        'info',
        { pid: p.id },
      );
    else if (W.mk?.watch.includes(p.id))
      news(W, 'Observado: ' + p.n, `${p.n} anunciou que vai se aposentar no fim da temporada.`, 'mkt', { pid: p.id });
  }
};

/** Vai se aposentar no fim desta temporada? */
export const retiring = (W: World, p: Player): boolean => p.ret != null && p.ret <= W.year;

/** Curva de carreira e aposentadoria anunciada (regras atuais) ou a evolução antiga. */
export const usesCareerCurve = (): boolean => RULES.career === 'curve';
