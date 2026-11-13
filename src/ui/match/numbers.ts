import type { Match } from '@/core';
import { assignNumbers } from '../pitch/numbers';

/** Números das camisas dos dois times na partida (titulares pela função, reservas a partir do 12). */
export const shirtNumbers = (m: Match): Map<number, number> => {
  const out = new Map<number, number>();
  for (const s of m.sides) {
    const starters = [...s.on].sort((a, b) => a.slot - b.slot).map((o) => ({ id: o.pl.id, role: o.role }));
    for (const [k, v] of assignNumbers(
      starters,
      s.bench.map((p) => p.id),
    ))
      out.set(k, v);
  }
  return out;
};
