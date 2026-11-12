import { SEASON_DAYS } from '../constants/divisions';
import { dateOf } from '../season/calendar';
import type { World } from '../types';

/** Uma janela de transferências do calendário da CBF (mês 0 = janeiro). */
export interface TransferWindow {
  id: 1 | 2 | 3;
  name: string;
  from: [month: number, day: number];
  to: [month: number, day: number];
  note: string;
}

/**
 * Janelas da temporada: 1ª (5/jan a 3/mar), complementar (4 a 27/mar, só mercado nacional) e 2ª (20/jul a 11/set).
 * Como todos os clubes do jogo são brasileiros, a complementar funciona igual às outras; o que muda é que as
 * tentativas de negociação recomeçam.
 */
export const TRANSFER_WINDOWS: TransferWindow[] = [
  { id: 1, name: '1ª janela', from: [0, 5], to: [2, 3], note: 'Qualquer jogador' },
  { id: 2, name: 'Janela complementar', from: [2, 4], to: [2, 27], note: 'Só mercado nacional' },
  { id: 3, name: '2ª janela', from: [6, 20], to: [8, 11], note: 'Qualquer jogador' },
];

const DAY_MS = 86400000;
const atDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();

/** Janela aberta numa data (ou null). */
export const windowOn = (dt: Date): TransferWindow | null => {
  const y = dt.getFullYear();
  const t = atDay(dt);
  return (
    TRANSFER_WINDOWS.find(
      (w) => t >= new Date(y, w.from[0], w.from[1]).getTime() && t <= new Date(y, w.to[0], w.to[1]).getTime(),
    ) ?? null
  );
};

/** Primeiro e último dia de uma janela no ano. */
export const windowRange = (year: number, w: TransferWindow): [Date, Date] => [
  new Date(year, w.from[0], w.from[1]),
  new Date(year, w.to[0], w.to[1]),
];

/**
 * "Hoje" para o mercado depois de `d` rodadas disputadas: o dia seguinte à última rodada.
 * Antes da 1ª rodada é a pré-temporada (meados de janeiro).
 */
export const marketDateAfter = (W: World, d: number): Date => {
  if (d <= 0) return new Date(W.year, 0, 15);
  return new Date(atDay(dateOf(W, d)) + DAY_MS);
};

export const marketDate = (W: World): Date => marketDateAfter(W, W.day);

export interface WindowState {
  open: boolean;
  name: string;
  /** rodadas até fechar (aberta) ou abrir (fechada) */
  rounds: number;
  /** data de abertura (fechada) */
  opens?: Date;
  /** último dia (aberta) */
  closes?: Date;
  win?: TransferWindow;
}

/** Situação da janela agora. */
export const windowState = (W: World): WindowState => {
  if (W.seasonDone) return { open: false, name: '1ª janela', rounds: 0, win: TRANSFER_WINDOWS[0] };
  const now = windowOn(marketDate(W));
  if (now) {
    let n = 0;
    for (let d = W.day + 1; d <= SEASON_DAYS && windowOn(marketDateAfter(W, d))?.id === now.id; d++) n++;
    return { open: true, name: now.name, rounds: n, closes: windowRange(W.year, now)[1], win: now };
  }
  for (let d = W.day + 1; d <= SEASON_DAYS; d++) {
    const w = windowOn(marketDateAfter(W, d));
    if (w) return { open: false, name: w.name, rounds: d - W.day, opens: windowRange(W.year, w)[0], win: w };
  }
  return { open: false, name: '1ª janela', rounds: SEASON_DAYS - W.day, win: TRANSFER_WINDOWS[0] };
};

/** Identificador da janela atual (para zerar tentativas quando muda). */
export const windowId = (W: World): number => W.year * 10 + (windowOn(marketDate(W))?.id ?? 0);
