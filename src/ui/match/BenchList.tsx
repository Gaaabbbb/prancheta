import type { PointerEvent as RPointerEvent } from 'react';
import { MAX_SUBS, ovr, type Match, type Side } from '@/core';
import { Crest } from '../components/Crest';
import { Ovr, PosTag } from '../components/Badges';
import { fitCol, type TeamColors } from './colors';
import type { Pick } from './MatchPitch';

const OUT_TXT: Record<string, string> = { sub: 'substituído', inj: 'lesionado', red: 'expulso' };

/** Banco de um time em lista. O do usuário é clicável e arrastável para o campo. */
export function BenchList({
  m,
  s,
  col,
  sel,
  onDown,
}: {
  m: Match;
  s: Side;
  col: TeamColors;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
}) {
  const mine = s.idx === m.userSide;
  const full = s.subs >= MAX_SUBS;
  const gone = Object.entries(s.out)
    .map(([id, why]) => ({ p: m.W.pmap[+id], why }))
    .filter((x) => x.p);
  const goals = m.goals.filter((g) => g.side === s.idx);
  return (
    <div className={`mbench ${mine ? 'mine' : ''} ${mine ? 'ub' : 'ob'}`}>
      <div className="mbench-h">
        <Crest club={s.club} size={22} />
        <b>{s.club.n}</b>
        <i className="kit" style={{ background: col.f, borderColor: col.s }} />
      </div>
      <div className="mbench-sub muted">
        Banco · {MAX_SUBS - s.subs} {MAX_SUBS - s.subs === 1 ? 'troca' : 'trocas'}
        {mine && !full && !m.ended && <span> · arraste ou toque para trocar</span>}
      </div>
      <div className="mbench-list">
        {s.bench.length === 0 && <p className="muted">Banco vazio.</p>}
        {s.bench.map((p) => {
          const dis = !mine || full || m.ended || s.played.has(p.id);
          const on = sel?.kind === 'bench' && sel.id === p.id;
          return (
            <div
              key={p.id}
              className={`brow ${dis ? 'dis' : ''} ${on ? 'sel' : ''}`}
              data-drop={mine ? `bench:${s.idx}:${p.id}` : undefined}
              onPointerDown={dis ? undefined : (e) => onDown({ kind: 'bench', side: s.idx, id: p.id }, e)}
            >
              <PosTag p={p.p} />
              <span className="nm">{p.n}</span>
              <Ovr v={ovr(p)} />
              <span className="fb" title={`Fôlego ${Math.round(p.f)}%`}>
                <span className="stam">
                  <i style={{ width: Math.round(p.f) + '%', background: fitCol(p.f) }} />
                </span>
                <small className="num">{Math.round(p.f)}</small>
              </span>
            </div>
          );
        })}
      </div>
      {(goals.length > 0 || gone.length > 0) && (
        <div className="mbench-log">
          {goals.map((g, i) => (
            <div key={'g' + i}>
              ⚽ {m.W.pmap[g.pid]?.n} {g.m}'{g.pen ? ' (pên.)' : ''}
            </div>
          ))}
          {gone.map(({ p, why }) => (
            <div key={p.id} className="muted">
              {why === 'red' ? '🟥' : why === 'inj' ? '✚' : '⇄'} {p.n} ({OUT_TXT[why] || why})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
