import { teamStrength, type Club, type World } from '@/core';

/** Ordena clubes por força (padrão) ou nome; devolve a força calculada de cada um. */
export const sortClubs = (W: World, list: Club[], mode: 'str' | 'az'): Record<number, number> => {
  const st: Record<number, number> = {};
  list.forEach((c) => (st[c.id] = teamStrength(W, c)));
  list.sort((a, b) =>
    mode === 'az' ? a.n.localeCompare(b.n, 'pt-BR') : st[b.id] - st[a.id] || a.n.localeCompare(b.n, 'pt-BR'),
  );
  return st;
};
