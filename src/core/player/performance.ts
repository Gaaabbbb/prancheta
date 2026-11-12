import type { Pos } from '../constants/attributes';
import { clamp } from '../math';
import { RULES } from '../rules';
import type { Player } from '../types';
import { ovrRole } from './ratings';

/** Nota média na temporada (null antes de 3 jogos). */
export const avgRating = (p: Player): number | null => (p.st.j >= 3 ? p.st.nt / p.st.j : null);

/** Efeito da condição física no rendimento (1 = 100% de condição). */
export const fitFactor = (p: Player): number =>
  (RULES.fitBase + (RULES.fitImpact * p.f) / 100) / (RULES.fitBase + RULES.fitImpact);

/** Efeito da moral (0,94 a 1,06; moral 50 = 1). */
export const moraleFactor = (p: Player): number => 0.94 + p.mo * 0.0012;

/** Efeito da fase (nota média): cada ponto acima ou abaixo de 6,5 vale `formImpact` (no máximo 2 pontos). */
export const formFactor = (p: Player): number => {
  const r = avgRating(p);
  if (!RULES.formImpact || r == null) return 1;
  return 1 + RULES.formImpact * clamp(r - 6.5, -2, 2);
};

/**
 * Desempenho previsto: o OVR na função ajustado por condição, moral e fase.
 * O OVR é a base; a condição pesa mais, a moral e a nota pesam menos.
 */
export const perfRating = (p: Player, role: Pos = p.p): number =>
  Math.round(ovrRole(p, role) * fitFactor(p) * moraleFactor(p) * formFactor(p));
