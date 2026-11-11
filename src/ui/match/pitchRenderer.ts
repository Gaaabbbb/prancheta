/**
 * Desenho do campo da partida ao vivo em <canvas>.
 * Fica fora do React: o componente LiveMatch só repassa eventos e chama animate/draw a cada quadro.
 */
import { clamp, FORMATIONS, type Match, type MatchEvent, type OnField, type Side, type World } from '@/core';
import { isLight } from '../format';

export interface TeamColors {
  /** cor principal */ f: string;
  /** cor da borda */ s: string;
}

interface Pt {
  x: number;
  y: number;
}

export class PitchRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private cw = 0;
  private ch = 0;
  private dpr = 1;
  private pos: Record<number, Pt> = {};
  private ball = { x: 0.5, y: 0.5, fx: 0.5, fy: 0.5, tx: 0.5, ty: 0.5, t: 1, dur: 300 };
  carrier: number | null = null;
  goalFlash = 0;
  paused = false;

  constructor(
    private W: World,
    private m: Match,
    private canvas: HTMLCanvasElement,
    private wrap: HTMLElement,
    private momCanvas: HTMLCanvasElement,
    readonly colors: [TeamColors, TeamColors],
  ) {
    this.resize();
    for (const s of m.sides)
      for (const o of s.on) {
        const [x, y] = this.slotXY(s, o);
        this.pos[o.pl.id] = { x: x * 0.85 + 0.075, y };
      }
  }

  /** Escolhe cores que não se confundam entre os dois times. */
  static pickColors(m: Match, colorDist: (a: string, b: string) => number): [TeamColors, TeamColors] {
    const [h, a] = m.sides.map((s) => s.club);
    const col: [TeamColors, TeamColors] = [
      { f: h.c1, s: h.c2 },
      { f: a.c1, s: a.c2 },
    ];
    if (colorDist(h.c1, a.c1) < 90) {
      col[1] = { f: a.c2, s: a.c1 };
      if (colorDist(h.c1, a.c2) < 90) col[1] = { f: '#FFD23F', s: '#1a1400' };
    }
    return col;
  }

  resize(): void {
    const W0 = this.wrap.clientWidth,
      H0 = this.wrap.clientHeight;
    let w = W0,
      h = (w * 68) / 105;
    if (h > H0) {
      h = H0;
      w = (h * 105) / 68;
    }
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.cw = w;
    this.ch = h;
    this.dpr = dpr;
    this.ctx = this.canvas.getContext('2d');
    const mc = this.momCanvas;
    mc.width = mc.clientWidth * dpr;
    mc.height = 34 * dpr;
    this.drawMom();
  }

  private slotXY(side: Side, o: OnField): [number, number] {
    const f = FORMATIONS[side.tac.f];
    const s = f[o.slot] || f[1];
    return side.idx === 0 ? [s[1], s[2]] : [1 - s[1], 1 - s[2]];
  }

  /** Repassa eventos do motor: bola, portador, flash de gol. */
  onEvents(evs: MatchEvent[], tickMs: number): void {
    const b = this.ball;
    for (const e of evs) {
      if (e.x !== undefined && e.y !== undefined) {
        b.fx = b.x;
        b.fy = b.y;
        b.tx = e.x;
        b.ty = e.y;
        b.t = 0;
        b.dur = Math.max(120, tickMs * 0.85);
      }
      if (e.pid) this.carrier = e.pid;
      if (e.type === 'goal') this.goalFlash = 1;
    }
  }

  /** Move bola e jogadores em direção aos alvos. */
  animate(dt: number, tickMs: number): void {
    const m = this.m,
      b = this.ball;
    if (b.t < 1) {
      b.t = Math.min(1, b.t + dt / (b.dur || 300));
      const e = b.t < 0.5 ? 2 * b.t * b.t : 1 - Math.pow(-2 * b.t + 2, 2) / 2;
      b.x = b.fx + (b.tx - b.fx) * e;
      b.y = b.fy + (b.ty - b.fy) * e;
    }
    const bx = b.tx,
      by = b.ty;
    const k = Math.min(1, (dt / 1000) * 2.4 * Math.max(1, 320 / tickMs) ** 0.5);
    for (const s of m.sides) {
      const dir = s.idx === 0 ? 1 : -1;
      const poss = m.pos === s.idx;
      // defensor mais próximo da bola pressiona
      let near: number | null = null,
        nd = 9;
      if (!poss)
        for (const o of s.on) {
          if (o.role === 'GOL') continue;
          const p = this.pos[o.pl.id];
          if (!p) continue;
          const d = Math.hypot(p.x - bx, (p.y - by) * 0.65);
          if (d < nd) {
            nd = d;
            near = o.pl.id;
          }
        }
      for (const o of s.on) {
        let p = this.pos[o.pl.id];
        if (!p) {
          const [x, y] = this.slotXY(s, o);
          p = this.pos[o.pl.id] = { x, y };
        }
        const [ax, ay] = this.slotXY(s, o);
        let tx: number, ty: number;
        if (o.role === 'GOL') {
          tx = (s.idx === 0 ? 0.03 : 0.97) + (bx - 0.5) * 0.05;
          ty = 0.5 + (by - 0.5) * 0.25;
        } else {
          const shift = (bx - 0.5) * 0.55 + (poss ? 0.07 : -0.05) * dir;
          tx = ax * 0.85 + 0.075 + shift;
          ty = ay + (by - 0.5) * 0.32 * (1 - Math.abs(ay - 0.5));
        }
        if (poss && o.pl.id === this.carrier) {
          tx = bx - 0.012 * dir;
          ty = by;
        }
        if (!poss && o.pl.id === near) {
          tx = p.x + (bx - p.x) * 0.75;
          ty = p.y + (by - p.y) * 0.75;
        }
        tx = clamp(tx, 0.01, 0.99);
        ty = clamp(ty, 0.03, 0.97);
        p.x += (tx - p.x) * k;
        p.y += (ty - p.y) * k;
      }
    }
    if (this.goalFlash > 0) this.goalFlash = Math.max(0, this.goalFlash - dt / 1400);
  }

  draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const d = this.dpr,
      w = this.cw,
      h = this.ch;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const X = (x: number) => x * w,
      Y = (y: number) => y * h;
    // gramado e linhas
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#2b7247' : '#2f7a4d';
      ctx.fillRect((i * w) / 14, 0, w / 14 + 1, h);
    }
    ctx.strokeStyle = '#ffffffb0';
    ctx.lineWidth = 1.6;
    const mx = w / 105,
      my = h / 68;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.beginPath();
    ctx.moveTo(w / 2, 2);
    ctx.lineTo(w / 2, h - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9.15 * mx, 0, Math.PI * 2);
    ctx.stroke();
    for (const side of [0, 1]) {
      const x0 = side ? w - 2 : 2,
        sg = side ? -1 : 1;
      ctx.strokeRect(side ? w - 2 - 16.5 * mx : 2, h / 2 - 20.16 * my, 16.5 * mx, 40.32 * my);
      ctx.strokeRect(side ? w - 2 - 5.5 * mx : 2, h / 2 - 9.16 * my, 5.5 * mx, 18.32 * my);
      ctx.beginPath();
      ctx.arc(x0 + sg * 11 * mx, h / 2, 9.15 * mx, side ? Math.PI - 0.93 : -0.93, side ? Math.PI + 0.93 : 0.93, false);
      ctx.stroke();
      ctx.fillStyle = '#ffffffb0';
      ctx.beginPath();
      ctx.arc(x0 + sg * 11 * mx, h / 2, 1.6, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff30';
      ctx.fillRect(side ? w - 2 : 0, h / 2 - 3.66 * my, 2, 7.32 * my);
    }
    ctx.fillStyle = '#ffffffb0';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 1.8, 0, 7);
    ctx.fill();
    if (this.goalFlash > 0) {
      ctx.fillStyle = `rgba(255,210,63,${this.goalFlash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
    // jogadores
    const r = Math.max(7, w / 95);
    ctx.font = `700 ${Math.round(r * 1.05)}px Saira Condensed, Arial Narrow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of this.m.sides) {
      const c = this.colors[s.idx];
      for (const o of s.on) {
        const p = this.pos[o.pl.id];
        if (!p) continue;
        const isGK = o.role === 'GOL';
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y) + 2, r, 0, 7);
        ctx.fillStyle = '#0005';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), r, 0, 7);
        ctx.fillStyle = isGK ? (s.idx ? '#7C3AED' : '#F97316') : c.f;
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = isGK ? '#fff' : c.s;
        ctx.stroke();
        ctx.fillStyle = isLight(isGK ? '#777' : c.f) ? '#111' : '#fff';
        ctx.fillText(String((o.slot || 0) + 1), X(p.x), Y(p.y) + 0.5);
        if (o.pl.id === this.carrier) {
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), r + 4, 0, 7);
          ctx.strokeStyle = '#FFD23F';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    // nome de quem está com a bola
    const carr = this.carrier != null ? this.W.pmap[this.carrier] : null;
    if (carr && this.pos[carr.id]) {
      const p = this.pos[carr.id];
      ctx.font = `600 12px Saira Semi Condensed, sans-serif`;
      const tw = ctx.measureText(carr.n).width;
      ctx.fillStyle = '#0E1828cc';
      ctx.fillRect(X(p.x) - tw / 2 - 4, Y(p.y) - r - 20, tw + 8, 16);
      ctx.fillStyle = '#EDEAE0';
      ctx.fillText(carr.n, X(p.x), Y(p.y) - r - 12);
    }
    // bola
    const b = this.ball,
      lift = Math.sin(Math.PI * Math.min(1, b.t)) * (Math.hypot(b.tx - b.fx, b.ty - b.fy) > 0.25 ? 8 : 2);
    ctx.beginPath();
    ctx.arc(X(b.x) + 2, Y(b.y) + 3, 4, 0, 7);
    ctx.fillStyle = '#0006';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(X(b.x), Y(b.y) - lift, 4.5, 0, 7);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (this.goalFlash > 0.3) {
      ctx.font = `800 ${Math.round(h / 4)}px Saira Condensed, sans-serif`;
      ctx.fillStyle = `rgba(255,210,63,${Math.min(1, this.goalFlash * 1.4)})`;
      ctx.strokeStyle = '#0E1828';
      ctx.lineWidth = 6;
      ctx.strokeText('GOL', w / 2, h / 2);
      ctx.fillText('GOL', w / 2, h / 2);
    }
    if (this.paused) {
      ctx.fillStyle = '#0E1828aa';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `700 28px Saira Condensed, sans-serif`;
      ctx.fillStyle = '#EDEAE0';
      ctx.fillText('Pausado', w / 2, h / 2);
    }
  }

  /** Gráfico de momento (quem pressiona) minuto a minuto. */
  drawMom(): void {
    const c = this.momCanvas;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width,
      h = c.height;
    ctx.clearRect(0, 0, w, h);
    const n = 95,
      bw = w / n;
    ctx.fillStyle = '#ffffff10';
    ctx.fillRect(0, h / 2, w, 1);
    const [c0, c1] = this.colors;
    this.m.momHist.forEach((v, i) => {
      const hh = Math.min(1, Math.abs(v) / 2.2) * (h / 2 - 1);
      ctx.fillStyle = v > 0 ? (c0.f === '#111111' ? '#ddd' : c0.f) : c1.f === '#111111' ? '#888' : c1.f;
      if (v > 0) ctx.fillRect(i * bw, h / 2 - hh, bw - 1, hh);
      else ctx.fillRect(i * bw, h / 2, bw - 1, hh);
    });
    for (const g of this.m.goals) {
      ctx.fillStyle = '#FFD23F';
      ctx.fillRect((g.m - 1) * bw, 0, 2, h);
    }
  }
}
