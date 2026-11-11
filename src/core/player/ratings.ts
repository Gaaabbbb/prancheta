import { FAM, POS_W, POS_WSUM, type Pos } from '../constants/attributes';
import { clamp } from '../math';
import { chance, gauss, ri } from '../rng';
import type { Player } from '../types';

/** OVR (nota geral) de um conjunto de atributos numa posição. */
export const ovrAt = (at: number[], pos: Pos): number => {
  const w = POS_W[pos];
  let s = 0;
  for (let i = 0; i < 12; i++) s += w[i] * at[i];
  return Math.round((s / POS_WSUM[pos]) * 4.4 + 10);
};

export const ovr = (pl: Player): number => ovrAt(pl.at, pl.p);

/** OVR do jogador atuando em outra função (penalizado pela familiaridade). */
export const ovrRole = (pl: Player, role: Pos): number => Math.round(ovrAt(pl.at, role) * FAM[pl.p + role]);

/** Gera atributos que resultem aproximadamente no OVR alvo. */
export const genAttrs = (pos: Pos, target: number): number[] => {
  const w = POS_W[pos];
  const tw = (target - 10) / 4.4;
  const at = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    let v: number;
    if (i === 11 && pos !== 'GOL') v = ri(1, 4);
    else if (pos === 'GOL' && i !== 11) v = i === 2 || i === 10 ? tw * 0.75 + gauss() * 1.5 : tw * 0.45 + gauss() * 1.5;
    else if (w[i] > 0) v = tw + gauss() * 1.4;
    else v = tw * 0.72 + gauss() * 2;
    at[i] = v;
  }
  for (let k = 0; k < 3; k++) {
    const cur = ovrAt(
      at.map((x) => clamp(Math.round(x), 1, 20)),
      pos,
    );
    const d = (target - cur) / 4.4;
    if (Math.abs(target - cur) < 1) break;
    for (let i = 0; i < 12; i++) if (w[i] > 0) at[i] += d;
  }
  return at.map((x) => clamp(Math.round(x), 1, 20));
};

/** Sobe/desce o OVR em aproximadamente `d` pontos, mexendo nos atributos relevantes. */
export const shiftOvr = (pl: Player, d: number): void => {
  if (!d) return;
  const w = POS_W[pl.p];
  const step = d / 4.4;
  for (let i = 0; i < 12; i++) {
    if (w[i] > 0 || chance(0.35)) {
      let delta = step * (w[i] > 0 ? 1 : 0.6) + gauss() * 0.4;
      if (d < 0 && (i === 8 || i === 9) && pl.a >= 30) delta *= 1.6;
      pl.at[i] = clamp(Math.round(pl.at[i] + delta), 1, 20);
    }
  }
};

export const available = (pl: Player): boolean => pl.inj <= 0 && pl.sus <= 0;
