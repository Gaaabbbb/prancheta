import { COUNTRIES, DIVS, FOREIGN, isForeignLeague, roundOf, type Competition, type Div, type World } from '@/core';
import { useUi } from '@/store/uiStore';
import { DivTabs } from '../components/DivTabs';
import { LeagueTable, Legend, TieBox } from '../components/Standings';
import type { PageProps } from './types';

type Group = 'br' | 'CDB' | 'LIB' | 'SULA' | 'sul';

const GROUP_NAME: Record<Group, string> = {
  br: 'Brasileirão',
  CDB: 'Copa do Brasil',
  LIB: 'Libertadores',
  SULA: 'Sul-Americana',
  sul: 'Ligas sul-americanas',
};

const groupOf = (id: string): Group =>
  (DIVS as readonly string[]).includes(id) ? 'br' : isForeignLeague(id) ? 'sul' : (id as Group);

/** Regulamento resumido das copas e ligas de fora. */
const CUP_RULES: Record<string, string> = {
  CDB: '126 clubes. Fases 1 a 4 em jogo único (empate vai aos pênaltis, o pior colocado manda o jogo). Os 20 da Série A entram na 5ª fase. Da 5ª fase à semifinal, ida e volta; final em jogo único, em campo neutro. O campeão vai à fase de grupos da Libertadores; o vice, à fase preliminar.',
  LIB: '47 clubes. Três fases preliminares em ida e volta; quem cai na 3ª vai para a Sul-Americana. Oito grupos de 4 (sem dois clubes do mesmo país): os dois primeiros vão às oitavas, o terceiro cai para os playoffs da Sul-Americana. Mata-mata em ida e volta e final única em campo neutro.',
  SULA: '1ª fase em jogo único entre clubes do mesmo país (fora Brasil e Argentina, que entram nos grupos). Oito grupos de 4: o líder vai às oitavas; o segundo enfrenta um terceiro da Libertadores nos playoffs. Mata-mata em ida e volta e final única em campo neutro.',
};

const foreignRules = (comp: Competition) =>
  `${comp.n} clubes, ${comp.stages[0]?.name.toLowerCase()}. Simulada nos bastidores (só o placar). ` +
  'Os primeiros vão à Libertadores e os seguintes à Sul-Americana do ano que vem.';

export function Competitions({ W }: PageProps) {
  const { tab, stage, stageDiv, rday, set } = useUi();
  const userDiv = W.clubs[W.user!].div;
  const cid = tab && W.comps[tab] ? tab : userDiv;
  const comp = W.comps[cid];
  const group = groupOf(cid);
  const groups = (['br', 'CDB', 'LIB', 'SULA', 'sul'] as Group[]).filter((g) =>
    g === 'br' ? true : g === 'sul' ? FOREIGN.some((k) => W.comps[k]) : !!W.comps[g],
  );
  const pick = (id: string) => set({ tab: id, stage: null, stageDiv: null, rday: null });
  const firstForeign = FOREIGN.find((k) => W.comps[k]) || 'ARG';

  return (
    <>
      <div className="ph">
        <h2>Competições</h2>
        <span className="sp" />
        {groups.length > 1 && (
          <div className="seg">
            {groups.map((g) => (
              <button
                key={g}
                className={group === g ? 'on' : ''}
                onClick={() => pick(g === 'br' ? userDiv : g === 'sul' ? firstForeign : g)}
              >
                {GROUP_NAME[g]}
              </button>
            ))}
          </div>
        )}
      </div>
      {group === 'br' && <DivTabs value={cid as Div} onChange={(d) => pick(d)} />}
      {group === 'sul' && (
        <div className="tabs">
          {FOREIGN.filter((k) => W.comps[k]).map((k) => (
            <button key={k} className={cid === k ? 'on' : ''} onClick={() => pick(k)}>
              {COUNTRIES[k]}
            </button>
          ))}
        </div>
      )}
      <CompView W={W} comp={comp} stage={stageDiv === cid ? stage : null} rday={rday} set={set} />
    </>
  );
}

