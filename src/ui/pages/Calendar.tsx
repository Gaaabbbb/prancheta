import { useState } from 'react';
import {
  dateOf,
  isPayday,
  dayOfYear,
  DIVS,
  isDays,
  roundOf,
  SEASON_DAYS,
  seasonLastDay,
  TRANSFER_WINDOWS,
  WEEKDAY_SHORT,
  windowOn,
  windowRange,
  windowState,
  type Competition,
  type Fixture,
  type World,
} from '@/core';
import { useUi } from '@/store/uiStore';
import { compColor, compLegend } from '../compStyle';
import { Crest } from '../components/Crest';
import { HomeIcon, PlaneIcon, VenueIcon } from '../components/Icons';
import { int } from '../format';
import type { PageProps } from './types';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type Where = 'all' | 'home' | 'away';

/** Sigla da competição nos cartões pequenos do calendário. */
const SHORT: Record<string, string> = { CDB: 'CdB', LIB: 'Liberta', SULA: 'Sula' };
const shortOf = (comp: Competition) => SHORT[comp.id] || comp.name;
type View = 'month' | 'list';

interface Game {
  f: Fixture;
  comp: Competition;
  date: Date;
  home: boolean;
  /** V, E ou D (jogos disputados) */
  res: 'V' | 'E' | 'D' | null;
  gf: number;
  ga: number;
}

/** Todos os jogos do usuário na temporada, em ordem. */
const userGames = (W: World): Game[] => {
  const out: Game[] = [];
  for (const comp of Object.values(W.comps))
    for (const f of comp.fx) {
      if (f.h !== W.user && f.a !== W.user) continue;
      const home = f.h === W.user;
      const gf = (home ? f.hg : f.ag) ?? 0,
        ga = (home ? f.ag : f.hg) ?? 0;
      let res: Game['res'] = null;
      if (f.pl)
        res =
          gf > ga ? 'V' : gf < ga ? 'D' : f.hp !== undefined ? ((home ? f.hp > f.ap! : f.ap! > f.hp) ? 'V' : 'D') : 'E';
      out.push({ f, comp, date: dateOf(W, f.d), home, res, gf, ga });
    }
  return out.sort((a, b) => a.f.d - b.f.d);
};

/** Dias entre dois jogos. */
const rest = (g: Game, prev: Game) => Math.round((g.date.getTime() - prev.date.getTime()) / 864e5);

const dayKey = (d: Date) => `${d.getMonth()}-${d.getDate()}`;

const record = (gs: Game[]) => {
  const r = { V: 0, E: 0, D: 0, gp: 0, gc: 0 };
  for (const g of gs)
    if (g.res) {
      r[g.res]++;
      r.gp += g.gf;
      r.gc += g.ga;
    }
  return r;
};

