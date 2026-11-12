import { useState } from 'react';
import { compList, fmtDate, dateOf, roundOf, WEEKDAY_SHORT, type Competition, type Fixture } from '@/core';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { int } from '../format';
import type { PageProps } from './types';

interface Row {
  f: Fixture;
  comp: Competition;
}

/** "Rodada 01" nos pontos corridos/grupos; ida/volta ou jogo único no mata-mata. */
const roundLabel = ({ f, comp }: Row): string => {
  const st = comp.stages[f.st];
  if (st.type !== 'league') return f.leg ? (f.leg === 1 ? 'Ida' : 'Volta') : 'Jogo único';
  const rounds = [...new Set(comp.fx.filter((x) => x.st === f.st).map(roundOf))].sort((a, b) => a - b);
  return 'Rodada ' + String(rounds.indexOf(roundOf(f)) + 1).padStart(2, '0');
};

export function Fixtures({ W }: PageProps) {
  const openModal = useUi((s) => s.openModal);
  const [only, setOnly] = useState<string>('all');
  const mine = (f: Fixture) => f.h === W.user || f.a === W.user;
  const comps = compList(W).filter((c) => c.fx.some(mine));
  const rows: Row[] = comps
    .filter((c) => only === 'all' || c.id === only)
    .flatMap((comp) => comp.fx.filter(mine).map((f) => ({ f, comp })))
    .sort((a, b) => a.f.d - b.f.d);
  const league = W.comps[W.clubs[W.user!].div];
  return (
    <>
      <div className="ph">
        <h2>Jogos</h2>
        <span className="muted">Temporada {W.year}</span>
        <span className="sp" />
        {comps.length > 1 && (
          <div className="seg">
            <button className={only === 'all' ? 'on' : ''} onClick={() => setOnly('all')}>
              Todas
            </button>
            {comps.map((c) => (
              <button key={c.id} className={only === c.id ? 'on' : ''} onClick={() => setOnly(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <table className="t">
          <thead>
            <tr>
              <th>Rodada</th>
              <th>Data</th>
              {comps.length > 1 && <th>Competição</th>}
              <th>Fase</th>
              <th>Local</th>
              <th>Adversário</th>
              <th>Resultado</th>
              <th className="r">Público</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { f, comp } = row;
              const home = f.h === W.user,
                opp = W.clubs[home ? f.a : f.h];
              let res = <span className="dim">–</span>;
              if (f.pl) {
                const gf = (home ? f.hg : f.ag)!,
                  ga = (home ? f.ag : f.hg)!;
                const won = f.hp !== undefined ? (home ? f.hp > f.ap! : f.ap! > f.hp) : null;
                const r = gf > ga ? 'V' : gf < ga ? 'D' : won == null ? 'E' : won ? 'V' : 'D';
                res = (
                  <>
                    <span className="form">
                      <span className={'f' + r}>{r}</span>
                    </span>{' '}
                    <b className="num">
                      {f.hg} x {f.ag}
                    </b>
                    {f.hp !== undefined && (
                      <span className="muted">
                        {' '}
                        (pên. {f.hp}x{f.ap})
                      </span>
                    )}
                  </>
                );
              }
              return (
                <tr
                  key={comp.id + f.id}
                  className={f.pl ? 'click' : ''}
                  onClick={f.pl ? () => openModal({ kind: 'report', comp: comp.id, fid: f.id }) : undefined}
                >
                  <td className="num">
                    <b>{roundLabel(row)}</b>
                  </td>
                  <td className="num muted">
                    {WEEKDAY_SHORT[dateOf(W, f.d).getDay()]}, {fmtDate(dateOf(W, f.d))}
                  </td>
                  {comps.length > 1 && (
                    <td>
                      <span className={`comptag c-${comp.id}`}>{comp.name}</span>
                    </td>
                  )}
                  <td>{comp.stages[f.st].name}</td>
                  <td>{f.neu ? 'Neutro' : home ? 'Casa' : 'Fora'}</td>
                  <td>
                    <Crest club={opp} size={20} /> {opp.n}
                  </td>
                  <td>{res}</td>
                  <td className="r muted num">{f.att ? int(f.att) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!league.done && league.stages.length > 0 && league.fx.filter(mine).every((f) => f.pl) && (
          <p className="note">Os próximos jogos aparecem quando a fase atual terminar.</p>
        )}
      </div>
    </>
  );
}