function CompView({
  W,
  comp,
  stage,
  rday,
  set,
}: {
  W: World;
  comp: Competition;
  stage: number | null;
  rday: number | null;
  set: ReturnType<typeof useUi.getState>['set'];
}) {
  const openModal = useUi((s) => s.openModal);
  const br = (DIVS as readonly string[]).includes(comp.id);
  const name = (id: number) => W.clubs[id].n;
  if (!comp.stages.length)
    return (
      <div className="panel">
        <p className="muted">A competição ainda não começou.</p>
      </div>
    );
  const si = stage != null && stage < comp.stages.length ? stage : comp.si;
  const st = comp.stages[si];

  // rodadas da fase (no calendário por dias, uma rodada pode ter jogos em dias diferentes)
  const days = [...new Set(comp.fx.filter((f) => f.st === si).map(roundOf))].sort((a, b) => a - b);
  const nextRd = comp.fx.filter((f) => f.st === si && !f.pl).map(roundOf);
  const rd = rday != null && days.includes(rday) ? rday : nextRd.length ? Math.min(...nextRd) : days[days.length - 1];
  const di = days.indexOf(rd);
  const fx = comp.fx.filter((f) => f.st === si && roundOf(f) === rd).sort((a, b) => a.d - b.d);
  const scorers = br
    ? W.players
        .filter((p) => p.c >= 0 && W.clubs[p.c].div === comp.id && p.st.g > 0)
        .sort((a, b) => b.st.g - a.st.g || a.st.j - b.st.j)
        .slice(0, 12)
    : [];
  const userIn = comp.fx.some((f) => f.h === W.user || f.a === W.user);
  // clube classificado para uma fase que ainda não começou (Série A na Copa do Brasil, 2ª fase ou grupos da Libertadores)
  const entry = (comp as Competition & { entry?: Record<string, number[]> }).entry;
  const waiting = !userIn && !!entry && Object.values(entry).some((l) => l.includes(W.user!));

  return (
    <>
      {comp.stages.length > 1 && (
        <div className="seg" style={{ marginBottom: 14 }}>
          {comp.stages.map((s, i) => (
            <button
              key={i}
              className={i === si ? 'on' : ''}
              onClick={() => set({ stage: i, stageDiv: comp.id, rday: null })}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid g21">
        <div className="grid" style={{ alignContent: 'start' }}>
          {comp.done && (
            <div className="panel">
              <h3>Resultado final</h3>
              <p style={{ margin: 0 }}>
                Campeão: <b>{comp.res.champ != null ? name(comp.res.champ) : '–'}</b>
                {comp.res.prom.length > 0 && (
                  <>
                    <br />
                    Acesso: {comp.res.prom.map(name).join(', ')}
                  </>
                )}
                {comp.res.rel.length > 0 && (
                  <>
                    <br />
                    Rebaixados: {comp.res.rel.map(name).join(', ')}
                  </>
                )}
              </p>
            </div>
          )}
          {!br && !userIn && !isForeignLeague(comp.id) && (
            <p className="note" style={{ margin: 0 }}>
              {waiting
                ? 'Seu clube já está classificado e entra numa das próximas fases.'
                : 'Seu clube não está nesta competição nesta temporada.'}
            </p>
          )}
          {st.type === 'league' ? (
            st.groups.map((_g, gi) => <LeagueTable key={gi} W={W} comp={comp} si={si} gi={gi} />)
          ) : (
            <div className="ko">
              {st.ties.map((t, i) => (
                <TieBox key={i} W={W} comp={comp} st={st} tie={t} />
              ))}
            </div>
          )}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          {st.type === 'league' && (
            <div className="panel">
              <h3>
                <span>Rodada {di + 1}</span>
                <span>
                  <button
                    className="btn sm"
                    disabled={di <= 0}
                    onClick={() => set({ rday: days[Math.max(0, di - 1)] })}
                  >
                    ‹
                  </button>{' '}
                  <button
                    className="btn sm"
                    disabled={di >= days.length - 1}
                    onClick={() => set({ rday: days[Math.min(days.length - 1, di + 1)] })}
                  >
                    ›
                  </button>
                </span>
              </h3>
              <table className="t">
                <tbody>
                  {fx.map((f) => {
                    const mine = f.h === W.user || f.a === W.user;
                    const clickable = f.pl && mine;
                    return (
                      <tr
                        key={f.id}
                        className={`${mine ? 'me' : ''} ${clickable ? 'click' : ''}`}
                        onClick={clickable ? () => openModal({ kind: 'report', comp: comp.id, fid: f.id }) : undefined}
                      >
                        <td className="r nm">{name(f.h)}</td>
                        <td className="c num" style={{ width: 60 }}>
                          <b>{f.pl ? f.hg + ' x ' + f.ag : 'x'}</b>
                        </td>
                        <td className="nm">{name(f.a)}</td>
                        {st.groups.length > 1 && (
                          <td className="dim">
                            {comp.id === 'LIB' || comp.id === 'SULA' ? String.fromCharCode(65 + f.g) : 'G' + (f.g + 1)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {br && (
            <div className="panel">
              <h3>Artilharia</h3>
              <table className="t">
                <tbody>
                  {scorers.length ? (
                    scorers.map((p, i) => (
                      <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                        <td className="num dim">{i + 1}</td>
                        <td className="nm">{p.n}</td>
                        <td className="muted">{W.clubs[p.c].s}</td>
                        <td className="r num">
                          <b>{p.st.g}</b>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="muted">Ninguém marcou ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {br ? (
            <Legend div={comp.id as Div} year={W.year} />
          ) : (
            <div className="panel">
              <h3>Regulamento</h3>
              <p className="note" style={{ margin: 0 }}>
                {CUP_RULES[comp.id] || foreignRules(comp)}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
