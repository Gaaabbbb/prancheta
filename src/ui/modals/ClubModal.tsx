import { DIV_NAME, leagueName, ovr, squad, teamStrength, youth } from '@/core';
import { useWorld } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { Ovr, PosTag, StrengthStars } from '../components/Badges';
import { PlayerTable } from '../components/PlayerTable';
import { int, money, potTxt } from '../format';

export function ClubModal({ id }: { id: number }) {
  const W = useWorld();
  const openModal = useUi((s) => s.openModal);
  const c = W.clubs[id];
  const sq = squad(W, c.id);
  const wage = sq.reduce((s, p) => s + p.sal, 0);
  const allKids = youth(W, c.id);
  const kids = allKids.sort((a, b) => ovr(b) - ovr(a)).slice(0, 10);
  return (
    <Modal wide>
      <ModalHeader>
        <Crest club={c} size={46} />
        <div style={{ flex: 1 }}>
          <h2>{c.n}</h2>
          <div className="muted">
            {c.div === 'SUL' ? leagueName(c) : `${DIV_NAME[c.div]}, ${c.uf}`} &nbsp; {c.std} ({int(c.cap)}) &nbsp;{' '}
            <StrengthStars s={teamStrength(W, c)} />
          </div>
        </div>
      </ModalHeader>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        Formação preferida {c.tac.f} &nbsp; reputação {c.rep} &nbsp; caixa {money(c.bal)} &nbsp; folha {money(wage)}/mês
      </p>
      <PlayerTable players={sq} />
      {kids.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>
            Destaques da base{' '}
            <small className="muted" style={{ fontFamily: 'var(--fb)', fontSize: 12 }}>
              {allKids.length} garotos
            </small>
          </h3>
          <table className="t">
            <tbody>
              {kids.map((p) => (
                <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                  <td>
                    <PosTag p={p.p} />
                  </td>
                  <td className="nm">{p.n}</td>
                  <td className="r num">{p.a}</td>
                  <td className="c">
                    <Ovr v={ovr(p)} />
                  </td>
                  <td className="c dim num">{potTxt(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
