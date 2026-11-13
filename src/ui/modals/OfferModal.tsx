import { useEffect, useState } from 'react';
import {
  acceptIncoming,
  calcValue,
  counterIncoming,
  leagueName,
  offerTalk,
  ovr,
  POS_NAME,
  rejectIncoming,
  roundMoney,
  roundShare,
  unitTxt,
} from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { Amount, Patience, TalkLog } from '../components/Negotiation';
import { money, potTxt } from '../format';

const pct = (v: number) => Math.round(v * 100) + '%';

/**
 * Proposta de outro clube por um jogador do usuário, em rodadas: aceitar a oferta, pedir mais (o clube melhora, mantém
 * ou desiste) ou recusar. Se o clube aceitar o seu pedido, o negócio fecha na hora.
 */
export function OfferModal({ id }: { id: number }) {
  const W = useWorld();
  const mutate = useGame((s) => s.mutate);
  const closeModal = useUi((s) => s.closeModal);
  const o = W.mk?.offers.find((x) => x.id === id);
  const [done, setDone] = useState<{ ok: boolean; msg: string; club: number; pid: number } | null>(null);
  const p = o ? W.pmap[o.pid] : done ? W.pmap[done.pid] : undefined;
  const loan = o?.kind === 'loan';
  const ask0 = o ? (loan ? o.share : o.fee) : 0;
  const listed = o ? W.mk?.sell[o.pid] : undefined;
  const [want, setWant] = useState(() =>
    loan ? roundShare(Math.min(1, ask0 + 0.2)) : roundMoney(Math.max(ask0 * 1.25, listed || 0)),
  );
  const save = () => void useGame.getState().save();

  // propostas de saves antigos ainda não têm conversa
  useEffect(() => {
    if (o && !o.talk) mutate((W) => void offerTalk(W, o));
  }, [o, mutate]);

  if (!p || (!o && !done)) {
    return (
      <Modal>
        <ModalHeader>
          <h2>Proposta encerrada</h2>
        </ModalHeader>
        <p className="muted">Esta proposta não existe mais (venceu o prazo ou o clube desistiu).</p>
      </Modal>
    );
  }

  if (done || !o) {
    const club = W.clubs[done!.club];
    return (
      <Modal>
        <ModalHeader>
          <Crest club={club} size={36} />
          <h2>{done!.ok ? 'Negócio fechado' : 'Proposta encerrada'}</h2>
        </ModalHeader>
        <p className={`dealans ${done!.ok ? 'accept' : 'reject'}`}>{done!.msg}</p>
        <div className="dealbtns">
          <button className="btn pri" onClick={closeModal} autoFocus>
            Fechar
          </button>
        </div>
      </Modal>
    );
  }

  const club = W.clubs[o.from];
  const talk = o.talk;
  const value = calcValue(p);

  const accept = () => {
    let err: string | null = null;
    mutate((W) => {
      err = acceptIncoming(W, o.id);
    });
    save();
    if (err) return toast(err);
    const msg = loan
      ? `${p.n} vai emprestado ao ${club.n}, que paga ${pct(o.share)} do salário.`
      : `${p.n} foi vendido ao ${club.n} por ${money(o.fee)}.`;
    toast(msg, 3500);
    setDone({ ok: true, msg, club: club.id, pid: p.id });
  };

  const counter = () => {
    let r!: ReturnType<typeof counterIncoming>;
    mutate((W) => {
      r = counterIncoming(W, o.id, want);
    });
    save();
    if (r.r === 'sold') {
      toast(r.msg, 3500);
      setDone({ ok: true, msg: r.msg, club: club.id, pid: p.id });
    } else if (r.r === 'gone') setDone({ ok: false, msg: r.msg, club: club.id, pid: p.id });
    else {
      // o próximo pedido já começa entre o seu e a nova oferta
      const now = W.mk!.offers.find((x) => x.id === o.id)!;
      const v = loan ? now.share : now.fee;
      setWant(loan ? roundShare((want + v) / 2 + 0.025) : roundMoney((want + v) / 2));
    }
  };

  const reject = () => {
    mutate((W) => rejectIncoming(W, o.id));
    save();
    closeModal();
  };

  return (
    <Modal>
      <ModalHeader>
        <Crest club={club} size={36} />
        <div style={{ flex: 1 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Proposta {loan ? 'de empréstimo' : 'de compra'} · {club.n} ({leagueName(club)})
          </span>
          <h2>{p.n}</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {POS_NAME[p.p]}, {p.a} anos · OVR {ovr(p)} · potencial {potTxt(p)}
          </div>
        </div>
      </ModalHeader>

      <dl className="kv dealkv">
        <dt>Valor de mercado</dt>
        <dd className="num">{money(value)}</dd>
        {listed != null && (
          <>
            <dt>Seu preço pedido</dt>
            <dd className="num">{money(listed)}</dd>
          </>
        )}
        <dt>Salário</dt>
        <dd className="num">{money(p.sal)}/mês</dd>
        <dt>Responder até</dt>
        <dd>{o.exp - W.day <= 0 ? 'hoje' : unitTxt(W, o.exp - W.day)}</dd>
      </dl>

      <div className="dealstep">
        <h3>
          Negociação com o {club.n}
          {talk && <Patience talk={talk} />}
        </h3>
        {talk && <TalkLog talk={talk} them={club} themName={club.n} />}

        {loan ? (
          <div className="loanbox">
            <div className="loansplit">
              <span>
                {club.s} paga <b className="num">{pct(want)}</b>
                <small className="num">{money(p.sal * want)}/mês</small>
              </span>
              <span className="r">
                Você paga <b className="num">{pct(1 - want)}</b>
                <small className="num">{money(p.sal * (1 - want))}/mês</small>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(want * 100)}
              onChange={(e) => setWant(+e.target.value / 100)}
              style={{ width: '100%' }}
              aria-label="Parte do salário que o outro clube paga"
            />
          </div>
        ) : (
          <Amount
            label="Valor pedido"
            value={want}
            onChange={(v) => setWant(roundMoney(v))}
            min={roundMoney(o.fee)}
            max={Math.round(Math.max(value, o.fee) * 3)}
            step={Math.max(10000, Math.round(value / 100))}
            fmt={money}
            stepDown={(v) => roundMoney(v * 0.95)}
            stepUp={(v) => roundMoney(v * 1.05)}
            hint={
              <>{Math.round((want / value) * 100)}% do valor de mercado. Se o clube aceitar, a venda fecha na hora.</>
            }
          />
        )}

        <div className="dealbtns">
          <button className="btn ghost" onClick={reject}>
            Recusar
          </button>
          <button className="btn" onClick={counter} disabled={want <= ask0}>
            {loan ? `Pedir ${pct(want)}` : `Pedir ${money(want)}`}
          </button>
          <button className="btn pri" onClick={accept}>
            Aceitar {loan ? pct(o.share) : money(o.fee)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
