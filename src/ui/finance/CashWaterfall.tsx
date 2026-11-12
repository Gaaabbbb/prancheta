import { useState } from 'react';
import { money } from '../format';

const W_ = 640,
  H_ = 230,
  PAD = { l: 8, r: 8, t: 26, b: 40 };

export interface CashFlow {
  start: number;
  bil: number;
  pat: number;
  bon: number;
  /** compensações recebidas (multas a favor) */
  inMul: number;
  /** compras (negativo) e vendas (positivo) de jogadores */
  tra: number;
  pre: number;
  sal: number;
  /** multas pagas (negativo) */
  outMul: number;
  now: number;
  forecast: number;
}

interface Step {
  label: string;
  kind: 'total' | 'up' | 'down' | 'forecast';
  from: number;
  to: number;
  hint: string;
}

const short = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',') + ' mi' : Math.round(a / 1e3) + ' mil';
  return (v < 0 ? '−' : '') + s;
};

/** Cascata do caixa: com quanto começou, o que entrou, o que saiu, quanto tem agora e a previsão. */
export function CashWaterfall({ flow }: { flow: CashFlow }) {
  const [hover, setHover] = useState<number | null>(null);
  const steps: Step[] = [];
  let acc = flow.start;
  steps.push({
    label: 'Início da temporada',
    kind: 'total',
    from: 0,
    to: acc,
    hint: 'Caixa no primeiro dia da temporada',
  });
  const add = (label: string, v: number, hint: string) => {
    if (!v) return;
    steps.push({ label, kind: v > 0 ? 'up' : 'down', from: acc, to: acc + v, hint });
    acc += v;
  };
  add('Bilheteria', flow.bil, 'Renda dos jogos em casa');
  add('Patrocínio', flow.pat + flow.bon, 'Parcelas mensais dos patrocinadores');
  add('Premiação', flow.pre, 'Prêmios por fase alcançada na Copa do Brasil, Libertadores e Sul-Americana');
  add('Transferências', flow.tra, 'Vendas menos compras de jogadores');
  add('Compensações', flow.inMul, 'Multas pagas ao clube por patrocinadores que romperam');
  add('Salários', flow.sal, 'Salários do elenco profissional, pagos uma vez por mês');
  add('Multas', flow.outMul, 'Multas pagas para rescindir contratos');
  steps.push({ label: 'Caixa hoje', kind: 'total', from: 0, to: flow.now, hint: 'Dinheiro disponível agora' });
  steps.push({
    label: 'Previsão no fim',
    kind: 'forecast',
    from: 0,
    to: flow.forecast,
    hint: 'Se nada mudar: caixa de hoje mais o que ainda falta receber e pagar na temporada',
  });

  const vals = steps.flatMap((s) => [s.from, s.to]);
  const lo = Math.min(0, ...vals),
    hi = Math.max(1, ...vals);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H_ - PAD.t - PAD.b);
  const cw = (W_ - PAD.l - PAD.r) / steps.length;
  const bw = Math.min(54, cw * 0.62);

  return (
    <div className="fchart">
      <svg viewBox={`0 0 ${W_} ${H_}`} role="img" aria-label="Como o caixa mudou na temporada">
        <line x1={PAD.l} x2={W_ - PAD.r} y1={y(0)} y2={y(0)} className="zero" />
        {steps.map((s, i) => {
          const x = PAD.l + cw * i + (cw - bw) / 2;
          const top = y(Math.max(s.from, s.to)),
            bot = y(Math.min(s.from, s.to));
          const next = steps[i + 1];
          return (
            <g key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.l + cw * i} y={PAD.t - 20} width={cw} height={H_ - PAD.t + 20} fill="transparent" />
              {hover === i && (
                <rect x={PAD.l + cw * i + 2} y={PAD.t - 20} width={cw - 4} height={H_ - PAD.t + 18} className="hov" />
              )}
              <rect x={x} y={top} width={bw} height={Math.max(2, bot - top)} rx={3} className={`wf-${s.kind}`} />
              {next && next.kind !== 'total' && next.kind !== 'forecast' && (
                <line x1={x + bw} x2={x + cw} y1={y(s.to)} y2={y(s.to)} className="wf-link" />
              )}
              <text x={x + bw / 2} y={top - 6} textAnchor="middle" className="wf-val">
                {s.kind === 'up' ? '+' : ''}
                {short(s.kind === 'up' || s.kind === 'down' ? s.to - s.from : s.to)}
              </text>
              <text x={x + bw / 2} y={H_ - 22} textAnchor="middle" className="ax">
                {s.label.split(' ')[0]}
              </text>
              <text x={x + bw / 2} y={H_ - 9} textAnchor="middle" className="ax">
                {s.label.split(' ').slice(1).join(' ')}
              </text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="ftip" style={{ left: `${((PAD.l + cw * (hover + 0.5)) / W_) * 100}%` }}>
          <b>{steps[hover].label}</b>
          <div>
            {steps[hover].kind === 'up' || steps[hover].kind === 'down'
              ? money(steps[hover].to - steps[hover].from)
              : money(steps[hover].to)}
          </div>
          <div className="muted">{steps[hover].hint}</div>
        </div>
      )}
    </div>
  );
}
