import { rand } from '../rng';
import { RULES } from '../rules';
import type { Player, World } from '../types';

/*
 * Lesões ligadas ao desgaste (regras atuais, `RULES.injuryModel = 'risk'`). Cada jogador tem um peso de risco:
 * - cansaço, numa curva forte (100% de fôlego = 1; 60% ≈ 2,3; 40% ≈ 3,9);
 * - idade, +5% por ano acima dos 29;
 * - carga: jogos nos últimos 10 dias;
 * - recaída: nos 3 jogos depois de voltar de lesão.
 * O motor sorteia a lesão pelo risco médio em campo e o lesionado pelo risco de cada um. Risco alto também puxa a
 * lesão para os tipos mais graves.
 */

/** Jogos guardados para medir a carga (dias em que o jogador entrou em campo). */
const LOAD_KEEP = 4;
/** Jogos com risco de recaída depois de voltar de lesão. */
export const RELAPSE_GAMES = 3;

export interface InjuryType {
  name: string;
  /** como aparece na notícia */
  txt: string;
  /** afastamento em dias */
  days: [number, number];
  /** peso no sorteio (risco normal) */
  w: number;
}

export const INJURY_TYPES: InjuryType[] = [
  { name: 'Pancada', txt: 'uma pancada', days: [2, 5], w: 42 },
  { name: 'Estiramento', txt: 'um estiramento na coxa', days: [7, 18], w: 30 },
  { name: 'Entorse', txt: 'uma entorse no tornozelo', days: [14, 30], w: 15 },
  { name: 'Lesão muscular', txt: 'uma lesão muscular', days: [28, 50], w: 8 },
  { name: 'Fratura', txt: 'uma fratura', days: [42, 84], w: 3 },
  { name: 'Ligamento', txt: 'uma lesão de ligamento no joelho', days: [120, 240], w: 2 },
];

/** Jogos do jogador nos 9 dias antes de `day` (calendário por dias). */
const recentGames = (p: Player, day: number): number => (p.gm || []).filter((d) => d < day && d >= day - 9).length;

export interface Risk {
  w: number;
  /** motivos que mais pesam (para o selo na tela) */
  why: string[];
}

/** Peso de risco de lesão do jogador agora (`day` = dia do jogo). */
export const injuryRisk = (W: World, p: Player, day = W.day + 1): Risk => {
  const why: string[] = [];
  const tired = (100 - p.f) / 35;
  let w = 1 + tired * tired;
  if (p.f < 60) why.push('cansado');
  if (p.a > 29) {
    w *= 1 + (p.a - 29) * 0.05;
    if (p.a >= 33) why.push(`${p.a} anos`);
  }
  if (W.cal === 'days') {
    const g = recentGames(p, day);
    if (g >= 3) {
      w *= 1.7;
      why.push(`${g + 1} jogos em 10 dias`);
    } else if (g >= 2) {
      w *= 1.35;
      why.push('3 jogos em 10 dias');
    }
  }
  if (p.rtn != null && p.rtn < RELAPSE_GAMES) {
    w *= [1.8, 1.5, 1.25][p.rtn];
    why.push('voltando de lesão');
  }
  return { w, why };
};

/** Nível do risco para o selo: baixo (< 2), médio (2 a 3) ou alto (3 ou mais). */
export const riskLevel = (w: number): 'baixo' | 'médio' | 'alto' => (w >= 3 ? 'alto' : w >= 2 ? 'médio' : 'baixo');

/** Sorteia o tipo de lesão; risco alto puxa para os mais graves. */
export const rollInjury = (w: number): InjuryType => {
  const tot = INJURY_TYPES.reduce((t, x) => t + x.w, 0);
  // expoente < 1 empurra o sorteio para o fim da lista (lesões mais graves)
  const r = Math.pow(rand(), 1 / (1 + Math.max(0, w - 1) * 0.05)) * tot;
  let acc = 0;
  for (const t of INJURY_TYPES) {
    acc += t.w;
    if (r <= acc) return t;
  }
  return INJURY_TYPES[INJURY_TYPES.length - 1];
};

/** Afastamento em dias convertido para o que o jogo conta: jogos (4 dias cada) ou rodadas (uma por semana). */
export const daysToOut = (W: World, days: number): number => Math.max(1, Math.round(days / (W.cal === 'days' ? 4 : 7)));

/** Registra o jogo para a carga e conta os jogos depois de voltar de lesão. */
export const notePlayed = (p: Player, day: number): void => {
  if (RULES.injuryModel !== 'risk') return;
  p.gm = [...(p.gm || []), day].slice(-LOAD_KEEP);
  if (p.rtn != null) {
    p.rtn++;
    if (p.rtn >= RELAPSE_GAMES) delete p.rtn;
  }
};

/** O jogador voltou de lesão: fôlego no máximo 70% e alguns jogos com risco de recaída. */
export const backFromInjury = (p: Player): void => {
  if (RULES.injuryModel !== 'risk') return;
  p.f = Math.min(p.f, 70);
  p.rtn = 0;
  delete p.injT;
};

/** Texto do afastamento para as notícias. */
export const outTxt = (days: number): string =>
  days <= 6
    ? `cerca de ${days} dias`
    : days < 28
      ? `cerca de ${Math.round(days / 7)} semana${Math.round(days / 7) > 1 ? 's' : ''}`
      : `cerca de ${Math.round(days / 30)} ${Math.round(days / 30) > 1 ? 'meses' : 'mês'}`;
