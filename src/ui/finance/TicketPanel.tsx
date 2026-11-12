import { DIV_NAME, expectedGate, remainingHomeGames, TICKET, type World } from '@/core';
import { useGame } from '@/store/gameStore';
import { int, isLight, money } from '../format';

/** Lugares desenhados no estádio: anéis (de dentro para fora) ao redor do campo. */
const SEATS = (() => {
  const out: { x: number; y: number; order: number }[] = [];
  const rings = 4;
  for (let r = 0; r < rings; r++) {
    const rx = 118 + r * 15,
      ry = 64 + r * 13,
      n = 44 + r * 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // distância da arquibancada principal (embaixo, no centro): enche primeiro perto dela e nos anéis de baixo
      const fromMain = Math.abs(((a - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      out.push({ x: 180 + Math.cos(a) * rx, y: 110 + Math.sin(a) * ry, order: r * 10 + fromMain });
    }
  }
  return out.sort((p, q) => p.order - q.order);
})();

const delta = (now: number, base: number) => {
  if (!base || now === base) return null;
  const d = Math.round((now / base - 1) * 100);
  return <span className={d > 0 ? 'dup' : 'ddown'}>{(d > 0 ? '+' : '') + d}%</span>;
};

/** Preço do ingresso: o estádio enche ou esvazia conforme o preço. */
export function TicketPanel({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const me = W.clubs[W.user!];
  const std = TICKET[me.div];
  const price = W.ticket || std;
  const min = Math.round(std * 0.4),
    max = Math.round(std * 3);
  const nextHome = remainingHomeGames(W)[0];
  const rivals = W.clubs.filter((c) => c.div === me.div && c.id !== me.id);
  const oppRep = nextHome
    ? W.clubs[nextHome.f.a].rep
    : rivals.reduce((t, c) => t + c.rep, 0) / Math.max(1, rivals.length);
  const gStd = expectedGate(me, oppRep, std);
  const g = expectedGate(me, oppRep, price);
  const occ = g.att / me.cap;
  const filled = Math.round(occ * SEATS.length);
  const fan =
    isLight(me.c1) && isLight(me.c2) ? '#ffd23f' : isLight(me.c1) ? me.c1 : me.c2 !== '#111111' ? me.c2 : me.c1;
  const set = (v: number) => mutate((W) => (W.ticket = Math.max(min, Math.min(max, Math.round(v)))));
  const step = std >= 30 ? 5 : 1;

  return (
    <div className="panel ticket">
      <h3>
        <span>Preço do ingresso</span>
        <small>{nextHome ? `próximo jogo em casa: ${W.clubs[nextHome.f.a].n}` : 'jogo médio em casa'}</small>
      </h3>
      <div className="tk-body">
        <svg
          viewBox="0 0 360 220"
          className="tk-stadium"
          role="img"
          aria-label={`Estádio ${Math.round(occ * 100)}% cheio`}
        >
          <rect x={112} y={72} width={136} height={76} rx={6} className="tk-pitch" />
          <line x1={180} x2={180} y1={72} y2={148} className="tk-line" />
          <circle cx={180} cy={110} r={12} className="tk-line" fill="none" />
          {SEATS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={3.4}
              className="tk-seat"
              style={{ fill: i < filled ? fan : undefined, opacity: i < filled ? 1 : undefined }}
            />
          ))}
          <text x={180} y={116} textAnchor="middle" className="tk-occ">
            {Math.round(occ * 100)}%
          </text>
        </svg>
        <div className="tk-side">
          <div className="tk-price">
            <button className="btn" onClick={() => set(price - step)} disabled={price <= min} aria-label="Baixar preço">
              −
            </button>
            <div>
              <b className="num">R$ {price}</b>
              <span className="muted">
                {price === std ? `preço padrão da ${DIV_NAME[me.div]}` : `padrão: R$ ${std}`}
              </span>
            </div>
            <button className="btn" onClick={() => set(price + step)} disabled={price >= max} aria-label="Subir preço">
              +
            </button>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={price}
            onChange={(e) => set(+e.target.value)}
            aria-label="Preço do ingresso"
          />
          <div className="tk-presets">
            {[
              ['Popular', Math.round(std * 0.7)],
              ['Padrão', std],
              ['Premium', Math.round(std * 1.6)],
            ].map(([l, v]) => (
              <button key={l} className={`btn sm ${price === v ? 'on' : ''}`} onClick={() => set(v as number)}>
                {l} <span className="muted">R$ {v}</span>
              </button>
            ))}
          </div>
          <div className="tk-stats">
            <div>
              <span className="kl">Público</span>
              <b className="num">{int(g.att)}</b>
              {delta(g.att, gStd.att)}
            </div>
            <div>
              <span className="kl">Renda por jogo</span>
              <b className="num">{money(g.rev)}</b>
              {delta(g.rev, gStd.rev)}
            </div>
          </div>
        </div>
      </div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
        Previsão média; o público real varia um pouco a cada jogo. Capacidade do {me.std}: {int(me.cap)} lugares.
      </p>
    </div>
  );
}
