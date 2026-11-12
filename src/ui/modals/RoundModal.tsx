import { roundOf, userStanding } from '@/core';
import { useWorld } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { Modal, ModalHeader } from '../components/Modal';
import { MiniTable } from '../components/Standings';

const MAX_ROWS = 40;

/** Resumo depois do jogo do usuário: resultados do dia e classificação. */
export function RoundModal({ comp: cid, fid }: { comp: string; fid: number }) {
  const W = useWorld();
  const { closeModal, openModal } = useUi();
  const comp = W.comps[cid];
  const f = comp.fx[fid];
  const st = comp.stages[f.st];
  // a rodada inteira (por dias, os jogos podem cair em dias diferentes) ou o mesmo dia de mata-mata
  const fx = comp.fx.filter((x) => x.st === f.st && roundOf(x) === roundOf(f));
  const home = f.h === W.user,
    gf = (home ? f.hg : f.ag)!,
    ga = (home ? f.ag : f.hg)!;
  const head = gf > ga ? 'Vitória' : gf < ga ? 'Derrota' : 'Empate';
  const s = userStanding(W);
  const name = (id: number) => W.clubs[id].n;
  return (
    <Modal wide>
      <ModalHeader>
        <h2>
          {head}: {name(f.h)} {f.hg} x {f.ag} {name(f.a)}
          {f.hp !== undefined ? ` (pên. ${f.hp}x${f.ap})` : ''}
        </h2>
      </ModalHeader>
      <div className="grid g2">
        <div>
          <h3 style={{ marginBottom: 6 }}>{comp.name}: resultados do dia</h3>
          <table className="t">
            <tbody>
              {fx.slice(0, MAX_ROWS).map((x) => (
                <tr key={x.id} className={x === f ? 'me' : ''}>
                  <td className="r nm">{name(x.h)}</td>
                  <td className="c num">
                    <b>
                      {x.hg} x {x.ag}
                    </b>
                  </td>
                  <td className="nm">{name(x.a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fx.length > MAX_ROWS && <p className="muted">e mais {fx.length - MAX_ROWS} jogos</p>}
        </div>
        <div>
          {s && st.type === 'league' && (
            <>
              <h3 style={{ marginBottom: 6 }}>Classificação</h3>
              <MiniTable W={W} comp={s.comp} si={s.si} gi={s.gi} cols="short" />
            </>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => openModal({ kind: 'report', comp: cid, fid })}>
              Estatísticas do jogo
            </button>
            <button className="btn pri" onClick={closeModal} autoFocus>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
