import type { NewsItem, NewsRef, World } from './types';

const MAX_NEWS = 120;

/** Adiciona uma mensagem à caixa de entrada do usuário. `ref` liga a mensagem a um jogador ou partida. */
export const news = (W: World, t: string, b: string, k?: string, ref?: NewsRef): void => {
  const it: NewsItem = { y: W.year, d: W.day, t, b, k: k || 'info' };
  if (ref) it.ref = ref;
  W.news.unshift(it);
  if (W.news.length > MAX_NEWS) W.news.length = MAX_NEWS;
};

/** Marca a mensagem como lida. */
export const readNews = (it: NewsItem): void => {
  it.rd = 1;
};

/** Registra a ação tomada a partir da mensagem (também marca como lida). */
export const actOnNews = (it: NewsItem, label: string): void => {
  it.rd = 1;
  it.ac = label;
};

export const unreadNews = (W: World): number => W.news.reduce((n, it) => n + (it.rd ? 0 : 1), 0);
