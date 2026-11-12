import { useState } from 'react';
import { dateOf, SEASON_DAYS, type FinDay, type World } from '@/core';
import { money } from '../format';
import { MONTH_LONG, MONTH_SHORT, monthBuckets } from '../finance/months';

const W_ = 640,
  H_ = 220,
  PAD = { l: 64, r: 14, t: 12, b: 26 };

/** Valores "redondos" para o eixo. */
const ticks = (lo: number, hi: number, n = 4): number[] => {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v));
  return out;
};

const short = (v: number) => {
  const a = Math.abs(v);
  const s =
    a >= 1e6
      ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' mi'
      : a >= 1e3
        ? Math.round(a / 1e3) + ' mil'
        : String(Math.round(a));
  return (v < 0 ? '−' : '') + 'R$ ' + s;
};

export type FinChartMode = 'bal' | 'month';

interface Props {
  W: World;
  log: FinDay[];
  startBal: number;
  projection: number;
  mode: FinChartMode;
}

/** Saldo ao longo da temporada (com projeção) ou receitas e despesas de cada mês. */
export function FinanceChart({ W, log, startBal, projection, mode }: Props) {
  return mode === 'bal' ? (
    <BalanceChart W={W} log={log} startBal={startBal} projection={projection} />
  ) : (
    <MonthChart W={W} log={log} />
  );
}

function Axis({ yt, y }: { yt: number[]; y: (v: number) => number }) {
  return (
    <>
      {yt.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W_ - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'zero' : 'gl'} />
          <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="ax">
            {short(v)}
          </text>
        </g>
      ))}
    </>
  );
}

function BalanceChart({ W, log, startBal, projection }: Omit<Props, 'mode'>) {
  const [hover, setHover] = useState<number | null>(null);
  const x = (d: number) => PAD.l + (d / SEASON_DAYS) * (W_ - PAD.l - PAD.r);
  const byDay = new Map(log.map((it) => [it.d, it]));
  const vals = [startBal, projection, ...log.map((it) => it.bal)];
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  const m = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= m;
  hi += m;
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H_ - PAD.t - PAD.b);
  const last = log[log.length - 1];
  const pts: [number, number][] = [[0, startBal], ...log.map((it) => [it.d, it.bal] as [number, number])];
  const path = pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const lastD = last ? last.d : 0;
  const lastBal = last ? last.bal : startBal;
  const hv = hover != null ? byDay.get(hover) : undefined;
  // marcas de mês no eixo x
  const monthTicks: { d: number; m: number }[] = [];
  for (let d = 1; d <= SEASON_DAYS; d++) {
    const mo = dateOf(W, d).getMonth();
    if (d === 1 || mo !== dateOf(W, d - 1).getMonth()) monthTicks.push({ d, m: mo });
  }

  return (
    <div className="fchart">
      <svg
        viewBox={`0 0 ${W_} ${H_}`}
        role="img"
        aria-label="Saldo em caixa ao longo da temporada"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W_;
          const d = Math.round(((px - PAD.l) / (W_ - PAD.l - PAD.r)) * SEASON_DAYS);
          setHover(d >= 1 && d <= SEASON_DAYS ? d : null);
        }}
      >
        <Axis yt={ticks(lo, hi)} y={y} />
        {monthTicks.map(({ d, m }) => (
          <text key={d} x={x(d)} y={H_ - 8} textAnchor="middle" className="ax">
            {MONTH_SHORT[m]}
          </text>
        ))}
        {lastD < SEASON_DAYS && (
          <line x1={x(lastD)} y1={y(lastBal)} x2={x(SEASON_DAYS)} y2={y(projection)} className="proj" />
        )}
        <path d={path} className="bal" />
        <circle cx={x(lastD)} cy={y(lastBal)} r={4} className="dot" />
        {lastD < SEASON_DAYS && (
          <text x={x(SEASON_DAYS) - 4} y={y(projection) - 8} textAnchor="end" className="lbl">
            projeção {money(projection)}
          </text>
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H_ - PAD.b} className="cross" />}
      </svg>
      {hover != null && (
        <div className="ftip" style={{ left: `${(x(hover) / W_) * 100}%` }}>
          <b>
            Rodada {hover} · {dateOf(W, hover).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </b>
          {hv ? (
            <>
              {hv.att != null && (
                <div className="muted">
                  Em casa contra {W.clubs[hv.opp!]?.n}: {hv.att.toLocaleString('pt-BR')} torcedores
                </div>
              )}
              {hv.bil !== 0 && <div>Bilheteria {money(hv.bil)}</div>}
              {hv.pat !== 0 && <div>Patrocínio (parcela) {money(hv.pat)}</div>}
              {!!hv.bon && <div>Bônus por vitória {money(hv.bon)}</div>}
              {hv.sal !== 0 && <div>Salários do mês {money(hv.sal)}</div>}
              {!!hv.mul && <div>Multas e rescisões {money(hv.mul)}</div>}
              <div className="sum">Saldo {money(hv.bal)}</div>
            </>
          ) : (
            <div className="muted">{hover > lastD ? 'Ainda não jogado' : 'Sem registro'}</div>
          )}
        </div>
      )}
    </div>
  );
}

