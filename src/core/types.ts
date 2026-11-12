import type { Pos } from './constants/attributes';
import type { Div } from './constants/divisions';

export type { Pos, Div };

export interface Tactic {
  /** chave de FORMATIONS */
  f: string;
  /** mentalidade 0..4 */
  men: number;
  /** marcação 0..2 */
  pres: number;
  /** ritmo 0..2 */
  temp: number;
  /** linha defensiva 0..2 */
  lin: number;
}

export interface SeasonStats {
  /** jogos */ j: number;
  /** gols */ g: number;
  /** assistências */ as: number;
  /** soma das notas */ nt: number;
}

export interface Player {
  id: number;
  /** nome */ n: string;
  /** id do clube (-1 = sem clube) */ c: number;
  /** posição */ p: Pos;
  /** idade */ a: number;
  /** atributos 1..20, na ordem de ATTR */ at: number[];
  /** potencial */ pt: number;
  /** moral */ mo: number;
  /** condição física 0..100 */ f: number;
  /** jogos lesionado */ inj: number;
  /** jogos suspenso */ sus: number;
  /** amarelos acumulados */ yc: number;
  st: SeasonStats;
  car: { j: number; g: number };
  /** contrato até (ano) */ ct: number;
  real: boolean;
  /** 1 = categoria de base */ y: number;
  nat: string;
  /** precisão do potencial conhecido (0..1) */ pk: number;
  /** progresso fracionário de evolução */ gx: number;
  /** fator de desenvolvimento individual */ dv: number;
  /** OVR no início da temporada */ sy: number;
  /** valor de mercado */ val: number;
  /** salário mensal */ sal: number;
  _injNow?: boolean;
  _promoted?: boolean;
}

export interface Club {
  id: number;
  n: string;
  /** sigla */ s: string;
  div: Div;
  c1: string;
  c2: string;
  rep: number;
  /** capacidade do estádio */ cap: number;
  uf: string;
  /** estádio */ std: string;
  /** grupo fixo da Série D (-1 = nenhum) */ grp: number;
  tac: Tactic;
  /** saldo em caixa */ bal: number;
  lineup: (number | null)[] | null;
  bench: number[] | null;
  /** patrocínio anual */ spon?: number | null;
  userTac?: Tactic;
}

export interface SideStats {
  pt: number;
  sh: number;
  sot: number;
  xg: number;
  cor: number;
  fou: number;
  yc: number;
  rc: number;
  off: number;
  sav: number;
}

export interface Fixture {
  id: number;
  /** dia (rodada) */ d: number;
  h: number;
  a: number;
  hg: number | null;
  ag: number | null;
  /** já jogado */ pl: boolean;
  /** índice da fase */ st: number;
  /** grupo (liga) ou confronto (mata-mata) */ g: number;
  /** 0 = liga, 1 = ida, 2 = volta */ leg: number;
  hp?: number;
  ap?: number;
  /** público */ att?: number;
  stats?: (SideStats & { g: number })[];
  goals?: { s: number; m: number; p: string; pen: boolean }[];
}

export interface LeagueStage {
  type: 'league';
  name: string;
  groups: number[][];
  double: boolean;
  start: number;
  end?: number;
  done: boolean;
}

export interface Tie {
  a: number;
  /** melhor cabeça de chave: manda o jogo de volta */
  b: number;
  f: [number, number];
  w: number | null;
}

export interface KOStage {
  type: 'ko';
  name: string;
  ties: Tie[];
  start: number;
  end: number;
  done: boolean;
  seedDecides: boolean;
  tag: string;
}

export type Stage = LeagueStage | KOStage;

export interface Competition {
  id: Div;
  name: string;
  stages: Stage[];
  fx: Fixture[];
  /** fase atual */ si: number;
  done: boolean;
  res: { champ: number | null; prom: number[]; rel: number[]; lib?: number[] };
  n: number;
  seedPts?: Record<number, number>;
}

/** Liga uma mensagem ao que ela fala (jogador ou partida). */
export interface NewsRef {
  pid?: number;
  comp?: Div;
  fid?: number;
}

export interface NewsItem {
  y: number;
  d: number;
  t: string;
  b: string;
  /** categoria: res, med, disc, youth, board, season, info */
  k: string;
  ref?: NewsRef;
  /** 1 = lida */
  rd?: 1;
  /** ação tomada a partir da mensagem */
  ac?: string;
}

/** Movimento de um dia no caixa do usuário. */
export interface FinDay {
  y: number;
  d: number;
  bil: number;
  pat: number;
  sal: number;
  inv: number;
  /** saldo no fim do dia */
  bal: number;
  /** público e adversário, quando houve jogo em casa */
  att?: number;
  opp?: number;
}

/** Resumo financeiro de uma temporada encerrada. */
export interface FinSeason {
  year: number;
  div: Div;
  bil: number;
  pat: number;
  sal: number;
  inv: number;
  bal: number;
}

export interface Board {
  exp: number;
  conf: number;
  rank?: number;
}

export interface SeasonReport {
  year: number;
  champs: Partial<Record<Div, number | null>>;
  prom: Partial<Record<Div, number[]>>;
  rel: Partial<Record<Div, number[]>>;
  scorers: Partial<Record<Div, { n: string; c: number; g: number }>>;
  user?: {
    club: number;
    div: Div;
    pos: { pos: number; pts: number; grp: number } | null;
    champ: boolean;
    prom: boolean;
    rel: boolean;
  };
}

export interface SquadIndex {
  p: Record<number, Player[]>;
  y: Record<number, Player[]>;
}

export type YouthDecision = 'up' | 'out';

export interface World {
  v: number;
  year: number;
  day: number;
  clubs: Club[];
  players: Player[];
  pmap: Record<number, Player>;
  nextPid: number;
  news: NewsItem[];
  user: number | null;
  comps: Record<Div, Competition>;
  hist: SeasonReport[];
  seasonDone: boolean;
  coach?: string;
  board?: Board;
  fin?: Record<string, number>;
  /** extrato diário da temporada atual */
  finLog?: FinDay[];
  /** resumo das temporadas anteriores */
  finHist?: FinSeason[];
  /** saldo no início da temporada */
  finStart?: number;
  ticket?: number;
  youthDecisions?: Record<number, YouthDecision>;
  /** cache do índice de elencos (não é salvo) */
  _sq?: SquadIndex | null;
}

/** Linha da classificação */
export interface TableRow {
  c: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  pts: number;
  form: ('V' | 'E' | 'D')[];
}

/** Banco de dados de entrada (padrão ou planilha) */
export interface DbClub {
  n: string;
  s: string | null;
  div: string;
  c1?: string;
  c2?: string;
  rep?: number;
  cap?: number;
  uf?: string;
  std?: string;
  grp?: number | null;
  line?: number;
}
export interface DbPlayer {
  club: string;
  n: string;
  p: string;
  a: number;
  o: number;
  pt?: number;
  real: boolean;
  nat?: string;
  line?: number;
}
export interface Database {
  clubs: DbClub[];
  players: DbPlayer[];
  youth: DbPlayer[];
}
