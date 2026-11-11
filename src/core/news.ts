import type { World } from './types';

const MAX_NEWS = 120;

/** Adiciona uma mensagem à caixa de entrada do usuário. */
export const news = (W: World, t: string, b: string, k?: string): void => {
  W.news.unshift({ y: W.year, d: W.day, t, b, k: k || 'info' });
  if (W.news.length > MAX_NEWS) W.news.length = MAX_NEWS;
};
