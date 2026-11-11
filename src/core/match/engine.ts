/**
 * Motor de partida.
 * Cada "tick" vale ~25 segundos de jogo. A bola percorre zonas 0..3
 * (saída, meio, ataque, área) do ponto de vista de quem tem a posse.
 */
import { A, FAM, type Pos } from '../constants/attributes';
import { FORMATIONS, MENT } from '../constants/formations';
import { clamp } from '../math';
import { ovr, ovrRole } from '../player/ratings';
import { chance, pick, rand, rf, ri, wpick } from '../rng';
import type { Club, Player, SideStats, Tactic, World } from '../types';
import { fmt, NARR } from './narration';

type RoleWeights = { d: number; m: number; a: number; w: number; p: number };

/** Contribuição da função para defesa / meio / ataque / amplitude / pressão */
const ROLE_W: Record<Pos, RoleWeights> = {
  GOL: { d: 0, m: 0, a: 0, w: 0, p: 0 },
  ZAG: { d: 1, m: 0.1, a: 0, w: 0, p: 0.3 },
  LD: { d: 0.6, m: 0.25, a: 0.2, w: 0.7, p: 0.6 },
  LE: { d: 0.6, m: 0.25, a: 0.2, w: 0.7, p: 0.6 },
  VOL: { d: 0.55, m: 0.55, a: 0.05, w: 0, p: 0.8 },
  MC: { d: 0.15, m: 0.85, a: 0.15, w: 0.1, p: 0.8 },
  MEI: { d: 0, m: 0.55, a: 0.5, w: 0.1, p: 0.6 },
  PD: { d: 0.05, m: 0.2, a: 0.75, w: 0.7, p: 0.7 },
  PE: { d: 0.05, m: 0.2, a: 0.75, w: 0.7, p: 0.7 },
  ATA: { d: 0, m: 0.05, a: 1, w: 0, p: 0.6 },
};
type ZoneTable = Record<Pos, number>[];
/** Peso de cada função como protagonista em cada zona (do atacante) */
const ACT_W: ZoneTable = [
  { GOL: 0.5, ZAG: 1, LD: 0.8, LE: 0.8, VOL: 1, MC: 0.5, MEI: 0.2, PD: 0.1, PE: 0.1, ATA: 0.05 },
  { GOL: 0, ZAG: 0.2, LD: 0.6, LE: 0.6, VOL: 1, MC: 1.3, MEI: 0.9, PD: 0.5, PE: 0.5, ATA: 0.2 },
  { GOL: 0, ZAG: 0.05, LD: 0.5, LE: 0.5, VOL: 0.3, MC: 0.7, MEI: 1.2, PD: 1.1, PE: 1.1, ATA: 0.7 },
  { GOL: 0, ZAG: 0.25, LD: 0.3, LE: 0.3, VOL: 0.3, MC: 0.6, MEI: 1.3, PD: 1.6, PE: 1.6, ATA: 3 },
];
/** Defensor protagonista conforme a zona do atacante */
const DEF_W: ZoneTable = [
  { GOL: 0, ZAG: 0.1, LD: 0.2, LE: 0.2, VOL: 0.4, MC: 0.6, MEI: 0.9, PD: 0.9, PE: 0.9, ATA: 1.2 },
  { GOL: 0, ZAG: 0.3, LD: 0.5, LE: 0.5, VOL: 1.3, MC: 1.1, MEI: 0.6, PD: 0.4, PE: 0.4, ATA: 0.2 },
  { GOL: 0, ZAG: 1, LD: 0.9, LE: 0.9, VOL: 1, MC: 0.5, MEI: 0.2, PD: 0.2, PE: 0.2, ATA: 0.05 },
  { GOL: 0, ZAG: 1.4, LD: 0.8, LE: 0.8, VOL: 0.6, MC: 0.2, MEI: 0.05, PD: 0.05, PE: 0.05, ATA: 0.02 },
];
const TICK = 90 / 214;
export const MAX_SUBS = 5;

export interface OnField {
  pl: Player;
  role: Pos;
  slot: number;
}

interface Units {
  def: number;
  mid: number;
  att: number;
  wide: number;
  press: number;
  build: number;
  gk: number;
  pace: number;
  dpace: number;
  n: number;
}

export interface MatchEvent {
  /** minuto */ m: number;
  type: string;
  side: number;
  /** importância 0..3 */ imp: number;
  pid?: number;
  pid2?: number;
  x?: number;
  y?: number;
  txt?: string;
  score?: [number, number];
  aid?: number | null;
  second?: boolean;
}

