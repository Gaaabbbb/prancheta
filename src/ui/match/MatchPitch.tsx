import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { clamp, FORMATIONS, type Match, type MatchEvent, type OnField, type Side } from '@/core';
import { fitCol, type TeamColors } from './colors';
import { shortName } from './numbers';

/** O que está selecionado ou sendo arrastado: jogador em campo, no banco ou vaga vazia. */
export type Pick = { kind: 'on' | 'bench' | 'slot'; side: number; id: number };

export interface FeedItem {
  key: number;
  e: MatchEvent;
}

/** Proporção largura/altura do campo: um pouco mais largo que o real, porque só o seu time aparece. */
const RATIO = 0.8;

/**
 * Linhas da formação, do goleiro ao ataque: profundidades próximas (até 0,09) viram a mesma linha, e as linhas são
 * espalhadas por igual no campo inteiro (goleiro embaixo, ataque em cima).
 */
const lineDepths = (xs: number[]): Map<number, number> => {
  const sorted = [...new Set(xs)].sort((a, b) => a - b);
  const lines: number[][] = [];
  for (const x of sorted) {
    const cur = lines[lines.length - 1];
    if (cur && x - cur[0] <= 0.09) cur.push(x);
    else lines.push([x]);
  }
  const out = new Map<number, number>();
  const n = lines.length;
  lines.forEach((l, i) => l.forEach((x) => out.set(x, n > 1 ? i / (n - 1) : 0)));
  return out;
};

/** Posição (em %) a partir da linha (0 = goleiro, 1 = ataque) e da largura. */
const spot = (line: number, y: number) => ({ top: 88 - line * 74, left: 10 + y * 80 });

/** Camisa com o número, nas cores do time. */
export function Shirt({ col, n, size }: { col: TeamColors; n: number | string; size?: number }) {
  return (
    <svg className="shirt" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path
        d="M14 4 L8 6 L2 13 L7 18 L10 15 L10 37 L30 37 L30 15 L33 18 L38 13 L32 6 L26 4 Q20 9 14 4 Z"
        fill={col.f}
        stroke={col.s}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text x="20" y="29" textAnchor="middle" fill={col.s}>
        {n}
      </text>
    </svg>
  );
}

/** Campo com o seu time na formação. As fichas (camisa + cartão com função, nota, nome e fôlego) são arrastáveis. */
export function MatchPitch({
  m,
  col,
  nums,
  sel,
  onDown,
  goalFlash,
}: {
  m: Match;
  col: TeamColors;
  nums: Map<number, number>;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
  goalFlash: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // o maior retângulo na proporção do campo que cabe no espaço
  useEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      const W0 = el.clientWidth,
        H0 = el.clientHeight || W0 / RATIO;
      let w = W0,
        h = w / RATIO;
      if (h > H0) {
        h = H0;
        w = h * RATIO;
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s: Side = m.sides[m.userSide];
  const slots = FORMATIONS[s.tac.f];
  const depth = lineDepths(slots.map((sl) => sl[1]));
  const used = new Set(s.on.map((o) => o.slot));
  const tk = Math.round(clamp(size.w * 0.095, 28, 46));

  return (
    <div className="vpitch-wrap" ref={wrap}>
      <div
        className={`vpitch ${goalFlash ? 'goalflash' : ''}`}
        key={goalFlash}
        style={{ width: size.w, height: size.h, '--tk': tk + 'px' } as CSSProperties}
      >
        <svg className="lines" viewBox="0 0 80 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="77" height="97" />
          <line x1="1.5" y1="50" x2="78.5" y2="50" />
          <ellipse cx="40" cy="50" rx="10" ry="8" />
          <rect x="18" y="1.5" width="44" height="15" />
          <rect x="29" y="1.5" width="22" height="5" />
          <rect x="18" y="83.5" width="44" height="15" />
          <rect x="29" y="93.5" width="22" height="5" />
        </svg>
        {s.on.map((o) => {
          const sl = slots[o.slot] || slots[0];
          return (
            <Token
              key={o.pl.id}
              m={m}
              s={s}
              o={o}
              n={nums.get(o.pl.id) ?? ''}
              pos={spot(depth.get(sl[1]) ?? 0.5, sl[2])}
              col={col}
              sel={sel}
              onDown={onDown}
            />
          );
        })}
        {slots.map((sl, i) => {
          if (used.has(i)) return null;
          const pos = spot(depth.get(sl[1]) ?? 0.5, sl[2]);
          const on = sel?.kind === 'slot' && sel.id === i;
          return (
            <div
              key={'e' + i}
              className={`ptok empty ${on ? 'sel' : ''}`}
              style={{ top: pos.top + '%', left: pos.left + '%' }}
              data-drop={`slot:${s.idx}:${i}`}
              onPointerDown={(e) => onDown({ kind: 'slot', side: s.idx, id: i }, e)}
            >
              <span className="eshirt">{sl[0]}</span>
              <span className="pcard">
                <span className="pn">vaga livre</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Token({
  m,
  s,
  o,
  n,
  pos,
  col,
  sel,
  onDown,
}: {
  m: Match;
  s: Side;
  o: OnField;
  n: number | string;
  pos: { top: number; left: number };
  col: TeamColors;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
}) {
  const p = o.pl;
  const goals = m.goals.filter((g) => g.pid === p.id && g.side === s.idx).length;
  const rat = s.rat[p.id] ?? 6;
  const isSel = sel?.kind === 'on' && sel.id === p.id;
  const hurt = s.out[p.id] === 'inj';
  const f = Math.round(p.f);
  return (
    <div
      className={`ptok ${isSel ? 'sel' : ''} ${hurt ? 'hurt' : ''}`}
      style={{ top: pos.top + '%', left: pos.left + '%' }}
      data-drop={`on:${s.idx}:${p.id}`}
      onPointerDown={(e) => onDown({ kind: 'on', side: s.idx, id: p.id }, e)}
      title={`${p.n} · ${o.role} · fôlego ${f}% · nota ${rat.toFixed(1)}`}
    >
      <span className="pshirt">
        <Shirt col={col} n={n} />
        {goals > 0 && <i className="pgoal">{goals > 1 ? goals : ''}⚽</i>}
        {s.yel[p.id] ? <i className="pyc" /> : null}
        {hurt && <i className="phurt">✚</i>}
      </span>
      <span className="pcard">
        <span className="pr">
          <b>{o.role}</b>
          <span className={`prt ${rat >= 7.5 ? 'hi' : rat < 6 ? 'lo' : ''}`}>{rat.toFixed(1)}</span>
        </span>
        <span className="pn">{shortName(p.n)}</span>
        <span className="pf" aria-label={`fôlego ${f}%`}>
          <i style={{ width: f + '%', background: fitCol(p.f) }} />
        </span>
      </span>
    </div>
  );
}
