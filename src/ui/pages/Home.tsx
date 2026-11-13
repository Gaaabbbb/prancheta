import { useState } from 'react';
import {
  compList,
  dateOf,
  fmtDate,
  isDays,
  leagueName,
  nextUserFixture,
  table,
  teamStrength,
  userStanding,
  WEEKDAY_SHORT,
  type Competition,
  type Fixture,
  type KOStage,
  type LeagueStage,
  type World,
} from '@/core';
import { continueGame } from '@/app/gameFlow';
import { useUi } from '@/store/uiStore';
import { compColor } from '../compStyle';
import { Crest } from '../components/Crest';
import { FormStrip, StrengthStars } from '../components/Badges';
import { Inbox } from '../components/Inbox';
import { VenueIcon } from '../components/Icons';
import { MiniCalendar } from '../components/MiniCalendar';
import { zoneOf } from '../zones';
import type { PageProps } from './types';

const isMine = (W: World, f: Fixture) => f.h === W.user || f.a === W.user;

/** Fase de pontos mais recente da competição em que o clube está (fase e grupo). */
const leagueSpot = (comp: Competition, club: number): { si: number; gi: number } | null => {
  for (let si = comp.stages.length - 1; si >= 0; si--) {
    const st = comp.stages[si];
    if (st.type !== 'league') continue;
    const gi = st.groups.findIndex((g) => g.includes(club));
    if (gi >= 0) return { si, gi };
  }
  return null;
};

/** Posição e campanha do clube na competição (fase de pontos) ou, se não houver, na liga dele. */
const standingOf = (W: World, comp: Competition, club: number) => {
  let c: Competition | undefined = comp;
  let sp = leagueSpot(comp, club);
  if (!sp) {
    c = W.comps[W.clubs[club].div];
    sp = c ? leagueSpot(c, club) : null;
  }
  if (!sp || !c) return null;
  const t = table(W, c, sp.si, sp.gi);
  const i = t.findIndex((r) => r.c === club);
  return i < 0 ? null : { pos: i + 1, row: t[i], comp: c };
};

const todayDay = (W: World) => (isDays(W) ? W.day + 1 : W.day);

const when = (W: World, d: number) => {
  const n = d - todayDay(W);
  return n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
};

/** Próximo jogo em destaque: escudos, data, local, campanha e força dos dois times. */
function NextMatch({ W }: { W: World }) {
  const nf = nextUserFixture(W);
  if (!nf)
    return (
      <div className="panel hnext">
        <h3>Próximo jogo</h3>
        <p className="muted">{W.seasonDone ? 'Temporada encerrada.' : 'Nenhum jogo restante nesta temporada.'}</p>
        <button className="btn advance big" onClick={continueGame}>
          {W.seasonDone ? 'Fechar temporada' : 'Avançar'} ▶
        </button>
      </div>
    );
  const { f, comp } = nf;
  const h = W.clubs[f.h];
  const st = comp.stages[f.st];
  const dt = dateOf(W, f.d);
  const col = compColor(comp.id);
  // descanso desde o último jogo do clube
  let last = -1;
  for (const c of Object.values(W.comps)) for (const x of c.fx) if (x.pl && isMine(W, x) && x.d > last) last = x.d;
  const rest = last >= 0 && isDays(W) ? f.d - last : null;
  const side = (id: number) => {
    const c = W.clubs[id];
    const s = standingOf(W, comp, id);
    return (
      <div className={`hteam ${id === W.user ? 'mine' : ''}`}>
        <Crest club={c} size={64} />
        <b>{c.n}</b>
        <span className="muted">
          {s ? `${s.pos}º${s.comp === comp ? '' : ' na ' + s.comp.name} · ${s.row.pts} pts` : leagueName(c)}
        </span>
        {s && s.row.form.length > 0 ? (
          <FormStrip form={s.row.form} />
        ) : (
          <span className="muted hnoform">sem jogos</span>
        )}
        <StrengthStars s={teamStrength(W, c)} />
      </div>
    );
  };
  return (
    <div className="panel hnext">
      <div className="hnext-top">
        <span className="ctag" style={{ background: col + '2e', color: col }}>
          {comp.name}
        </span>
        <span className="muted">
          {st.name}
          {f.leg ? ` · jogo de ${f.leg === 1 ? 'ida' : 'volta'}` : ''}
        </span>
      </div>
      <div className="hnext-mid">
        {side(f.h)}
        <div className="hvs">
          <span className="hday">
            {WEEKDAY_SHORT[dt.getDay()]}, {fmtDate(dt)}
          </span>
          <b>x</b>
          <span className="hwhen">{when(W, f.d)}</span>
        </div>
        {side(f.a)}
      </div>
      <div className="hnext-info">
        <span>
          <VenueIcon home={f.h === W.user} neutral={f.neu} size={14} />{' '}
          {f.neu ? 'Campo neutro' : `${h.std}${h.uf ? ' · ' + h.uf : ''}`}
        </span>
        {rest != null && rest > 0 && <span className="muted">{rest} dias de descanso</span>}
      </div>
      <button className="btn advance big" onClick={continueGame}>
        Avançar ▶
      </button>
    </div>
  );
}

