import { Fragment, useState } from 'react';
import {
  DIV_NAME,
  expectedGate,
  isPayday,
  monthlyWages,
  PAYDAYS,
  POS_GROUP,
  remainingHomeGames,
  seasonProjection,
  seasonStartBalance,
  sponsorAnnual,
  squad,
  TICKET,
  type World,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi, type FinTab } from '@/store/uiStore';
import { PosTag } from '../components/Badges';
import { FinanceChart, type FinChartMode } from '../components/FinanceChart';
import { MONTH_LONG, monthBuckets } from '../finance/months';
import { SponsorsTab } from '../finance/SponsorsTab';
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
  const rec = (f.bil || 0) + (f.pat || 0) + (f.bon || 0) + Math.max(0, f.mul || 0);
  const des = (f.sal || 0) + Math.min(0, f.mul || 0);
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
          Temporada {W.year}, rodada {W.day} de 40 · {DIV_NAME[me.div]}
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
          label="Saldo em caixa"
          value={money(me.bal)}
          sub={`${signed(me.bal - start)} na temporada`}
          tone={me.bal < 0 ? 'bad' : undefined}
        />
        <Kpi
          label="Resultado da temporada"
          value={signed(rec + des)}
          sub={`receitas ${money(rec)} · despesas ${money(-des)}`}
          tone={rec + des < 0 ? 'bad' : 'ok'}
        />
        <Kpi
          label="Projeção para o fim da temporada"
          value={money(proj.bal)}
          sub={
            proj.months
              ? `faltam ${proj.months} pagamento(s) mensais · bilheteria esperada ${money(proj.gate)}`
              : 'sem pagamentos restantes'
          }
          tone={proj.bal < 0 ? 'bad' : undefined}
        />
        <Kpi
          label="Folha x patrocínio"
          value={`${money(wage)} / ${money(spon / PAYDAYS)}`}
          sub="salários por mês / parcela mensal dos patrocinadores"
          tone={spon / PAYDAYS < wage ? 'bad' : undefined}
        />
      </div>

      {tab === 'sum' && <Summary W={W} start={start} projection={proj.bal} />}
      {tab === 'spon' && <SponsorsTab W={W} />}
      {tab === 'ledger' && <Ledger W={W} />}
    </>
  );
}

