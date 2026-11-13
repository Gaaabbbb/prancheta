import { compList, dateOf, isForeignLeague, roundOf, userStanding, type Competition, type Fixture } from '@/core';
import { useWorld } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { LeagueTable } from '../components/Standings';

/** Linha de resultado: mandante, placar e visitante (com pênaltis, quando houver). */
function ResultRow({ f, me }: { f: Fixture; me: boolean }) {
  const W = useWorld();
  const h = W.clubs[f.h],
    a = W.clubs[f.a];
  return (
    <tr className={me ? 'me' : ''}>
      <td className="r nm">
        {h.n} <Crest club={h} size={16} />
      </td>
      <td className="c num" style={{ whiteSpace: 'nowrap' }}>
        {f.pl ? (
          <b>
            {f.hg} x {f.ag}
            {f.hp != null && (
              <small className="muted">
                {' '}
                ({f.hp}x{f.ap} pên.)
              </small>
            )}
          </b>
        ) : (
          <span className="muted">
            {dateOf(W, f.d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric' })}
          </span>
        )}
      </td>
      <td className="nm">
        <Crest club={a} size={16} /> {a.n}
      </td>
    </tr>
  );
}

/**
 * Resumo depois do jogo do usuário: os resultados do dia em todas as competições (a do usuário aberta, com a rodada
 * inteira) e a classificação completa, com o time do usuário destacado.
 */
export function RoundModal({ comp: cid, fid }: { comp: string; fid: number }) {
  const W = useWorld();
  const { closeModal, openModal } = useUi();
  const comp = W.comps[cid];
  const f = comp.fx[fid];
  const st = comp.stages[f.st];
  const home = f.h === W.user,
    gf = (home ? f.hg : f.ag)!,
    ga = (home ? f.ag : f.hg)!;
  const pens = f.hp != null ? (home ? f.hp - f.ap! : f.ap! - f.hp) : 0;
  const head = gf > ga || pens > 0 ? 'Vitória' : gf < ga || pens < 0 ? 'Derrota' : 'Empate';

  // a competição do jogo: a rodada inteira (num calendário por dias, os jogos podem cair em dias diferentes)
  const mine = comp.fx.filter((x) => x.st === f.st && roundOf(x) === roundOf(f));
  // as outras: só o que foi jogado no mesmo dia (sem as ligas de fora do Brasil)
  const others = compList(W)
    .filter((c) => c.id !== cid && !isForeignLeague(c.id))
    .map((c) => ({ c, fx: c.fx.filter((x) => x.d === f.d && x.pl) }))
    .filter((x) => x.fx.length);

  // classificação: o grupo deste jogo (se for fase de pontos) e a liga do usuário
  const tables: { comp: Competition; si: number; gi: number; title: string }[] = [];
  if (st.type === 'league') {
    const gi = st.groups.findIndex((g) => g.includes(W.user!));
    if (gi >= 0)
      tables.push({
        comp,
        si: f.st,
        gi,
        title:
          comp.name +
          (st.groups.length > 1
            ? ' · ' +
              (comp.id === 'LIB' || comp.id === 'SULA' ? 'Grupo ' + String.fromCharCode(65 + gi) : 'Grupo ' + (gi + 1))
            : ''),
      });
  }
  const s = userStanding(W);
  if (s && !(s.comp.id === cid && s.si === f.st))
    tables.push({ comp: s.comp, si: s.si, gi: s.gi, title: s.comp.name + ' · classificação' });

  return (
    <Modal wide>
      <ModalHeader>
        <div style={{ flex: 1 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {comp.name} · {st.name}
          </span>
          <h2>
            {head}: {W.clubs[f.h].n} {f.hg} x {f.ag} {W.clubs[f.a].n}
            {f.hp !== undefined ? ` (pên. ${f.hp}x${f.ap})` : ''}
          </h2>
        </div>
      </ModalHeader>
      <div className="roundgrid">
        <div>
          <div className="panel">
            <h3>
              {comp.name}: {st.type === 'league' ? 'rodada ' + roundOf(f) : st.name.toLowerCase()}
            </h3>
            <table className="t results">
              <tbody>
                {mine.map((x) => (
                  <ResultRow key={x.id} f={x} me={x.id === f.id} />
                ))}
              </tbody>
            </table>
          </div>
          {others.map(({ c, fx }) => (
            <details key={c.id} className="panel daycomp">
              <summary>
                <h3>
                  {c.name} <small className="muted">{fx.length === 1 ? '1 jogo' : fx.length + ' jogos'} hoje</small>
                </h3>
              </summary>
              <table className="t results">
                <tbody>
                  {fx.map((x) => (
                    <ResultRow key={x.id} f={x} me={false} />
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
        <div>
          {tables.map((t) => (
            <LeagueTable key={t.comp.id + t.si + t.gi} W={W} comp={t.comp} si={t.si} gi={t.gi} title={t.title} still />
          ))}
          {!tables.length && <p className="muted">Sem tabela de pontos nesta fase.</p>}
        </div>
      </div>
      <div className="roundbtns">
        <button className="btn" onClick={() => openModal({ kind: 'report', comp: cid, fid })}>
          Estatísticas do jogo
        </button>
        <button className="btn pri" onClick={closeModal} autoFocus>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
