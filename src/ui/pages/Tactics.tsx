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
  lineupIssues,
  tidyLineup,
  avgRating,
  type Player,
  type Spot,
  type Pos,
  type Tactic,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast } from '@/store/uiStore';
import { Ovr, PosTag, RiskTag, StatusTags, FitBar, MoraleBar } from '../components/Badges';
import { SavedTactics } from '../components/SavedTactics';
import { sortPlayers } from '../sortPlayers';
import { TacticControls } from '../components/TacticControls';
import { colorDist, fitColor, isLight } from '../format';
import { placeFormation } from '../pitch/layout';
import { assignNumbers, shortName } from '../pitch/numbers';
import { PitchFrame, PlayerToken } from '../pitch/Pitch';
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
  tidyLineup(W, me);
  const issues = lineupIssues(W, me);
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
  // camisa nas cores do clube (detalhe preto ou branco se as duas cores forem parecidas)
  const kit = { f: me.c1, s: colorDist(me.c1, me.c2) < 80 ? (isLight(me.c1) ? '#0b0f18' : '#ffffff') : me.c2 };

  const ratingTxt = (p: Player) => {
    const r = avgRating(p);
    return r == null ? '–' : r.toFixed(1);
  };
  /** dica do jogador: OVR na função, condição, moral e nota */
  const tip = (p: Player, role: Pos) =>
    `${p.n} (${role}) · OVR ${ovrRole(p, role)}\n` +
    `Condição ${Math.round(p.f)}% · Moral ${Math.round(p.mo)} · Nota ${ratingTxt(p)}`;

  const nums = assignNumbers(
    slots.map((sl, i) => ({ id: lineup[i] ?? -1 - i, role: sl[0] })),
    bench,
  );
  const tokenProps = (p: Player, role: Pos, spot: Spot) => {
    const o = ovrRole(p, role);
    return {
      col: kit,
      num: nums.get(p.id) ?? '',
      role: p.p !== role ? role + '*' : role,
      value: o,
      valueCls: o >= ovr(p) ? 'hi' : o < ovr(p) - 4 ? 'lo' : '',
      name: shortName(p.n),
      fit: p.f,
      fitColor: fitColor(p.f),
      sel: sameSpot(sel, spot),
      dim: !available(p),
      title: tip(p, role),
      tag: !available(p) ? (
        <span className="xtag">{p.inj > 0 ? `lesionado (${p.inj})` : 'suspenso'}</span>
      ) : (
        <RiskTag W={W} p={p} />
      ),
    };
  };

  return (
    <>
      <div className="ph">
        <h2>Tática</h2>
        <span className="muted">
          Arraste jogadores entre o campo, o banco e a lista de reservas, ou toque em um e depois em outro para
          trocá-los. No cartão: a função e o OVR nela (* = fora da posição de origem) e a barra de condição. Passe o
          mouse para ver moral e nota.
        </span>
      </div>
      {issues.length > 0 && (
        <p className="warnbox" style={{ margin: '0 0 14px' }}>
          <b>Escalação com desfalques:</b>{' '}
          {issues.map((x) => `${W.pmap[x.pid].n} (${x.why}, ${x.where === 'xi' ? 'titular' : 'banco'})`).join(', ')}.
          Arraste um jogador disponível sobre ele ou mande-o para as reservas. O jogo só começa depois disso.
        </p>
      )}
      <div className="grid tacgrid">
        <div>
          <PitchFrame className="tacpitch">
            {(w) => {
              const pos = placeFormation(slots, w);
              return slots.map((sl, i) => {
                const spot: Spot = { z: 'xi', i };
                const p = W.pmap[lineup[i]!];
                const at = { top: pos[i].top + '%', left: pos[i].left + '%' };
                if (!p)
                  return (
                    <div key={i} className={`ptok empty ${cls(spot)}`} style={at} {...dnd(spot)}>
                      <span className="eshirt">{sl[0]}</span>
                      <span className="pcard">
                        <span className="pn">vaga</span>
                      </span>
                    </div>
                  );
                return (
                  <PlayerToken
                    key={i}
                    {...tokenProps(p, sl[0], spot)}
                    width={pos[i].w}
                    className={over === spotKey(spot) ? 'over' : ''}
                    style={at}
                    {...dnd(spot)}
                  />
                );
              });
            }}
          </PitchFrame>
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
                    <div key={i} className={`ptok bt empty ${cls(spot)}`} {...dnd(spot)}>
                      <span className="eshirt">+</span>
                      <span className="pcard">
                        <span className="pn">vaga</span>
                      </span>
                    </div>
                  );
                return (
                  <PlayerToken
                    key={i}
                    {...tokenProps(p, p.p, spot)}
                    className={`bt ${over === spotKey(spot) ? 'over' : ''}`}
                    {...dnd(spot)}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h3>Instruções</h3>
            <SavedTactics W={W} />
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
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Nome</th>
                  <th className="c">OVR</th>
                  <th>Cond.</th>
                  <th>Moral</th>
                  <th className="r">Nota</th>
                </tr>
              </thead>
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
                        <RiskTag W={W} p={p} />
                      </td>
                      <td className="c">
                        <Ovr v={ovr(p)} />
                      </td>
                      <td style={{ width: 56 }} title={`${Math.round(p.f)}%`}>
                        <FitBar f={p.f} />
                      </td>
                      <td style={{ width: 56 }} title={String(Math.round(p.mo))}>
                        <MoraleBar m={p.mo} />
                      </td>
                      <td className="r num">{ratingTxt(p)}</td>
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
