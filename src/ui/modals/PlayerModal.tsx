import {
  aiListed,
  ATTR,
  ATTR_NAME,
  calcValue,
  demote,
  ovr,
  ovrRole,
  POS,
  POS_NAME,
  RULES,
  tidyLineup,
  toggleWatch,
} from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { StatusTags } from '../components/Badges';
import { evoDelta, money, ovrCls, potTxt, rating } from '../format';
import { youthActions } from '@/app/youthActions';

const attrCls = (x: number) => (x >= 15 ? 'a-hi' : x >= 10 ? 'a-md' : 'a-lo');

export function PlayerModal({ id }: { id: number }) {
  const W = useWorld();
  const openModal = useUi((s) => s.openModal);
  const closeModal = useUi((s) => s.closeModal);
  const mutate = useGame((s) => s.mutate);
  const p = W.pmap[id];
  if (!p) return null;
  const c = W.clubs[p.c];
  const o = ovr(p);
  const roles = POS.filter((r) => r !== p.p)
    .map((r) => [r, ovrRole(p, r)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const mine = p.c === W.user;
  const market = RULES.market;
  const watched = !!W.mk?.watch.includes(p.id);
  const evo = evoDelta(p);
  return (
    <Modal>
      <ModalHeader>
        {c ? <Crest club={c} size={40} /> : <span className="fa-badge">LIVRE</span>}
        <div style={{ flex: 1 }}>
          <h2>
            {p.n} {p.real && <span className="tag real">real</span>}
          </h2>
          <div className="muted">
            {POS_NAME[p.p]}, {p.a} anos, {p.nat || 'Brasil'},{' '}
            {c ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openModal({ kind: 'club', id: c.id });
                }}
              >
                {c.n}
              </a>
            ) : (
              'sem clube'
            )}
            {p.loan && <> (emprestado pelo {W.clubs[p.loan.from].n})</>}
            {p.y ? ' (base)' : ''} <StatusTags p={p} />
            {market && c && !mine && aiListed(W, p) && <span className="tag mk">à venda</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{ fontFamily: 'var(--fd)', fontSize: 44, fontWeight: 800, lineHeight: 1 }}
            className={ovrCls(o) === 'o9' ? 'a-hi' : ''}
          >
            {o}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            potencial {potTxt(p)}
          </div>
        </div>
      </ModalHeader>
      <div className="grid g2">
        <div>
          <h3 style={{ marginBottom: 8 }}>Atributos</h3>
          <div className="attrs">
            {ATTR.map((k, i) => (
              <div className="attr" key={k}>
                <span>{ATTR_NAME[k]}</span>
                <b className={attrCls(p.at[i])}>{p.at[i]}</b>
                <div className="bar">
                  <i style={{ width: `${p.at[i] * 5}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Também joga como: {roles.map((r) => r[0] + ' ' + r[1]).join(', ')}
          </p>
        </div>
        <div>
          <h3 style={{ marginBottom: 8 }}>Situação</h3>
          <dl className="kv">
            <dt>Condição física</dt>
            <dd>{Math.round(p.f)}%</dd>
            <dt>Moral</dt>
            <dd>{Math.round(p.mo)}</dd>
            <dt>Valor de mercado</dt>
            <dd>{money(calcValue(p))}</dd>
            {p.y ? (
              <>
                <dt>Evolução na temporada</dt>
                <dd>
                  {evo > 0 ? (
                    <b style={{ color: 'var(--ok)' }}>+{evo}</b>
                  ) : evo < 0 ? (
                    <span style={{ color: '#ff9a9d' }}>{evo}</span>
                  ) : (
                    <span className="dim">0</span>
                  )}
                </dd>
              </>
            ) : (
              <>
                <dt>{c ? 'Salário' : 'Último salário'}</dt>
                <dd>{money(p.sal)}/mês</dd>
                {c && (
                  <>
                    <dt>Contrato até</dt>
                    <dd style={{ color: p.ct <= W.year ? 'var(--yellow)' : undefined }}>
                      {p.ct}
                      {p.ct <= W.year ? ' (último ano)' : ''}
                    </dd>
                  </>
                )}
              </>
            )}
            <dt>Temporada</dt>
            <dd>
              {p.st.j} jogos, {p.st.g} gols, {p.st.as} assist., nota {rating(p)}
            </dd>
            <dt>Carreira (no jogo)</dt>
            <dd>
              {p.car.j} jogos, {p.car.g} gols
            </dd>
            <dt>Cartões acumulados</dt>
            <dd>{p.yc} amarelo(s)</dd>
          </dl>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mine && p.y ? (
              <>
                <button className="btn sm pri" onClick={() => youthActions.promote(p)}>
                  Subir para o profissional
                </button>
                <button className="btn sm" onClick={() => youthActions.release(p)}>
                  Dispensar
                </button>
              </>
            ) : null}
            {mine && !p.y && p.a <= 20 && (
              <button
                className="btn sm"
                onClick={() => {
                  mutate((W) => {
                    demote(W, p);
                    tidyLineup(W, W.clubs[W.user!]);
                  });
                  closeModal();
                  toast(p.n + ' voltou para a base.');
                }}
              >
                Mandar para a base
              </button>
            )}
            {market && !p.y && !mine && (
              <>
                <button
                  className="btn sm pri"
                  onClick={() => openModal({ kind: 'deal', pid: p.id, mode: c ? 'buy' : 'free' })}
                >
                  {c ? 'Fazer proposta' : 'Contratar'}
                </button>
                {c && !p.loan && (
                  <button className="btn sm" onClick={() => openModal({ kind: 'deal', pid: p.id, mode: 'loan' })}>
                    Pedir emprestado
                  </button>
                )}
                <button
                  className="btn sm"
                  onClick={() => {
                    let on = false;
                    mutate((W) => {
                      on = toggleWatch(W, p.id);
                    });
                    toast(on ? `${p.n} na lista de observação.` : `${p.n} saiu da lista de observação.`);
                  }}
                >
                  {watched ? '★ Observando' : '☆ Observar'}
                </button>
              </>
            )}
            {market && mine && !p.y && !p.loan && (
              <>
                <button className="btn sm pri" onClick={() => openModal({ kind: 'deal', pid: p.id, mode: 'renew' })}>
                  Renovar contrato
                </button>
                <button
                  className="btn sm"
                  onClick={() => {
                    useUi.getState().set({ marketTab: 'mine' });
                    useUi.getState().go('market');
                    closeModal();
                  }}
                >
                  Vender, emprestar ou dispensar
                </button>
              </>
            )}
            <button className="btn sm" onClick={() => openModal({ kind: 'editAttrs', id: p.id })}>
              Editar jogador
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
