import { useRef, useState, type DragEvent } from 'react';
import {
  autoLineup,
  available,
  BENCH_SIZE,
  FORMATIONS,
  ovr,
  ovrRole,
  refreshBench,
  spotPlayer,
  squad,
  swapSpots,
  validateLineup,
  type Player,
  type Spot,
  type Tactic,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast } from '@/store/uiStore';
import { Ovr, PosTag, StatusTags, FitBar } from '../components/Badges';
import { sortPlayers } from '../sortPlayers';
import { TacticControls } from '../components/TacticControls';
import { fitColor, isLight } from '../format';
import type { PageProps } from './types';

const spotKey = (s: Spot) => (s.z === 'res' ? 'r' + s.pid : s.z + s.i);
const sameSpot = (a: Spot | null, b: Spot) => !!a && spotKey(a) === spotKey(b);

export function Tactics({ W }: PageProps) {
  const mutate = useGame((s) => s.mutate);
  /** lugar selecionado com clique (alternativa ao arrastar, útil no celular) */
  const [sel, setSel] = useState<Spot | null>(null);
  /** lugar sob o cursor durante o arraste */
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<Spot | null>(null);
  const me = W.clubs[W.user!];
  validateLineup(W, me);
  const lineup = me.lineup!;
  const slots = FORMATIONS[me.tac.f];

  const swap = (a: Spot, b: Spot) => {
    let err: string | null = null;
    mutate(() => {
      err = swapSpots(W, me, a, b);
    });
    if (err) toast(err);
  };

  const click = (s: Spot) => {
    if (!sel) {
      if (spotPlayer(me, s) != null || s.z !== 'res') setSel(s);
    } else if (sameSpot(sel, s)) setSel(null);
    else {
      swap(sel, s);
      setSel(null);
    }
  };

  /** Props de arrastar/soltar e clique para qualquer lugar. */
  const dnd = (s: Spot) => {
    const pid = spotPlayer(me, s);
    const k = spotKey(s);
    return {
      draggable: pid != null,
      onDragStart: (e: DragEvent) => {
        drag.current = s;
        setSel(null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(pid));
      },
      onDragEnd: () => {
        drag.current = null;
        setOver(null);
      },
      onDragOver: (e: DragEvent) => {
        if (!drag.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (over !== k) setOver(k);
      },
      onDragLeave: () => setOver((o) => (o === k ? null : o)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const from = drag.current;
        drag.current = null;
        setOver(null);
        if (from && !sameSpot(from, s)) swap(from, s);
      },
      onClick: () => click(s),
    };
  };
  const cls = (s: Spot) => `${sameSpot(sel, s) ? 'sel' : ''} ${over === spotKey(s) ? 'over' : ''}`;

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

  const bench = me.bench || [];
  const used = new Set<number | null>([...lineup, ...bench]);
  const pool = sortPlayers(
    squad(W, W.user!).filter((p) => !used.has(p.id)),
    'pos',
    1,
  );
  const benchHasGk = bench.some((id) => W.pmap[id]?.p === 'GOL');
  const shirt = { background: me.c1, borderColor: me.c2, color: isLight(me.c1) ? '#111' : '#fff' };

  const token = (p: Player, rating: number, role: string) => (
    <>
      <div className="sh" style={shirt}>
        {rating}
      </div>
      <span className="nm">{p.n}</span>
      <span className="rl">
        {role}
        {p.p !== role ? ' (' + p.p + ')' : ''}
      </span>
      <div className="fit">
        <i style={{ width: `${p.f}%`, background: fitColor(p.f) }} />
      </div>
    </>
  );

  return (
    <>
      <div className="ph">
        <h2>Tática</h2>
        <span className="muted">
          Arraste jogadores entre o campo, o banco e a lista de reservas. Também dá para clicar em um e depois em outro
          para trocá-los.
        </span>
      </div>
      <div className="grid tacgrid">
        <div>
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
              const spot: Spot = { z: 'xi', i };
              const p = W.pmap[lineup[i]!];
              const pos = { top: `${7 + (1 - s[1] / 0.85) * 80}%`, left: `${6 + s[2] * 88}%` };
              if (!p)
                return (
                  <div key={i} className={`tok empty ${cls(spot)}`} style={pos} {...dnd(spot)}>
                    <div className="sh">?</div>
                    <span className="nm">{s[0]}</span>
                  </div>
                );
              const r = ovrRole(p, s[0]);
              return (
                <div key={i} className={`tok ${cls(spot)}`} style={pos} title={`${p.n}: ${s[0]} ${r}`} {...dnd(spot)}>
                  {token(p, r, s[0])}
                </div>
              );
            })}
          </div>
          <div className="benchbox">
            <div className="bh">
              <b>Banco</b>
              <span className="muted">
                {bench.length} de {BENCH_SIZE}
                {!benchHasGk && bench.length > 0 && <span className="warn"> · sem goleiro reserva</span>}
              </span>
              <span className="sp" />
              <button className="btn ghost sm" onClick={() => mutate(() => refreshBench(W, me))}>
                Banco automático
              </button>
            </div>
            <div className="bench">
              {Array.from({ length: BENCH_SIZE }, (_, i) => {
                const spot: Spot = { z: 'bench', i };
                const p = W.pmap[bench[i]];
                if (!p)
                  return (
                    <div key={i} className={`tok bt empty ${cls(spot)}`} {...dnd(spot)}>
                      <div className="sh">+</div>
                      <span className="nm">vaga</span>
                    </div>
                  );
                return (
                  <div key={i} className={`tok bt ${cls(spot)}`} title={`${p.n}: ${p.p} ${ovr(p)}`} {...dnd(spot)}>
                    {token(p, ovr(p), p.p)}
                  </div>
                );
              })}
            </div>
          </div>
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
              Reservas <small>fora do time e do banco</small>
            </h3>
            <table className="t">
              <tbody>
                {pool.length === 0 && (
                  <tr>
                    <td className="muted">Todo o elenco está no time ou no banco.</td>
                  </tr>
                )}
                {pool.map((p) => {
                  const spot: Spot = { z: 'res', pid: p.id };
                  return (
                    <tr
                      key={p.id}
                      className={`click drow ${sameSpot(sel, spot) ? 'me' : ''} ${over === spotKey(spot) ? 'over' : ''} ${available(p) ? '' : 'out'}`}
                      {...dnd(spot)}
                    >
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
