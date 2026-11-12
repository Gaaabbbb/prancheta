import { useState } from 'react';
import {
  DIV_NAME,
  expandStadium,
  expectedGate,
  MAX_CAPACITY,
  monthlyWages,
  POS_GROUP,
  remainingHomeGames,
  seasonProjection,
  seasonStartBalance,
  seatCost,
  sponsorYear,
  squad,
  TICKET,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { PosTag } from '../components/Badges';
import { FinanceChart, type FinChartMode } from '../components/FinanceChart';
import { int, money } from '../format';
import type { PageProps } from './types';

const GROUPS = ['Goleiros', 'Defesa', 'Meio-campo', 'Ataque'];
const EXPANSIONS = [2000, 5000, 10000];

const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) => (
  <div className="panel kpi">
    <span className="kl">{label}</span>
    <span className={`kv2 ${tone || ''}`}>{value}</span>
    {sub && <span className="ks">{sub}</span>}
  </div>
);

const signed = (v: number) => (v > 0 ? '+' : '') + money(v);

export function Finance({ W }: PageProps) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const [mode, setMode] = useState<FinChartMode>('bal');
  const [ledger, setLedger] = useState<'all' | 'home'>('all');
  const me = W.clubs[W.user!];
  const f = W.fin || {};
  const sq = squad(W, W.user!).filter((p) => !p.y);
  const wage = monthlyWages(W, me.id);
  const spon = sponsorYear(W, me);
  const rec = (f.bil || 0) + (f.pat || 0);
  const des = (f.sal || 0) + (f.inv || 0);
  const start = seasonStartBalance(W);
  const proj = seasonProjection(W);
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
  const homeGames = Object.values(W.comps).reduce((t, c) => t + c.fx.filter((x) => x.h === W.user).length, 0);

  // folha por setor
  const byGroup = [0, 0, 0, 0];
  for (const p of sq) byGroup[POS_GROUP[p.p]] += p.sal;
  const maxGroup = Math.max(1, ...byGroup);
  const expiring = sq.filter((p) => p.ct <= W.year);

  const expand = (seats: number) => {
    const n = Math.min(seats, MAX_CAPACITY - me.cap);
    const cost = n * seatCost(me);
    const perSeason = (n / me.cap) * gNow.rev * homeGames;
    openModal({
      kind: 'confirm',
      title: `Ampliar o ${me.std}?`,
      body: (
        <>
          Mais {int(n)} lugares (capacidade {int(me.cap)} → {int(me.cap + n)}) por {money(cost)}. Com o preço atual, a
          bilheteria deve render cerca de {money(perSeason)} a mais por temporada
          {perSeason > 0 ? `, pagando a obra em ${(cost / perSeason).toFixed(1).replace('.', ',')} temporada(s)` : ''}.
        </>
      ),
      ok: 'Ampliar',
      onOk: () => {
        let ok = false;
        mutate((W) => {
          ok = expandStadium(W, seats);
        });
        if (ok) {
          toast('Estádio ampliado: ' + int(me.cap) + ' lugares.');
          void useGame.getState().save();
        } else toast('Dinheiro insuficiente para a obra.');
      },
    });
  };

  const rows = log
    .filter((it) => ledger === 'all' || it.att != null)
    .slice()
    .reverse();

  return (
    <>
      <div className="ph">
        <h2>Finanças</h2>
        <span className="muted">
          Temporada {W.year}, dia {W.day} de 40 · {DIV_NAME[me.div]}
        </span>
      </div>

      <div className="grid g4">
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
          sub={proj.days ? `faltam ${proj.days} dias · bilheteria esperada ${money(proj.gate)}` : 'temporada encerrada'}
          tone={proj.bal < 0 ? 'bad' : undefined}
        />
        <Kpi
          label="Folha salarial"
          value={money(wage) + '/mês'}
          sub={`${Math.round(((wage * 10) / Math.max(1, spon)) * 100)}% do patrocínio anual (${money(spon)})`}
        />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>
          <span>{mode === 'bal' ? 'Saldo ao longo da temporada' : 'Receitas e despesas por dia'}</span>
          <span className="seg">
            <button className={mode === 'bal' ? 'on' : ''} onClick={() => setMode('bal')}>
              Saldo
            </button>
            <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>
              Por dia
            </button>
          </span>
        </h3>
        {mode === 'day' && (
          <div className="legend">
            <span>
              <i style={{ background: 'var(--ok)' }} /> Receitas (bilheteria e patrocínio)
            </span>
            <span>
              <i style={{ background: 'var(--red)' }} /> Despesas (salários e obras)
            </span>
          </div>
        )}
        {log.length ? (
          <FinanceChart W={W} log={log} startBal={start} projection={proj.bal} mode={mode} />
        ) : (
          <p className="muted">O gráfico começa a ser preenchido no próximo dia de jogos.</p>
        )}
        {mode === 'bal' && log.length > 0 && (
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
            Linha tracejada: projeção com patrocínio, salários e a bilheteria esperada dos jogos em casa já marcados.
            Passe o mouse para ver cada dia.
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
            {avgAtt ? int(avgAtt) : 'sem jogos ainda'}.
          </p>
        </div>

        <div className="panel">
          <h3>
            <span>Estádio</span>
            <small>{me.std}</small>
          </h3>
          <div className="stadium">
            <div>
              <span className="kl">Capacidade</span>
              <b className="num">{int(me.cap)}</b>
            </div>
            <div>
              <span className="kl">Ocupação média</span>
              <b className="num">{avgAtt ? Math.round((avgAtt / me.cap) * 100) + '%' : '–'}</b>
            </div>
            <div>
              <span className="kl">Jogos em casa</span>
              <b className="num">{homeGames}</b>
            </div>
          </div>
          <div className="meter" style={{ margin: '10px 0 14px' }} title="Ocupação média">
            <i style={{ width: `${avgAtt ? (avgAtt / me.cap) * 100 : 0}%`, background: 'var(--blue)' }} />
          </div>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
            Ampliar o estádio aumenta o público de todos os jogos em casa. Cada lugar novo custa {money(seatCost(me))}{' '}
            na {DIV_NAME[me.div]}.
          </p>
          <div className="expand">
            {EXPANSIONS.map((n) => {
              const real = Math.min(n, MAX_CAPACITY - me.cap);
              const cost = real * seatCost(me);
              const can = real > 0 && cost <= me.bal;
              return (
                <button
                  key={n}
                  className="btn"
                  disabled={!can}
                  onClick={() => expand(n)}
                  title={!can ? (real <= 0 ? 'Capacidade máxima atingida' : 'Dinheiro insuficiente') : undefined}
                >
                  <b>+{int(n)} lugares</b>
                  <span>{money(cost)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid g21" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>
            <span>Extrato</span>
            <span className="seg">
              <button className={ledger === 'all' ? 'on' : ''} onClick={() => setLedger('all')}>
                Todos os dias
              </button>
              <button className={ledger === 'home' ? 'on' : ''} onClick={() => setLedger('home')}>
                Jogos em casa
              </button>
            </span>
          </h3>
          {rows.length === 0 ? (
            <p className="muted">Nenhum movimento registrado ainda nesta temporada.</p>
          ) : (
            <div className="ledger">
              <table className="t">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Jogo em casa</th>
                    <th className="r">Bilheteria</th>
                    <th className="r">Patrocínio</th>
                    <th className="r">Salários</th>
                    <th className="r">Obras</th>
                    <th className="r">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.d}>
                      <td className="num">{it.d}</td>
                      <td className="nm">
                        {it.att != null ? (
                          <>
                            {W.clubs[it.opp!]?.n} <span className="muted">· {int(it.att)}</span>
                          </>
                        ) : (
                          <span className="dim">–</span>
                        )}
                      </td>
                      <td className="r num">{it.bil ? money(it.bil) : ''}</td>
                      <td className="r num">{money(it.pat)}</td>
                      <td className="r num neg">{money(it.sal)}</td>
                      <td className="r num neg">{it.inv ? money(it.inv) : ''}</td>
                      <td className="r num">
                        <b>{money(it.bal)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <th className="r">Obras</th>
                <th className="r">Resultado</th>
                <th className="r">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {W.finHist!.slice()
                .reverse()
                .map((h) => {
                  const res = h.bil + h.pat + h.sal + h.inv;
                  return (
                    <tr key={h.year}>
                      <td className="num">{h.year}</td>
                      <td>{DIV_NAME[h.div]}</td>
                      <td className="r num">{money(h.bil)}</td>
                      <td className="r num">{money(h.pat)}</td>
                      <td className="r num neg">{money(h.sal)}</td>
                      <td className="r num neg">{h.inv ? money(h.inv) : ''}</td>
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
