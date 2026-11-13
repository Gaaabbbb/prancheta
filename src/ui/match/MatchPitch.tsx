import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { clamp, FORMATIONS, type Match, type MatchEvent, type OnField, type Side } from '@/core';
import type { TeamColors } from './colors';

/** O que está selecionado ou sendo arrastado: jogador em campo, no banco ou vaga vazia. */
export type Pick = { kind: 'on' | 'bench' | 'slot'; side: number; id: number };

export interface FeedItem {
  key: number;
  e: MatchEvent;
}

/** Sobrenome (ou o nome curto) para caber embaixo da ficha. */
const shortName = (n: string): string => {
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  return parts.length > 1 && last.length <= 3 ? parts.slice(-2).join(' ') : last;
};

/**
 * Posição da ficha no campo vertical. O mandante ataca para cima (metade de baixo), o visitante para baixo.
 * `x` da formação (0 = próprio gol, 1 = gol adversário) vira a altura; `y` (largura) vira a coluna.
 */
const spot = (sideIdx: number, x: number, y: number) => {
  const depth = 0.04 + clamp(x, 0, 0.82) * 0.47;
  return sideIdx === 0 ? { top: (1 - depth) * 100, left: y * 100 } : { top: depth * 100, left: (1 - y) * 100 };
};

/** Cor da condição física (embaixo do nome). */
const fitCol = (f: number) => (f > 70 ? 'var(--ok)' : f > 55 ? 'var(--yellow)' : 'var(--red)');

const EV_ICON: Record<string, string> = { goal: '⚽', yel: '🟨', red: '🟥', inj: '✚', sub: '⇄' };

/** Campo vertical com as duas formações, a narração no meio e as fichas do usuário arrastáveis. */
export function MatchPitch({
  m,
  cols,
  sel,
  feed,
  onDown,
  goalFlash,
}: {
  m: Match;
  cols: [TeamColors, TeamColors];
  sel: Pick | null;
  feed: FeedItem[];
  onDown: (p: Pick, e: RPointerEvent) => void;
  goalFlash: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // o campo ocupa o maior retângulo 68 x 105 que cabe no espaço
  useEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      const W0 = el.clientWidth,
        H0 = el.clientHeight;
      let w = W0,
        h = (w * 105) / 68;
      if (h > H0 && H0 > 0) {
        h = H0;
        w = (h * 68) / 105;
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const user = m.userSide;
  const tokens = (s: Side) => {
    const slots = FORMATIONS[s.tac.f];
    const used = new Set(s.on.map((o) => o.slot));
    const empty = slots.map((sl, i) => ({ sl, i })).filter(({ i }) => !used.has(i));
    return (
      <>
        {s.on.map((o) => {
          const sl = slots[o.slot] || slots[0];
          return (
            <Token
              key={o.pl.id}
              m={m}
              s={s}
              o={o}
              pos={spot(s.idx, sl[1], sl[2])}
              col={cols[s.idx]}
              sel={sel}
              onDown={onDown}
            />
          );
        })}
        {s.idx === user &&
          empty.map(({ sl, i }) => {
            const pos = spot(s.idx, sl[1], sl[2]);
            const on = sel?.kind === 'slot' && sel.id === i;
            return (
              <div
                key={'e' + i}
                className={`vtok empty ${on ? 'sel' : ''}`}
                style={{ top: pos.top + '%', left: pos.left + '%' }}
                data-drop={`slot:${s.idx}:${i}`}
                onPointerDown={(e) => onDown({ kind: 'slot', side: s.idx, id: i }, e)}
              >
                <span className="sh">{sl[0]}</span>
                <span className="nm">vaga</span>
              </div>
            );
          })}
      </>
    );
  };

  const recent = feed.slice(0, 2);
  return (
    <div className="vpitch-wrap" ref={wrap}>
      <div
        className={`vpitch ${goalFlash ? 'goalflash' : ''}`}
        key={goalFlash}
        style={{ width: size.w, height: size.h }}
      >
        <svg className="lines" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="66" height="103" />
          <line x1="1" y1="52.5" x2="67" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.85" y="1" width="40.3" height="16.5" />
          <rect x="24.85" y="1" width="18.3" height="5.5" />
          <rect x="13.85" y="87.5" width="40.3" height="16.5" />
          <rect x="24.85" y="98.5" width="18.3" height="5.5" />
        </svg>
        {tokens(m.sides[1])}
        {tokens(m.sides[0])}
        <div className="vnarr" aria-live="polite">
          {recent.map(({ key, e }, i) => (
            <div key={key} className={`vn i${e.imp} ${e.type === 'goal' ? 'goal' : ''} ${i ? 'old' : ''}`}>
              <b>{e.m}'</b>
              {EV_ICON[e.type] && <span className="ic">{EV_ICON[e.type]}</span>}
              {e.side === 0 || e.side === 1 ? <i className="dot" style={{ background: cols[e.side].f }} /> : null}
              <span>{e.txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Token({
  m,
  s,
  o,
  pos,
  col,
  sel,
  onDown,
}: {
  m: Match;
  s: Side;
  o: OnField;
  pos: { top: number; left: number };
  col: TeamColors;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
}) {
  const p = o.pl;
  const mine = s.idx === m.userSide;
  const goals = m.goals.filter((g) => g.pid === p.id && g.side === s.idx).length;
  const rat = s.rat[p.id] ?? 6;
  const isSel = sel?.kind === 'on' && sel.id === p.id;
  return (
    <div
      className={`vtok ${mine ? 'mine' : ''} ${isSel ? 'sel' : ''} ${s.out[p.id] === 'inj' ? 'hurt' : ''}`}
      style={{ top: pos.top + '%', left: pos.left + '%' }}
      data-drop={mine ? `on:${s.idx}:${p.id}` : undefined}
      onPointerDown={mine ? (e) => onDown({ kind: 'on', side: s.idx, id: p.id }, e) : undefined}
      title={`${p.n} · ${o.role} · condição ${Math.round(p.f)}% · nota ${rat.toFixed(1)}`}
    >
      <span className="sh" style={{ background: col.f, color: col.s, borderColor: col.s }}>
        {o.role}
      </span>
      <span className="nm" style={{ boxShadow: `inset 0 -2px 0 ${fitCol(p.f)}` }}>
        {s.yel[p.id] ? <i className="yc" /> : null}
        {shortName(p.n)}
        {goals > 0 && <span className="gl">{goals > 1 ? goals + '⚽' : '⚽'}</span>}
      </span>
      <span className={`rt ${rat >= 7.5 ? 'hi' : rat < 6 ? 'lo' : ''}`}>{rat.toFixed(1)}</span>
    </div>
  );
}
