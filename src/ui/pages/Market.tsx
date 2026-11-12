import { useState } from 'react';
import {
  acceptIncoming,
  aiListed,
  calcValue,
  counterIncoming,
  counterIncomingShare,
  COUNTRIES,
  DIV_NAME,
  FOREIGN,
  DIVS,
  ensureMarket,
  keyRole,
  KEY_ROLE_NAME,
  ovr,
  POS,
  playerDemand,
  POS_GROUP,
  rejectIncoming,
  releaseCost,
  releasePlayer,
  roundMoney,
  setForLoan,
  setForSale,
  squad,
  toggleWatch,
  windowState,
  type Div,
  type Player,
  type TransferRecord,
  type World,
  leagueName,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi, type MarketTab } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Ovr, PosTag, StatusTags } from '../components/Badges';
import { money, potTxt } from '../format';
import type { PageProps } from './types';

const TABS: [MarketTab, string][] = [
  ['search', 'Buscar jogadores'],
  ['free', 'Livres'],
  ['watch', 'Observados'],
  ['offers', 'Propostas'],
  ['mine', 'Meu elenco'],
  ['log', 'Movimentações'],
];
const GROUPS = ['Todos', 'Goleiros', 'Defesa', 'Meio', 'Ataque'];

/** "3 de março" */
const dm = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

/** Etiqueta de destaque (estrela do clube ou titular importante). */
function KeyTag({ W, p }: { W: World; p: Player }) {
  const role = keyRole(W, p);
  if (!role) return null;
  return (
    <span
      className={`tag ktag ${role === 'star' ? 'top' : ''}`}
      title={
        role === 'star'
          ? 'Um dos destaques do clube: pede bem mais, cede pouco e às vezes é inegociável'
          : 'Titular importante: mais caro e mais difícil de negociar'
      }
    >
      {KEY_ROLE_NAME[role].toLowerCase()}
    </span>
  );
}

/** Estrela para observar o jogador. */
function Star({ W, p }: { W: World; p: Player }) {
  const mutate = useGame((s) => s.mutate);
  const on = !!W.mk?.watch.includes(p.id);
  return (
    <button
      className={`star ${on ? 'on' : ''}`}
      title={on ? 'Parar de observar' : 'Observar (avisa quando ficar disponível)'}
      aria-label={on ? 'Parar de observar' : 'Observar'}
      onClick={(e) => {
        e.stopPropagation();
        let now = false;
        mutate((W) => {
          now = toggleWatch(W, p.id);
        });
        toast(now ? `${p.n} na lista de observação.` : `${p.n} saiu da lista de observação.`);
      }}
    >
      {on ? '★' : '☆'}
    </button>
  );
}

const ClubCell = ({ W, cid }: { W: World; cid: number }) =>
  cid >= 0 ? (
    <span className="clubcell">
      <Crest club={W.clubs[cid]} size={16} /> {W.clubs[cid].n}
      {W.clubs[cid].country && <span className="ctry">{W.clubs[cid].country}</span>}
    </span>
  ) : (
    <span className="muted">sem clube</span>
  );

export function Market({ W }: PageProps) {
  const tab = useUi((s) => s.marketTab);
  const setUi = useUi((s) => s.set);
  const mk = W.mk ?? ensureMarket(W);
  const ws = windowState(W);
  if (!mk)
    return (
      <div className="panel">
        <p className="muted">O mercado está desligado nas regras atuais.</p>
      </div>
    );
  const pending = mk.offers.length + Object.keys(mk.agreed).length;
  return (
    <>
      <div className="ph">
        <h2>Mercado</h2>
        <span className={`winbadge ${ws.open ? 'open' : ''}`}>
          {ws.open
            ? `${ws.name} aberta até ${dm(ws.closes!)} · ${ws.rounds} rodada${ws.rounds !== 1 ? 's' : ''}`
            : `Janela fechada · ${ws.opens ? `${ws.name.toLowerCase()} abre em ${dm(ws.opens)} (daqui a ${ws.rounds} rodada${ws.rounds !== 1 ? 's' : ''})` : '1ª janela abre em 5 de janeiro'}`}
        </span>
        <span className="sp" />
        <div className="seg">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setUi({ marketTab: k })}>
              {l}
              {k === 'offers' && pending > 0 && <span className="segbadge">{pending}</span>}
              {k === 'watch' && mk.watch.length > 0 && <span className="muted"> {mk.watch.length}</span>}
            </button>
          ))}
        </div>
      </div>
      {!ws.open && (tab === 'search' || tab === 'offers') && (
        <p className="note" style={{ marginTop: 0 }}>
          Com a janela fechada dá para observar, contratar jogadores livres e renovar contratos. Compras, vendas e
          empréstimos só com a janela aberta.
        </p>
      )}
      {tab === 'search' && <Search W={W} />}
      {tab === 'free' && <Free W={W} />}
      {tab === 'watch' && <Watch W={W} />}
      {tab === 'offers' && <Offers W={W} />}
      {tab === 'mine' && <Mine W={W} />}
      {tab === 'log' && <Log W={W} />}
    </>
  );
}