export interface MatchGoal {
  side: number;
  m: number;
  pid: number;
  aid: number | null;
  pen: boolean;
}

export interface KoContext {
  leg: number;
  /** placar do jogo de ida, do ponto de vista do mandante da volta */
  agg?: [number, number];
  pens?: boolean;
}

export interface MatchOptions {
  quiet?: boolean;
  ko?: KoContext | null;
  userSide?: number;
  hl?: (number | null)[];
  hb?: number[];
  ht?: Tactic;
  al?: (number | null)[];
  ab?: number[];
  at?: Tactic;
}

interface NarrRefs {
  p?: Player;
  d?: Player;
  g?: Player;
  a?: Player;
  o?: Player;
  x?: string;
}

export class Side {
  W: World;
  club: Club;
  idx: number;
  tac: Tactic;
  on: OnField[] = [];
  bench: Player[] = [];
  subs = 0;
  goals = 0;
  pens = 0;
  s: SideStats = { pt: 0, sh: 0, sot: 0, xg: 0, cor: 0, fou: 0, yc: 0, rc: 0, off: 0, sav: 0 };
  /** notas por jogador */ rat: Record<number, number> = {};
  /** amarelos por jogador */ yel: Record<number, number> = {};
  /** motivo da saída: 'red' | 'inj' | 'sub' */ out: Record<number, string> = {};
  played = new Set<number>();
  dirty = true;
  u!: Units;

  constructor(W: World, club: Club, idx: number, lineup: (number | null)[], bench: number[] | null, tac?: Tactic) {
    this.W = W;
    this.club = club;
    this.idx = idx;
    this.tac = Object.assign({}, tac || club.tac);
    const slots = FORMATIONS[this.tac.f];
    lineup.forEach((pid, i) => {
      if (pid && W.pmap[pid]) this.on.push({ pl: W.pmap[pid], role: slots[i][0], slot: i });
    });
    (bench || []).forEach((pid) => {
      if (W.pmap[pid]) this.bench.push(W.pmap[pid]);
    });
    this.on.forEach((o) => {
      this.rat[o.pl.id] = 6.0;
      this.played.add(o.pl.id);
    });
  }

  /** Atributo efetivo (condição, moral e familiaridade com a função). */
  eff(o: OnField, i: number): number {
    const pl = o.pl;
    return pl.at[i] * (0.72 + (0.28 * pl.f) / 100) * (0.94 + pl.mo * 0.0012) * FAM[pl.p + o.role];
  }

  calc(home: boolean): void {
    let d = 0,
      m = 0,
      a = 0,
      w = 0,
      p = 0,
      b = 0,
      gk = 8,
      wv = 0,
      dv = 0,
      cnt = 0;
    for (const o of this.on) {
      const e = (i: number) => this.eff(o, i);
      const rw = ROLE_W[o.role];
      if (o.role === 'GOL') {
        gk = e(A.gol);
        b += 0.3 * (0.6 * e(A.pas) + 0.4 * e(A.gol));
        continue;
      }
      cnt++;
      const ds = 0.3 * e(A.des) + 0.3 * e(A.mar) + 0.12 * e(A.cab) + 0.14 * e(A.vel) + 0.14 * e(A.for);
      const ms = 0.3 * e(A.pas) + 0.25 * e(A.vis) + 0.15 * e(A.res) + 0.1 * e(A.dri) + 0.2 * e(A.des);
      const as = 0.32 * e(A.fin) + 0.22 * e(A.dri) + 0.22 * e(A.vel) + 0.12 * e(A.cab) + 0.12 * e(A.for);
      d += rw.d * ds;
      m += rw.m * ms;
      a += rw.a * as;
      w += rw.w * e(A.cru);
      p += rw.p * (0.4 * e(A.res) + 0.3 * e(A.vel) + 0.3 * e(A.des));
      b += (rw.d + rw.m) * 0.5 * (0.5 * e(A.pas) + 0.3 * e(A.vis) + 0.2 * e(A.dri));
      if (rw.a > 0.4) wv += e(A.vel) * rw.a;
      if (rw.d > 0.5) dv += e(A.vel) * rw.d;
    }
    const t = this.tac,
      men = t.men - 2;
    const hf = home ? 1.055 : 1;
    this.u = {
      def: (d / 4.6) * hf * (1 - men * 0.045) * (1 + (t.lin - 1) * 0.02),
      mid: (m / 3.6) * hf * (1 + men * 0.02),
      att: (a / 3.0) * hf * (1 + men * 0.06),
      wide: w / 2.6,
      press: (p / 6) * (0.85 + t.pres * 0.15) * hf,
      build: (b / 3.4) * hf,
      gk: gk * (home ? 1.02 : 1),
      pace: wv / 2.5,
      dpace: dv / 4,
      n: cnt,
    };
    this.dirty = false;
  }

