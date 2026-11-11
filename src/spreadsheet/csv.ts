import {
  autoLineup,
  calcValue,
  calcWage,
  clamp,
  fillSquad,
  makePlayer,
  ovr,
  POS,
  rebuildPmap,
  dirty,
  squad,
  type Club,
  type Pos,
  type World,
} from '@/core';

export const findClub = (W: World, s: string): Club | undefined => {
  s = s.trim().toLowerCase();
  return (
    W.clubs.find((c) => c.n.toLowerCase() === s) ||
    W.clubs.find((c) => c.s.toLowerCase() === s) ||
    W.clubs.find((c) => c.n.toLowerCase().startsWith(s))
  );
};

/**
 * Importa jogadores colados como CSV: Clube;Nome;Posição;Idade;OVR (uma linha por jogador).
 * `replace` substitui os elencos profissionais dos clubes citados.
 */
export const importCsv = (W: World, text: string, replace: boolean): { ok: number; errs: string[] } => {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const touched = new Set<number>();
  const errs: string[] = [];
  const parsed: { c: Club; nm: string; pos: Pos; age: number; ovr: number }[] = [];
  lines.forEach((l, i) => {
    const parts = l.split(/[;\t]/).map((x) => x.trim());
    if (parts.length < 5) return void errs.push('linha ' + (i + 1));
    const [cn, nm, pos, age, o] = parts;
    const c = findClub(W, cn);
    const P2 = pos.toUpperCase();
    if (!c || !(POS as readonly string[]).includes(P2) || !nm) return void errs.push('linha ' + (i + 1));
    parsed.push({ c, nm, pos: P2 as Pos, age: clamp(+age || 25, 15, 45), ovr: clamp(+o || 60, 25, 99) });
    touched.add(c.id);
  });
  if (replace) {
    W.players = W.players.filter((p) => !touched.has(p.c) || p.y);
    rebuildPmap(W);
    dirty(W);
  }
  let ok = 0;
  for (const r of parsed) {
    const pl = makePlayer(W, r.c.id, r.nm, r.pos, r.age, r.ovr, true);
    pl.val = calcValue(pl);
    pl.sal = calcWage(pl, r.c.div);
    ok++;
  }
  for (const id of touched) {
    const c = W.clubs[id];
    fillSquad(W, c);
    c.lineup = null;
    autoLineup(W, c);
  }
  return { ok, errs };
};

export const exportCsv = (W: World, c: Club): string =>
  squad(W, c.id)
    .map((p) => [c.n, p.n, p.p, p.a, ovr(p)].join(';'))
    .join('\n');
