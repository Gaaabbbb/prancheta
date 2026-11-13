import type { Pos } from '@/core';

/** Proporção largura/altura do campo: um pouco mais largo que o real, porque só um time aparece. */
export const PITCH_RATIO = 0.8;

/** Largura máxima do cartão da ficha (px). */
const CARD_MAX = 96;

/**
 * Linhas da formação, do goleiro ao ataque: profundidades próximas (até 0,09) viram a mesma linha, e as linhas são
 * espalhadas por igual no campo inteiro (0 = goleiro, 1 = ataque).
 */
export const lineDepths = (xs: number[]): Map<number, number> => {
  const sorted = [...new Set(xs)].sort((a, b) => a - b);
  const lines: number[][] = [];
  for (const x of sorted) {
    const cur = lines[lines.length - 1];
    if (cur && x - cur[0] <= 0.09) cur.push(x);
    else lines.push([x]);
  }
  const out = new Map<number, number>();
  const n = lines.length;
  lines.forEach((l, i) => l.forEach((x) => out.set(x, n > 1 ? i / (n - 1) : 0)));
  return out;
};

/**
 * Afasta as posições (em %, já ordenadas) até ficarem a pelo menos `gap` uma da outra, dentro de [lo, hi].
 * Se não couber, espalha por igual e devolve quanto o cartão precisa encolher.
 */
const fitLine = (xs: number[], gap: number, lo = 7, hi = 93): { xs: number[]; scale: number } => {
  const n = xs.length;
  if (n < 2) return { xs, scale: 1 };
  if (gap * (n - 1) > hi - lo) {
    const step = (hi - lo) / (n - 1);
    return { xs: xs.map((_, i) => lo + i * step), scale: step / gap };
  }
  const out = [...xs];
  for (let it = 0; it < 30; it++) {
    let moved = false;
    for (let i = 1; i < n; i++) {
      const d = out[i] - out[i - 1];
      if (d < gap - 0.01) {
        const push = (gap - d) / 2;
        out[i - 1] -= push;
        out[i] += push;
        moved = true;
      }
    }
    if (out[0] < lo) {
      const s = lo - out[0];
      for (let i = 0; i < n; i++) out[i] += s;
    }
    if (out[n - 1] > hi) {
      const s = out[n - 1] - hi;
      for (let i = 0; i < n; i++) out[i] -= s;
    }
    if (!moved) break;
  }
  return { xs: out, scale: 1 };
};

export interface Placed {
  top: number;
  left: number;
  /** largura do cartão (px) */
  w: number;
}

/** Tamanho da camisa (px) para a largura do campo. */
export const shirtSize = (pitchW: number): number => Math.round(Math.min(46, Math.max(28, pitchW * 0.095)));

/**
 * Posição de cada vaga da formação no campo (goleiro embaixo), sem cartões encostados: jogadores da mesma linha são
 * afastados até os cartões caberem lado a lado; se não couber, os cartões dessa linha encolhem.
 */
export const placeFormation = (slots: [Pos, number, number][], pitchW: number): Placed[] => {
  const tk = shirtSize(pitchW);
  const cw = Math.min(CARD_MAX, tk * 1.95);
  const gap = pitchW > 0 ? ((cw + 6) / pitchW) * 100 : 20;
  const depth = lineDepths(slots.map((s) => s[1]));
  const out: Placed[] = slots.map(() => ({ top: 0, left: 0, w: cw }));
  const groups = new Map<number, number[]>();
  slots.forEach((s, i) => {
    const d = depth.get(s[1]) ?? 0.5;
    const g = groups.get(d) || [];
    g.push(i);
    groups.set(d, g);
  });
  for (const [d, idx] of groups) {
    idx.sort((a, b) => slots[a][2] - slots[b][2]);
    const { xs, scale } = fitLine(
      idx.map((i) => 10 + slots[i][2] * 80),
      gap,
    );
    idx.forEach((i, k) => {
      out[i] = { top: 88 - d * 74, left: xs[k], w: Math.max(56, cw * Math.min(1, scale)) };
    });
  }
  return out;
};