  actor(zone: number, table?: ZoneTable): OnField {
    const tb = (table || ACT_W)[zone];
    return wpick(this.on, (o) => tb[o.role] * (zone === 3 && !table ? (o.pl.at[A.fin] + 4) / 14 : 1));
  }

  gkOn(): OnField {
    return this.on.find((o) => o.role === 'GOL') || this.on[0];
  }

  /** Ajusta a nota de um jogador. */
  r(pid: number, d: number): void {
    if (this.rat[pid] !== undefined) this.rat[pid] += d;
  }
}

export class Match {
  W: World;
  quiet: boolean;
  ko: KoContext | null;
  sides: [Side, Side];
  userSide: number;
  min = 0;
  half = 1;
  add1: number;
  add2: number;
  /** lado com a posse */ pos: number;
  zone = 1;
  lane = 1;
  counter = 0;
  ended = false;
  events: MatchEvent[] = [];
  goals: MatchGoal[] = [];
  /** momento (positivo = mandante pressionando) */ mom = 0;
  momHist: number[] = [];
  pending: (() => void) | null = null;
  started = false;
  lastTacMin: Record<number, number> = { 0: 0, 1: 0 };
  ballX = 52.5;
  ballY = 34;
  carrier: number | null = null;
  penLog?: [number, string, boolean][];
  private _lastAI?: number;
  private _lastMom?: number;
  private _fp?: number;

  constructor(W: World, home: Club, away: Club, opts?: MatchOptions) {
    opts = opts || {};
    this.W = W;
    this.quiet = !!opts.quiet;
    this.ko = opts.ko || null;
    this.sides = [
      new Side(W, home, 0, opts.hl || home.lineup!, opts.hb || home.bench, opts.ht),
      new Side(W, away, 1, opts.al || away.lineup!, opts.ab || away.bench, opts.at),
    ];
    this.userSide = opts.userSide === undefined ? -1 : opts.userSide;
    this.add1 = ri(0, 3);
    this.add2 = ri(2, 6);
    this.pos = chance(0.5) ? 0 : 1;
  }

  sideName(i: number): string {
    return this.sides[i].club.n;
  }

  emit(type: string, side: number, o: NarrRefs | null, imp?: number, extra?: Partial<MatchEvent>): MatchEvent {
    const e: MatchEvent = Object.assign(
      {
        m: Math.min(Math.floor(this.min) + 1, this.half === 1 ? 45 + this.add1 : 90 + this.add2),
        type,
        side,
        imp: imp || 0,
      },
      extra || {},
    );
    if (o) {
      e.pid = o.p ? o.p.id : undefined;
      e.pid2 = o.d ? o.d.id : undefined;
    }
    this.setBall(side, e);
    if (!this.quiet) {
      const tpl = NARR[type];
      if (tpl) {
        const s = this.sides[side] || this.sides[0];
        e.txt = fmt(pick(tpl), {
          p: o && o.p ? o.p.n : '',
          d: o && o.d ? o.d.n : '',
          g: o && o.g ? o.g.n : '',
          a: o && o.a ? o.a.n : '',
          o: o && o.o ? o.o.n : '',
          t: s.club.n,
          std: this.sides[0].club.std,
          x: (o && o.x) || '',
        });
      }
    }
    this.events.push(e);
    return e;
  }

  setBall(side: number, e: MatchEvent): void {
    const z = this.zone,
      rel = [0.2, 0.42, 0.66, 0.87][z] + rf(-0.06, 0.06);
    const ly = [0.18, 0.5, 0.82][this.lane] + rf(-0.08, 0.08);
    let x = side === 0 ? rel : 1 - rel,
      y = side === 0 ? ly : 1 - ly;
    if (e.type === 'goal') {
      x = side === 0 ? 0.995 : 0.005;
      y = 0.5 + rf(-0.04, 0.04);
    }
    if (e.type === 'kick' || e.type === 'st2' || e.type === 'ht' || e.type === 'ft') {
      x = 0.5;
      y = 0.5;
    }
    if (e.type === 'pen' || e.type === 'penkick') {
      x = side === 0 ? 0.89 : 0.11;
      y = 0.5;
    }
    if (e.type === 'corner') {
      x = side === 0 ? 0.99 : 0.01;
      y = chance(0.5) ? 0.01 : 0.99;
    }
    e.x = x;
    e.y = y;
    this.ballX = x;
    this.ballY = y;
  }

