import { useState } from 'react';
import {
  calcValue,
  ensureMarket,
  keyRole,
  loanRequest,
  MAX_TRIES,
  offerContract,
  offerToClub,
  ovr,
  playerDemand,
  POS_NAME,
  renewContract,
  roundMoney,
  triesLeft,
  untouchable,
  windowState,
  type ClubAnswer,
  type PlayerAnswer,
} from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { money, potTxt } from '../format';

type Mode = 'buy' | 'loan' | 'free' | 'renew';

const TITLE: Record<Mode, string> = {
  buy: 'Contratar',
  loan: 'Pedir emprestado',
  free: 'Contratar jogador livre',
  renew: 'Renovar contrato',
};

/** Negociação em duas etapas: valor com o clube, depois salário e duração com o jogador. */
export function DealModal({ pid, mode }: { pid: number; mode: Mode }) {
  const W = useWorld();
  if (!W.mk) ensureMarket(W);
  return W.pmap[pid] ? <DealBody pid={pid} mode={mode} /> : null;
}

function DealBody({ pid, mode }: { pid: number; mode: Mode }) {
  const W = useWorld();
  const mutate = useGame((s) => s.mutate);
  const closeModal = useUi((s) => s.closeModal);
  const p = W.pmap[pid];
  const agreed = W.mk?.agreed[pid];
  const clubStep = (mode === 'buy' || mode === 'loan') && !agreed;
  const value = calcValue(p);
  const [fee, setFee] = useState(() => roundMoney(value));
  const [share, setShare] = useState(0.75);
  const [clubAns, setClubAns] = useState<ClubAnswer | null>(null);
  const demand = playerDemand(W, p, mode === 'renew' ? 'renew' : mode === 'free' ? 'free' : 'buy');
  const [wage, setWage] = useState(demand.wage);
  const [years, setYears] = useState(demand.years[0]);
  const [playerAns, setPlayerAns] = useState<PlayerAnswer | null>(null);
  const from = p.c >= 0 ? W.clubs[p.c] : null;
  const ws = windowState(W);
  const role = mode === 'buy' || mode === 'loan' ? keyRole(W, p) : null;
  const save = () => void useGame.getState().save();

  /** roda uma ação do núcleo no mundo e redesenha */
  const run = <T,>(fn: () => T): T => {
    let out!: T;
    mutate(() => {
      out = fn();
    });
    return out;
  };

  const sendClub = (v = fee) => {
    const a = run(() => (mode === 'loan' ? loanRequest(W, pid, share) : offerToClub(W, pid, v)));
    setClubAns(a);
    if (a.r === 'counter' && mode === 'buy') setFee(a.fee);
    save();
  };

  const sendPlayer = (w = wage, y = years) => {
    const a = run(() => (mode === 'renew' ? renewContract(W, pid, w, y) : offerContract(W, pid, w, y)));
    setPlayerAns(a);
    if (a.r === 'counter') {
      setWage(a.wage);
      setYears(Math.min(Math.max(y, a.years[0]), a.years[1]));
    }
    if (a.r === 'accept') {
      toast(a.msg, 3500);
      save();
      closeModal();
    }
  };

  const needWindow = (mode === 'buy' || mode === 'loan') && !ws.open;
  const ansBox = (a: ClubAnswer | PlayerAnswer | null) =>
    a && (
      <p className={`dealans ${a.r}`}>
        {a.r === 'accept' ? '✓ ' : a.r === 'counter' ? '↔ ' : '✕ '}
        {a.msg}
      </p>
    );

  return (
    <Modal>
      <ModalHeader>
        {from ? <Crest club={from} size={36} /> : <span className="fa-badge">LIVRE</span>}
        <div style={{ flex: 1 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {TITLE[mode]}
          </span>
          <h2>{p.n}</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {POS_NAME[p.p]}, {p.a} anos · OVR {ovr(p)} · potencial {potTxt(p)} · {from ? from.n : 'sem clube'}
          </div>
        </div>
      </ModalHeader>

      <dl className="kv" style={{ marginBottom: 12 }}>
        <dt>Valor de mercado</dt>
        <dd className="num">{money(value)}</dd>
        <dt>Salário atual</dt>
        <dd className="num">{p.c >= 0 ? money(p.sal) + '/mês' : '—'}</dd>
        {p.c >= 0 && (
          <>
            <dt>Contrato até</dt>
            <dd className="num">{p.ct}</dd>
          </>
        )}
        <dt>Seu caixa</dt>
        <dd className="num">{money(W.clubs[W.user!].bal)}</dd>
      </dl>

      {role && clubStep && !needWindow && (
        <p className="keynote">
          {untouchable(W, p) ? (
            <>
              <b>Inegociável nesta janela.</b> {p.n} é um dos destaques do {from!.n}, que não quer nem ouvir propostas
              agora. Tente na próxima janela.
            </>
          ) : role === 'star' ? (
            <>
              <b>Destaque do {from!.n}.</b> O clube pede bem acima do valor de mercado, só conversa com propostas perto
              do pedido e quase não cede. Ele também pede um salário maior para sair.
            </>
          ) : (
            <>
              <b>Titular importante do {from!.n}.</b> Sai mais caro e o clube cede pouco na negociação.
            </>
          )}
        </p>
      )}

      {needWindow ? (
        <p className="warnbox">
          A janela de transferências está fechada.{' '}
          {ws.opens
            ? `A próxima (${ws.name.toLowerCase()}) abre em ${ws.opens.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}, daqui a ${ws.rounds} rodada(s).`
            : 'A próxima abre em 5 de janeiro, na pré-temporada.'}
        </p>
      ) : clubStep ? (
        <div className="dealstep">
          <h3>
            1. Acerto com o {from!.n}{' '}
            <small>
              {triesLeft(W, pid, mode === 'loan' ? 'loan' : 'club')} de {MAX_TRIES} tentativas
            </small>
          </h3>
          {mode === 'buy' ? (
            <>
              <div className="feerow">
                <button className="btn" onClick={() => setFee(roundMoney(fee * 0.9))} aria-label="Diminuir">
                  −
                </button>
                <b className="num">{money(fee)}</b>
                <button className="btn" onClick={() => setFee(roundMoney(fee * 1.1))} aria-label="Aumentar">
                  +
                </button>
              </div>
              <input
                type="range"
                min={Math.round(value * 0.4)}
                max={Math.round(value * 2.5)}
                step={Math.max(10000, Math.round(value / 100))}
                value={fee}
                onChange={(e) => setFee(roundMoney(+e.target.value))}
                style={{ width: '100%' }}
                aria-label="Valor da proposta"
              />
              <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
                {Math.round((fee / value) * 100)}% do valor de mercado
              </p>
            </>
          ) : (
            <div className="seg" style={{ marginBottom: 10 }}>
              {[0.5, 0.75, 1].map((v) => (
                <button key={v} className={share === v ? 'on' : ''} onClick={() => setShare(v)}>
                  Pago {Math.round(v * 100)}% do salário
                </button>
              ))}
            </div>
          )}
          {ansBox(clubAns)}
          <div className="dealbtns">
            {clubAns?.r === 'counter' && mode === 'buy' && (
              <button className="btn pri" onClick={() => sendClub(clubAns.fee)}>
                Aceitar {money(clubAns.fee)}
              </button>
            )}
            <button className={`btn ${clubAns?.r === 'counter' ? '' : 'pri'}`} onClick={() => sendClub()}>
              {mode === 'loan' ? 'Pedir empréstimo' : 'Enviar proposta'}
            </button>
          </div>
        </div>
      ) : agreed?.kind === 'loan' ? (
        <div className="dealstep">
          <h3>2. Confirmar empréstimo</h3>
          <p>
            Acerto feito: você paga {Math.round(agreed.share * 100)}% do salário ({money(p.sal * agreed.share)}/mês) até
            o fim da temporada.
          </p>
          {ansBox(playerAns)}
          <div className="dealbtns">
            <button className="btn pri" onClick={() => sendPlayer(0, 1)}>
              Trazer {p.n}
            </button>
          </div>
        </div>
      ) : (
        <div className="dealstep">
          <h3>
            {mode === 'renew' || mode === 'free' ? '' : '2. '}Contrato com {p.n}{' '}
            <small>
              {triesLeft(W, pid, mode === 'renew' ? 'renew' : 'player')} de {MAX_TRIES} tentativas
            </small>
          </h3>
          {agreed && <p className="dealans accept">✓ Valor acertado com o clube: {money(agreed.fee)}.</p>}
          {demand.refuse ? (
            <p className="dealans reject">✕ {demand.refuse}</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
                {p.n} pede cerca de <b>{money(demand.wage)}/mês</b> e um contrato de {demand.years[0]} a{' '}
                {demand.years[1]} anos.
              </p>
              <label className="kl">Salário mensal</label>
              <div className="feerow">
                <button className="btn" onClick={() => setWage(Math.round(wage * 0.95))} aria-label="Diminuir">
                  −
                </button>
                <b className="num">{money(wage)}</b>
                <button className="btn" onClick={() => setWage(Math.round(wage * 1.05))} aria-label="Aumentar">
                  +
                </button>
              </div>
              <input
                type="range"
                min={Math.round(demand.wage * 0.6)}
                max={Math.round(demand.wage * 1.5)}
                step={1000}
                value={wage}
                onChange={(e) => setWage(+e.target.value)}
                style={{ width: '100%' }}
                aria-label="Salário"
              />
              <label className="kl" style={{ display: 'block', marginTop: 8 }}>
                Duração
              </label>
              <div className="seg" style={{ marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((y) => (
                  <button key={y} className={years === y ? 'on' : ''} onClick={() => setYears(y)}>
                    {y} ano{y > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
              {ansBox(playerAns)}
              <div className="dealbtns">
                {playerAns?.r === 'counter' && (
                  <button className="btn pri" onClick={() => sendPlayer(playerAns.wage, years)}>
                    Aceitar {money(playerAns.wage)}/mês
                  </button>
                )}
                <button className={`btn ${playerAns?.r === 'counter' ? '' : 'pri'}`} onClick={() => sendPlayer()}>
                  {mode === 'renew' ? 'Propor renovação' : 'Oferecer contrato'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
