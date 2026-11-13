import type { Match } from '@/core';
import { colorDist } from '../format';

export interface TeamColors {
  /** cor principal (camisa) */ f: string;
  /** cor do detalhe (número e borda) */ s: string;
}

/** Cores dos dois times na partida: se as camisas forem parecidas, o visitante usa a segunda cor (ou amarelo). */
export const teamColors = (m: Match): [TeamColors, TeamColors] => {
  const [h, a] = m.sides.map((s) => s.club);
  const col: [TeamColors, TeamColors] = [
    { f: h.c1, s: h.c2 },
    { f: a.c1, s: a.c2 },
  ];
  if (colorDist(h.c1, a.c1) < 90) {
    col[1] = { f: a.c2, s: a.c1 };
    if (colorDist(h.c1, a.c2) < 90) col[1] = { f: '#FFD23F', s: '#1a1400' };
  }
  // detalhe muito parecido com a camisa: usa preto ou branco para dar leitura
  for (const c of col) if (colorDist(c.f, c.s) < 80) c.s = colorDist(c.f, '#ffffff') < 200 ? '#0b0f18' : '#ffffff';
  return col;
};

/** Cor do fôlego: verde, amarelo (cansando) ou vermelho (esgotado). */
export const fitCol = (f: number): string => (f > 70 ? 'var(--ok)' : f > 50 ? 'var(--yellow)' : 'var(--red)');
