import {
  acceptOffer,
  DIV_NAME,
  ensureSponsors,
  haggleOffer,
  rejectOffer,
  seekSponsors,
  seekWait,
  SLOT_NAME,
  SLOTS,
  sponsorDef,
  sponsorSatisfaction,
  SPONSORS,
  STYLE_NAME,
  terminateContract,
  terminationFee,
  PAYDAYS,
  type SponsorContract,
  type SponsorDef,
  type SponsorOffer,
  type World,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { money } from '../format';

/** "Logotipo" da marca: as cores dela com as iniciais. */
export function SponsorLogo({ def, size = 44 }: { def: SponsorDef; size?: number }) {
  const ini = def.n
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span
      className="slogo"
      style={{ width: size * 1.4, height: size, background: def.c1, color: def.c2, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {ini}
    </span>
  );
}

const satInfo = (s: number) =>
  s >= 60
    ? { txt: 'Satisfeito', col: 'var(--ok)' }
    : s >= 40
      ? { txt: 'Atento aos resultados', col: 'var(--yellow)' }
      : { txt: 'Insatisfeito: pode romper', col: 'var(--red)' };

const years = (c: SponsorContract) => (c.to > c.from ? `${c.from} a ${c.to}` : `${c.to}`);

export function SponsorsTab({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  if (!W.sp) ensureSponsors(W);
  const sp = W.sp!;
  const me = W.clubs[W.user!];
  const wait = seekWait(W);
  const save = () => void useGame.getState().save();

  const act = (fn: (W: World) => string | null | void, ok?: string) => {
    let err: string | null | void = null;
    mutate((W) => {
      err = fn(W);
    });
    if (err) toast(err);
    else {
      if (ok) toast(ok);
      save();
    }
  };

  const accept = (o: SponsorOffer) => {
    const cur = sp[o.slot];
    const def = sponsorDef(o.sid);
    const fee = cur && !o.renewal ? Math.round(terminationFee(W, cur) * (1 - o.cover)) : 0;
    if (!fee) return act((W) => acceptOffer(W, o.id), `Contrato assinado com a ${def.n}.`);
    openModal({
      kind: 'confirm',
      title: `Trocar a ${sponsorDef(cur!.sid).n} pela ${def.n}?`,
      body: (
        <>
          Para encerrar o contrato atual o clube paga {money(fee)} de multa
          {o.cover ? ` (a ${def.n} cobre ${Math.round(o.cover * 100)}% da multa cheia)` : ''}. Em troca, o patrocínio
          passa de {money(cur!.val)} para {money(o.val)} por ano.
        </>
      ),
      ok: 'Assinar',
      onOk: () => act((W) => acceptOffer(W, o.id), `Contrato assinado com a ${def.n}.`),
    });
  };

  const haggle = (o: SponsorOffer) => {
    let r: ReturnType<typeof haggleOffer> = null;
    mutate((W) => {
      r = haggleOffer(W, o.id);
    });
    const n = sponsorDef(o.sid).n;
    toast(
      r === 'up'
        ? `A ${n} aceitou melhorar a proposta.`
        : r === 'gone'
          ? `A ${n} não gostou e retirou a proposta.`
          : `A ${n} manteve a proposta como estava.`,
    );
    save();
  };

  const terminate = (c: SponsorContract) => {
    const def = sponsorDef(c.sid);
    const fee = terminationFee(W, c);
    openModal({
      kind: 'confirm',
      title: `Rescindir com a ${def.n}?`,
      body: (
        <>
          A multa é de {money(fee)} (40% do que falta receber do contrato). O espaço de{' '}
          {SLOT_NAME[c.slot].toLowerCase()} fica livre até você assinar com outra marca, e o clube deixa de receber{' '}
          {money(c.val / PAYDAYS)} por mês.
        </>
      ),
      ok: 'Rescindir',
      onOk: () => act((W) => terminateContract(W, c.slot), 'Contrato rescindido.'),
    });
  };

  const seek = () => {
    let n = 0;
    mutate((W) => {
      n = seekSponsors(W);
    });
    toast(n ? `O departamento comercial trouxe ${n} proposta(s).` : 'Nenhuma marca se interessou agora.');
    save();
  };

  const market = SPONSORS.filter((s) => s.divs.includes(me.div));
  const inUse = new Set([sp.master?.sid, sp.sec?.sid]);

  return (
    <>
      <div className="grid g2">
        {SLOTS.map((slot) => {
          const c = sp[slot];
          if (!c)
            return (
              <div key={slot} className="panel spslot empty">
                <h3>
                  <span>{SLOT_NAME[slot]}</span>
                  <small>espaço livre</small>
                </h3>
                <p className="muted">
                  Sem patrocinador neste espaço, o clube não recebe nada por ele. Aceite uma proposta abaixo ou peça ao
                  departamento comercial para procurar marcas.
                </p>
                <button className="btn pri" disabled={wait > 0} onClick={seek}>
                  {wait > 0 ? `Nova busca em ${wait} rodada(s)` : 'Procurar patrocinador'}
                </button>
              </div>
            );
          const def = sponsorDef(c.sid);
          const sat = sponsorSatisfaction(W, c);
          const si = satInfo(sat);
          return (
            <div key={slot} className="panel spslot">
              <h3>
                <span>{SLOT_NAME[slot]}</span>
                <small>contrato {years(c)}</small>
              </h3>
              <div className="sphead">
                <SponsorLogo def={def} size={48} />
                <div>
                  <b className="spname">{def.n}</b>
                  <span className="muted">
                    {def.sec} · {STYLE_NAME[def.style]}
                  </span>
                </div>
              </div>
              <dl className="kv spkv">
                <dt>Valor por ano</dt>
                <dd className="num">
                  <b>{money(c.val)}</b>
                </dd>
                <dt>Parcela mensal</dt>
                <dd className="num">{money(c.val / PAYDAYS)}</dd>
                {c.win > 0 && (
                  <>
                    <dt>Bônus por vitória</dt>
                    <dd className="num">{money(c.win)}</dd>
                  </>
                )}
                <dt>Multa para rescindir</dt>
                <dd className="num">{money(terminationFee(W, c))}</dd>
              </dl>
              <div className="spsat">
                <span>
                  Satisfação <b style={{ color: si.col }}>{si.txt}</b>
                </span>
                <div className="meter">
                  <i style={{ width: `${sat}%`, background: si.col }} />
                </div>
              </div>
              <div className="spbtns">
                <button className="btn danger sm" onClick={() => terminate(c)}>
                  Rescindir contrato
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>
          <span>
            Propostas{' '}
            <small>{sp.offers.length ? `${sp.offers.length} aguardando resposta` : 'nenhuma no momento'}</small>
          </span>
          <button className="btn sm" disabled={wait > 0} onClick={seek}>
            {wait > 0 ? `Nova busca em ${wait} rodada(s)` : 'Procurar patrocinadores'}
          </button>
        </h3>
        {sp.offers.length === 0 && (
          <p className="muted">
            Marcas mandam propostas ao longo da temporada, principalmente para espaços livres. Às vezes uma marca tenta
            tirar o patrocinador atual oferecendo mais.
          </p>
        )}
        <div className="offers">
          {sp.offers.map((o) => {
            const def = sponsorDef(o.sid);
            const cur = sp[o.slot];
            const replace = !!cur && !o.renewal;
            const fee = replace ? Math.round(terminationFee(W, cur!) * (1 - o.cover)) : 0;
            const left = o.exp - W.day;
            return (
              <div key={o.id} className={`offer ${o.renewal ? 'renew' : replace ? 'repl' : ''}`}>
                <div className="sphead">
                  <SponsorLogo def={def} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <b className="spname">{def.n}</b>
                    <span className="muted">
                      {def.sec} · {STYLE_NAME[def.style]}
                    </span>
                  </div>
                </div>
                <div className="otag">
                  {o.renewal ? 'Renovação' : replace ? `Quer substituir a ${sponsorDef(cur!.sid).n}` : 'Espaço livre'} ·{' '}
                  {SLOT_NAME[o.slot]}
                </div>
                <dl className="kv spkv">
                  <dt>Valor por ano</dt>
                  <dd className="num">
                    <b>{money(o.val)}</b>
                    {replace && <span className="up"> +{Math.round((o.val / cur!.val - 1) * 100)}% que o atual</span>}
                  </dd>
                  {o.win > 0 && (
                    <>
                      <dt>Bônus por vitória</dt>
                      <dd className="num">{money(o.win)}</dd>
                    </>
                  )}
                  <dt>Contrato</dt>
                  <dd>{years(o)}</dd>
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
                  <dd>{left <= 0 ? 'hoje' : `${left} rodada(s)`}</dd>
                </dl>
                <div className="spbtns">
                  <button className="btn pri sm" onClick={() => accept(o)}>
                    Aceitar
                  </button>
                  <button
                    className="btn sm"
                    disabled={o.haggled}
                    onClick={() => haggle(o)}
                    title={o.haggled ? 'Você já pediu mais a esta marca' : 'Pode melhorar, manter ou a marca desistir'}
                  >
                    Pedir mais
                  </button>
                  <button className="btn ghost sm" onClick={() => act((W) => rejectOffer(W, o.id))}>
                    Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>
          <span>
            Marcas no mercado <small>que patrocinam clubes da {DIV_NAME[me.div]}</small>
          </span>
        </h3>
        <div className="market">
          {market.map((s) => (
            <div key={s.id} className={`mk ${inUse.has(s.id) ? 'on' : ''}`} title={`${s.sec} · ${STYLE_NAME[s.style]}`}>
              <SponsorLogo def={s} size={26} />
              <div>
                <b>{s.n}</b>
                <span className="muted">
                  {s.sec} · {s.divs.map((d) => d).join('/')}
                  {inUse.has(s.id) ? ' · seu patrocinador' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
          Valor fixo paga o valor cheio. Contrato longo paga um pouco menos, mas dura 3 a 4 anos e tem mais paciência.
          Por desempenho paga menos de base e um bônus a cada vitória. Marcas impacientes podem romper quando os
          resultados são ruins, e cada marca só patrocina certas divisões.
        </p>
      </div>
    </>
  );
}