  /** Probabilidade de progredir: força relativa a vs b. */
  prog(a: number, b: number, base: number): number {
    const k = 2.2,
      pa = Math.pow(a, k),
      pb = Math.pow(b, k);
    return clamp((base * 2 * pa) / (pa + pb), 0.04, 0.96);
  }

  /** Avança um tick e devolve os eventos gerados. */
  step(): MatchEvent[] {
    if (this.ended) return [];
    const before = this.events.length;
    if (!this.started) {
      this.started = true;
      this.emit('kick', this.pos, null, 1);
    }
    for (const s of this.sides) if (s.dirty) s.calc(s.idx === 0);
    this.min += TICK;
    // fim de tempo
    if (this.half === 1 && this.min >= 45 + this.add1) {
      this.emit('ht', 0, null, 2);
      this.half = 2;
      this.min = 45;
      this.pos = 1 - this.firstPos();
      this.zone = 1;
      this.lane = 1;
      this.halfTime();
      this.emit('st2', this.pos, null, 1);
      return this.events.slice(before);
    }
    if (this.half === 2 && this.min >= 90 + this.add2) {
      this.finish();
      return this.events.slice(before);
    }
    // IA do banco a cada ~5 min
    if (Math.floor(this.min) % 5 === 0 && Math.floor(this.min) !== this._lastAI) {
      this._lastAI = Math.floor(this.min);
      for (const s of this.sides) if (s.idx !== this.userSide) this.aiManage(s);
    }
    this.fatigue();
    if (this.pending) {
      const fn = this.pending;
      this.pending = null;
      fn();
    } else this.play();
    this.mom = this.mom * 0.9 + (this.pos === 0 ? 1 : -1) * (this.zone >= 2 ? this.zone : 0) * 0.35;
    if (Math.floor(this.min) !== this._lastMom) {
      this._lastMom = Math.floor(this.min);
      this.momHist.push(+this.mom.toFixed(2));
    }
    return this.events.slice(before);
  }

  firstPos(): number {
    return this._fp === undefined ? (this._fp = this.pos) : this._fp;
  }

  play(): void {
    const s = this.sides[this.pos],
      o = this.sides[1 - this.pos];
    s.s.pt++;
    const su = s.u,
      ou = o.u,
      t = s.tac,
      ot = o.tac;
    // falta / lesão
    const foulP = 0.115 * (0.8 + ot.pres * 0.2) * (this.zone >= 2 ? 1.25 : 0.8);
    if (chance(foulP)) return this.foul(s, o);
    if (chance(0.0006 * 2)) return this.injury(chance(0.5) ? s : o);
    switch (this.zone) {
      case 0: {
        if (chance(0.18 - t.temp * 0.05)) {
          if (chance(0.15)) this.emit('prog1', this.pos, { p: s.actor(0).pl });
          return;
        }
        const p = this.prog(su.build, ou.press * (0.9 + ot.pres * 0.1), 0.8 - t.temp * 0.03);
        const a = s.actor(0);
        if (chance(p)) {
          this.zone = 1;
          this.lane = ri(0, 2);
          s.r(a.pl.id, 0.02);
          if (chance(0.25)) this.emit('prog1', this.pos, { p: a.pl });
        } else {
          const d = o.actor(3 - 0, DEF_W);
          s.r(a.pl.id, -0.12);
          o.r(d.pl.id, 0.1);
          this.turn(2);
          this.emit('saida_err', this.pos, { p: a.pl, d: d.pl }, 1);
        }
        return;
      }
      case 1: {
        if (chance(0.24 - t.temp * 0.06)) return;
        const base = 0.55 + (this.counter > 0 ? 0.12 : 0);
        const p = this.prog(su.mid, ou.mid, base);
        const a = s.actor(1);
        if (chance(p)) {
          this.zone = 2;
          this.lane = wpick([0, 1, 2], (l) => (l === 1 ? 1 : 0.9 + su.wide / 20));
          s.r(a.pl.id, 0.03);
          if (chance(0.35)) this.emit('prog2', this.pos, { p: a.pl });
          // contra-ataque direto
          if (this.counter > 0 && chance(0.18 * (su.pace / Math.max(6, ou.dpace)) * (0.8 + ot.lin * 0.25))) {
            this.emit('counter', this.pos, null, 1);
            this.zone = 3;
            this.chance(s, o, 'thru');
          }
        } else {
          const d = o.actor(2, DEF_W);
          s.r(a.pl.id, -0.04);
          o.r(d.pl.id, 0.05);
          if (chance(0.3)) this.emit(chance(0.5) ? 'tack' : 'lose', this.pos, { p: a.pl, d: d.pl });
          this.turn(1, t.men >= 3 || (this.counter === 0 && chance(0.25)));
        }
        if (this.counter > 0) this.counter--;
        return;
      }
      case 2: {
        if (chance(0.045 + (t.men - 2) * 0.008)) {
          const a = s.actor(3);
          this.emit('long', this.pos, { p: a.pl });
          return this.shot(s, o, a, 'long');
        }
        if (chance(0.12 - t.temp * 0.03)) return; // circula
        const p = this.prog(su.att * 0.55 + su.mid * 0.45, ou.def, 0.3);
        const a = s.actor(2);
        if (chance(p)) {
          s.r(a.pl.id, 0.05);
          this.zone = 3;
          return this.chance(s, o, null, a);
        }
        const d = o.actor(1, DEF_W);
        if (chance(0.14 * (0.7 + ot.lin * 0.35))) {
          const f = s.actor(3);
          s.s.off++;
          this.emit('off', this.pos, { p: f.pl }, 0);
          this.turn(0);
          return;
        }
        s.r(a.pl.id, -0.03);
        o.r(d.pl.id, 0.06);
        if (chance(0.16)) {
          s.s.cor++;
          this.emit('corner', this.pos, null, 0);
          this.pending = () => this.corner(s, o);
          return;
        }
        if (chance(0.35)) this.emit('tack', this.pos, { p: a.pl, d: d.pl });
        this.turn(0, t.men >= 3);
        return;
      }
      case 3:
        return this.chance(s, o);
    }
  }