function MonthChart({ W, log }: { W: World; log: FinDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const months = monthBuckets(W, log);
  const first = dateOf(W, 1).getMonth(),
    last = dateOf(W, SEASON_DAYS).getMonth();
  const cats = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const byM = new Map(months.map((b) => [b.m, b]));
  const inc = (m: number) => {
    const b = byM.get(m);
    return b ? b.bil + b.pat + b.bon + Math.max(0, b.mul) : 0;
  };
  const out = (m: number) => {
    const b = byM.get(m);
    return b ? b.sal + Math.min(0, b.mul) : 0;
  };
  const lo = Math.min(0, ...cats.map(out)),
    hi = Math.max(1, ...cats.map(inc));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H_ - PAD.t - PAD.b);
  const cw = (W_ - PAD.l - PAD.r) / cats.length;
  const cx = (i: number) => PAD.l + cw * (i + 0.5);
  const bw = Math.min(26, cw * 0.32);
  const hb = hover != null ? byM.get(hover) : undefined;

  return (
    <div className="fchart">
      <svg
        viewBox={`0 0 ${W_} ${H_}`}
        role="img"
        aria-label="Receitas e despesas por mês"
        onMouseLeave={() => setHover(null)}
      >
        <Axis yt={ticks(lo, hi)} y={y} />
        {cats.map((m, i) => (
          <g key={m} onMouseEnter={() => setHover(m)}>
            <rect x={cx(i) - cw / 2} y={PAD.t} width={cw} height={H_ - PAD.t - PAD.b} fill="transparent" />
            {hover === m && (
              <rect x={cx(i) - cw / 2 + 2} y={PAD.t} width={cw - 4} height={H_ - PAD.t - PAD.b} className="hov" />
            )}
            <rect
              x={cx(i) - bw - 1}
              y={y(inc(m))}
              width={bw}
              height={Math.max(0, y(0) - y(inc(m)))}
              rx={3}
              className="inc"
            />
            <rect x={cx(i) + 1} y={y(0)} width={bw} height={Math.max(0, y(out(m)) - y(0))} rx={3} className="out" />
            <text x={cx(i)} y={H_ - 8} textAnchor="middle" className="ax">
              {MONTH_SHORT[m]}
            </text>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div className="ftip" style={{ left: `${(cx(cats.indexOf(hover)) / W_) * 100}%` }}>
          <b>{MONTH_LONG[hover]}</b>
          {hb ? (
            <>
              <div>
                Bilheteria {money(hb.bil)} ({hb.games.length} jogo(s) em casa)
              </div>
              <div>Patrocínio {money(hb.pat + hb.bon)}</div>
              <div>Salários {money(hb.sal)}</div>
              {!!hb.mul && <div>Multas e rescisões {money(hb.mul)}</div>}
              <div className="sum">Resultado {money(hb.net)}</div>
            </>
          ) : (
            <div className="muted">Ainda não jogado</div>
          )}
        </div>
      )}
    </div>
  );
}
