import {
  autoLineup,
  calcValue,
  calcWage,
  clamp,
  demote,
  dirty,
  fillSquad,
  genAttrs,
  makePlayer,
  normName,
  ovr,
  promote,
  rebuildPmap,
  shiftOvr,
  tidyLineup,
  type Club,
  type Database,
  type Player,
  type Pos,
  type World,
} from '@/core';

export interface ApplyReport {
  clubs: number;
  upd: number;
  add: number;
  mov: number;
  del: number;
  fill: number;
  divs: number;
  unknown: string[];
}

/** Ajusta o OVR do jogador para o alvo mexendo nos atributos. */
export const setOvr = (p: Player, target: number) => {
  for (let k = 0; k < 4 && Math.abs(ovr(p) - target) >= 1; k++) shiftOvr(p, target - ovr(p));
};

/**
 * Atualiza a carreira atual com os dados da planilha: clubes, jogadores (por nome),
 * transferências, saídas e elencos completados. Divisões não mudam no meio da carreira.
 */
export const applyDb = (W: World, db: Database): ApplyReport => {
  const rep: ApplyReport = { clubs: 0, upd: 0, add: 0, mov: 0, del: 0, fill: 0, divs: 0, unknown: [] };
  const bySig: Record<string, Club> = {},
    byName: Record<string, Club> = {};
  W.clubs.forEach((c) => {
    bySig[c.s.toUpperCase()] = c;
    byName[normName(c.n)] = c;
  });
  const sheetToClub: Record<string, Club> = {};
  for (const d of db.clubs) {
    const c = (d.s && bySig[d.s]) || byName[normName(d.n)];
    if (!c) {
      rep.unknown.push(d.n);
      continue;
    }
    sheetToClub[normName(d.n)] = c;
    if (d.s) sheetToClub[d.s] = c;
    c.n = d.n;
    if (d.s) c.s = d.s;
    if (d.uf) c.uf = d.uf;
    if (d.std) c.std = d.std;
    if (d.cap && d.cap > 0) c.cap = d.cap;
    if (d.rep && d.rep > 0) c.rep = clamp(d.rep, 1, 99);
    if (d.c1) c.c1 = d.c1;
    if (d.c2) c.c2 = d.c2;
    if (d.div !== c.div) rep.divs++;
    rep.clubs++;
  }
  const resolve = (name: string) =>
    sheetToClub[normName(name)] ||
    sheetToClub[String(name).toUpperCase()] ||
    byName[normName(name)] ||
    bySig[String(name).toUpperCase()];
  const byPName: Record<string, Player[]> = {};
  W.players.forEach((p) => {
    const k = normName(p.n);
    (byPName[k] = byPName[k] || []).push(p);
  });
  const keep = new Set<number>(),
    touchedP = new Set<number>(),
    touchedY = new Set<number>();
  const rows = [...db.players.map((d) => ({ y: 0, ...d })), ...(db.youth || []).map((d) => ({ y: 1, ...d }))];
  for (const d of rows) {
    const c = resolve(d.club);
    if (!c) {
      if (!rep.unknown.includes(d.club)) rep.unknown.push(d.club);
      continue;
    }
    (d.y ? touchedY : touchedP).add(c.id);
    const cands = (byPName[normName(d.n)] || []).filter((p) => !keep.has(p.id));
    let p = cands.find((x) => x.c === c.id && !!x.y === !!d.y) || cands.find((x) => x.c === c.id);
    if (!p && cands.length === 1) {
      p = cands[0];
      p.c = c.id;
      rep.mov++;
    }
    const pos = d.p as Pos;
    if (p) {
      if (p.p !== pos) {
        p.p = pos;
        p.at = genAttrs(pos, d.o);
      } else setOvr(p, d.o);
      p.a = d.a;
      p.real = d.real;
      if (d.nat) p.nat = d.nat;
      if (d.y && !p.y && p.a <= 21) demote(W, p);
      else if (!d.y && p.y) promote(W, p, true);
      p.pt = d.y && d.pt ? Math.max(ovr(p) + 1, d.pt) : Math.max(p.pt, ovr(p));
      rep.upd++;
    } else {
      p = makePlayer(W, c.id, d.n, pos, d.a, d.o, d.real, { y: d.y, pt: d.pt, nat: d.nat });
      rep.add++;
    }
    keep.add(p.id);
  }
  dirty(W);
  const gone = W.players.filter((p) => (p.y ? touchedY : touchedP).has(p.c) && !keep.has(p.id));
  rep.del = gone.filter((p) => p.real).length;
  const goneFill = gone.filter((p) => !p.real && !p.y).length;
  const goneIds = new Set(gone.map((p) => p.id));
  W.players = W.players.filter((p) => !goneIds.has(p.id));
  rebuildPmap(W);
  dirty(W);
  const touched = new Set([...touchedP, ...touchedY]);
  for (const id of touched) rep.fill += fillSquad(W, W.clubs[id]).length;
  rep.fill = Math.max(0, rep.fill - goneFill);
  for (const p of W.players) {
    p.val = calcValue(p);
    if (p.c >= 0) p.sal = p.y ? 0 : calcWage(p, W.clubs[p.c].div);
  }
  for (const c of W.clubs) {
    if (c.lineup) c.lineup = c.lineup.map((id) => (id != null && W.pmap[id] && W.pmap[id].c === c.id ? id : null));
    if (c.bench) c.bench = c.bench.filter((id) => W.pmap[id] && W.pmap[id].c === c.id);
    if (c.id === W.user) tidyLineup(W, c);
    else if (touched.has(c.id)) autoLineup(W, c);
  }
  return rep;
};
