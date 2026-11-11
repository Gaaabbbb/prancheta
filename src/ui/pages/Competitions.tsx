import { DIVS, type Div } from '@/core';
import { useUi } from '@/store/uiStore';
import { DivTabs } from '../components/DivTabs';
import { LeagueTable, Legend, TieBox } from '../components/Standings';
import type { PageProps } from './types';

export function Competitions({ W }: PageProps) {
  const { tab, stage, stageDiv, rday, set, openModal } = useUi();
  const div: Div = tab && DIVS.includes(tab) ? tab : W.clubs[W.user!].div;
  const comp = W.comps[div];
  const si = stage != null && stage < comp.stages.length && stageDiv === div ? stage : comp.si;
  const st = comp.stages[si];
  const name = (id: number) => W.clubs[id].n;

  const days = [...new Set(comp.fx.filter((f) => f.st === si).map((f) => f.d))].sort((a, b) => a - b);
  const rd = rday != null && days.includes(rday) ? rday : days.find((d) => d > W.day) || days[days.length - 1];
  const di = days.indexOf(rd);
  const fx = comp.fx.filter((f) => f.st === si && f.d === rd);
  const scorers = W.players
    .filter((p) => p.c >= 0 && W.clubs[p.c].div === div && p.st.g > 0)
    .sort((a, b) => b.st.g - a.st.g || a.st.j - b.st.j)
    .slice(0, 12);

  return (
    <>
      <div className="ph">
        <h2>Competições</h2>
      </div>
      <DivTabs value={div} onChange={(d) => set({ tab: d, stage: null, rday: null })} />
      {comp.stages.length > 1 && (
        <div className="seg" style={{ marginBottom: 14 }}>
          {comp.stages.map((s, i) => (
            <button
              key={i}
              className={i === si ? 'on' : ''}
              onClick={() => set({ stage: i, stageDiv: div, rday: null })}
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
                        {st.groups.length > 1 && <td className="dim">G{f.g + 1}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
          <Legend div={div} year={W.year} />
        </div>
      </div>
    </>
  );
}
