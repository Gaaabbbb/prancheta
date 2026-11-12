import { useState } from 'react';
import { SEASON_DAYS, type FinDay, type World } from '@/core';
import { money } from '../format';

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

export type FinChartMode = 'bal' | 'day';

interface Props {
  W: World;
  log: FinDay[];
  startBal: number;
  projection: number;
  mode: FinChartMode;
}

/** Saldo ao longo da temporada (com projeção) ou receitas e despesas de cada dia. */
export function FinanceChart({ W, log, startBal, projection, mode }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const x = (d: number) => PAD.l + (d / SEASON_DAYS) * (W_ - PAD.l - PAD.r);
  const byDay = new Map(log.map((it) => [it.d, it]));

  let lo: number, hi: number;
  if (mode === 'bal') {
    const vals = [startBal, projection, ...log.map((it) => it.bal)];
    lo = Math.min(...vals);
    hi = Math.max(...vals);
    const m = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
    lo -= m;
    hi += m;
  } else {
    lo = Math.min(0, ...log.map((it) => it.sal + it.inv));
    hi = Math.max(0, ...log.map((it) => it.bil + it.pat));
    if (lo === hi) hi = 1;
  }
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H_ - PAD.t - PAD.b);
  const yt = ticks(lo, hi);

  const last = log[log.length - 1];
  const pts: [number, number][] = [[0, startBal], ...log.map((it) => [it.d, it.bal] as [number, number])];
  const path = pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const lastD = last ? last.d : 0;
  const lastBal = last ? last.bal : startBal;

  const hv = hover != null ? byDay.get(hover) : undefined;
  const bw = Math.max(3, ((W_ - PAD.l - PAD.r) / SEASON_DAYS) * 0.6);

  return (
    <div className="fchart">
      <svg
        viewBox={`0 0 ${W_} ${H_}`}
        role="img"
        aria-label={mode === 'bal' ? 'Saldo em caixa ao longo da temporada' : 'Receitas e despesas por dia'}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W_;
          const d = Math.round(((px - PAD.l) / (W_ - PAD.l - PAD.r)) * SEASON_DAYS);
          setHover(d >= 1 && d <= SEASON_DAYS ? d : null);
        }}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W_ - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'zero' : 'gl'} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="ax">
              {short(v)}
            </text>
          </g>
        ))}
        {[1, 10, 20, 30, 40].map((d) => (
          <text key={d} x={x(d)} y={H_ - 8} textAnchor="middle" className="ax">
            {d === 1 ? 'dia 1' : d}
          </text>
        ))}
        {mode === 'bal' ? (
          <>
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
          </>
        ) : (
          log.map((it) => {
            const inc = it.bil + it.pat,
              out = it.sal + it.inv;
            return (
              <g key={it.d}>
                <rect
                  x={x(it.d) - bw / 2}
                  y={y(inc)}
                  width={bw}
                  height={Math.max(0, y(0) - y(inc) - 1)}
                  rx={2}
                  className="inc"
                />
                <rect
                  x={x(it.d) - bw / 2}
                  y={y(0) + 1}
                  width={bw}
                  height={Math.max(0, y(out) - y(0) - 1)}
                  rx={2}
                  className="out"
                />
              </g>
            );
          })
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H_ - PAD.b} className="cross" />}
      </svg>
      {hover != null && (
        <div className="ftip" style={{ left: `${(x(hover) / W_) * 100}%` }}>
          <b>Dia {hover}</b>
          {hv ? (
            <>
              {hv.att != null && (
                <div className="muted">
                  Em casa contra {W.clubs[hv.opp!]?.n}: {hv.att.toLocaleString('pt-BR')} torcedores
                </div>
              )}
              {hv.bil !== 0 && <div>Bilheteria {money(hv.bil)}</div>}
              <div>Patrocínio {money(hv.pat)}</div>
              <div>Salários {money(hv.sal)}</div>
              {hv.inv !== 0 && <div>Investimentos {money(hv.inv)}</div>}
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
