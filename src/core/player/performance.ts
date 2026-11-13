import { clamp } from '../math';
import { RULES } from '../rules';
import type { Player } from '../types';

/** Nota média na temporada (null antes de 3 jogos). */
export const avgRating = (p: Player): number | null => (p.st.j >= 3 ? p.st.nt / p.st.j : null);

/** Efeito da fase (nota média): cada ponto acima ou abaixo de 6,5 vale `formImpact` (no máximo 2 pontos). */
export const formFactor = (p: Player): number => {
  const r = avgRating(p);
  if (!RULES.formImpact || r == null) return 1;
  return 1 + RULES.formImpact * clamp(r - 6.5, -2, 2);
};
