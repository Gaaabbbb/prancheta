import { ovr, type Player } from '@/core';

/** Valores em reais, abreviados (R$ 1,2 mi). */
export const money = (v: number): string => {
  const s = v < 0 ? '-' : '';
  v = Math.abs(v);
  if (v >= 1e9) return s + 'R$ ' + (v / 1e9).toFixed(2).replace('.', ',') + ' bi';
  if (v >= 1e6) return s + 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi';
  if (v >= 1e3) return s + 'R$ ' + Math.round(v / 1e3) + ' mil';
  return s + 'R$ ' + Math.round(v);
};

export const int = (v: number): string => v.toLocaleString('pt-BR');

/** Nota média na temporada. */
export const rating = (p: Player): string => (p.st.j ? (p.st.nt / p.st.j).toFixed(2) : '–');

export const isLight = (hex: string): boolean => {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
};

export const colorDist = (a: string, b: string): number => {
  const x = parseInt(a.slice(1), 16),
    y = parseInt(b.slice(1), 16);
  return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255));
};

export const ovrCls = (v: number): string => (v >= 85 ? 'o9' : v >= 77 ? 'o8' : v >= 68 ? 'o7' : v >= 58 ? 'o6' : 'o5');

export const fitColor = (f: number): string => (f > 80 ? 'var(--ok)' : f > 60 ? 'var(--yellow)' : 'var(--red)');

/** Potencial que aparece no jogo: um número só (a estimativa do clube; nunca abaixo do OVR atual). */
export const potTxt = (p: Player): string => String(Math.max(ovr(p), p.pt));

/** Força do elenco (média dos 13 melhores) convertida em 0..5 estrelas. */
export const strVal = (s: number): number => {
  const pts = [
    [40, 0],
    [50, 1],
    [58, 2],
    [66, 3],
    [72, 4],
    [78, 5],
  ];
  if (s <= 40) return 0;
  if (s >= 78) return 5;
  for (let i = 1; i < pts.length; i++)
    if (s <= pts[i][0]) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i];
      return y0 + ((s - x0) / (x1 - x0)) * (y1 - y0);
    }
  return 5;
};