type SortK = 'ovr' | 'a' | 'val' | 'pt';

function Search({ W }: { W: World }) {
  const openModal = useUi((s) => s.openModal);
  const me = W.clubs[W.user!];
  const [g, setG] = useState(0);
  const [div, setDiv] = useState<Div | 'all'>('all');
  const [country, setCountry] = useState<string>('all');
  const [maxAge, setMaxAge] = useState(40);
  const [minOvr, setMinOvr] = useState(Math.max(40, Math.round(ovrOf(W) - 6)));
  const [maxVal, setMaxVal] = useState<number>(0);
  const [onlyListed, setOnlyListed] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: SortK; d: 1 | -1 }>({ k: 'ovr', d: -1 });
  const budget = Math.max(0, me.bal);
  const list = W.players
    .filter((p) => {
      if (p.c < 0 || p.c === W.user || p.y) return false;
      if (g && POS_GROUP[p.p] !== g - 1) return false;
      if (div !== 'all' && W.clubs[p.c].div !== div) return false;
      if (div === 'SUL' && country !== 'all' && W.clubs[p.c].country !== country) return false;
      if (p.a > maxAge || ovr(p) < minOvr) return false;
      if (q && !p.n.toLowerCase().includes(q.toLowerCase())) return false;
      if (maxVal && calcValue(p) > maxVal) return false;
      return true;
    })
    .filter((p) => !onlyListed || aiListed(W, p));
  const key = (p: Player) => (sort.k === 'ovr' ? ovr(p) : sort.k === 'a' ? p.a : sort.k === 'pt' ? p.pt : calcValue(p));
  list.sort((a, b) => (key(a) - key(b)) * sort.d);
  const rows = list.slice(0, 80);
  const th = (k: SortK, label: string, cls = 'r') => (
    <th className={`s ${cls}`} onClick={() => setSort({ k, d: sort.k === k ? (sort.d === 1 ? -1 : 1) : -1 })}>
      {label}
      {sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  return (
    <div className="panel">
      <div className="mfilters">
        <div className="seg">
          {GROUPS.map((l, i) => (
            <button key={l} className={g === i ? 'on' : ''} onClick={() => setG(i)}>
              {l}
            </button>
          ))}
        </div>
        <select value={div} onChange={(e) => setDiv(e.target.value as Div | 'all')} aria-label="Divisão">
          <option value="all">Todas as divisões</option>
          {DIVS.map((d) => (
            <option key={d} value={d}>
              {DIV_NAME[d]}
            </option>
          ))}
          <option value="SUL">Sul-América (fora do Brasil)</option>
        </select>
        {div === 'SUL' && (
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País">
            <option value="all">Todos os países</option>
            {FOREIGN.map((k) => (
              <option key={k} value={k}>
                {COUNTRIES[k]}
              </option>
            ))}
          </select>
        )}
        <label>
          OVR mín.{' '}
          <input type="number" min={30} max={99} value={minOvr} onChange={(e) => setMinOvr(+e.target.value || 0)} />
        </label>
        <label>
          Idade máx.{' '}
          <input type="number" min={16} max={45} value={maxAge} onChange={(e) => setMaxAge(+e.target.value || 45)} />
        </label>
        <select value={maxVal} onChange={(e) => setMaxVal(+e.target.value)} aria-label="Valor máximo">
          <option value={0}>Qualquer valor</option>
          <option value={budget}>Cabe no caixa ({money(budget)})</option>
          {[1e6, 5e6, 2e7, 5e7].map((v) => (
            <option key={v} value={v}>
              Até {money(v)}
            </option>
          ))}
        </select>
        <label className="chk">
          <input type="checkbox" checked={onlyListed} onChange={(e) => setOnlyListed(e.target.checked)} /> Só quem o
          clube quer vender
        </label>
        <input placeholder="Buscar nome" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 140 }} />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>
        {list.length} jogadores{list.length > rows.length ? `, mostrando os ${rows.length} primeiros` : ''}. Clique no
        nome para ver a ficha.
      </p>
      <table className="t">
        <thead>
          <tr>
            <th />
            <th>Pos</th>
            <th>Nome</th>
            {th('a', 'Idade')}
            {th('ovr', 'OVR', 'c')}
            {th('pt', 'Pot', 'c')}
            <th>Clube</th>
            {th('val', 'Valor')}
            <th className="r">Salário</th>
            <th className="r">Contrato</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
              <td>
                <Star W={W} p={p} />
              </td>
              <td>
                <PosTag p={p.p} />
              </td>
              <td className="nm">
                {p.n}
                {aiListed(W, p) && <span className="tag mk">à venda</span>}
                <KeyTag W={W} p={p} />
                {p.ct <= W.year && <span className="tag sus">último ano</span>}
                <StatusTags p={p} />
              </td>
              <td className="r num">{p.a}</td>
              <td className="c">
                <Ovr v={ovr(p)} />
              </td>
              <td className="c dim num">{potTxt(p)}</td>
              <td>
                <ClubCell W={W} cid={p.c} />
              </td>
              <td className="r num">{money(calcValue(p))}</td>
              <td className="r num">{money(p.sal)}</td>
              <td className="r num">{p.ct}</td>
              <td className="r">
                <button
                  className="btn sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal({ kind: 'deal', pid: p.id, mode: 'buy' });
                  }}
                >
                  Negociar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Nível médio dos 11 melhores do usuário (para o filtro inicial). */
