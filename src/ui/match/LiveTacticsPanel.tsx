import { useState } from 'react';
import { MAX_SUBS, ovr, ovrRole, type Match, type MatchEvent, type Tactic } from '@/core';
import { toast } from '@/store/uiStore';
import { FitBar, Ovr, PosTag } from '../components/Badges';
import { TacticControls } from '../components/TacticControls';

/** Painel lateral para mudar a tática e fazer substituições durante a partida. */
export function LiveTacticsPanel({
  m,
  onEvent,
  onClose,
}: {
  m: Match;
  onEvent: (e: MatchEvent) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [, force] = useState(0);
  const s = m.sides[m.userSide];
  const setTac = (patch: Partial<Tactic>) => {
    m.setTactic(m.userSide, patch);
    force((x) => x + 1);
  };
  const sub = (inId: number) => {
    if (!sel) return toast('Primeiro escolha quem sai, na lista “Em campo”.');
    const outPl = m.W.pmap[sel],
      inPl = m.W.pmap[inId];
    if (m.doSub(s, outPl, inPl)) {
      setSel(null);
      onEvent(m.events[m.events.length - 1]);
    }
  };
  return (
    <div className="side-panel">
      <div className="mh" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2 style={{ flex: 1 }}>Tática e substituições</h2>
        <button className="btn pri" onClick={onClose}>
          Voltar ao jogo
        </button>
      </div>
      {(m.W.tacs || []).length > 0 && (
        <div className="stlist" style={{ marginBottom: 12 }}>
          <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>
            Táticas salvas:
          </span>
          {m.W.tacs!.map((t) => (
            <button
              key={t.id}
              className="stchip"
              title="Aplica a formação e as instruções desta tática (os jogadores em campo continuam os mesmos)"
              onClick={() => {
                setTac({ ...t.tac });
                toast(`Tática "${t.name}" aplicada.`);
              }}
            >
              <b>{t.name}</b>
              <span>{t.tac.f}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <TacticControls tac={s.tac} onChange={setTac} lineLabel="Linha" />
      </div>
      <div className="grid g2">
        <div>
          <h3 style={{ marginBottom: 6 }}>
            Em campo{' '}
            <small className="muted" style={{ fontFamily: 'var(--fb)', fontSize: 12 }}>
              clique em quem vai sair
            </small>
          </h3>
          {s.on.map((o) => {
            const p = o.pl;
            return (
              <div
                key={p.id}
                className={`subrow ${sel === p.id ? 'sel' : ''}`}
                onClick={() => setSel(sel === p.id ? null : p.id)}
              >
                <PosTag p={o.role} />
                <span className="nm">
                  {p.n}
                  {s.yel[p.id] ? (
                    <>
                      {' '}
                      <span className="tag sus">AM</span>
                    </>
                  ) : null}
                </span>
                <Ovr v={ovrRole(p, o.role)} />
                <span>
                  <FitBar f={p.f} />
                </span>
                <span className="num muted">{(s.rat[p.id] || 6).toFixed(1)}</span>
              </div>
            );
          })}
        </div>
        <div>
          <h3 style={{ marginBottom: 6 }}>
            Banco{' '}
            <small className="muted" style={{ fontFamily: 'var(--fb)', fontSize: 12 }}>
              {MAX_SUBS - s.subs} trocas restantes
            </small>
          </h3>
          {s.bench.length === 0 && <p className="muted">Banco vazio.</p>}
          {s.bench.map((p) => {
            const disabled = s.played.has(p.id) || s.subs >= MAX_SUBS;
            return (
              <div
                key={p.id}
                className={`subrow ${disabled ? 'dis' : ''}`}
                onClick={disabled ? undefined : () => sub(p.id)}
              >
                <PosTag p={p.p} />
                <span className="nm">{p.n}</span>
                <Ovr v={ovr(p)} />
                <span>
                  <FitBar f={p.f} />
                </span>
                <span />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
