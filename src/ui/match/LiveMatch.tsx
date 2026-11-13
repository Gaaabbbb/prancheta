import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MAX_SUBS, type MatchEvent } from '@/core';
import { afterUserMatch } from '@/app/gameFlow';
import { useLive } from '@/store/liveStore';
import { toast, useUi } from '@/store/uiStore';
import { useWorld } from '@/store/gameStore';
import { Crest } from '../components/Crest';
import { Opponent, Reserves } from './Rosters';
import { shirtNumbers } from './numbers';
import { teamColors } from './colors';
import { TacticDock } from './TacticDock';
import { LiveEndPanel } from './LiveEndPanel';
import { MatchPitch, type FeedItem, type Pick } from './MatchPitch';
import { SPEEDS } from './speeds';

const MAX_FEED = 120;

/** Distância (px) a partir da qual o toque vira arrasto. */
const DRAG_MIN = 7;

const statItem = (label: string, a: number, b: number, fa?: string, fb?: string) => {
  const s = a + b || 1;
  return (
    <div className="sti" key={label}>
      <div className="lb">
        <b>{fa ?? a}</b>
        <span>{label}</span>
        <b>{fb ?? b}</b>
      </div>
      <div className="dual">
        <i className="h" style={{ width: `${(a / s) * 100}%` }} />
        <i className="a" />
      </div>
    </div>
  );
};

