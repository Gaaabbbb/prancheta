import type { Pos } from '../constants/attributes';
import { clamp } from '../math';
import { genAttrs, ovr } from '../player/ratings';
import { gauss, rand, ri } from '../rng';
import type { Club, Player, World } from '../types';

/** Nível técnico esperado do clube (OVR médio alvo), pela divisão e reputação. */
export const clubLevel = (c: Club): number => {
  switch (c.div) {
    case 'A':
      return 70 + (c.rep - 80) * 0.2;
    case 'B':
      return 63 + (c.rep - 60) * 0.22;
    case 'C':
      return 56 + (c.rep - 46) * 0.22;
    default:
      return 48 + (c.rep - 32) * 0.25;
  }
};

export const genAge = (): number => {
  const r = rand();
  if (r < 0.12) return ri(17, 20);
  if (r < 0.75) return ri(21, 29);
  if (r < 0.95) return ri(30, 33);
  return ri(34, 37);
};

export const genPot = (o: number, age: number): number =>
  age <= 19 ? o + ri(6, 20) : age <= 21 ? o + ri(4, 14) : age <= 23 ? o + ri(1, 8) : age <= 26 ? o + ri(0, 3) : o;

export interface MakePlayerExtra {
  /** é da base */ y?: number | boolean;
  nat?: string;
  pt?: number;
  pk?: number;
}

/** Cria um jogador e o adiciona ao mundo. `val` e `sal` devem ser calculados depois. */
export const makePlayer = (
  W: World,
  clubId: number,
  name: string,
  pos: Pos,
  age: number,
  target: number,
  real: boolean,
  ex?: MakePlayerExtra,
): Player => {
  ex = ex || {};
  const pl = {
    id: W.nextPid++,
    n: name,
    c: clubId,
    p: pos,
    a: age,
    at: genAttrs(pos, target),
    pt: 0,
    mo: 70,
    f: 100,
    inj: 0,
    sus: 0,
    yc: 0,
    st: { j: 0, g: 0, as: 0, nt: 0 },
    car: { j: 0, g: 0 },
    ct: W.year + ri(0, 3),
    real: !!real,
    y: ex.y ? 1 : 0,
    nat: ex.nat || 'Brasil',
    pk: ex.y ? (ex.pk != null ? ex.pk : 0.2) : age <= 23 ? 0.5 : 1,
    gx: 0,
    dv: +clamp(Math.exp(gauss() * 0.35), 0.45, 1.8).toFixed(2),
  } as Player;
  pl.pt = ex.pt ? Math.max(ovr(pl) + (ex.y ? 1 : 0), clamp(+ex.pt, 25, 99)) : clamp(genPot(ovr(pl), age), 1, 95);
  pl.sy = ovr(pl);
  W.players.push(pl);
  W.pmap[pl.id] = pl;
  W._sq = null;
  return pl;
};

/** Gera uma sigla de 3 letras que ainda não esteja em uso. */
export const uniqueShort = (name: string, used: Set<string>): string => {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  const cands = [
    base.slice(0, 3),
    base[0] + base.slice(2, 4),
    base[0] + base[1] + base[base.length - 1],
    base.slice(0, 2) + base[3],
  ];
  for (const c of cands)
    if (c && c.length === 3 && !used.has(c)) {
      used.add(c);
      return c;
    }
  for (let i = 0; i < 99; i++) {
    const c = base.slice(0, 2) + String.fromCharCode(65 + (i % 26));
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  return base.slice(0, 3);
};
