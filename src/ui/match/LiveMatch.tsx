import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MAX_SUBS, type MatchEvent } from '@/core';
import { afterUserMatch } from '@/app/gameFlow';
import { useLive } from '@/store/liveStore';
import { toast, useUi } from '@/store/uiStore';
import { useWorld } from '@/store/gameStore';
import { Crest } from '../components/Crest';
import { BenchList } from './BenchList';
import { teamColors } from './colors';
import { LiveTacticsPanel } from './LiveTacticsPanel';
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
  const [panel, setPanel] = useState<'none' | 'tac' | 'log' | 'end'>('none');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [goalFlash, setGoalFlash] = useState(0);
  const [sel, setSel] = useState<Pick | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [, setTick] = useState(0);
  const [cols] = useState(() => teamColors(m));

  // valores lidos dentro do loop
  const loop = useRef({ paused: false, speed, hold: 0, acc: 0, last: 0, endShown: false, feedKey: 0 });
  useEffect(() => {
    loop.current.paused = paused || panel === 'tac' || panel === 'end';
    loop.current.speed = speed;
  }, [paused, panel, speed]);

  /** Eventos do motor: narração e placar. */
  const handleEvents = useCallback((evs: MatchEvent[], tickMs: number) => {
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
      // lances sem importância aparecem só às vezes, para a narração não correr demais
      if (e.txt && (e.imp >= 1 || Math.random() < 0.55)) items.push({ key: loop.current.feedKey++, e });
    }
    if (items.length) setFeed((f) => [...items.reverse(), ...f].slice(0, MAX_FEED));
    setTick((t) => t + 1);
  }, []);

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
          while (L.acc >= tickMs && !m.ended && guard++ < 6) {
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

  // espaço pausa; Esc desfaz a seleção
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        panel !== 'tac' &&
        panel !== 'end' &&
        (document.activeElement as HTMLElement)?.tagName !== 'INPUT'
      ) {
        e.preventDefault();
        setPaused((p) => !p);
      }
      if (e.key === 'Escape') setSel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

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
    setSel(null);
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
    : Math.min(Math.floor(m.min) + 1, m.half === 1 ? 45 : 90) + (m.min > (m.half === 1 ? 45 : 90) ? '+' : '') + "'";
  const [x, y] = m.sides.map((s) => s.s);
  const tot = x.pt + y.pt || 1;
  const hint = !sel
    ? null
    : sel.kind === 'bench'
      ? `Toque em quem sai para ${m.W.pmap[sel.id]?.n} entrar.`
      : sel.kind === 'slot'
        ? 'Toque no jogador que vai ocupar a vaga.'
        : `${m.W.pmap[sel.id]?.n}: toque em outro jogador para trocar de posição ou num reserva para substituir.`;

  return (
    <div id="match" style={{ ['--hc' as string]: cols[0].f, ['--ac' as string]: cols[1].f }}>
      <div className="placar" ref={placarRef}>
        {ko && (
          <div className="agg">
            Ida: {ko[0]} x {ko[1]}
          </div>
        )}
        <div className="tm h">
          <span>{h.n}</span>
          <Crest club={h} size={46} />
        </div>
        <div className="led num" aria-live="polite">
          <span>{m.sides[0].goals}</span>
          <span className="sep">:</span>
          <span>{m.sides[1].goals}</span>
        </div>
        <div className="tm">
          <Crest club={a} size={46} />
          <span>{a.n}</span>
        </div>
        <div className="clock num">{clock}</div>
      </div>

      <div className="mstrip">
        {statItem('Posse', x.pt, y.pt, Math.round((x.pt / tot) * 100) + '%', Math.round((y.pt / tot) * 100) + '%')}
        {statItem('Finalizações', x.sh, y.sh)}
        {statItem('No gol', x.sot, y.sot)}
        {statItem('xG', x.xg, y.xg, x.xg.toFixed(2), y.xg.toFixed(2))}
        {statItem('Escanteios', x.cor, y.cor)}
        {statItem('Faltas', x.fou, y.fou)}
        {statItem(
          'Cartões',
          x.yc + x.rc,
          y.yc + y.rc,
          x.yc + (x.rc ? '/' + x.rc + 'V' : ''),
          y.yc + (y.rc ? '/' + y.rc + 'V' : ''),
        )}
      </div>

      <div className="mgrid">
        <BenchList m={m} s={m.sides[0]} col={cols[0]} sel={sel} onDown={onDown} />
        <MatchPitch m={m} cols={cols} sel={sel} feed={feed} onDown={onDown} goalFlash={goalFlash} />
        <BenchList m={m} s={m.sides[1]} col={cols[1]} sel={sel} onDown={onDown} />
      </div>

      <div className="mctl">
        <button className="btn" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Continuar' : 'Pausar'}
        </button>
        <div className="seg" aria-label="Velocidade">
          {SPEEDS.map((s, i) => (
            <button key={i} className={i === speed ? 'on' : ''} onClick={() => setUi({ liveSpeed: i })}>
              {s[0]}x
            </button>
          ))}
        </div>
        <span className="mhint">{hint}</span>
        <button className="btn" onClick={() => setPanel(panel === 'log' ? 'none' : 'log')}>
          Lances
        </button>
        <button className="btn" onClick={() => setPanel('tac')} disabled={m.ended}>
          Tática
        </button>
        <button className="btn" onClick={skip} disabled={m.ended}>
          Pular para o fim
        </button>
      </div>

      {ghost && (
        <div className="dragghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.label}
        </div>
      )}
      {panel === 'log' && (
        <div className="side-panel logpanel">
          <div className="mh" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h2 style={{ flex: 1 }}>Lances</h2>
            <button className="btn pri" onClick={() => setPanel('none')}>
              Fechar
            </button>
          </div>
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
        </div>
      )}
      {panel === 'tac' && <LiveTacticsPanel m={m} onClose={() => setPanel('none')} />}
      {panel === 'end' && <LiveEndPanel W={W} m={m} onClose={close} />}
    </div>
  );
}
