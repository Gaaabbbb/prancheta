import { useEffect, useState } from 'react';
import {
  calcValue,
  clubTalk,
  ensureMarket,
  getTalk,
  keyRole,
  loanBlock,
  loanRequest,
  loanTalk,
  offerContract,
  offerToClub,
  ovr,
  playerDemand,
  playerTalk,
  POS_NAME,
  renewContract,
  roundMoney,
  roundShare,
  sellBlock,
  untouchable,
  unitTxt,
  windowState,
  type ClubAnswer,
  type PlayerAnswer,
  type TalkStage,
} from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { Amount, Patience, TalkLog } from '../components/Negotiation';
import { money, potTxt } from '../format';

type Mode = 'buy' | 'loan' | 'free' | 'renew';

const TITLE: Record<Mode, string> = {
  buy: 'Contratar',
  loan: 'Pedir emprestado',
  free: 'Contratar jogador livre',
  renew: 'Renovar contrato',
};

const pct = (v: number) => Math.round(v * 100) + '%';

/**
 * Negociação em rodadas: primeiro o valor (ou a parte do salário, no empréstimo) com o clube, depois salário e duração
 * com o jogador. Cada lado responde com uma contraproposta até fechar ou alguém perder a paciência.
 */
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
  const from = p.c >= 0 ? W.clubs[p.c] : null;
  const ws = windowState(W);
  const needWindow = (mode === 'buy' || mode === 'loan') && !ws.open;
  const role = mode === 'buy' || mode === 'loan' ? keyRole(W, p) : null;
  const demand = playerDemand(W, p, mode === 'renew' ? 'renew' : mode === 'free' ? 'free' : 'buy');
  const stage: TalkStage | null = clubStep
    ? mode === 'loan'
      ? 'loan'
      : 'club'
    : agreed?.kind === 'loan'
      ? null
      : mode === 'renew'
        ? 'renew'
        : 'player';
  // motivo para nem começar a conversa
  const block =
    needWindow || !stage
      ? null
      : stage === 'club'
        ? sellBlock(W, p) ||
          (untouchable(W, p) ? `${p.n} é inegociável para o ${from!.n} nesta janela. Tente na próxima.` : null)
        : stage === 'loan'
          ? sellBlock(W, p) || loanBlock(W, p)
          : demand.refuse || null;
  const talk = stage ? getTalk(W, pid, stage) : undefined;

  // abre a conversa ao entrar na etapa: o outro lado diz o que quer
  useEffect(() => {
    if (!stage || needWindow || block) return;
    mutate((W) => {
      const pl = W.pmap[pid];
      if (stage === 'club') clubTalk(W, pl);
      else if (stage === 'loan') loanTalk(W, pl);
      else playerTalk(W, pl, stage, demand);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, needWindow, block]);

  // sem escolha do usuário, a proposta sugerida fica abaixo do pedido (ou entre a sua última e o pedido)
  const [feeSel, setFee] = useState<number | null>(null);
  const [shareSel, setShare] = useState<number | null>(null);
  const [wageSel, setWage] = useState<number | null>(null);
  const mine = talk ? [...talk.log].reverse().find((m) => m.by === 'me') : undefined;
  const suggest = (k: number, base: number) => (talk ? (mine ? (mine.v + talk.ask) / 2 : talk.ask * k) : base);
  const fee = feeSel ?? roundMoney(suggest(0.8, value * 0.8));
  const share = shareSel ?? roundShare(talk && !mine ? talk.ask - 0.2 : suggest(1, 0.4));
  const wage = wageSel ?? Math.round(suggest(0.88, demand.wage * 0.88) / 1000) * 1000;
  const [years, setYears] = useState(demand.years[0]);
  const [last, setLast] = useState<ClubAnswer | PlayerAnswer | null>(null);

  const save = () => void useGame.getState().save();

  /** roda uma ação do núcleo no mundo e redesenha */
  const run = <T,>(fn: () => T): T => {
    let out!: T;
    mutate(() => {
      out = fn();
    });
    return out;
  };

  const sendClub = (v: number) => {
    const a = run(() => (mode === 'loan' ? loanRequest(W, pid, v) : offerToClub(W, pid, v)));
    setLast(a);
    // a próxima proposta já começa entre a sua e a deles
    if (a.r === 'counter' && mode === 'buy') setFee(roundMoney((v + a.fee) / 2));
    if (a.r === 'counter' && mode === 'loan' && a.share != null) setShare(roundShare((v + a.share) / 2));
    if (a.r === 'accept') toast(a.msg, 3500);
    save();
  };

  const sendPlayer = (w: number, y: number) => {
    const a = run(() => (mode === 'renew' ? renewContract(W, pid, w, y) : offerContract(W, pid, w, y)));
    setLast(a);
    if (a.r === 'counter') {
      setWage(Math.round((w + a.wage) / 2 / 1000) * 1000);
      setYears(Math.min(Math.max(y, a.years[0]), a.years[1]));
    }
    save();
    if (a.r === 'accept') {
      toast(a.msg, 3500);
      closeModal();
    }
  };

  const open = !!talk && !talk.end;
  const themName = stage === 'club' || stage === 'loan' ? from?.n || '' : p.n;

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
            {p.ret != null && <span className="tag ret">aposenta no fim da temporada</span>}
          </div>
        </div>
      </ModalHeader>

      <dl className="kv dealkv">
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

      {role && clubStep && !needWindow && !block && (
        <p className="keynote">
          {role === 'star' ? (
            <>
              <b>Destaque do {from!.n}.</b> O clube pede bem acima do valor de mercado, quase não cede e tem pouca
              paciência. Ele também pede um salário maior para sair.
            </>
          ) : (
            <>
              <b>Titular importante do {from!.n}.</b> Sai mais caro e o clube cede pouco a cada rodada.
            </>
          )}
        </p>
      )}

      {agreed && (
        <p className="dealans accept">
          ✓ Acerto com o {from?.n}:{' '}
          {agreed.kind === 'loan'
            ? `você paga ${pct(agreed.share)} do salário (${money(p.sal * agreed.share)}/mês) até o fim da temporada.`
            : money(agreed.fee) + '.'}
        </p>
      )}

      {needWindow ? (
        <p className="warnbox">
          A janela de transferências está fechada.{' '}
          {ws.opens
            ? `A próxima (${ws.name.toLowerCase()}) abre em ${ws.opens.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}, daqui a ${unitTxt(W, ws.rounds)}.`
            : 'A próxima abre em 5 de janeiro, na pré-temporada.'}
        </p>
      ) : !stage ? (
        <div className="dealstep">
          <h3>2. Confirmar empréstimo</h3>
          <div className="dealbtns">
            <button className="btn pri" onClick={() => sendPlayer(0, 1)}>
              Trazer {p.n}
            </button>
          </div>
        </div>
      ) : block ? (
        <p className="dealans reject">✕ {block}</p>
      ) : (
        <div className="dealstep">
          <h3>
            {stage === 'club' || stage === 'loan'
              ? `1. Negociação com o ${from!.n}`
              : `${mode === 'buy' || mode === 'loan' ? '2. ' : ''}Contrato com ${p.n}`}
            {talk && <Patience talk={talk} />}
          </h3>
          {talk?.rival && !talk.end && stage === 'club' && (
            <p className="rivalbox">
              <b>Concorrência:</b> o {W.clubs[talk.rival.club].n} ofereceu {money(talk.rival.fee)} por {p.n}.{' '}
              {talk.rival.until - W.day <= 0
                ? 'Feche hoje ou ele leva o jogador.'
                : `Você tem ${unitTxt(W, talk.rival.until - W.day)} para fechar antes dele.`}
            </p>
          )}
          {talk && (
            <TalkLog talk={talk} them={stage === 'club' || stage === 'loan' ? from : null} themName={themName} />
          )}

          {talk?.end === 'off' ? (
            <div className="dealbtns">
              <button className="btn" onClick={closeModal}>
                Fechar
              </button>
            </div>
          ) : (
            talk && (
              <>
                {stage === 'club' && (
                  <Amount
                    label="Valor da proposta"
                    value={fee}
                    onChange={(v) => setFee(roundMoney(v))}
                    min={Math.round(value * 0.3)}
                    max={Math.max(talk.ask, Math.round(value * 3))}
                    step={Math.max(10000, Math.round(value / 100))}
                    fmt={money}
                    stepDown={(v) => roundMoney(v * 0.95)}
                    stepUp={(v) => roundMoney(v * 1.05)}
                    hint={
                      <>
                        {Math.round((fee / value) * 100)}% do valor de mercado · o {from!.s} pede {money(talk.ask)}
                      </>
                    }
                  />
                )}
                {stage === 'loan' && (
                  <div className="loanbox">
                    <div className="loansplit">
                      <span>
                        Você paga <b className="num">{pct(share)}</b>
                        <small className="num">{money(p.sal * share)}/mês</small>
                      </span>
                      <span className="r">
                        {from!.s} paga <b className="num">{pct(1 - share)}</b>
                        <small className="num">{money(p.sal * (1 - share))}/mês</small>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(share * 100)}
                      onChange={(e) => setShare(+e.target.value / 100)}
                      style={{ width: '100%' }}
                      aria-label="Parte do salário que você paga"
                    />
                    <p className="amount-hint muted">
                      O {from!.s} quer que você pague {pct(talk.ask)} do salário.
                    </p>
                  </div>
                )}
                {(stage === 'player' || stage === 'renew') && (
                  <>
                    <Amount
                      label="Salário mensal"
                      value={wage}
                      onChange={(v) => setWage(Math.round(v / 1000) * 1000)}
                      min={Math.round(demand.wage * 0.5)}
                      max={Math.max(talk.ask, Math.round(demand.wage * 1.5))}
                      step={1000}
                      fmt={(v) => money(v) + '/mês'}
                      stepDown={(v) => Math.round((v * 0.97) / 1000) * 1000}
                      stepUp={(v) => Math.round((v * 1.03) / 1000) * 1000}
                      hint={<>Ele pede {money(talk.ask)}/mês</>}
                    />
                    <label className="kl" style={{ display: 'block', marginTop: 8 }}>
                      Duração
                    </label>
                    <div className="seg" style={{ marginBottom: 6 }}>
                      {[1, 2, 3, 4, 5].map((y) => (
                        <button key={y} className={years === y ? 'on' : ''} onClick={() => setYears(y)}>
                          {y} ano{y > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="dealbtns">
                  {open && stage === 'club' && (
                    <button className="btn" onClick={() => sendClub(talk.ask)}>
                      Aceitar {money(talk.ask)}
                    </button>
                  )}
                  {open && stage === 'loan' && (
                    <button className="btn" onClick={() => sendClub(talk.ask)}>
                      Aceitar pagar {pct(talk.ask)}
                    </button>
                  )}
                  {open && (stage === 'player' || stage === 'renew') && (
                    <button
                      className="btn"
                      onClick={() => sendPlayer(talk.ask, Math.min(Math.max(years, demand.years[0]), demand.years[1]))}
                    >
                      Aceitar {money(talk.ask)}/mês
                    </button>
                  )}
                  <button
                    className="btn pri"
                    disabled={!open}
                    onClick={() =>
                      stage === 'club' ? sendClub(fee) : stage === 'loan' ? sendClub(share) : sendPlayer(wage, years)
                    }
                  >
                    {stage === 'club' || stage === 'loan'
                      ? 'Enviar proposta'
                      : mode === 'renew'
                        ? 'Propor renovação'
                        : 'Oferecer contrato'}
                  </button>
                </div>
              </>
            )
          )}
          {last?.r === 'reject' && talk?.end !== 'off' && <p className="dealans reject">✕ {last.msg}</p>}
        </div>
      )}
    </Modal>
  );
}
