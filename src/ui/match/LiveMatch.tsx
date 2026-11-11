import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchEvent, Side } from '@/core';
import { afterUserMatch } from '@/app/gameFlow';
import { useLive } from '@/store/liveStore';
import { useUi } from '@/store/uiStore';
import { useWorld } from '@/store/gameStore';
import { Crest } from '../components/Crest';
import { colorDist } from '../format';
import { PitchRenderer } from './pitchRenderer';
import { LiveTacticsPanel } from './LiveTacticsPanel';
import { LiveEndPanel } from './LiveEndPanel';
import { SPEEDS } from './speeds';

const MAX_FEED = 120;

interface FeedItem {
  key: number;
  e: MatchEvent;
}

const statRow = (label: string, a: number, b: number, colA: string, colB: string, fa?: string, fb?: string) => {
  const s = a + b || 1;
  return (
    <div className="st" key={label}>
      <div className="lb">
        <b>{fa ?? a}</b>
        <span>{label}</span>
        <b>{fb ?? b}</b>
      </div>
      <div className="dual">
        <i style={{ width: `${(a / s) * 100}%`, background: colA === '#111111' ? '#ccc' : colA }} />
        <i style={{ flex: 1, background: colB === '#111111' ? '#666' : colB, opacity: 0.8 }} />
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const momRef = useRef<HTMLCanvasElement>(null);
  const placarRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PitchRenderer | null>(null);

  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<'none' | 'tac' | 'end'>('none');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [, setTick] = useState(0);

  const [cols] = useState(() => PitchRenderer.pickColors(m, colorDist));

  // valores lidos dentro do loop de animação
  const loop = useRef({ paused: false, speed, hold: 0, acc: 0, last: 0, endShown: false, feedKey: 0, lastStats: 0 });
  useEffect(() => {
    loop.current.paused = paused || panel !== 'none';
    loop.current.speed = speed;
  }, [paused, panel, speed]);

  /** Processa eventos do motor: campo, narração, placar. */
  const handleEvents = useCallback(
    (evs: MatchEvent[], tickMs: number) => {
      const r = rendererRef.current;
      r?.onEvents(evs, tickMs);
      const items: FeedItem[] = [];
      for (const e of evs) {
        if (e.type === 'goal') {
          loop.current.hold = Math.max(1200, tickMs * 3);
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
      if (m.events.length - loop.current.lastStats > 4 || evs.some((e) => e.type === 'goal')) {
        loop.current.lastStats = m.events.length;
        r?.drawMom();
      }
      setTick((t) => t + 1);
    },
    [m],
  );

  // monta o renderizador e o loop
  useEffect(() => {
    const r = new PitchRenderer(W, m, canvasRef.current!, wrapRef.current!, momRef.current!, cols);
    rendererRef.current = r;
    const onResize = () => r.resize();
    window.addEventListener('resize', onResize);
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
      r.paused = L.paused;
      r.animate(dt, tickMs);
      r.draw();
      if (m.ended && !L.endShown) {
        L.endShown = true;
        setTimeout(() => setPanel('end'), 900);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [W, m, cols, handleEvents]);

  // espaço pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && panel === 'none' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  const skip = () => {
    if (m.ended) return;
    setPaused(false);
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
  const user: Side = m.sides[m.userSide];
  const ko = m.ko && m.ko.leg === 2 ? m.ko.agg : null;
  const clock = m.ended
    ? 'Fim'
    : Math.min(Math.floor(m.min) + 1, m.half === 1 ? 45 : 90) + (m.min > (m.half === 1 ? 45 : 90) ? '+' : '') + "'";
  const [x, y] = m.sides.map((s) => s.s);
  const tot = x.pt + y.pt || 1;

  return (
    <div id="match">
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
      <div className="mbody">
        <div className="mleft">
          <div className="pitchwrap" ref={wrapRef}>
            <canvas id="pitch" ref={canvasRef} />
          </div>
          <canvas className="mom" ref={momRef} />
          <div className="mstats">
            {statRow(
              'Posse de bola',
              x.pt,
              y.pt,
              cols[0].f,
              cols[1].f,
              Math.round((x.pt / tot) * 100) + '%',
              Math.round((y.pt / tot) * 100) + '%',
            )}
            {statRow('Finalizações', x.sh, y.sh, cols[0].f, cols[1].f)}
            {statRow('No gol', x.sot, y.sot, cols[0].f, cols[1].f)}
            {statRow('Gols esperados (xG)', x.xg, y.xg, cols[0].f, cols[1].f, x.xg.toFixed(2), y.xg.toFixed(2))}
            {statRow('Escanteios', x.cor, y.cor, cols[0].f, cols[1].f)}
            {statRow('Faltas', x.fou, y.fou, cols[0].f, cols[1].f)}
            {statRow(
              'Cartões',
              x.yc + x.rc,
              y.yc + y.rc,
              cols[0].f,
              cols[1].f,
              x.yc + (x.rc ? ' / ' + x.rc + 'V' : ''),
              y.yc + (y.rc ? ' / ' + y.rc + 'V' : ''),
            )}
            {statRow('Impedimentos', x.off, y.off, cols[0].f, cols[1].f)}
          </div>
        </div>
        <div className="feed" aria-live="polite">
          {/* mais recente primeiro; o CSS (column-reverse) mostra embaixo */}
          {feed.map(({ key, e }) => (
            <div
              key={key}
              className={`ev i${e.imp}${e.type === 'goal' ? ' goal' : ''}${e.type === 'yel' ? ' card-y' : ''}${e.type === 'red' ? ' card-r' : ''}`}
            >
              <span className="m">{e.m}'</span>
              <span>
                {e.imp >= 1 && !['ht', 'ft', 'kick', 'st2'].includes(e.type) && (
                  <i
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: cols[e.side === 0 ? 0 : 1].f,
                      marginRight: 6,
                      border: '1px solid #fff5',
                    }}
                  />
                )}
                {e.txt}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mctl">
        <button className="btn" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Continuar' : 'Pausar'}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          Velocidade
        </span>
        <div className="seg">
          {SPEEDS.map((s, i) => (
            <button key={i} className={i === speed ? 'on' : ''} onClick={() => setUi({ liveSpeed: i })}>
              {s[0]}x
            </button>
          ))}
        </div>
        <span className="sp" />
        <span className="muted" style={{ fontSize: 13 }}>
          Substituições: {user.subs} de 5
        </span>
        <button className="btn" onClick={() => setPanel('tac')} disabled={m.ended}>
          Tática e substituições
        </button>
        <button className="btn" onClick={skip}>
          Pular para o fim
        </button>
      </div>
      {panel === 'tac' && (
        <LiveTacticsPanel m={m} onEvent={(e) => handleEvents([e], 300)} onClose={() => setPanel('none')} />
      )}
      {panel === 'end' && <LiveEndPanel W={W} m={m} onClose={close} />}
    </div>
  );
}