function Summary({ W, start, projection }: { W: World; start: number; projection: number }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const [mode, setMode] = useState<FinChartMode>('bal');
  const me = W.clubs[W.user!];
  const sq = squad(W, W.user!).filter((p) => !p.y);
  const wage = monthlyWages(W, me.id);
  const log = (W.finLog || []).filter((it) => it.y === W.year);
  const std = TICKET[me.div];
  const price = W.ticket || std;

  // próximo jogo em casa: comparação do preço escolhido com o padrão
  const nextHome = remainingHomeGames(W)[0];
  const rivals = W.clubs.filter((c) => c.div === me.div && c.id !== me.id);
  const oppRep = nextHome
    ? W.clubs[nextHome.f.a].rep
    : rivals.reduce((t, c) => t + c.rep, 0) / Math.max(1, rivals.length);
  const gStd = expectedGate(me, oppRep, std);
  const gNow = expectedGate(me, oppRep, price);
  const homeFx = W.comps[me.div].fx.filter((x) => x.h === W.user && x.pl && x.att);
  const avgAtt = homeFx.length ? Math.round(homeFx.reduce((s, x) => s + x.att!, 0) / homeFx.length) : 0;

  const byGroup = [0, 0, 0, 0];
  for (const p of sq) byGroup[POS_GROUP[p.p]] += p.sal;
  const maxGroup = Math.max(1, ...byGroup);
  const expiring = sq.filter((p) => p.ct <= W.year);

  return (
    <>
      <div className="panel">
        <h3>
          <span>{mode === 'bal' ? 'Saldo ao longo da temporada' : 'Receitas e despesas por mês'}</span>
          <span className="seg">
            <button className={mode === 'bal' ? 'on' : ''} onClick={() => setMode('bal')}>
              Saldo
            </button>
            <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
              Por mês
            </button>
          </span>
        </h3>
        {mode === 'month' && (
          <div className="legend">
            <span>
              <i style={{ background: 'var(--ok)' }} /> Receitas (bilheteria, patrocínio e bônus)
            </span>
            <span>
              <i style={{ background: 'var(--red)' }} /> Despesas (salários e multas)
            </span>
          </div>
        )}
        {log.length ? (
          <FinanceChart W={W} log={log} startBal={start} projection={projection} mode={mode} />
        ) : (
          <p className="muted">O gráfico começa a ser preenchido no próximo dia de jogos.</p>
        )}
        {mode === 'bal' && log.length > 0 && (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
            Os degraus são os dias de pagamento: no primeiro jogo de cada mês saem os salários e entram as parcelas dos
            patrocinadores. Linha tracejada: projeção até o fim da temporada. Passe o mouse para ver cada rodada.
          </p>
        )}
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Preço do ingresso</h3>
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Ingresso mais caro rende mais por torcedor, mas esvazia o estádio. O preço padrão da {DIV_NAME[me.div]} é R${' '}
            {std}.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range"
              min={Math.round(std * 0.4)}
              max={Math.round(std * 3)}
              value={price}
              onChange={(e) => mutate((W) => (W.ticket = +e.target.value))}
              style={{ flex: 1 }}
              aria-label="Preço do ingresso"
            />
            <b className="num" style={{ fontFamily: 'var(--fd)', fontSize: 24 }}>
              R$ {price}
            </b>
            {price !== std && (
              <button className="btn ghost sm" onClick={() => mutate((W) => (W.ticket = std))}>
                Padrão
              </button>
            )}
          </div>
          <table className="t" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>{nextHome ? `Próximo jogo em casa: ${W.clubs[nextHome.f.a].n}` : 'Jogo médio em casa'}</th>
                <th className="r">Público</th>
                <th className="r">Ocupação</th>
                <th className="r">Renda</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="muted">Preço padrão (R$ {std})</td>
                <td className="r num">{int(gStd.att)}</td>
                <td className="r num">{Math.round((gStd.att / me.cap) * 100)}%</td>
                <td className="r num">{money(gStd.rev)}</td>
              </tr>
              <tr className="me">
                <td>Seu preço (R$ {price})</td>
                <td className="r num">{int(gNow.att)}</td>
                <td className="r num">{Math.round((gNow.att / me.cap) * 100)}%</td>
                <td className="r num">
                  {money(gNow.rev)}{' '}
                  {gStd.rev > 0 && gNow.rev !== gStd.rev && (
                    <span style={{ color: gNow.rev > gStd.rev ? 'var(--ok)' : '#ff9a9d', fontSize: 12 }}>
                      {gNow.rev > gStd.rev ? '+' : ''}
                      {Math.round((gNow.rev / gStd.rev - 1) * 100)}%
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Valores esperados; o público real varia um pouco a cada jogo. Média em casa até agora:{' '}
            {avgAtt ? `${int(avgAtt)} (${Math.round((avgAtt / me.cap) * 100)}% do ${me.std})` : 'sem jogos ainda'}.
          </p>
        </div>

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
                <th className="r">Resultado</th>
                <th className="r">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {W.finHist!.slice()
                .reverse()
                .map((h) => {
                  const pat = (h.pat || 0) + (h.bon || 0);
                  const mul = h.mul || 0;
                  const res = h.bil + pat + h.sal + mul;
                  return (
                    <tr key={h.year}>
                      <td className="num">{h.year}</td>
                      <td>{DIV_NAME[h.div]}</td>
                      <td className="r num">{money(h.bil)}</td>
                      <td className="r num">{money(pat)}</td>
                      <td className="r num neg">{money(h.sal)}</td>
                      <td className="r num">{neg(mul)}</td>
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
  const [open, setOpen] = useState<number | null>(null);
  const cur = months[months.length - 1];
  const nextPayIn = (() => {
    for (let d = W.day + 1; d <= 40; d++) if (isPayday(W, d)) return d - W.day;
    return null;
  })();
  const tot = months.reduce(
    (t, b) => ({
      bil: t.bil + b.bil,
      pat: t.pat + b.pat,
      bon: t.bon + b.bon,
      sal: t.sal + b.sal,
      mul: t.mul + b.mul,
      net: t.net + b.net,
    }),
    { bil: 0, pat: 0, bon: 0, sal: 0, mul: 0, net: 0 },
  );

  return (
    <div className="panel">
      <h3>
        <span>
          Extrato mensal <small>clique num mês para ver os jogos em casa</small>
        </span>
        {nextPayIn != null && (
          <small>
            próximo pagamento de salários em {nextPayIn} rodada{nextPayIn > 1 ? 's' : ''}
          </small>
        )}
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
              <th className="r">Bônus</th>
              <th className="r">Salários</th>
              <th className="r">Multas</th>
              <th className="r">Resultado</th>
              <th className="r">Saldo no fim</th>
            </tr>
          </thead>
          <tbody>
            {months.map((b) => (
              <Fragment key={b.m}>
                <tr className={`click ${open === b.m ? 'me' : ''}`} onClick={() => setOpen(open === b.m ? null : b.m)}>
                  <td>
                    <span className="caret">{open === b.m ? '▾' : '▸'}</span> {MONTH_LONG[b.m]}
                    {b === cur && W.day < 40 && <span className="muted"> · em andamento</span>}
                  </td>
                  <td className="r num">{b.games.length || ''}</td>
                  <td className="r num">{neg(b.bil)}</td>
                  <td className="r num">{neg(b.pat)}</td>
                  <td className="r num">{neg(b.bon)}</td>
                  <td className="r num neg">{neg(b.sal)}</td>
                  <td className={`r num ${b.mul < 0 ? 'neg' : ''}`}>{neg(b.mul)}</td>
                  <td className="r num" style={{ color: b.net < 0 ? '#ff9a9d' : 'var(--ok)' }}>
                    {signed(b.net)}
                  </td>
                  <td className="r num">
                    <b>{money(b.bal)}</b>
                  </td>
                </tr>
                {open === b.m && (
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
              <td className="r num">{neg(tot.pat)}</td>
              <td className="r num">{neg(tot.bon)}</td>
              <td className="r num neg">{neg(tot.sal)}</td>
              <td className="r num">{neg(tot.mul)}</td>
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
        bilheteria entra a cada jogo em casa e o bônus a cada vitória.
      </p>
    </div>
  );
}
