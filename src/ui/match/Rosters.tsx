import type { PointerEvent as RPointerEvent } from 'react';
import { MAX_SUBS, ovr, type Match, type Player, type Side } from '@/core';
import { Crest } from '../components/Crest';
import { Ovr, PosTag, RiskTag } from '../components/Badges';
import { fitCol, type TeamColors } from './colors';
import { type Pick } from './MatchPitch';
import { Shirt } from '../pitch/Pitch';

const OUT_TXT: Record<string, string> = { sub: 'substituído', inj: 'lesionado', red: 'expulso' };

/** Barra de fôlego com o número ao lado. */
const Stamina = ({ f }: { f: number }) => (
  <span className="fb" title={`Fôlego ${Math.round(f)}%`}>
    <span className="stam">
      <i style={{ width: Math.round(f) + '%', background: fitCol(f) }} />
    </span>
    <small className="num">{Math.round(f)}</small>
  </span>
);

/** Quem saiu (substituído, lesionado, expulso) e os gols do time. */
function Log({ m, s }: { m: Match; s: Side }) {
  const gone = Object.entries(s.out)
    .map(([id, why]) => ({ p: m.W.pmap[+id], why }))
    .filter((x) => x.p);
  const goals = m.goals.filter((g) => g.side === s.idx);
  if (!goals.length && !gone.length) return null;
  return (
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
  );
}

/** Reservas do usuário: arraste (ou toque) para colocar em campo. */
export function Reserves({
  m,
  col,
  nums,
  sel,
  onDown,
}: {
  m: Match;
  col: TeamColors;
  nums: Map<number, number>;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
}) {
  const s = m.sides[m.userSide];
  const full = s.subs >= MAX_SUBS;
  return (
    <section className="mpanel mres">
      <header>
        <h3>Reservas</h3>
        <span className={`subs ${full ? 'full' : ''}`}>
          {MAX_SUBS - s.subs} de {MAX_SUBS} trocas
        </span>
      </header>
      <div className="mlist">
        {s.bench.length === 0 && <p className="muted">Banco vazio.</p>}
        {s.bench.map((p) => {
          const dis = full || m.ended || s.played.has(p.id);
          const on = sel?.kind === 'bench' && sel.id === p.id;
          return (
            <div
              key={p.id}
              className={`brow mine ${dis ? 'dis' : ''} ${on ? 'sel' : ''}`}
              data-drop={`bench:${s.idx}:${p.id}`}
              onPointerDown={dis ? undefined : (e) => onDown({ kind: 'bench', side: s.idx, id: p.id }, e)}
            >
              <Shirt col={col} n={nums.get(p.id) ?? ''} size={26} />
              <PosTag p={p.p} />
              <span className="nm">
                {p.n}
                <RiskTag W={m.W} p={p} short />
              </span>
              <Ovr v={ovr(p)} />
              <Stamina f={p.f} />
            </div>
          );
        })}
      </div>
      {!full && !m.ended && <p className="mtip muted">Arraste um reserva até o jogador que sai, ou toque nos dois.</p>}
      <Log m={m} s={s} />
    </section>
  );
}

/** Adversário: quem está em campo (com nota e cartões) e o banco. */
export function Opponent({ m, col, nums }: { m: Match; col: TeamColors; nums: Map<number, number> }) {
  const s = m.sides[1 - m.userSide];
  const row = (p: Player, role: Player['p'], rat?: number) => (
    <div key={p.id} className="brow">
      <Shirt col={col} n={nums.get(p.id) ?? ''} size={26} />
      <PosTag p={role} />
      <span className="nm">
        {p.n}
        {s.yel[p.id] ? <i className="yc" /> : null}
        {m.goals.some((g) => g.pid === p.id && g.side === s.idx) ? ' ⚽' : ''}
      </span>
      {rat != null ? (
        <span className={`rt num ${rat >= 7.5 ? 'hi' : rat < 6 ? 'lo' : ''}`}>{rat.toFixed(1)}</span>
      ) : (
        <Ovr v={ovr(p)} />
      )}
      <Stamina f={p.f} />
    </div>
  );
  return (
    <section className="mpanel mopp">
      <header>
        <Crest club={s.club} size={20} />
        <h3>{s.club.n}</h3>
        <span className="muted">{s.tac.f}</span>
      </header>
      <div className="mlist">
        {[...s.on].sort((a, b) => a.slot - b.slot).map((o) => row(o.pl, o.role, s.rat[o.pl.id] ?? 6))}
        {s.bench.length > 0 && (
          <div className="msep">
            Banco · {MAX_SUBS - s.subs} {MAX_SUBS - s.subs === 1 ? 'troca' : 'trocas'}
          </div>
        )}
        {s.bench.map((p) => row(p, p.p))}
      </div>
      <Log m={m} s={s} />
    </section>
  );
}
