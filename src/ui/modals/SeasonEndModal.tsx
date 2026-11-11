import { DIV_NAME, DIVS, ovr, youth, youthRecommend, type YouthDecision } from '@/core';
import { newSeason } from '@/app/gameFlow';
import { useGame, useWorld } from '@/store/gameStore';
import { Modal, ModalHeader } from '../components/Modal';
import { Ovr, PosTag } from '../components/Badges';
import { potTxt } from '../format';

export function SeasonEndModal() {
  const W = useWorld();
  const mutate = useGame((s) => s.mutate);
  const me = W.clubs[W.user!];
  const uc = W.comps[me.div];
  const name = (id: number) => W.clubs[id].n;
  let verdict = 'Temporada encerrada.';
  if (uc.res.champ === W.user) verdict = 'Campeão! Que temporada.';
  else if (uc.res.prom.includes(W.user!)) verdict = 'Acesso garantido! Ano que vem, divisão de cima.';
  else if (uc.res.rel.includes(W.user!)) verdict = 'Rebaixado. Hora de reconstruir.';
  const last = youth(W, W.user!).filter((p) => p.a >= 20);
  const decisions = W.youthDecisions || {};
  const decisionOf = (id: number) => decisions[id] || youthRecommend(W, W.pmap[id]);
  const setDecision = (id: number, v: YouthDecision) =>
    mutate((W) => {
      W.youthDecisions = { ...(W.youthDecisions || {}), [id]: v };
    });
  return (
    <Modal wide lock>
      <ModalHeader closable={false}>
        <h2>Fim da temporada {W.year}</h2>
      </ModalHeader>
      <p style={{ fontSize: 18, margin: '0 0 14px' }}>
        <b>{verdict}</b>
      </p>
      <table className="t">
        <thead>
          <tr>
            <th>Divisão</th>
            <th>Campeão</th>
            <th>Acesso</th>
            <th>Rebaixados</th>
          </tr>
        </thead>
        <tbody>
          {DIVS.map((div) => {
            const c = W.comps[div];
            return (
              <tr key={div}>
                <td>
                  <b>{DIV_NAME[div]}</b>
                </td>
                <td>{c.res.champ != null ? name(c.res.champ) : '–'}</td>
                <td>{c.res.prom.map(name).join(', ') || '–'}</td>
                <td>{c.res.rel.map(name).join(', ') || '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {last.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Base: quem completa 21 anos</h3>
          <p className="note" style={{ margin: '0 0 8px' }}>
            Esses garotos não podem mais ficar na base. Escolha quem sobe para o profissional.
          </p>
          <table className="t">
            <tbody>
              {last.map((p) => (
                <tr key={p.id}>
                  <td>
                    <PosTag p={p.p} />
                  </td>
                  <td className="nm">
                    {p.n} <span className="dim">{p.a} anos</span>
                  </td>
                  <td className="c">
                    <Ovr v={ovr(p)} />
                  </td>
                  <td className="c dim num">{potTxt(p)}</td>
                  <td className="r">
                    <select
                      value={decisionOf(p.id)}
                      onChange={(e) => setDecision(p.id, e.target.value as YouthDecision)}
                    >
                      <option value="up">Subir para o profissional</option>
                      <option value="out">Dispensar</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Na virada, os jogadores envelhecem e evoluem (ou caem de rendimento), veteranos se aposentam e a peneira traz
        novos garotos para a base.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn pri big" onClick={newSeason} autoFocus>
          Começar {W.year + 1}
        </button>
      </div>
    </Modal>
  );
}