function ovrOf(W: World) {
  const top = squad(W, W.user!)
    .map(ovr)
    .sort((a, b) => b - a)
    .slice(0, 11);
  return top.reduce((t, v) => t + v, 0) / Math.max(1, top.length);
}

function Free({ W }: { W: World }) {
  const openModal = useUi((s) => s.openModal);
  const [g, setG] = useState(0);
  const list = W.players
    .filter((p) => p.c < 0 && !p.y && (!g || POS_GROUP[p.p] === g - 1))
    .sort((a, b) => ovr(b) - ovr(a));
  return (
    <div className="panel">
      <h3>
        <span>
          Jogadores livres <small>sem clube: contrate a qualquer momento, sem pagar transferência</small>
        </span>
        <div className="seg">
          {GROUPS.map((l, i) => (
            <button key={l} className={g === i ? 'on' : ''} onClick={() => setG(i)}>
              {l}
            </button>
          ))}
        </div>
      </h3>
      {list.length === 0 && <p className="muted">Nenhum jogador livre agora.</p>}
      <table className="t">
        <thead>
          <tr>
            <th />
            <th>Pos</th>
            <th>Nome</th>
            <th className="r">Idade</th>
            <th className="c">OVR</th>
            <th className="c">Pot</th>
            <th className="r">Pede por mês</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
              <td>
                <Star W={W} p={p} />
              </td>
              <td>
                <PosTag p={p.p} />
              </td>
              <td className="nm">{p.n}</td>
              <td className="r num">{p.a}</td>
              <td className="c">
                <Ovr v={ovr(p)} />
              </td>
              <td className="c dim num">{potTxt(p)}</td>
              <td className="r num">{money(playerDemand(W, p, 'free').wage)}</td>
              <td className="r">
                <button
                  className="btn sm pri"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal({ kind: 'deal', pid: p.id, mode: 'free' });
                  }}
                >
                  Contratar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Watch({ W }: { W: World }) {
  const openModal = useUi((s) => s.openModal);
  const list = (W.mk?.watch || []).map((id) => W.pmap[id]).filter(Boolean);
  return (
    <div className="panel">
      <h3>
        <span>
          Lista de observação <small>avisamos na caixa de entrada quando ficarem disponíveis ou mudarem de clube</small>
        </span>
      </h3>
      {list.length === 0 && (
        <p className="muted">Nenhum jogador observado. Clique na estrela ☆ ao lado de um jogador para observar.</p>
      )}
      <table className="t">
        <tbody>
          {list.map((p) => {
            const free = p.c < 0;
            return (
              <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                <td>
                  <Star W={W} p={p} />
                </td>
                <td>
                  <PosTag p={p.p} />
                </td>
                <td className="nm">
                  {p.n}
                  {!free && aiListed(W, p) && <span className="tag mk">à venda</span>}
                  {!free && p.ct <= W.year && <span className="tag sus">último ano</span>}
                </td>
                <td className="r num">{p.a} anos</td>
                <td className="c">
                  <Ovr v={ovr(p)} />
                </td>
                <td>
                  <ClubCell W={W} cid={p.c} />
                </td>
                <td className="r num">{money(calcValue(p))}</td>
                <td className="r">
                  {p.c !== W.user && (
                    <button
                      className="btn sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal({ kind: 'deal', pid: p.id, mode: free ? 'free' : 'buy' });
                      }}
                    >
                      {free ? 'Contratar' : 'Negociar'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Offers({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const mk = W.mk!;
  const [ask, setAsk] = useState<Record<number, number>>({});
  const [askSh, setAskSh] = useState<Record<number, number>>({});
  const save = () => void useGame.getState().save();
  const agreed = Object.entries(mk.agreed).map(([pid, a]) => ({ p: W.pmap[+pid], a }));
  return (
    <>
      <div className="panel">
        <h3>
          <span>
            Propostas recebidas <small>pelos seus jogadores</small>
          </span>
        </h3>
        {mk.offers.length === 0 && (
          <p className="muted">
            Nenhuma proposta agora. Coloque jogadores à venda ou para empréstimo na aba "Meu elenco" para atrair clubes.
          </p>
        )}
        <div className="offers">
          {mk.offers.map((o) => {
            const p = W.pmap[o.pid];
            const club = W.clubs[o.from];
            const counter = ask[o.id] ?? roundMoney(Math.max(o.fee * 1.2, mk.sell[o.pid] || 0));
            const counterSh = askSh[o.id] ?? Math.min(1, Math.round((o.share + 0.2) * 20) / 20);
            return (
              <div key={o.id} className="offer">
                <div className="sphead">
                  <Crest club={club} size={34} />
                  <div>
                    <b className="spname">{club.n}</b>
                    <span className="muted">
                      {leagueName(club)} · quer {o.kind === 'loan' ? 'emprestado' : 'comprar'}
                    </span>
                  </div>
                </div>
                <p style={{ margin: '0 0 8px' }}>
                  <PosTag p={p.p} /> <b>{p.n}</b> <span className="muted">OVR {ovr(p)}</span>
                </p>
                <dl className="kv spkv">
                  {o.kind === 'buy' ? (
                    <>
                      <dt>Oferta</dt>
                      <dd className="num">
                        <b>{money(o.fee)}</b>
                      </dd>
                      <dt>Valor de mercado</dt>
                      <dd className="num">{money(calcValue(p))}</dd>
                    </>
                  ) : (
                    <>
                      <dt>Eles pagam do salário</dt>
                      <dd className="num">
                        <b>{Math.round(o.share * 100)}%</b> ({money(p.sal * o.share)}/mês)
                      </dd>
                      <dt>Você continua pagando</dt>
                      <dd className="num">{money(p.sal * (1 - o.share))}/mês</dd>
                    </>
                  )}
                  <dt>Responder até</dt>
                  <dd>{o.exp - W.day <= 0 ? 'hoje' : `${o.exp - W.day} rodada(s)`}</dd>
                </dl>
                {o.kind === 'loan' && !o.haggled && (
                  <div className="feerow sm">
                    <span className="muted">Pedir que paguem</span>
                    <button
                      className="btn sm"
                      onClick={() => setAskSh({ ...askSh, [o.id]: Math.max(0, counterSh - 0.05) })}
                    >
                      −
                    </button>
                    <b className="num">{Math.round(counterSh * 100)}%</b>
                    <button
                      className="btn sm"
                      onClick={() => setAskSh({ ...askSh, [o.id]: Math.min(1, counterSh + 0.05) })}
                    >
                      +
                    </button>
                  </div>
                )}
                {o.kind === 'buy' && !o.haggled && (
                  <div className="feerow sm">
                    <span className="muted">Pedir</span>
                    <button className="btn sm" onClick={() => setAsk({ ...ask, [o.id]: roundMoney(counter * 0.9) })}>
                      −
                    </button>
                    <b className="num">{money(counter)}</b>
                    <button className="btn sm" onClick={() => setAsk({ ...ask, [o.id]: roundMoney(counter * 1.1) })}>
                      +
                    </button>
                  </div>
                )}
                <div className="spbtns">
                  <button
                    className="btn pri sm"
                    onClick={() =>
                      openModal({
                        kind: 'confirm',
                        title: o.kind === 'loan' ? `Emprestar ${p.n} ao ${club.n}?` : `Vender ${p.n} ao ${club.n}?`,
                        body:
                          o.kind === 'loan'
                            ? `${p.n} joga pelo ${club.n} até o fim da temporada, que paga ${Math.round(o.share * 100)}% do salário.`
                            : `O clube recebe ${money(o.fee)} e ${p.n} sai na hora.`,
                        ok: o.kind === 'loan' ? 'Emprestar' : 'Vender',
                        onOk: () => {
                          let err: string | null = null;
                          mutate((W) => {
                            err = acceptIncoming(W, o.id);
                          });
                          if (err) toast(err);
                          save();
                        },
                      })
                    }
                  >
                    Aceitar
                  </button>
                  {o.kind === 'loan' && !o.haggled && (
                    <button
                      className="btn sm"
                      onClick={() => {
                        let r: string = '';
                        mutate((W) => {
                          r = counterIncomingShare(W, o.id, counterSh);
                        });
                        const now = W.mk!.offers.find((x) => x.id === o.id);
                        toast(
                          r === 'gone' || !now
                            ? `O ${club.n} desistiu do empréstimo.`
                            : `O ${club.n} agora paga ${Math.round(now.share * 100)}% do salário.`,
                        );
                        save();
                      }}
                    >
                      Pedir mais
                    </button>
                  )}
                  {o.kind === 'buy' && !o.haggled && (
                    <button
                      className="btn sm"
                      onClick={() => {
                        let r: string = '';
                        mutate((W) => {
                          r = counterIncoming(W, o.id, counter);
                        });
                        toast(
                          r === 'gone'
                            ? `O ${club.n} desistiu da proposta.`
                            : `O ${club.n} agora oferece ${money(W.mk!.offers.find((x) => x.id === o.id)?.fee || 0)}.`,
                        );
                        save();
                      }}
                    >
                      Pedir mais
                    </button>
                  )}
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      mutate((W) => rejectIncoming(W, o.id));
                      save();
                    }}
                  >
                    Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {agreed.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>
            <span>
              Acertos com clubes <small>falta fechar o contrato com o jogador</small>
            </span>
          </h3>
          <table className="t">
            <tbody>
              {agreed.map(({ p, a }) => (
                <tr key={p.id}>
                  <td>
                    <PosTag p={p.p} />
                  </td>
                  <td className="nm">{p.n}</td>
                  <td>
                    <ClubCell W={W} cid={p.c} />
                  </td>
                  <td className="r num">
                    {a.kind === 'loan' ? `empréstimo (${Math.round(a.share * 100)}% do salário)` : money(a.fee)}
                  </td>
                  <td className="r">
                    <button
                      className="btn sm pri"
                      onClick={() => openModal({ kind: 'deal', pid: p.id, mode: a.kind === 'loan' ? 'loan' : 'buy' })}
                    >
                      Fechar contrato
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type MineK = 'pos' | 'n' | 'a' | 'ovr' | 'sal' | 'ct' | 'val' | 'sit';

function Mine({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const mk = W.mk!;
  const me = W.user!;
  const [sort, setSort] = useState<{ k: MineK; d: 1 | -1 }>({ k: 'ct', d: 1 });
  const [g, setG] = useState(0);
  /** situação: emprestado, à venda, para empréstimo, contrato no fim, normal */
  const sit = (p: Player) =>
    p.loan ? 0 : mk.sell[p.id] != null ? 1 : mk.loan.includes(p.id) ? 2 : p.ct <= W.year ? 3 : 4;
  const key = (p: Player): number | string => {
    switch (sort.k) {
      case 'pos':
        return POS.indexOf(p.p);
      case 'n':
        return p.n;
      case 'a':
        return p.a;
      case 'ovr':
        return ovr(p);
      case 'sal':
        return p.sal;
      case 'ct':
        return p.loan ? 9999 : p.ct;
      case 'val':
        return calcValue(p);
      case 'sit':
        return sit(p);
    }
  };
  const cmp = (a: Player, b: Player) => {
    const x = key(a),
      y = key(b);
    const r = typeof x === 'string' ? x.localeCompare(y as string, 'pt-BR') : x - (y as number);
    return r * sort.d || ovr(b) - ovr(a);
  };
  const all = squad(W, me);
  const list = all.filter((p) => !g || POS_GROUP[p.p] === g - 1).sort(cmp);
  const th = (k: MineK, label: string, cls = '') => (
    <th
      className={`s ${cls}`}
      onClick={() =>
        setSort({
          k,
          // texto e posição começam do A/goleiro; números, do maior; contrato, do que termina antes
          d: sort.k === k ? (sort.d === 1 ? -1 : 1) : k === 'n' || k === 'pos' || k === 'ct' || k === 'sit' ? 1 : -1,
        })
      }
      title="Clique para ordenar"
    >
      {label}
      {sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const out = W.players.filter((p) => p.loan?.from === me);
  const save = () => void useGame.getState().save();
  const ending = all.filter((p) => !p.loan && p.ct <= W.year).length;
  return (
    <>
      <div className="panel">
        <h3>
          <span>
            Contratos do elenco{' '}
            <small>
              {ending
                ? `${ending} terminam em ${W.year}: renove ou eles saem de graça no fim da temporada`
                : 'nenhum contrato termina nesta temporada'}
            </small>
          </span>
          <div className="seg">
            {GROUPS.map((l, i) => (
              <button key={l} className={g === i ? 'on' : ''} onClick={() => setG(i)}>
                {l}
              </button>
            ))}
          </div>
        </h3>
        <table className="t">
          <thead>
            <tr>
              {th('pos', 'Pos')}
              {th('n', 'Nome')}
              {th('a', 'Idade', 'r')}
              {th('ovr', 'OVR', 'c')}
              {th('sal', 'Salário', 'r')}
              {th('ct', 'Contrato', 'r')}
              {th('val', 'Valor', 'r')}
              {th('sit', 'Situação')}
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const price = mk.sell[p.id];
              const onLoan = mk.loan.includes(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <PosTag p={p.p} />
                  </td>
                  <td className="nm click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                    {p.n}
                    <StatusTags p={p} />
                  </td>
                  <td className="r num">{p.a}</td>
                  <td className="c">
                    <Ovr v={ovr(p)} />
                  </td>
                  <td className="r num">{money(p.sal)}</td>
                  <td className={`r num ${!p.loan && p.ct <= W.year ? 'ctend' : ''}`}>{p.loan ? '—' : p.ct}</td>
                  <td className="r num">{money(calcValue(p))}</td>
                  <td>
                    {p.loan ? (
                      <span className="tag">emprestado pelo {W.clubs[p.loan.from].s}</span>
                    ) : (
                      <>
                        {price != null && <span className="tag mk">à venda {money(price)}</span>}
                        {onLoan && <span className="tag">para empréstimo</span>}
                      </>
                    )}
                  </td>
                  <td className="r nowrap">
                    {!p.loan && (
                      <>
                        <button
                          className="btn sm"
                          onClick={() => openModal({ kind: 'deal', pid: p.id, mode: 'renew' })}
                        >
                          Renovar
                        </button>{' '}
                        <button
                          className={`btn sm ${price != null ? 'on' : ''}`}
                          title="Clubes da IA mandam propostas durante a janela"
                          onClick={() => {
                            mutate((W) => setForSale(W, p.id, price != null ? null : askingPriceMine(W, p)));
                            save();
                          }}
                        >
                          {price != null ? 'Tirar da venda' : 'Vender'}
                        </button>{' '}
                        <button
                          className={`btn sm ${onLoan ? 'on' : ''}`}
                          onClick={() => {
                            mutate((W) => setForLoan(W, p.id, !onLoan));
                            save();
                          }}
                        >
                          {onLoan ? 'Não emprestar' : 'Emprestar'}
                        </button>{' '}
                        <button
                          className="btn ghost sm"
                          onClick={() =>
                            openModal({
                              kind: 'confirm',
                              title: `Dispensar ${p.n}?`,
                              body: `A rescisão custa ${money(releaseCost(W, p))} (metade do salário que falta pagar no contrato). Ele fica livre no mercado.`,
                              ok: 'Dispensar',
                              onOk: () => {
                                let err: string | null = null;
                                mutate((W) => {
                                  err = releasePlayer(W, p.id);
                                });
                                if (err) toast(err);
                                save();
                              },
                            })
                          }
                        >
                          Dispensar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>
          "Vender" coloca o jogador na lista pelo valor de mercado; as propostas chegam durante a janela, na aba
          Propostas. Renovar pode ser feito a qualquer momento.
        </p>
      </div>
      {out.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Emprestados a outros clubes</h3>
          <table className="t">
            <tbody>
              {out.map((p) => (
                <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                  <td>
                    <PosTag p={p.p} />
                  </td>
                  <td className="nm">{p.n}</td>
                  <td>
                    <ClubCell W={W} cid={p.c} />
                  </td>
                  <td className="r muted">
                    o {W.clubs[p.c].s} paga {Math.round(p.loan!.share * 100)}% do salário · volta no fim da temporada
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Preço de venda sugerido para um jogador do usuário: o valor de mercado. */
const askingPriceMine = (_W: World, p: Player) => roundMoney(calcValue(p));

const KIND_TXT: Record<TransferRecord['kind'], string> = {
  compra: 'Transferência',
  empréstimo: 'Empréstimo',
  livre: 'Livre',
  saída: 'Fim de contrato / dispensa',
  retorno: 'Volta de empréstimo',
};

function Log({ W }: { W: World }) {
  const openModal = useUi((s) => s.openModal);
  const [scope, setScope] = useState<'mine' | 'div' | 'all'>('all');
  const me = W.user!;
  const div = W.clubs[me].div;
  const inDiv = (cid: number) => cid >= 0 && W.clubs[cid].div === div;
  const list = (W.mk?.log || []).filter((r) =>
    scope === 'mine' ? r.from === me || r.to === me : scope === 'div' ? inDiv(r.from) || inDiv(r.to) : true,
  );
  return (
    <div className="panel">
      <h3>
        <span>Movimentações</span>
        <div className="seg">
          {(
            [
              ['all', 'Todas'],
              ['div', DIV_NAME[div]],
              ['mine', 'Meu clube'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>
              {l}
            </button>
          ))}
        </div>
      </h3>
      {list.length === 0 && <p className="muted">Nenhuma movimentação ainda.</p>}
      <table className="t">
        <tbody>
          {list.slice(0, 150).map((r, i) => (
            <tr
              key={i}
              className={W.pmap[r.pid] ? 'click' : ''}
              onClick={() => W.pmap[r.pid] && openModal({ kind: 'player', id: r.pid })}
            >
              <td className="num muted">
                {r.y} · rod. {r.d}
              </td>
              <td className="nm">{r.n}</td>
              <td>
                <ClubCell W={W} cid={r.from} />
              </td>
              <td className="muted">→</td>
              <td>
                <ClubCell W={W} cid={r.to} />
              </td>
              <td className="muted">{KIND_TXT[r.kind]}</td>
              <td className="r num">{r.fee ? money(r.fee) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
