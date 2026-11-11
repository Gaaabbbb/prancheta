import { fmtDate, dateOf } from '@/core';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { int } from '../format';
import type { PageProps } from './types';

export function Fixtures({ W }: PageProps) {
  const openModal = useUi((s) => s.openModal);
  const comp = W.comps[W.clubs[W.user!].div];
  const list = comp.fx.filter((f) => f.h === W.user || f.a === W.user).sort((a, b) => a.d - b.d);
  return (
    <>
      <div className="ph">
        <h2>Jogos</h2>
        <span className="muted">
          {comp.name} {W.year}
        </span>
      </div>
      <div className="panel">
        <table className="t">
          <thead>
            <tr>
              <th>Data</th>
              <th>Fase</th>
              <th>Local</th>
              <th>Adversário</th>
              <th>Resultado</th>
              <th className="r">Público</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => {
              const home = f.h === W.user,
                opp = W.clubs[home ? f.a : f.h];
              let res = <span className="dim">–</span>;
              if (f.pl) {
                const gf = (home ? f.hg : f.ag)!,
                  ga = (home ? f.ag : f.hg)!;
                const r = gf > ga ? 'V' : gf < ga ? 'D' : 'E';
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
                  key={f.id}
                  className={f.pl ? 'click' : ''}
                  onClick={f.pl ? () => openModal({ kind: 'report', comp: comp.id, fid: f.id }) : undefined}
                >
                  <td className="num muted">{fmtDate(dateOf(W, f.d))}</td>
                  <td>
                    {comp.stages[f.st].name}
                    {f.leg ? ' (' + f.leg + 'º jogo)' : ''}
                  </td>
                  <td>{home ? 'Casa' : 'Fora'}</td>
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
        {!comp.done && comp.stages.length > 0 && list.every((f) => f.pl) && (
          <p className="note">Os próximos jogos aparecem quando a fase atual terminar.</p>
        )}
      </div>
    </>
  );
}
