import { seasonProgress } from '../season/calendar';
import { clamp } from '../math';
import type { Player, World } from '../types';
import { youthYearly } from '../youth/youth';
import { ovr } from './ratings';

/** Faixa de variação do OVR na virada de temporada para quem tem mais de 21 anos (idade já virada). */
export const ageEvoRange = (age: number): [number, number] =>
  age <= 24 ? [0, 3] : age <= 28 ? [-1, 2] : age <= 31 ? [-2, 1] : age <= 33 ? [-4, 0] : [-6, -1];

/** Bônus de evolução de quem tem até 24 anos e jogou mais de 20 partidas na temporada. */
export const seasonPlayBonus = (p: Player): number => (p.st.j > 20 && p.a <= 24 ? 1 : 0);

export type EvoOutlook =
  /** até 21 anos: evolui durante a temporada; `progress` é quanto já andou para o próximo ponto */
  | { kind: 'young'; progress: number; perYear: number; days: number | null }
  /** até 21 anos, mas já no potencial */
  | { kind: 'ceiling'; progress: 1 }
  /** mais de 21: muda só na virada; `progress` é quanto da temporada já passou */
  | { kind: 'season'; progress: number; lo: number; hi: number; bonus: boolean };

/** Como o jogador está em relação à próxima mudança de OVR. Só lê o estado; não sorteia nada. */
export const evoOutlook = (W: World, p: Player): EvoOutlook => {
  if (p.a <= 21) {
    const perYear = youthYearly(W, p);
    if (perYear <= 0) return { kind: 'ceiling', progress: 1 };
    const progress = clamp(p.gx || 0, 0, 1);
    // `days`: dias (calendário por dias) ou rodadas até o próximo ponto
    const perTick = perYear / (W.cal === 'days' ? 365 : 40);
    return { kind: 'young', progress, perYear, days: perTick > 0 ? Math.ceil((1 - progress) / perTick) : null };
  }
  const o = ovr(p);
  const age = p.a + 1;
  const [lo0, hi0] = ageEvoRange(age);
  const pen = age <= 24 && o >= 78 ? 1 : 0;
  const room = Math.max(0, p.pt - o);
  const cap = (d: number) => (d > 0 ? Math.min(d, room) : d);
  const bonus = p.st.j > 20 && age <= 24;
  return {
    kind: 'season',
    progress: seasonProgress(W),
    lo: cap(lo0 - pen) + (bonus ? 1 : 0),
    hi: cap(hi0 - pen) + (bonus ? 1 : 0),
    bonus,
  };
};
