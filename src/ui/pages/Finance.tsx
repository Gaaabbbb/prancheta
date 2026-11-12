import { Fragment, useState } from 'react';
import {
  dateOf,
  DIV_NAME,
  isDays,
  isPayday,
  seasonLastDay,
  unitTxt,
  monthlyWages,
  PAYDAYS,
  POS_GROUP,
  seasonProjection,
  seasonStartBalance,
  sponsorAnnual,
  squad,
  type World,
} from '@/core';
import { useUi, type FinTab } from '@/store/uiStore';
import { PosTag } from '../components/Badges';
import { FinanceChart, type FinChartMode } from '../components/FinanceChart';
import { MONTH_LONG, monthBuckets } from '../finance/months';
import { SponsorsTab } from '../finance/SponsorsTab';
import { CashWaterfall, type CashFlow } from '../finance/CashWaterfall';
import { TicketPanel } from '../finance/TicketPanel';
import { int, money } from '../format';
import type { PageProps } from './types';

const GROUPS = ['Goleiros', 'Defesa', 'Meio-campo', 'Ataque'];
const TABS: [FinTab, string][] = [
  ['sum', 'Resumo'],
  ['spon', 'Patrocínio'],
  ['ledger', 'Extrato mensal'],
];

const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) => (
  <div className="panel kpi">
    <span className="kl">{label}</span>
    <span className={`kv2 ${tone || ''}`}>{value}</span>
    {sub && <span className="ks">{sub}</span>}
  </div>
);

const signed = (v: number) => (v > 0 ? '+' : '') + money(v);
const neg = (v: number) => (v ? money(v) : '');