  turn(newZoneForOther: number, counter?: boolean): void {
    this.pos = 1 - this.pos;
    this.zone = newZoneForOther;
    this.lane = ri(0, 2);
    this.counter = counter ? 2 : 0;
  }

  chance(s: Side, o: Side, forced?: string | null, creator?: OnField): void {
    const su = s.u;
    const type =
      forced ||
      wpick(['head', 'thru', 'drib', 'box'], (k) =>
        k === 'head' ? 0.8 + su.wide / 8 : k === 'thru' ? 0.7 : k === 'drib' ? 0.6 : 1.2,
      );
    let shooter: OnField;
    if (type === 'head')
      shooter = wpick(
        s.on,
        (x) =>
          ({ ATA: 3, ZAG: 0.6, PD: 0.8, PE: 0.8, MEI: 0.6, MC: 0.5, VOL: 0.4, LD: 0.2, LE: 0.2, GOL: 0 })[x.role] *
          (x.pl.at[A.cab] + 3),
      );
    else shooter = s.actor(3);
    const cr =
      creator ||
      wpick(
        s.on.filter((x) => x !== shooter),
        (x) =>
          (type === 'head'
            ? x.pl.at[A.cru] * ROLE_W[x.role].w
            : x.pl.at[A.pas] * (ROLE_W[x.role].m + ROLE_W[x.role].a)) + 0.1,
      );
    if (type === 'head') {
      this.lane = chance(0.5) ? 0 : 2;
      this.emit('head', this.pos, { p: shooter.pl, a: cr.pl });
      this.lane = 1;
    } else if (type === 'thru') {
      this.lane = 1;
      this.emit('thru', this.pos, { p: shooter.pl, a: cr.pl });
    } else if (type === 'drib') this.emit('drib', this.pos, { p: shooter.pl });
    return this.shot(s, o, shooter, type, cr);
  }