export function Calendar({ W }: PageProps) {
  const openModal = useUi((s) => s.openModal);
  const games = userGames(W);
  const next = games.find((g) => !g.f.pl);
  const [month, setMonth] = useState(() => (next || games[games.length - 1])?.date.getMonth() ?? 0);
  const [where, setWhere] = useState<Where>('all');
  const [view, setView] = useState<View>('month');

  /** descanso desde o jogo anterior do time (com ou sem filtro) */
  const restBefore = (g: Game): number | null => {
    const i = games.indexOf(g);
    return i > 0 ? rest(g, games[i - 1]) : null;
  };
  const shown = games.filter((g) => where === 'all' || (where === 'home') === g.home);
  const byDay = new Map(shown.map((g) => [dayKey(g.date), g]));
  // dias de jogo da temporada (todas as rodadas), para marcar salários e rodadas sem jogo do usuário
  const seasonDays = new Map<string, number>();
  const days = isDays(W);
  if (days) {
    // por dias: rodadas da liga do usuário (os jogos de uma rodada podem cair em dias diferentes)
    for (const f of W.comps[W.clubs[W.user!].div].fx) seasonDays.set(dayKey(dateOf(W, f.d)), roundOf(f));
  } else for (let d = 1; d <= SEASON_DAYS; d++) seasonDays.set(dayKey(dateOf(W, d)), d);
  // janeiro entra por causa da 1ª janela de transferências
  const firstMonth = 0,
    lastMonth = days ? 11 : dateOf(W, SEASON_DAYS).getMonth();
  const ws = windowState(W);
  const dm = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const winStatus = (i: number) => {
    const w = TRANSFER_WINDOWS[i];
    if (ws.open && ws.win?.id === w.id) return 'aberta agora';
    const [, end] = windowRange(W.year, w);
    const past = W.seasonDone || (W.day > 0 && dateOf(W, Math.min(W.day, seasonLastDay(W))) > end);
    return past ? 'encerrada' : 'ainda vai abrir';
  };

  const open = (g: Game) => {
    if (g.f.pl) openModal({ kind: 'report', comp: g.comp.id, fid: g.f.id });
    else openModal({ kind: 'club', id: g.home ? g.f.a : g.f.h });
  };

  const homeRec = record(games.filter((g) => g.home)),
    awayRec = record(games.filter((g) => !g.home));

  const chip = (g: Game, compact = false) => {
    const opp = W.clubs[g.home ? g.f.a : g.f.h];
    return (
      <>
        <div className="cg-top">
          <span className="cg-ven">
            <VenueIcon home={g.home} neutral={g.f.neu} size={compact ? 11 : 13} />
          </span>
          <span className="cg-comp" style={{ color: compColor(g.comp.id) }}>
            {compact ? shortOf(g.comp) : g.comp.name}
          </span>
          {g.res && <span className={`cg-res f${g.res}`}>{g.res}</span>}
        </div>
        <div className="cg-opp">
          <Crest club={opp} size={compact ? 18 : 22} />
          <span>{compact ? opp.s : opp.n}</span>
        </div>
        <div className="cg-sc num">
          {g.f.pl ? (
            <>
              {g.f.hg} x {g.f.ag}
              {g.f.hp !== undefined && (
                <small>
                  {' '}
                  ({g.f.hp}x{g.f.ap} pên.)
                </small>
              )}
            </>
          ) : g === next ? (
            <span className="cg-next">próximo</span>
          ) : (
            <span className="dim">{g.comp.stages[g.f.st]?.name}</span>
          )}
        </div>
      </>
    );
  };

  // grade do mês: semanas começando na segunda
  const first = new Date(W.year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(W.year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthGames = shown.filter((g) => g.date.getMonth() === month);

  return (
    <>
      <div className="ph">
        <h2>Calendário</h2>
        <span className="muted">Temporada {W.year}</span>
        <span className="sp" />
        <div className="seg">
          {(
            [
              ['all', 'Todos'],
              ['home', 'Em casa'],
              ['away', 'Fora'],
            ] as [Where, string][]
          ).map(([k, l]) => (
            <button key={k} className={where === k ? 'on' : ''} onClick={() => setWhere(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
            Mês
          </button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
            Lista
          </button>
        </div>
      </div>

      <div className="grid g4 calsum">
        <div className="panel">
          <span className="kl">Em casa</span>
          <b className="num">
            {homeRec.V}V {homeRec.E}E {homeRec.D}D
          </b>
          <span className="ks">
            gols {homeRec.gp}-{homeRec.gc}
          </span>
        </div>
        <div className="panel">
          <span className="kl">Fora</span>
          <b className="num">
            {awayRec.V}V {awayRec.E}E {awayRec.D}D
          </b>
          <span className="ks">
            gols {awayRec.gp}-{awayRec.gc}
          </span>
        </div>
        <div className="panel">
          <span className="kl">Jogos</span>
          <b className="num">
            {games.filter((g) => g.f.pl).length} de {games.length}
          </b>
          <span className="ks">disputados até agora</span>
        </div>
        <div className="panel click" onClick={() => next && open(next)}>
          <span className="kl">Próximo jogo</span>
          {next ? (
            <>
              <b>
                {next.home ? 'x' : '@'} {W.clubs[next.home ? next.f.a : next.f.h].n}
              </b>
              <span className="ks">
                {next.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} ·{' '}
                {next.home ? 'em casa' : 'fora'}
              </span>
            </>
          ) : (
            <b className="dim">temporada encerrada</b>
          )}
        </div>
      </div>

      <div className="panel calwins">
        <span className="kl">Janelas de transferência</span>
        {TRANSFER_WINDOWS.map((w, i) => {
          const [a, b] = windowRange(W.year, w);
          const st = winStatus(i);
          return (
            <div key={w.id} className={`calwin ${st === 'aberta agora' ? 'on' : st === 'encerrada' ? 'past' : ''}`}>
              <b>{w.name}</b>
              <span className="num">
                {dm(a)} a {dm(b)}
              </span>
              <span className="muted">
                {w.note} · {st}
              </span>
            </div>
          );
        })}
      </div>

      {view === 'month' ? (
        <div className="grid g21" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="calnav">
              <button
                className="btn ghost sm"
                disabled={month <= firstMonth}
                onClick={() => setMonth((m) => m - 1)}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <h3>
                {MONTHS[month]} {W.year}
              </h3>
              <button
                className="btn ghost sm"
                disabled={month >= lastMonth}
                onClick={() => setMonth((m) => m + 1)}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <div className="cal">
              {WEEK.map((w) => (
                <div key={w} className="cal-wd">
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day == null) return <div key={i} className="cal-c off" />;
                const k = `${month}-${day}`;
                const g = byDay.get(k);
                const sd = seasonDays.get(k);
                const doy = dayOfYear(new Date(W.year, month, day));
                const pay = days ? isPayday(W, doy) : sd != null && isPayday(W, sd);
                const today = days ? doy === W.day + 1 : sd != null && sd === W.day + 1;
                const win = windowOn(new Date(W.year, month, day));
                const winStart = win && win.from[0] === month && win.from[1] === day;
                const winEnd = win && win.to[0] === month && win.to[1] === day;
                const cc = g ? compColor(g.comp.id) : null;
                return (
                  <div
                    key={i}
                    className={`cal-c ${g ? 'game' : ''} ${g?.res ? 'r' + g.res : ''} ${today ? 'today' : ''} ${win ? 'win' : ''}`}
                    style={cc ? { background: cc + '2e', borderLeftColor: cc } : undefined}
                    onClick={g ? () => open(g) : undefined}
                    title={g ? `${g.comp.name}, ${g.comp.stages[g.f.st]?.name}` : undefined}
                  >
                    <span className="cal-n">{day}</span>
                    {(winStart || winEnd) && (
                      <span className="cal-win" title={`${winStart ? 'Abre' : 'Fecha'} a ${win.name.toLowerCase()}`}>
                        {winStart ? 'abre ' : 'fecha '}
                        {win.id === 2 ? 'compl.' : win.id === 1 ? '1ª' : '2ª'}
                      </span>
                    )}
                    {g && chip(g, true)}
                    {!g && sd != null && <span className="cal-rd">rodada {sd}</span>}
                    {pay && <span className="cal-pay">salários</span>}
                  </div>
                );
              })}
            </div>
            <div className="legend" style={{ marginTop: 10 }}>
              {compLegend([W.clubs[W.user!].div, ...['CDB', 'LIB', 'SULA'].filter((id) => W.comps[id])]).map((l) => (
                <span key={l.id}>
                  <i style={{ background: l.color }} /> {l.label}
                </span>
              ))}
              <span>
                <HomeIcon /> Em casa
              </span>
              <span>
                <PlaneIcon /> Fora
              </span>
              <span>
                <i style={{ background: 'var(--muted)' }} /> Salários e patrocínio
              </span>
              <span>
                <i style={{ background: 'var(--win)' }} /> Janela de transferências
              </span>
            </div>
            {games.every((g) => (DIVS as readonly string[]).includes(g.comp.id)) && !isDays(W) && (
              <p className="note" style={{ margin: '8px 0 0' }}>
                Copa do Brasil, Libertadores e Sul-Americana entram no calendário a partir da próxima temporada.
              </p>
            )}
          </div>
          <div className="panel">
            <h3>
              <span>Jogos em {MONTHS[month].toLowerCase()}</span>
              <small>{monthGames.length}</small>
            </h3>
            {monthGames.length === 0 && <p className="muted">Nenhum jogo neste mês.</p>}
            {monthGames.map((g) => (
              <div
                key={g.comp.id + g.f.id}
                className="cal-li"
                style={{ borderLeftColor: compColor(g.comp.id) }}
                onClick={() => open(g)}
              >
                <span className="cal-dt num">{g.date.getDate()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>{chip(g)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 16 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th title="Dias desde o jogo anterior">Descanso</th>
                <th>Local</th>
                <th>Competição</th>
                <th>Adversário</th>
                <th>Fase</th>
                <th>Resultado</th>
                <th title="Janela de transferências aberta na data do jogo">Janela</th>
                <th className="r">Público</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g, i) => {
                const opp = W.clubs[g.home ? g.f.a : g.f.h];
                const newMonth = i === 0 || shown[i - 1].date.getMonth() !== g.date.getMonth();
                return (
                  <tr
                    key={g.comp.id + g.f.id}
                    className={`click ${g === next ? 'me' : ''} ${newMonth ? 'mstart' : ''}`}
                    onClick={() => open(g)}
                  >
                    <td className="num">{g.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</td>
                    <td className="muted">{WEEKDAY_SHORT[g.date.getDay()]}</td>
                    <td className={`num ${restBefore(g) != null && restBefore(g)! <= 4 ? 'restwarn' : 'muted'}`}>
                      {restBefore(g) != null ? restBefore(g) + ' dias' : ''}
                    </td>
                    <td className="cg-ven">
                      <VenueIcon home={g.home} neutral={g.f.neu} /> {g.f.neu ? 'Neutro' : g.home ? 'Casa' : 'Fora'}
                    </td>
                    <td>
                      <span
                        className="comptag"
                        style={{ background: compColor(g.comp.id) + '2e', color: compColor(g.comp.id) }}
                      >
                        {g.comp.name}
                      </span>
                    </td>
                    <td className="nm">
                      <Crest club={opp} size={18} /> {opp.n}
                    </td>
                    <td className="muted">
                      {g.comp.stages[g.f.st]?.name}
                      {g.f.leg ? ` (${g.f.leg}º jogo)` : ''}
                    </td>
                    <td>
                      {g.res ? (
                        <>
                          <span className={`cg-res f${g.res}`}>{g.res}</span>{' '}
                          <b className="num">
                            {g.f.hg} x {g.f.ag}
                          </b>
                        </>
                      ) : g === next ? (
                        <span className="cg-next">próximo</span>
                      ) : (
                        <span className="dim">–</span>
                      )}
                    </td>
                    <td>
                      {windowOn(g.date) && (
                        <span className="tag win">
                          {windowOn(g.date)!.id === 2 ? 'complementar' : windowOn(g.date)!.name}
                        </span>
                      )}
                    </td>
                    <td className="r num muted">{g.f.att ? int(g.f.att) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Clique num jogo disputado para ver o relatório, ou num jogo futuro para ver o adversário. Jogos de mata-mata
        aparecem quando a fase anterior termina.
      </p>
    </>
  );
}
