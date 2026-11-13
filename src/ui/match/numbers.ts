import type { Match, Pos } from '@/core';

/** Números clássicos por função (o primeiro livre de cada lista). */
const CLASSIC: Record<Pos, number[]> = {
  GOL: [1],
  LD: [2],
  ZAG: [3, 4, 14],
  LE: [6],
  VOL: [5, 8, 15],
  MC: [8, 16, 18],
  MEI: [10, 20],
  PD: [7],
  PE: [11],
  ATA: [9, 19, 21],
};

/**
 * Números das camisas na partida: titulares recebem o número clássico da função (1 no gol, 9 no centroavante…);
 * quem não encontrar número livre e os reservas pegam os próximos livres a partir do 12.
 */
export const shirtNumbers = (m: Match): Map<number, number> => {
  const out = new Map<number, number>();
  for (const s of m.sides) {
    const used = new Set<number>();
    const next = () => {
      let n = 12;
      while (used.has(n)) n++;
      used.add(n);
      return n;
    };
    const late: number[] = [];
    for (const o of [...s.on].sort((a, b) => a.slot - b.slot)) {
      const n = CLASSIC[o.role].find((x) => !used.has(x));
      if (n == null) late.push(o.pl.id);
      else {
        used.add(n);
        out.set(o.pl.id, n);
      }
    }
    for (const id of late) out.set(id, next());
    for (const p of s.bench) out.set(p.id, next());
  }
  return out;
};

/** Sobrenome (ou o nome curto) para caber no cartão da ficha. */
export const shortName = (n: string): string => {
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  return parts.length > 1 && last.length <= 3 ? parts.slice(-2).join(' ') : last;
};