  shot(s: Side, o: Side, sh: OnField, type: string, cr?: OnField): void {
    const ou = o.u,
      su = s.u,
      pl = sh.pl;
    const base = (
      { head: 0.075, thru: 0.23, drib: 0.11, box: 0.095, long: 0.03, corner: 0.06, fk: 0.05, pen: 0.76 } as Record<
        string,
        number
      >
    )[type];
    const skill =
      type === 'head' || type === 'corner'
        ? s.eff(sh, A.cab)
        : type === 'fk'
          ? (s.eff(sh, A.fin) + s.eff(sh, A.pas)) / 2
          : s.eff(sh, A.fin);
    const press = type === 'pen' ? 1 : clamp(Math.pow((su.att + 1) / (ou.def + 1), 0.4), 0.7, 1.35);
    let xg = 0.97 * base * Math.pow(skill / Math.max(5, ou.gk * 0.9 + 1.3), 0.8) * press;
    xg = clamp(xg, 0.01, 0.92);
    s.s.sh++;
    s.s.xg += xg;
    const gk = o.gkOn();
    if (chance(xg)) {
      s.s.sot++;
      s.goals++;
      const assist = cr && cr.pl.id !== pl.id && type !== 'pen' && type !== 'fk' && chance(0.85) ? cr.pl : null;
      s.r(pl.id, 1.0);
      if (assist) s.r(assist.id, 0.6);
      s.on.forEach((x) => s.r(x.pl.id, 0.1));
      o.on.forEach((x) =>
        o.r(x.pl.id, x.role === 'GOL' ? -0.35 : ['ZAG', 'LD', 'LE'].includes(x.role) ? -0.15 : -0.08),
      );
      this.goals.push({
        side: s.idx,
        m: Math.floor(this.min) + 1,
        pid: pl.id,
        aid: assist ? assist.id : null,
        pen: type === 'pen',
      });
      this.emit('goal', s.idx, { p: pl }, 3, {
        score: [this.sides[0].goals, this.sides[1].goals],
        aid: assist ? assist.id : null,
      });
      this.pos = o.idx;
      this.zone = 1;
      this.lane = 1;
      this.counter = 0;
      this.sides.forEach((x) => (x.dirty = true));
      return;
    }
    const onT = chance(type === 'pen' ? 0.55 : 0.22 + skill / 90);
    if (onT) {
      s.s.sot++;
      o.s.sav++;
      o.r(gk.pl.id, 0.22);
      s.r(pl.id, 0.08);
      this.emit('save', s.idx, { p: pl, g: gk.pl }, 2);
      if (chance(0.3)) {
        s.s.cor++;
        this.emit('corner', s.idx, null, 0);
        this.pending = () => this.corner(s, o);
        return;
      }
      this.turn(0);
    } else {
      s.r(pl.id, -0.05);
      if (chance(0.25) && type !== 'pen') {
        const d = o.actor(0, DEF_W);
        o.r(d.pl.id, 0.08);
        this.emit('shot_blk', s.idx, { p: pl, d: d.pl }, 1);
        if (chance(0.45)) {
          s.s.cor++;
          this.emit('corner', s.idx, null, 0);
          this.pending = () => this.corner(s, o);
          return;
        }
      } else this.emit('shot_off', s.idx, { p: pl }, 1);
      this.turn(0);
    }
  }

  corner(s: Side, o: Side): void {
    this.pos = s.idx;
    this.zone = 3;
    if (chance(0.3)) {
      const h = wpick(
        s.on,
        (x) =>
          ({ ZAG: 2.2, ATA: 2, VOL: 1, MC: 0.6, MEI: 0.4, PD: 0.5, PE: 0.5, LD: 0.4, LE: 0.4, GOL: 0 })[x.role] *
          (x.pl.at[A.cab] + 2),
      );
      this.lane = 1;
      this.emit('cornhead', s.idx, { p: h.pl });
      const taker = wpick(
        s.on.filter((x) => x !== h),
        (x) => x.pl.at[A.cru] + 1,
      );
      return this.shot(s, o, h, 'corner', taker);
    }
    if (chance(0.3)) {
      this.zone = 2;
      return;
    }
    this.turn(0);
  }

  foul(s: Side, o: Side): void {
    const p = s.actor(this.zone),
      d = o.actor(this.zone, DEF_W);
    o.s.fou++;
    o.r(d.pl.id, -0.05);
    if (this.zone === 3 && chance(0.16)) {
      this.emit('pen', s.idx, { p: p.pl, d: d.pl }, 2);
      this.card(o, d, chance(0.35) ? 1 : 0);
      const taker = s.on
        .slice()
        .sort((a, b) => b.pl.at[A.fin] + b.pl.at[A.vis] * 0.3 - (a.pl.at[A.fin] + a.pl.at[A.vis] * 0.3))[0];
      this.pending = () => {
        this.zone = 3;
        this.emit('penkick', s.idx, { p: taker.pl }, 1);
        this.shot(s, o, taker, 'pen');
      };
      return;
    }
    if (chance(0.45) || this.zone >= 2) this.emit('foul', s.idx, { p: p.pl, d: d.pl }, 0);
    const r = rand();
    if (r < 0.003) this.card(o, d, 2);
    else if (r < 0.003 + 0.14 * (0.85 + o.tac.pres * 0.15)) this.card(o, d, 1);
    if (this.zone >= 2 && chance(this.zone === 3 ? 0.5 : 0.22)) {
      const taker = s.on.slice().sort((a, b) => b.pl.at[A.pas] + b.pl.at[A.fin] - (a.pl.at[A.pas] + a.pl.at[A.fin]))[0];
      this.pending = () => {
        this.emit('fk', s.idx, { p: taker.pl }, 1);
        this.shot(s, o, taker, 'fk');
      };
    }
  }