export function LiveMatch() {
  const session = useLive((s) => s.session)!;
  const { m, uf } = session;
  const W = useWorld();
  const speed = useUi((s) => s.liveSpeed);
  const setUi = useUi((s) => s.set);
  const placarRef = useRef<HTMLDivElement>(null);

  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<'none' | 'end'>('none');
  /** parada obrigatória: intervalo ou lesão de um jogador do usuário */
  const [stop, setStop] = useState<{ kind: 'ht' } | { kind: 'inj'; pid: number } | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [goalFlash, setGoalFlash] = useState(0);
  const [sel, setSel] = useState<Pick | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [, setTick] = useState(0);
  const [cols] = useState(() => teamColors(m));
  const [nums] = useState(() => shirtNumbers(m));
  const [tab, setTab] = useState<'stats' | 'log'>('stats');

  // valores lidos dentro do loop
  const loop = useRef({ paused: false, speed, hold: 0, acc: 0, last: 0, endShown: false, feedKey: 0 });
  useEffect(() => {
    loop.current.paused = paused || !!stop || panel === 'end';
    loop.current.speed = speed;
  }, [paused, stop, panel, speed]);

  /** Eventos do motor: narração e placar. */
  const handleEvents = useCallback(
    (evs: MatchEvent[], tickMs: number) => {
      const items: FeedItem[] = [];
      for (const e of evs) {
        if (e.type === 'goal') {
          loop.current.hold = Math.max(1400, tickMs * 3);
          setGoalFlash((g) => g + 1);
          const pl = placarRef.current;
          if (pl) {
            pl.classList.remove('flash');
            void pl.offsetWidth;
            pl.classList.add('flash');
          }
        }
        // intervalo: o jogo para para o usuário mexer na tática e nas trocas
        if (e.type === 'ht' && m.manual) {
          loop.current.paused = true;
          setStop({ kind: 'ht' });
        }
        // lesão no time do usuário: o jogo para e o lesionado já fica escolhido para a troca
        if (e.type === 'inj' && m.manual && e.side === m.userSide && e.pid != null) {
          loop.current.paused = true;
          setStop({ kind: 'inj', pid: e.pid });
          setSel({ kind: 'on', side: m.userSide, id: e.pid });
        }
        // lances sem importância aparecem só às vezes, para a narração não correr demais
        if (e.txt && (e.imp >= 1 || Math.random() < 0.55)) items.push({ key: loop.current.feedKey++, e });
      }
      if (items.length) setFeed((f) => [...items.reverse(), ...f].slice(0, MAX_FEED));
      setTick((t) => t + 1);
    },
    [m],
  );

  // relógio da partida
  useEffect(() => {
    let raf = 0;
    const L = loop.current;
    const frame = (ts: number) => {
      const dt = Math.min(100, ts - (L.last || ts));
      L.last = ts;
      const tickMs = SPEEDS[L.speed][1];
      if (!L.paused && !m.ended) {
        if (L.hold > 0) L.hold -= dt;
        else {
          L.acc += dt;
          let guard = 0;
          while (L.acc >= tickMs && !m.ended && !L.paused && guard++ < 6) {
            L.acc -= tickMs;
            handleEvents(m.step(), tickMs);
            if (L.hold > 0) {
              L.acc = 0;
              break;
            }
          }
        }
      }
      if (m.ended && !L.endShown) {
        L.endShown = true;
        setSel(null);
        setTimeout(() => setPanel('end'), 900);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [m, handleEvents]);

  /** Pausar/continuar. Numa parada obrigatória, continuar segue o jogo. */
  const togglePause = () => {
    if (stop) {
      setStop(null);
      setPaused(false);
      return;
    }
    setPaused((p) => !p);
  };

  // espaço pausa; Esc desfaz a seleção
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && panel !== 'end' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'Escape') setSel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const user = m.sides[m.userSide];

  /** Junta duas escolhas: troca de posição, substituição ou ida para a vaga vazia. */
  const act = (a: Pick, b: Pick): boolean => {
    if (m.ended || a.side !== m.userSide || b.side !== m.userSide) return false;
    const P = (id: number) => m.W.pmap[id];
    if (a.kind === 'on' && b.kind === 'on') return m.swapPos(user, P(a.id), P(b.id));
    if (a.kind === 'on' && b.kind === 'slot') return m.moveTo(user, P(a.id), b.id);
    if (a.kind === 'slot' && b.kind === 'on') return m.moveTo(user, P(b.id), a.id);
    if ((a.kind === 'bench' && b.kind === 'on') || (a.kind === 'on' && b.kind === 'bench')) {
      const inP = P(a.kind === 'bench' ? a.id : b.id),
        outP = P(a.kind === 'on' ? a.id : b.id);
      if (user.subs >= MAX_SUBS) {
        toast('Você já fez as ' + MAX_SUBS + ' substituições.');
        return false;
      }
      if (m.doSub(user, outP, inP)) {
        handleEvents([m.events[m.events.length - 1]], 300);
        // trocou o lesionado: o jogo segue
        if (stop?.kind === 'inj' && stop.pid === outP.id) {
          setStop(null);
          setPaused(false);
        }
        return true;
      }
    }
    return false;
  };

  const tap = (p: Pick) => {
    if (!sel) return setSel(p);
    if (sel.kind === p.kind && sel.id === p.id) return setSel(null);
    // dois do banco ou duas vagas: troca a escolha
    if (sel.kind === p.kind && p.kind !== 'on') return setSel(p);
    if (act(sel, p)) setTick((t) => t + 1);
    setSel(null);
  };

  /** Toque curto seleciona; arrastar e soltar em outra ficha (ou no banco) faz a troca. */
  const onDown = (p: Pick, e: RPointerEvent) => {
    if (m.ended || e.button > 0) return;
    const x0 = e.clientX,
      y0 = e.clientY;
    const label = p.kind === 'slot' ? 'vaga' : m.W.pmap[p.id]?.n || '';
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_MIN) return;
      moved = true;
      setGhost({ x: ev.clientX, y: ev.clientY, label });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setGhost(null);
      if (!moved) return tap(p);
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-drop]');
      if (!el) return;
      const [kind, side, id] = el.dataset.drop!.split(':');
      const dst: Pick = { kind: kind as Pick['kind'], side: +side, id: +id };
      if (dst.kind === p.kind && dst.id === p.id) return;
      if (act(p, dst)) setTick((t) => t + 1);
      setSel(null);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setGhost(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const skip = () => {
    if (m.ended) return;
    setPaused(false);
    setStop(null);
    setSel(null);
    // daqui em diante as trocas do usuário ficam com a IA (inclusive a de quem está machucado)
    m.handOver();
    while (!m.ended)
      handleEvents(
        m.step().filter((e) => e.imp >= 2),
        1,
      );
    loop.current.hold = 0;
  };

  const close = () => {
    useLive.getState().stop();
    afterUserMatch(uf, m);
  };

  const [h, a] = m.sides.map((s) => s.club);
  const ko = m.ko && m.ko.leg === 2 ? m.ko.agg : null;
  const clock = m.ended
    ? 'Fim'
    : stop?.kind === 'ht'
      ? 'Intervalo'
      : Math.min(Math.floor(m.min) + 1, m.half === 1 ? 45 : 90) + (m.min > (m.half === 1 ? 45 : 90) ? '+' : '') + "'";
  const [x, y] = m.sides.map((s) => s.s);
  const tot = x.pt + y.pt || 1;
  const hint = !sel
    ? stop?.kind === 'ht'
      ? 'Intervalo: arraste reservas para o campo ou mude a tática.'
      : null
    : sel.kind === 'bench'
      ? `Toque em quem sai para ${m.W.pmap[sel.id]?.n} entrar.`
      : sel.kind === 'slot'
        ? 'Toque no jogador que vai ocupar a vaga.'
        : `${m.W.pmap[sel.id]?.n}: toque em outro jogador para trocar de posição ou num reserva para substituir.`;

  const injP = stop?.kind === 'inj' ? m.W.pmap[stop.pid] : null;
  const banner = stop ? (
    <>
      {stop.kind === 'ht' ? (
        <>
          <b>Intervalo</b>
          <span>
            {h.n} {m.sides[0].goals} x {m.sides[1].goals} {a.n}. Ajuste a tática e faça as trocas.
          </span>
          <button className="btn pri" onClick={togglePause}>
            Começar o 2º tempo
          </button>
        </>
      ) : (
        <>
          <b>✚ {injP?.n} se machucou</b>
          <span>
            {user.subs < MAX_SUBS
              ? 'Escolha no banco quem entra no lugar dele.'
              : 'Sem trocas restantes: ele segue em campo sem render.'}
          </span>
          <button className="btn" onClick={togglePause}>
            {user.subs < MAX_SUBS ? 'Seguir sem trocar' : 'Continuar'}
          </button>
        </>
      )}
    </>
  ) : null;

  const last = feed[0];
  const me = m.sides[m.userSide].club;
  const stats: [string, number, number, string?, string?][] = [
    ['Posse de bola', x.pt, y.pt, Math.round((x.pt / tot) * 100) + '%', Math.round((y.pt / tot) * 100) + '%'],
    ['Finalizações', x.sh, y.sh],
    ['No gol', x.sot, y.sot],
    ['Gols esperados (xG)', x.xg, y.xg, x.xg.toFixed(2), y.xg.toFixed(2)],
    ['Escanteios', x.cor, y.cor],
    ['Faltas', x.fou, y.fou],
    ['Cartões', x.yc + x.rc, y.yc + y.rc, x.yc + (x.rc ? '/' + x.rc + 'V' : ''), y.yc + (y.rc ? '/' + y.rc + 'V' : '')],
    ['Impedimentos', x.off, y.off],
  ];

  return (
    <div id="match" style={{ ['--hc' as string]: cols[0].f, ['--ac' as string]: cols[1].f }}>
      <div className="placar" ref={placarRef}>
        <div className="mycrest" title={me.n}>
          <Crest club={me} size={54} />
        </div>
        {ko && (
          <div className="agg">
            Ida: {ko[0]} x {ko[1]}
          </div>
        )}
        <div className="tm h">
          <span>{h.n}</span>
          <Crest club={h} size={40} />
        </div>
        <div className="led num" aria-live="polite">
          <span>{m.sides[0].goals}</span>
          <span className="sep">:</span>
          <span>{m.sides[1].goals}</span>
        </div>
        <div className="tm">
          <Crest club={a} size={40} />
          <span>{a.n}</span>
        </div>
        <div className="clock num">{clock}</div>
      </div>

      {banner ? (
        <div className={`mstopbar ${stop?.kind}`}>{banner}</div>
      ) : (
        <div className={`mticker ${last?.e.type === 'goal' ? 'goal' : ''}`} aria-live="polite">
          {last ? (
            <>
              <b className="num">{last.e.m}'</b>
              {last.e.side === 0 || last.e.side === 1 ? (
                <i className="dot" style={{ background: cols[last.e.side].f }} />
              ) : null}
              <span>{last.e.txt}</span>
            </>
          ) : (
            <span className="muted">A partida vai começar.</span>
          )}
        </div>
      )}

      <div className="mmain">
        <MatchPitch m={m} col={cols[m.userSide]} nums={nums} sel={sel} onDown={onDown} goalFlash={goalFlash} />
        <Reserves m={m} col={cols[m.userSide]} nums={nums} sel={sel} onDown={onDown} />
        <Opponent m={m} col={cols[1 - m.userSide]} nums={nums} />
        <TacticDock m={m} />
        <section className="mpanel mstats">
          <header>
            <div className="tabs2">
              <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>
                Estatísticas
              </button>
              <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
                Lances
              </button>
            </div>
          </header>
          {tab === 'stats' ? (
            <div className="mstatlist">
              <div className="mstat-h">
                <span>{h.s}</span>
                <span>{a.s}</span>
              </div>
              {stats.map(([label, va, vb, fa, fb]) => statItem(label, va, vb, fa, fb))}
            </div>
          ) : (
            <div className="feed">
              {feed.map(({ key, e }) => (
                <div
                  key={key}
                  className={`ev i${e.imp}${e.type === 'goal' ? ' goal' : ''}${e.type === 'yel' ? ' card-y' : ''}${e.type === 'red' ? ' card-r' : ''}`}
                >
                  <span className="m">{e.m}'</span>
                  <span>{e.txt}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mpanel mctl">
          <header>
            <h3>Partida</h3>
          </header>
          <button className={`btn big ${stop || paused ? 'pri' : ''}`} onClick={togglePause} disabled={m.ended}>
            {paused || stop ? '▶ Continuar' : '❚❚ Pausar'}
          </button>
          <div className="mspeed">
            <span className="muted">Velocidade</span>
            <div className="seg" aria-label="Velocidade">
              {SPEEDS.map((sp, i) => (
                <button key={i} className={i === speed ? 'on' : ''} onClick={() => setUi({ liveSpeed: i })}>
                  {sp[0]}x
                </button>
              ))}
            </div>
          </div>
          <button className="btn big" onClick={skip} disabled={m.ended}>
            Pular para o fim ⏭
          </button>
          {hint && <p className="mhint">{hint}</p>}
        </section>
      </div>

      {ghost && (
        <div className="dragghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.label}
        </div>
      )}
      {panel === 'end' && <LiveEndPanel W={W} m={m} onClose={close} />}
    </div>
  );
}
