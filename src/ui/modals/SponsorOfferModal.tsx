import { useEffect, useState } from 'react';
import {
  acceptOffer,
  counterSponsor,
  rejectOffer,
  SLOT_NAME,
  slotLocked,
  sponsorDef,
  sponsorTalk,
  STYLE_NAME,
  terminationFee,
  unitTxt,
} from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { SponsorLogo } from '../finance/SponsorsTab';
import { Modal, ModalHeader } from '../components/Modal';
import { Amount, Patience, TalkLog } from '../components/Negotiation';
import { money } from '../format';

const nice = (v: number) => (v >= 1e7 ? Math.round(v / 1e5) * 1e5 : Math.round(v / 1e4) * 1e4);

/** Proposta de patrocínio em rodadas: assinar, pedir mais (a marca sobe, mantém ou desiste) ou recusar. */
export function SponsorOfferModal({ id }: { id: number }) {
  const W = useWorld();
  const mutate = useGame((s) => s.mutate);
  const closeModal = useUi((s) => s.closeModal);
  const o = W.sp?.offers.find((x) => x.id === id);
  const [gone, setGone] = useState<string | null>(null);
  const [wantSel, setWant] = useState<number | null>(null);
  const save = () => void useGame.getState().save();

  // propostas de saves antigos ainda não têm conversa
  useEffect(() => {
    if (o && !o.talk) mutate((W) => void sponsorTalk(W, o));
  }, [o, mutate]);

  if (!o) {
    return (
      <Modal>
        <ModalHeader>
          <h2>Proposta encerrada</h2>
        </ModalHeader>
        <p className={gone ? 'dealans reject' : 'muted'}>
          {gone || 'Esta proposta não existe mais (venceu o prazo ou a marca desistiu).'}
        </p>
        <div className="dealbtns">
          <button className="btn pri" onClick={closeModal} autoFocus>
            Fechar
          </button>
        </div>
      </Modal>
    );
  }

  const def = sponsorDef(o.sid);
  const sp = W.sp!;
  const cur = sp[o.slot];
  const replace = !!cur && !o.renewal;
  const locked = replace && slotLocked(W, o.slot);
  const fee = replace ? Math.round(terminationFee(W, cur!) * (1 - o.cover)) : 0;
  const talk = o.talk;
  const want = wantSel ?? nice(o.val * 1.12);
  const dealt = talk?.end === 'deal';

  const sign = () => {
    let err: string | null = null;
    mutate((W) => {
      err = acceptOffer(W, o.id);
    });
    if (err) return toast(err);
    save();
    toast(`Contrato assinado com a ${def.n}.`, 3500);
    closeModal();
  };

  const ask = () => {
    let r!: ReturnType<typeof counterSponsor>;
    mutate((W) => {
      r = counterSponsor(W, o.id, want);
    });
    save();
    if (r.r === 'gone') setGone(r.msg);
    else if (r.r === 'counter') setWant(nice((want + o.val) / 2));
  };

  const reject = () => {
    mutate((W) => rejectOffer(W, o.id));
    save();
    closeModal();
  };

  const diff = cur ? Math.round((o.val / cur.val - 1) * 100) : 0;
  return (
    <Modal>
      <ModalHeader>
        <SponsorLogo def={def} size={36} />
        <div style={{ flex: 1 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {o.renewal ? 'Renovação' : replace ? `Quer substituir a ${sponsorDef(cur!.sid).n}` : 'Espaço livre'} ·{' '}
            {SLOT_NAME[o.slot]}
          </span>
          <h2>{def.n}</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {def.sec} · {STYLE_NAME[def.style]}
          </div>
        </div>
      </ModalHeader>

      <dl className="kv dealkv">
        <dt>Contrato</dt>
        <dd>{o.to > o.from ? `${o.from} a ${o.to}` : o.to}</dd>
        {cur && (
          <>
            <dt>Contrato atual</dt>
            <dd className="num">
              {money(cur.val)}/ano ({sponsorDef(cur.sid).n})
            </dd>
          </>
        )}
        {replace && (
          <>
            <dt>Multa a pagar</dt>
            <dd className="num">
              {money(fee)}
              {o.cover > 0 && <span className="muted"> ({Math.round(o.cover * 100)}% coberta)</span>}
            </dd>
          </>
        )}
        <dt>Responder até</dt>
        <dd>{o.exp - W.day <= 0 ? 'hoje' : unitTxt(W, o.exp - W.day)}</dd>
      </dl>

      <div className="dealstep">
        <h3>
          Negociação com a {def.n}
          {talk && <Patience talk={talk} />}
        </h3>
        {talk && <TalkLog talk={talk} themName={def.n} />}
        {!dealt && (
          <Amount
            label="Valor pedido por ano"
            value={want}
            onChange={(v) => setWant(nice(v))}
            min={nice(o.val)}
            max={nice(o.val * 2)}
            step={Math.max(10000, nice(o.val / 100))}
            fmt={(v) => money(v) + '/ano'}
            stepDown={(v) => nice(v * 0.97)}
            stepUp={(v) => nice(v * 1.03)}
            hint={
              cur ? (
                <>
                  A proposta atual é {diff >= 0 ? '+' : ''}
                  {diff}% em relação ao contrato de hoje.
                </>
              ) : undefined
            }
          />
        )}
        <div className="dealbtns">
          <button className="btn ghost" onClick={reject}>
            Recusar
          </button>
          {!dealt && (
            <button className="btn" onClick={ask} disabled={want <= o.val}>
              Pedir {money(want)}
            </button>
          )}
          <button
            className="btn pri"
            onClick={sign}
            disabled={locked}
            title={locked ? 'Este espaço já foi trocado nesta temporada' : undefined}
          >
            Assinar por {money(o.val)}
            {fee ? ` (multa ${money(fee)})` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