  /** lvl: 1 amarelo, 2 vermelho direto */
  card(side: Side, o: OnField, lvl: number): void {
    if (!lvl) return;
    const pid = o.pl.id;
    if (lvl === 1) {
      side.yel[pid] = (side.yel[pid] || 0) + 1;
      side.s.yc++;
      side.r(pid, -0.3);
      if (side.yel[pid] >= 2) {
        side.s.rc++;
        this.emit('red', side.idx, { d: o.pl }, 2, { second: true });
        this.sendOff(side, o);
      } else this.emit('yel', side.idx, { d: o.pl }, 1);
    } else {
      side.s.rc++;
      side.r(pid, -1.2);
      this.emit('red', side.idx, { d: o.pl }, 2);
      this.sendOff(side, o);
    }
  }

  sendOff(side: Side, o: OnField): void {
    side.out[o.pl.id] = 'red';
    side.r(o.pl.id, -0.6);
    side.on = side.on.filter((x) => x !== o);
    side.dirty = true;
    if (o.role === 'GOL') {
      // improvisa goleiro do banco, se houver substituição
      const gk = side.bench.find((p) => p.p === 'GOL');
      if (gk && side.subs < MAX_SUBS) {
        const victim = side.on.filter((x) => x.role !== 'GOL').sort((a, b) => ovr(a.pl) - ovr(b.pl))[0];
        if (victim) this.doSub(side, victim.pl, gk, 'GOL');
      } else if (side.on.length) {
        const v = side.on.sort((a, b) => a.pl.at[A.gol] - b.pl.at[A.gol]).pop()!;
        side.on.push(v);
        v.role = 'GOL';
      }
    }
  }

  injury(side: Side): void {
    const cand = side.on.filter((x) => !side.out[x.pl.id]);
    if (!cand.length) return;
    const o = pick(cand);
    o.pl._injNow = true;
    side.out[o.pl.id] = 'inj';
    this.emit('inj', side.idx, { p: o.pl }, 2);
    // substitui automaticamente (também para o usuário — avisado na narração)
    const rep = this.bestSub(side, o.role);
    if (rep && side.subs < MAX_SUBS) this.doSub(side, o.pl, rep, o.role);
    else {
      o.pl.f = Math.min(o.pl.f, 35);
      side.dirty = true;
    }
  }

  bestSub(side: Side, role: Pos): Player | null {
    const c = side.bench.filter((p) => !side.played.has(p.id));
    let best: Player | null = null,
      bs = -1;
    for (const p of c) {
      const s = ovrRole(p, role);
      if (s > bs) {
        bs = s;
        best = p;
      }
    }
    return best;
  }

  doSub(side: Side, outPl: Player, inPl: Player, role?: Pos): boolean {
    const idx = side.on.findIndex((x) => x.pl.id === outPl.id);
    if (idx < 0 || side.subs >= MAX_SUBS || side.played.has(inPl.id)) return false;
    const r = role || side.on[idx].role;
    side.on[idx] = { pl: inPl, role: r, slot: side.on[idx].slot };
    side.bench = side.bench.filter((p) => p.id !== inPl.id);
    side.subs++;
    side.played.add(inPl.id);
    side.rat[inPl.id] = 6.0;
    side.dirty = true;
    if (!side.out[outPl.id]) side.out[outPl.id] = 'sub';
    this.emit('sub', side.idx, { p: inPl, o: outPl }, 1);
    return true;
  }

  setTactic(sideIdx: number, tac: Partial<Tactic>): void {
    const side = this.sides[sideIdx];
    const oldF = side.tac.f;
    Object.assign(side.tac, tac);
    if (tac.f && tac.f !== oldF) {
      // reatribui funções pela nova formação
      const slots = FORMATIONS[tac.f];
      side.on.forEach((o) => {
        if (o.slot < 11) o.role = slots[o.slot][0];
      });
    }
    side.dirty = true;
  }

