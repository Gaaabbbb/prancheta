import type { Pos } from './attributes';

/** Divisões do futebol brasileiro (as ligas que o usuário pode disputar). */
export const DIVS = ['A', 'B', 'C', 'D'] as const;
export type BrDiv = (typeof DIVS)[number];
/** 'SUL' = clube sul-americano (fora do Brasil): joga a liga do seu país e as copas da Conmebol. */
export type Div = BrDiv | 'SUL';

export const DIV_NAME: Record<Div, string> = {
  A: 'Série A',
  B: 'Série B',
  C: 'Série C',
  D: 'Série D',
  SUL: 'Sul-América',
};
/** Preço padrão do ingresso (R$) */
export const TICKET: Record<Div, number> = { A: 60, B: 35, C: 20, D: 12, SUL: 30 };
/** Salário mínimo por divisão (R$/mês) */
export const DIV_MIN_SAL: Record<Div, number> = { A: 70000, B: 22000, C: 9000, D: 3500, SUL: 15000 };
/** Reputação para a qual o clube converge na divisão (os sul-americanos não convergem) */
export const DIV_REP_TARGET: Record<Div, number> = { A: 80, B: 58, C: 45, D: 32, SUL: 70 };

/** Países da Conmebol no jogo (sigla FIFA → nome). */
export const COUNTRIES: Record<string, string> = {
  BRA: 'Brasil',
  ARG: 'Argentina',
  BOL: 'Bolívia',
  CHI: 'Chile',
  COL: 'Colômbia',
  ECU: 'Equador',
  PAR: 'Paraguai',
  PER: 'Peru',
  URU: 'Uruguai',
  VEN: 'Venezuela',
};
export const FOREIGN = ['ARG', 'BOL', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'URU', 'VEN'] as const;

/** Ordem geográfica (norte → sul), usada para montar grupos regionais. */
export const REGION_ORDER = [
  'RR',
  'AM',
  'AC',
  'RO',
  'AP',
  'PA',
  'TO',
  'MA',
  'PI',
  'CE',
  'RN',
  'PB',
  'PE',
  'AL',
  'SE',
  'BA',
  'DF',
  'GO',
  'MT',
  'MS',
  'MG',
  'ES',
  'RJ',
  'SP',
  'PR',
  'SC',
  'RS',
];

/** Quantos jogadores por posição o elenco deve ter. */
export const SQUAD_PLAN: Record<Pos, number> = {
  GOL: 3,
  ZAG: 5,
  LD: 2,
  LE: 2,
  VOL: 3,
  MC: 3,
  MEI: 2,
  PD: 2,
  PE: 2,
  ATA: 3,
};
export const SQUAD_PLAN_D: Record<Pos, number> = {
  GOL: 2,
  ZAG: 4,
  LD: 2,
  LE: 2,
  VOL: 2,
  MC: 3,
  MEI: 2,
  PD: 2,
  PE: 2,
  ATA: 3,
};

/** Tamanho da Série C na temporada seguinte (o formato cresce até 2028). */
export const targetC = (y: number): number => (y <= 2026 ? 20 : y === 2027 ? 24 : 28);
/** Quantos clubes sobem da Série D. */
export const promD = (y: number): number => (y <= 2028 ? 6 : 4);

export const EXP_TXT = [
  'Lutar contra o rebaixamento',
  'Terminar no meio da tabela',
  'Brigar na parte de cima',
  'Brigar pelo acesso',
  'Brigar pelo título',
];

/** Rodadas por temporada (usado na interface). */
export const SEASON_DAYS = 40;