export function Finance({ W }: PageProps) {
  const tab = useUi((s) => s.finTab);
  const setUi = useUi((s) => s.set);
  const me = W.clubs[W.user!];
  const f = W.fin || {};
  const rec = (f.bil || 0) + (f.pat || 0) + (f.bon || 0) + Math.max(0, f.mul || 0) + Math.max(0, f.tra || 0);
  const des = (f.sal || 0) + Math.min(0, f.mul || 0) + Math.min(0, f.tra || 0);
  const start = seasonStartBalance(W);
  const proj = seasonProjection(W);
  const wage = monthlyWages(W, me.id);
  const spon = sponsorAnnual(W);
  const unanswered = W.sp?.offers.length || 0;

  return (
    <>
      <div className="ph">
        <h2>Finanças</h2>
        <span className="muted">
          Temporada {W.year},{' '}
          {isDays(W)
            ? dateOf(W, W.day + 1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
            : `rodada ${W.day} de 40`}{' '}
          · {DIV_NAME[me.div]}
        </span>
        <span className="sp" />
        <div className="seg">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setUi({ finTab: k })}>
              {l}
              {k === 'spon' && unanswered > 0 && <span className="segbadge">{unanswered}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi
          label="Caixa hoje"
          value={money(me.bal)}
          sub={`dinheiro disponível agora · ${signed(me.bal - start)} desde o início da temporada`}
          tone={me.bal < 0 ? 'bad' : undefined}
        />
        <Kpi
          label={rec + des < 0 ? 'Prejuízo na temporada' : 'Lucro na temporada'}
          value={signed(rec + des)}
          sub={`entrou ${money(rec)} · saiu ${money(-des)}`}
          tone={rec + des < 0 ? 'bad' : 'ok'}
        />
        <Kpi
          label="Previsão para o fim da temporada"
          value={money(proj.bal)}
          sub={
            proj.months
              ? `contando ${proj.months} mês(es) de salário e patrocínio e a bilheteria que falta`
              : 'nada mais a pagar nesta temporada'
          }
          tone={proj.bal < 0 ? 'bad' : undefined}
        />
        <Kpi
          label="Todo mês"
          value={`${signed(spon / PAYDAYS - wage)}`}
          sub={`entra ${money(spon / PAYDAYS)} de patrocínio · sai ${money(wage)} de salários (sem bilheteria)`}
          tone={spon / PAYDAYS < wage ? 'bad' : 'ok'}
        />
      </div>

      {tab === 'sum' && <Summary W={W} start={start} projection={proj.bal} />}
      {tab === 'spon' && <SponsorsTab W={W} />}
      {tab === 'ledger' && <Ledger W={W} />}
    </>
  );
}

function Summary({ W, start, projection }: { W: World; start: number; projection: number }) {
  const openModal = useUi((s) => s.openModal);
  const [mode, setMode] = useState<FinChartMode | 'cash'>('cash');
  const me = W.clubs[W.user!];
  const sq = squad(W, W.user!).filter((p) => !p.y);
  const wage = monthlyWages(W, me.id);
  const log = (W.finLog || []).filter((it) => it.y === W.year);

  const byGroup = [0, 0, 0, 0];
  for (const p of sq) byGroup[POS_GROUP[p.p]] += p.sal;
  const maxGroup = Math.max(1, ...byGroup);
  const expiring = sq.filter((p) => p.ct <= W.year);
  const f = W.fin || {};
  const flow: CashFlow = {
    start,
    bil: f.bil || 0,
    pat: f.pat || 0,
    bon: f.bon || 0,
    inMul: Math.max(0, f.mul || 0),
    tra: f.tra || 0,
    sal: f.sal || 0,
    outMul: Math.min(0, f.mul || 0),
    now: me.bal,
    forecast: projection,
  };

  return (
    <>
      <div className="panel">
        <h3>
          <span>
            {mode === 'cash'
              ? 'De onde veio e para onde foi o dinheiro'
              : mode === 'bal'
                ? isDays(W)
                  ? 'Caixa dia a dia'
                  : 'Caixa rodada a rodada'
                : 'Entradas e saídas por mês'}
          </span>
          <span className="seg">
            <button className={mode === 'cash' ? 'on' : ''} onClick={() => setMode('cash')}>
              Resumo do caixa
            </button>
            <button className={mode === 'bal' ? 'on' : ''} onClick={() => setMode('bal')}>
              {isDays(W) ? 'Dia a dia' : 'Rodada a rodada'}
            </button>
            <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
              Por mês
            </button>
          </span>
        </h3>
        {mode === 'cash' && (
          <>
            <CashWaterfall flow={flow} />
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              O clube começou a temporada com <b>{money(start)}</b>. Entraram{' '}
              <b>{money(flow.bil + flow.pat + flow.bon + flow.inMul + Math.max(0, flow.tra))}</b> e saíram{' '}
              <b>{money(-(flow.sal + flow.outMul + Math.min(0, flow.tra)))}</b>, então o caixa está em{' '}
              <b>{money(me.bal)}</b>. Se nada mudar, termina a temporada com cerca de <b>{money(projection)}</b>.
            </p>
          </>
        )}
        {mode === 'month' && (
          <div className="legend">
            <span>
              <i style={{ background: 'var(--ok)' }} /> Entradas (bilheteria e patrocínio)
            </span>
            <span>
              <i style={{ background: 'var(--red)' }} /> Saídas (salários e multas)
            </span>
          </div>
        )}
        {mode !== 'cash' &&
          (log.length ? (
            <FinanceChart W={W} log={log} startBal={start} projection={projection} mode={mode} />
          ) : (
            <p className="muted">O gráfico começa a ser preenchido no próximo dia de jogos.</p>
          ))}
        {mode === 'bal' && log.length > 0 && (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
            Os degraus são os dias de pagamento: no primeiro jogo de cada mês saem os salários e entram as parcelas dos
            patrocinadores. Linha tracejada: projeção até o fim da temporada. Passe o mouse para ver cada dia de
            movimento.
          </p>
        )}
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <TicketPanel W={W} />

        <div className="panel">
          <h3>
            <span>Folha por setor</span>
            <small>{money(wage)}/mês</small>
          </h3>
          {GROUPS.map((g, i) => (
            <div key={g} className="hbar">
              <span>{g}</span>
              <div className="meter">
                <i style={{ width: `${(byGroup[i] / maxGroup) * 100}%`, background: 'var(--blue)' }} />
              </div>
              <b className="num">{money(byGroup[i])}</b>
            </div>
          ))}
          <p className="muted" style={{ margin: '14px 0 4px', fontSize: 12 }}>
            Maiores salários
          </p>
          <table className="t">
            <tbody>
              {sq
                .slice()
                .sort((a, b) => b.sal - a.sal)
                .slice(0, 6)
                .map((p) => (
                  <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                    <td>
                      <PosTag p={p.p} />
                    </td>
                    <td className="nm">{p.n}</td>
                    <td className="r num">{money(p.sal)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {expiring.length > 0 && (
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
              Contratos que terminam em {W.year}: {expiring.map((p) => p.n).join(', ')}.
            </p>
          )}
        </div>
      </div>

      {(W.finHist || []).length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Temporadas anteriores</h3>
          <table className="t">
            <thead>
              <tr>
                <th>Ano</th>
                <th>Divisão</th>
                <th className="r">Bilheteria</th>
                <th className="r">Patrocínio</th>
                <th className="r">Salários</th>
                <th className="r">Multas</th>
                <th className="r">Transferências</th>
                <th className="r">Lucro / prejuízo</th>
                <th className="r">Caixa no fim</th>
              </tr>
            </thead>
            <tbody>
              {W.finHist!.slice()
                .reverse()
                .map((h) => {
                  const pat = (h.pat || 0) + (h.bon || 0);
                  const mul = h.mul || 0;
                  const tra = h.tra || 0;
                  const res = h.bil + pat + h.sal + mul + tra;
                  return (
                    <tr key={h.year}>
                      <td className="num">{h.year}</td>
                      <td>{DIV_NAME[h.div]}</td>
                      <td className="r num">{money(h.bil)}</td>
                      <td className="r num">{money(pat)}</td>
                      <td className="r num neg">{money(h.sal)}</td>
                      <td className="r num">{neg(mul)}</td>
                      <td className="r num">{neg(tra)}</td>
                      <td className="r num" style={{ color: res < 0 ? '#ff9a9d' : 'var(--ok)' }}>
                        {signed(res)}
                      </td>
                      <td className="r num">{money(h.bal)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Ledger({ W }: { W: World }) {
  const log = (W.finLog || []).filter((it) => it.y === W.year);
  const months = monthBuckets(W, log);
  // várias linhas podem ficar abertas ao mesmo tempo
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (m: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });
  const cur = months[months.length - 1];
  const nextPayIn = (() => {
    for (let d = W.day + 1, last = seasonLastDay(W); d <= last; d++) if (isPayday(W, d)) return d - W.day;
    return null;
  })();
  const tot = months.reduce(
    (t, b) => ({
      bil: t.bil + b.bil,
      pat: t.pat + b.pat,
      bon: t.bon + b.bon,
      sal: t.sal + b.sal,
      mul: t.mul + b.mul,
      tra: t.tra + b.tra,
      net: t.net + b.net,
    }),
    { bil: 0, pat: 0, bon: 0, sal: 0, mul: 0, tra: 0, net: 0 },
  );

  return (
    <div className="panel">
      <h3>
        <span>
          Extrato mensal <small>clique num mês para ver os jogos em casa</small>
        </span>
        {nextPayIn != null && <small>próximo pagamento de salários em {unitTxt(W, nextPayIn)}</small>}
      </h3>
      {months.length === 0 ? (
        <p className="muted">Nenhum movimento registrado ainda nesta temporada.</p>
      ) : (
        <table className="t ledger">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="r">Jogos em casa</th>
              <th className="r">Bilheteria</th>
              <th className="r">Patrocínio</th>
              <th className="r">Salários</th>
              <th className="r">Multas</th>
              <th className="r">Transferências</th>
              <th className="r">Lucro do mês</th>
              <th className="r">Caixa no fim do mês</th>
            </tr>
          </thead>
          <tbody>
            {months.map((b) => (
              <Fragment key={b.m}>
                <tr className={`click ${open.has(b.m) ? 'me' : ''}`} onClick={() => toggle(b.m)}>
                  <td>
                    <span className="caret">{open.has(b.m) ? '▾' : '▸'}</span> {MONTH_LONG[b.m]}
                    {b === cur && !W.seasonDone && <span className="muted"> · em andamento</span>}
                  </td>
                  <td className="r num">{b.games.length || ''}</td>
                  <td className="r num">{neg(b.bil)}</td>
                  <td className="r num">{neg(b.pat + b.bon)}</td>
                  <td className="r num neg">{neg(b.sal)}</td>
                  <td className={`r num ${b.mul < 0 ? 'neg' : ''}`}>{neg(b.mul)}</td>
                  <td className={`r num ${b.tra < 0 ? 'neg' : ''}`}>{neg(b.tra)}</td>
                  <td className="r num" style={{ color: b.net < 0 ? '#ff9a9d' : 'var(--ok)' }}>
                    {signed(b.net)}
                  </td>
                  <td className="r num">
                    <b>{money(b.bal)}</b>
                  </td>
                </tr>
                {open.has(b.m) && (
                  <tr className="sub">
                    <td colSpan={9}>
                      {b.games.length === 0 && b.fines.length === 0 && (
                        <span className="muted">Sem jogos em casa neste mês.</span>
                      )}
                      {b.games.map((g) => (
                        <div key={g.d} className="subrow">
                          <span className="muted">Rodada {g.d}</span>
                          <span>x {W.clubs[g.opp!]?.n}</span>
                          <span className="muted">{int(g.att!)} torcedores</span>
                          <b className="num">{money(g.bil)}</b>
                        </div>
                      ))}
                      {b.fines.map((g) => (
                        <div key={'m' + g.d} className="subrow">
                          <span className="muted">Rodada {g.d}</span>
                          <span>{g.mul < 0 ? 'Multa de rescisão paga' : 'Compensação recebida'}</span>
                          <span />
                          <b className="num">{money(g.mul)}</b>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <b>Temporada</b>
              </td>
              <td className="r num">{months.reduce((t, b) => t + b.games.length, 0)}</td>
              <td className="r num">{neg(tot.bil)}</td>
              <td className="r num">{neg(tot.pat + tot.bon)}</td>
              <td className="r num neg">{neg(tot.sal)}</td>
              <td className="r num">{neg(tot.mul)}</td>
              <td className="r num">{neg(tot.tra)}</td>
              <td className="r num" style={{ color: tot.net < 0 ? '#ff9a9d' : 'var(--ok)' }}>
                <b>{signed(tot.net)}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
      <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
        Salários e parcelas de patrocínio são pagos uma vez por mês, de fevereiro a novembro (10 vezes por temporada). A
        bilheteria entra a cada jogo em casa.
      </p>
    </div>
  );
}
