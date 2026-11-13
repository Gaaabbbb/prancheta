import type { Pos } from '@/core';

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
 * Números das camisas: titulares (na ordem das vagas) recebem o número clássico da função (1 no gol, 9 no
 * centroavante…); quem não encontrar número livre e os reservas pegam os próximos livres a partir do 12.
 */
export const assignNumbers = (starters: { id: number; role: Pos }[], bench: number[]): Map<number, number> => {
  const out = new Map<number, number>();
  const used = new Set<number>();
  const next = () => {
    let n = 12;
    while (used.has(n)) n++;
    used.add(n);
    return n;
  };
  const late: number[] = [];
  for (const s of starters) {
    const n = CLASSIC[s.role].find((x) => !used.has(x));
    if (n == null) late.push(s.id);
    else {
      used.add(n);
      out.set(s.id, n);
    }
  }
  for (const id of late) out.set(id, next());
  for (const id of bench) if (!out.has(id)) out.set(id, next());
  return out;
};

/** Sobrenome (ou o nome curto) para caber no cartão da ficha. */
export const shortName = (n: string): string => {
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  return parts.length > 1 && last.length <= 3 ? parts.slice(-2).join(' ') : last;
};
