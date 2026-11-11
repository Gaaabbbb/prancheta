/**
 * Gerador de números aleatórios determinístico (mulberry32).
 * O estado é global de propósito: ele é salvo junto com o jogo e
 * garante que a mesma seed produza o mesmo mundo e os mesmos resultados.
 */
export const rngState = { s: 20260128 };

export const seed = (s: number): void => {
  rngState.s = s >>> 0 || 1;
};

export const rand = (): number => {
  let t = (rngState.s = (rngState.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Inteiro entre a e b (inclusive). */
export const ri = (a: number, b: number): number => a + Math.floor(rand() * (b - a + 1));
/** Real entre a e b. */
export const rf = (a: number, b: number): number => a + rand() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
export const chance = (p: number): boolean => rand() < p;

export const gauss = (): number => {
  let u = 0,
    v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Escolha ponderada: wf devolve o peso de cada item. */
export const wpick = <T>(arr: readonly T[], wf: (x: T) => number): T => {
  let tot = 0;
  const ws = arr.map((x) => {
    const w = Math.max(0, wf(x));
    tot += w;
    return w;
  });
  if (tot <= 0) return arr[Math.floor(rand() * arr.length)];
  let r = rand() * tot;
  for (let i = 0; i < arr.length; i++) {
    r -= ws[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

export const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const hash = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
