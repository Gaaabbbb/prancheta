import { useState } from 'react';
import {
  autoLineup,
  available,
  FORMATIONS,
  ovr,
  ovrRole,
  refreshBench,
  squad,
  validateLineup,
  type Tactic,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast } from '@/store/uiStore';
import { Ovr, PosTag, StatusTags, FitBar } from '../components/Badges';
import { sortPlayers } from '../sortPlayers';
import { TacticControls } from '../components/TacticControls';
import { fitColor, isLight } from '../format';
import type { PageProps } from './types';

export function Tactics({ W }: PageProps) {
  const mutate = useGame((s) => s.mutate);
  /** vaga do campo selecionada */
  const [sel, setSel] = useState<number | null>(null);
  /** jogador da lista selecionado */
  const [selP, setSelP] = useState<number | null>(null);
  const me = W.clubs[W.user!];
  validateLineup(W, me);
  const lineup = me.lineup!;
  const slots = FORMATIONS[me.tac.f];

  const clickSlot = (i: number) => {
    if (selP != null) {
      const p = W.pmap[selP];
      if (available(p))
        mutate(() => {
          lineup[i] = p.id;
          refreshBench(W, me);
        });
      else toast(p.n + ' não está disponível.');
      setSelP(null);
      setSel(null);
    } else if (sel == null) setSel(i);
    else if (sel === i) setSel(null);
    else {
      mutate(() => {
        const t = lineup[i];
        lineup[i] = lineup[sel];
        lineup[sel] = t;
      });
      setSel(null);
    }
  };

  const clickPool = (pid: number) => {
    const p = W.pmap[pid];
    if (sel != null) {
      if (!available(p)) return toast(p.n + ' não está disponível.');
      mutate(() => {
        lineup[sel] = p.id;
        refreshBench(W, me);
      });
      setSel(null);
    } else setSelP(selP === pid ? null : pid);
  };

  const setTac = (patch: Partial<Tactic>) => {
    if (patch.f && patch.f !== me.tac.f) {
      mutate(() => {
        me.tac.f = patch.f!;
        autoLineup(W, me);
      });
      toast('Formação ' + patch.f + ': time reescalado automaticamente.');
      return;
    }
    mutate(() => {
      Object.assign(me.tac, patch);
      me.userTac = Object.assign({}, me.tac);
    });
  };

  const inXI = new Set(lineup);
  const pool = sortPlayers(
    squad(W, W.user!).filter((p) => !inXI.has(p.id)),
    'pos',
    1,
  );
  const benchSet = new Set(me.bench);
  const shirt = { background: me.c1, borderColor: me.c2, color: isLight(me.c1) ? '#111' : '#fff' };

  return (
    <>
      <div className="ph">
        <h2>Tática</h2>
        <span className="muted">
          Clique em dois jogadores do campo para trocá-los de lugar, ou em um do campo e depois em um da lista.
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(340px,520px) 1fr' }}>
        <div className="board">
          <div className="ln" style={{ left: '4%', right: '4%', top: '3%', bottom: '3%' }} />
          <div className="ln" style={{ left: '4%', right: '4%', top: '50%', height: 0, borderWidth: '2px 0 0' }} />
          <div
            className="ln"
            style={{
              left: '50%',
              top: '50%',
              width: '22%',
              aspectRatio: 1,
              borderRadius: '50%',
              transform: 'translate(-50%,-50%)',
            }}
          />
          <div className="ln" style={{ left: '24%', right: '24%', top: '3%', height: '13%', borderTop: 0 }} />
          <div className="ln" style={{ left: '24%', right: '24%', bottom: '3%', height: '13%', borderBottom: 0 }} />
          {slots.map((s, i) => {
            const p = W.pmap[lineup[i]!];
            const pos = { top: `${7 + (1 - s[1] / 0.85) * 80}%`, left: `${6 + s[2] * 88}%` };
            if (!p)
              return (
                <div key={i} className={`tok empty ${sel === i ? 'sel' : ''}`} style={pos} onClick={() => clickSlot(i)}>
                  <div className="sh">?</div>
                  <span className="nm">{s[0]}</span>
                </div>
              );
            const r = ovrRole(p, s[0]);
            return (
              <div
                key={i}
                className={`tok ${sel === i ? 'sel' : ''}`}
                style={pos}
                onClick={() => clickSlot(i)}
                title={`${p.n}: ${s[0]} ${r}`}
              >
                <div className="sh" style={shirt}>
                  {r}
                </div>
                <span className="nm">{p.n}</span>
                <span className="rl">
                  {s[0]}
                  {p.p !== s[0] ? ' (' + p.p + ')' : ''}
                </span>
                <div className="fit">
                  <i style={{ width: `${p.f}%`, background: fitColor(p.f) }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h3>Instruções</h3>
            <TacticControls tac={me.tac} onChange={setTac} />
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => mutate(() => autoLineup(W, me))}>
                Escalar automaticamente
              </button>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Pressão alta cansa mais e gera mais faltas. Linha adiantada pega mais impedimentos, mas sofre com
              atacantes rápidos. Mentalidade ofensiva cria mais chances e deixa espaço para o contra-ataque.
            </p>
          </div>
          <div className="panel">
            <h3>
              Fora do time titular <small>os 9 melhores vão para o banco</small>
            </h3>
            <table className="t">
              <tbody>
                {pool.map((p) => (
                  <tr key={p.id} className={`click ${selP === p.id ? 'me' : ''}`} onClick={() => clickPool(p.id)}>
                    <td>
                      <PosTag p={p.p} />
                    </td>
                    <td className="nm">
                      {p.n}
                      <StatusTags p={p} />
                    </td>
                    <td className="c">
                      <Ovr v={ovr(p)} />
                    </td>
                    <td style={{ width: 60 }}>
                      <FitBar f={p.f} />
                    </td>
                    <td className="r muted" style={{ fontSize: 12 }}>
                      {benchSet.has(p.id) ? 'banco' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