  aiManage(side: Side): void {
    const opp = this.sides[1 - side.idx];
    const diff = side.goals - opp.goals,
      m = this.min;
    const base = side.club.tac.men;
    let men = base;
    if (m > 60 && diff < 0) men = Math.min(4, base + 1);
    if (m > 78 && diff < 0) men = Math.min(4, base + 2);
    if (m > 75 && diff > 0) men = Math.max(0, base - 1);
    if (men !== side.tac.men) {
      side.tac.men = men;
      side.dirty = true;
      if (!this.quiet && m > 55) this.emit('tac', side.idx, { x: MENT[men].toLowerCase() }, 0);
    }
    if (m < 55 || side.subs >= MAX_SUBS) return;
    // cansaço ou amarelado
    const tired = side.on
      .filter((x) => x.role !== 'GOL' && (x.pl.f < 62 || (side.yel[x.pl.id] && m > 60)))
      .sort((a, b) => a.pl.f - b.pl.f);
    const maxNow = m < 65 ? 2 : 3;
    let done = 0;
    for (const o of tired) {
      if (done >= maxNow || side.subs >= MAX_SUBS) break;
      const role = o.role;
      const rep = this.bestSub(side, role);
      if (
        rep &&
        ovrRole(rep, role) * (0.75 + (0.25 * rep.f) / 100) > ovrRole(o.pl, role) * (0.75 + (0.25 * o.pl.f) / 100) - 4
      ) {
        this.doSub(side, o.pl, rep, role);
        done++;
      }
    }
  }

  fatigue(): void {
    for (const s of this.sides) {
      const pf = 1 + s.tac.pres * 0.15 + (s.tac.temp - 1) * 0.05;
      for (const o of s.on) {
        const res = o.pl.at[A.res];
        o.pl.f = Math.max(10, o.pl.f - 0.105 * (1.35 - (res / 20) * 0.7) * pf * (o.role === 'GOL' ? 0.3 : 1));
      }
      if (Math.floor(this.min) % 10 === 0) s.dirty = true;
    }
  }

  halfTime(): void {
    for (const s of this.sides) {
      for (const o of s.on) o.pl.f = Math.min(100, o.pl.f + 3);
      s.dirty = true;
    }
  }

  finish(): void {
    // pênaltis em mata-mata
    const [h, a] = this.sides;
    if (this.ko) {
      const aggH = h.goals + (this.ko.agg ? this.ko.agg[0] : 0),
        aggA = a.goals + (this.ko.agg ? this.ko.agg[1] : 0);
      if (aggH === aggA && this.ko.pens) this.shootout();
    }
    this.ended = true;
    this.emit('ft', 0, null, 3);
  }

  shootout(): void {
    const [h, a] = this.sides;
    const takers = (s: Side) =>
      s.on.slice().sort((x, y) => y.pl.at[A.fin] + y.pl.at[A.vis] * 0.5 - (x.pl.at[A.fin] + x.pl.at[A.vis] * 0.5));
    const th = takers(h),
      ta = takers(a);
    let gh = 0,
      ga = 0,
      kh = 0,
      ka = 0;
    const kick = (s: Side, o: Side, t: OnField) => {
      const p = 0.76 * Math.pow(s.eff(t, A.fin) / 13, 0.3) * Math.pow(12 / Math.max(6, o.u.gk), 0.2);
      return chance(clamp(p, 0.55, 0.9));
    };
    const decided = () => (kh <= 5 && ka <= 5 ? gh + (5 - kh) < ga || ga + (5 - ka) < gh : kh === ka && gh !== ga);
    const log: [number, string, boolean][] = [];
    while (kh < 40) {
      const t1 = th[kh % th.length];
      const s1 = kick(h, a, t1);
      kh++;
      if (s1) gh++;
      log.push([0, t1.pl.n, s1]);
      if (decided()) break;
      const t2 = ta[ka % ta.length];
      const s2 = kick(a, h, t2);
      ka++;
      if (s2) ga++;
      log.push([1, t2.pl.n, s2]);
      if (decided()) break;
    }
    if (gh === ga) gh++;
    h.pens = gh;
    a.pens = ga;
    this.penLog = log;
    if (!this.quiet)
      this.events.push({
        m: 90 + this.add2,
        type: 'pens',
        side: gh > ga ? 0 : 1,
        imp: 3,
        x: 0.5,
        y: 0.5,
        txt:
          'Pênaltis: ' +
          h.club.n +
          ' ' +
          gh +
          ' x ' +
          ga +
          ' ' +
          a.club.n +
          '. ' +
          log.map((l) => l[1] + (l[2] ? ' ✔' : ' ✘')).join(', '),
      });
  }

  runToEnd(): this {
    let g = 0;
    while (!this.ended && g++ < 2000) this.step();
    return this;
  }

  result() {
    const [h, a] = this.sides;
    return { hg: h.goals, ag: a.goals, hp: h.pens, ap: a.pens, pens: !!this.penLog };
  }
}