/** Classificação das competições em disputa, com filtro; destaque para o seu time e as zonas. */
function Standings({ W }: { W: World }) {
  const go = useUi((s) => s.go);
  const comps = compList(W).filter((c) => c.fx.some((f) => isMine(W, f)) || leagueSpot(c, W.user!));
  const [cid, setCid] = useState<string | undefined>(() => userStanding(W)?.comp.id);
  const comp = comps.find((c) => c.id === cid) || comps[0];
  if (!comp) return null;
  const sp = leagueSpot(comp, W.user!);
  let body;
  if (sp) {
    const t = table(W, comp, sp.si, sp.gi);
    const st = comp.stages[sp.si] as LeagueStage;
    body = (
      <>
        {st.groups.length > 1 && (
          <p className="muted hsub">
            {st.name} · Grupo {comp.id === 'LIB' || comp.id === 'SULA' ? String.fromCharCode(65 + sp.gi) : sp.gi + 1}
          </p>
        )}
        <table className="t htable">
          <thead>
            <tr>
              <th>#</th>
              <th>Clube</th>
              <th className="r">J</th>
              <th className="r">SG</th>
              <th className="r">Pts</th>
            </tr>
          </thead>
          <tbody>
            {t.map((r, i) => (
              <tr key={r.c} className={r.c === W.user ? 'me' : ''}>
                <td className="num">
                  <span className={`zone ${zoneOf(W, comp, sp.si, i + 1, t.length)}`} />
                  {i + 1}
                </td>
                <td className="nm">
                  <Crest club={W.clubs[r.c]} size={16} /> {W.clubs[r.c].n}
                </td>
                <td className="r num">{r.j}</td>
                <td className="r num">{r.gp - r.gc}</td>
                <td className="r num">
                  <b>{r.pts}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  } else {
    // mata-mata: os confrontos do clube
    const ties = comp.stages
      .filter((st): st is KOStage => st.type === 'ko')
      .flatMap((st) =>
        st.ties
          .filter((t) => t.a === W.user || t.b === W.user)
          .map((t) => ({ st, t, fx: [...new Set(t.f)].map((i) => comp.fx[i]).filter(Boolean) })),
      );
    body = ties.length ? (
      <div className="hties">
        {ties.map(({ st, t, fx }) => {
          const opp = W.clubs[t.a === W.user ? t.b : t.a];
          return (
            <div key={st.name} className={`htie ${t.w == null ? '' : t.w === W.user ? 'won' : 'lost'}`}>
              <span className="muted">{st.name}</span>
              <span className="nm">
                <Crest club={opp} size={18} /> {opp.n}
              </span>
              <span className="num">
                {fx.map((f) => (f.pl ? `${f.hg}-${f.ag}` : '–')).join(' · ')}
                {t.w != null && (t.w === W.user ? ' ✓' : ' ✕')}
              </span>
            </div>
          );
        })}
      </div>
    ) : (
      <p className="muted">O sorteio ainda não definiu seus jogos.</p>
    );
  }
  return (
    <div className="panel htab">
      <h3>
        <span>Classificação</span>
        <small>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go('tables');
            }}
          >
            ver tudo
          </a>
        </small>
      </h3>
      {comps.length > 1 && (
        <div className="seg hseg">
          {comps.map((c) => (
            <button key={c.id} className={c.id === comp.id ? 'on' : ''} onClick={() => setCid(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="htab-body">{body}</div>
    </div>
  );
}

/** Jogos do clube: os 2 últimos (com resultado) e os 3 próximos. */
function Games({ W }: { W: World }) {
  const openModal = useUi((s) => s.openModal);
  const all = compList(W)
    .flatMap((comp) => comp.fx.filter((f) => isMine(W, f)).map((f) => ({ f, comp })))
    .sort((x, y) => x.f.d - y.f.d);
  const past = all.filter((x) => x.f.pl).slice(-2);
  const next = all.filter((x) => !x.f.pl).slice(0, 5 - past.length);
  const list = [...past, ...next];
  return (
    <div className="panel hup">
      <h3>Jogos</h3>
      {list.length === 0 && <p className="muted">Sem jogos marcados.</p>}
      {list.map(({ f, comp }, i) => {
        const dt = dateOf(W, f.d);
        const col = compColor(comp.id);
        const h = W.clubs[f.h],
          a = W.clubs[f.a];
        const home = f.h === W.user;
        let res: 'V' | 'E' | 'D' | null = null;
        if (f.pl) {
          const gf = (home ? f.hg : f.ag)!,
            ga = (home ? f.ag : f.hg)!;
          res = gf > ga ? 'V' : gf < ga ? 'D' : f.hp != null ? ((home ? f.hp > f.ap! : f.ap! > f.hp) ? 'V' : 'D') : 'E';
        }
        return (
          <button
            key={comp.id + f.id}
            className={`hup-row ${f.pl ? 'played' : ''} ${i === past.length && past.length ? 'first-next' : ''}`}
            onClick={() =>
              f.pl
                ? openModal({ kind: 'report', comp: comp.id, fid: f.id })
                : openModal({ kind: 'club', id: home ? a.id : h.id })
            }
            title={f.pl ? 'Ver o relatório do jogo' : 'Ver o adversário'}
          >
            <span className="hup-d">
              <b>{WEEKDAY_SHORT[dt.getDay()]}</b> {fmtDate(dt)}
            </span>
            <span className="ctag" style={{ background: col + '2e', color: col }}>
              {comp.name}
            </span>
            <span className="hup-m">
              <span className={`hs ${home ? 'me' : ''}`}>{h.s}</span>
              <Crest club={h} size={18} />
              {f.pl ? (
                <b className="hsc num">
                  {f.hg}-{f.ag}
                </b>
              ) : (
                <i>x</i>
              )}
              <Crest club={a} size={18} />
              <span className={`hs ${!home ? 'me' : ''}`}>{a.s}</span>
            </span>
            {res ? (
              <span className="form">
                <span className={'f' + res}>{res}</span>
              </span>
            ) : (
              <VenueIcon home={home} neutral={f.neu} size={14} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Início: caixa de entrada à esquerda, próximo jogo e calendário no meio, classificação e jogos à direita. */
export function Home({ W }: PageProps) {
  return (
    <div className="home3">
      <div className="hinbox">
        <Inbox W={W} />
      </div>
      <div className="hcol hmid">
        <NextMatch W={W} />
        <MiniCalendar W={W} />
      </div>
      <div className="hcol hright">
        <Standings W={W} />
        <Games W={W} />
      </div>
    </div>
  );
}
