import { ovr, POS_GROUP, squad, youth, youthRecommend, type Pos, type World } from '@/core';
import { youthActions } from '@/app/youthActions';
import { useUi } from '@/store/uiStore';
import { Evo, FacilityStars, Ovr, PosTag } from '../components/Badges';
import { SortTh } from '../components/PlayerTable';
import { EvoBar } from '../components/EvoBar';
import { sortPlayers } from '../sortPlayers';
import { potTxt } from '../format';
import type { PageProps } from './types';

/** OVR mediano do elenco profissional na posição (referência de "pronto"). */
const posRef = (W: World, cid: number, pos: Pos): number => {
  const xs = squad(W, cid)
    .filter((p) => p.p === pos)
    .map(ovr)
    .sort((a, b) => b - a);
  return xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length / 2))] : 0;
};

export function Youth({ W }: PageProps) {
  const sort = useUi((s) => s.sort);
  const openModal = useUi((s) => s.openModal);
  const me = W.clubs[W.user!];
  const kids = youth(W, W.user!);
  const lastYear = kids.filter((p) => p.a >= 20);
  const pos: Record<number, number> = {};
  kids.forEach((p) => (pos[POS_GROUP[p.p]] = (pos[POS_GROUP[p.p]] || 0) + 1));
  const bonus = me.rep >= 80 ? 2 : me.rep >= 55 ? 1 : 0;
  return (
    <>
      <div className="ph">
        <h2>Categoria de base</h2>
        <span className="muted">
          {kids.length} garotos &nbsp; estrutura <FacilityStars club={me} />
        </span>
      </div>
      <div className="grid g21">
        <div className="panel">
          <table className="t">
            <thead>
              <tr>
                <SortTh k="pos" label="Pos" />
                <SortTh k="n" label="Nome" />
                <SortTh k="a" label="Idade" cls="r" />
                <SortTh k="ovr" label="OVR" cls="c" />
                <SortTh k="evo" label="Evolução" cls="c" />
                <SortTh k="pt" label="Potencial" cls="c" />
                <SortTh k="prog" label="Próximo OVR" />
                <th>Nível</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {kids.length === 0 && (
                <tr>
                  <td className="muted">A base está vazia. A peneira do fim da temporada traz novos garotos.</td>
                </tr>
              )}
              {sortPlayers(kids, sort.k, sort.d, W).map((p) => {
                const o = ovr(p),
                  ref = posRef(W, W.user!, p.p);
                return (
                  <tr key={p.id}>
                    <td>
                      <PosTag p={p.p} />
                    </td>
                    <td className="nm">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          openModal({ kind: 'player', id: p.id });
                        }}
                      >
                        {p.n}
                      </a>
                      {p.a >= 20 && (
                        <span className="tag sus" title="Completa 21 anos no fim da temporada: sobe ou sai">
                          último ano
                        </span>
                      )}
                    </td>
                    <td className="r num">{p.a}</td>
                    <td className="c">
                      <Ovr v={o} />
                    </td>
                    <td className="c num">
                      <Evo p={p} />
                    </td>
                    <td className="c num">{potTxt(p)}</td>
                    <td>
                      <EvoBar W={W} p={p} />
                    </td>
                    <td>
                      {ref > 0 && o >= ref - 2 ? (
                        <span className="tag" style={{ background: '#4cc38a33', color: 'var(--ok)' }}>
                          pronto
                        </span>
                      ) : ref > 0 && o >= ref - 6 ? (
                        <span className="tag" style={{ background: '#6fa8ff22', color: '#9cc2ff' }}>
                          perto
                        </span>
                      ) : null}
                    </td>
                    <td className="r">
                      <button className="btn sm" onClick={() => youthActions.promote(p)}>
                        Subir
                      </button>{' '}
                      <button className="btn sm ghost" onClick={() => youthActions.release(p)}>
                        Dispensar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h3>Como funciona</h3>
            <p className="note" style={{ margin: 0 }}>
              Os garotos evoluem sozinhos a cada rodada, sem jogos da base. Quanto maior a estrutura do clube, mais eles
              crescem. O potencial aparece como uma faixa que vai ficando mais precisa com o tempo.
            </p>
            <p className="note" style={{ margin: '8px 0 0' }}>
              Você pode subir alguém para o profissional a qualquer momento. No profissional, quem joga evolui mais
              rápido. Aos 21 anos o garoto precisa sair da base: no fim da temporada você decide se ele sobe ou é
              dispensado. Todo ano a peneira traz de {3 + bonus} a {5 + bonus} garotos novos.
            </p>
            <p className="note" style={{ margin: '8px 0 0' }}>
              “Pronto” significa que o garoto já tem o nível dos titulares medianos da posição no seu elenco; “perto”,
              que está a poucos pontos disso.
            </p>
          </div>
          <div className="panel">
            <h3>
              Último ano de base <small>{lastYear.length} garoto(s)</small>
            </h3>
            {lastYear.length ? (
              lastYear.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
                  <span>
                    <PosTag p={p.p} /> {p.n}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {youthRecommend(W, p) === 'up' ? 'recomendo subir' : 'recomendo dispensar'}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Ninguém completa 21 anos nesta temporada.
              </p>
            )}
          </div>
          <div className="panel">
            <h3>Por setor</h3>
            <dl className="kv">
              <dt>Goleiros</dt>
              <dd>{pos[0] || 0}</dd>
              <dt>Defensores</dt>
              <dd>{pos[1] || 0}</dd>
              <dt>Meio-campistas</dt>
              <dd>{pos[2] || 0}</dd>
              <dt>Atacantes</dt>
              <dd>{pos[3] || 0}</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
