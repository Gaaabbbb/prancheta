import { DIV_NAME, sponsorYear, squad, TICKET } from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { PosTag } from '../components/Badges';
import { int, money } from '../format';
import type { PageProps } from './types';

export function Finance({ W }: PageProps) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const me = W.clubs[W.user!];
  const f = W.fin || {};
  const sq = squad(W, W.user!);
  const wage = sq.reduce((s, p) => s + p.sal, 0);
  const rec = (f.bil || 0) + (f.pat || 0),
    des = f.sal || 0;
  const price = W.ticket || TICKET[me.div];
  const homeFx = W.comps[me.div].fx.filter((x) => x.h === W.user && x.pl && x.att);
  const avgAtt = homeFx.length ? Math.round(homeFx.reduce((s, x) => s + x.att!, 0) / homeFx.length) : 0;
  const line = (l: string, v: number) => (
    <>
      <dt>{l}</dt>
      <dd className="num" style={{ color: v < 0 ? '#ff9a9d' : 'var(--chalk)' }}>
        {money(v)}
      </dd>
    </>
  );
  return (
    <>
      <div className="ph">
        <h2>Finanças</h2>
        <span className="muted">Temporada {W.year}</span>
      </div>
      <div className="grid g3">
        <div className="panel">
          <h3>Saldo em caixa</h3>
          <div
            style={{
              fontFamily: 'var(--fd)',
              fontSize: 40,
              fontWeight: 800,
              color: me.bal < 0 ? 'var(--red)' : 'var(--chalk)',
            }}
          >
            {money(me.bal)}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Folha salarial: {money(wage)} por mês
          </p>
        </div>
        <div className="panel">
          <h3>Receitas da temporada</h3>
          <dl className="kv">
            {line('Bilheteria', f.bil || 0)}
            {line('Patrocínios', f.pat || 0)}
            <dt>
              <b>Total</b>
            </dt>
            <dd className="num">
              <b>{money(rec)}</b>
            </dd>
          </dl>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Patrocínio previsto no ano: {money(sponsorYear(W, me))}
          </p>
        </div>
        <div className="panel">
          <h3>Despesas da temporada</h3>
          <dl className="kv">
            {line('Salários', f.sal || 0)}
            <dt>
              <b>Resultado</b>
            </dt>
            <dd className="num">
              <b style={{ color: rec + des < 0 ? 'var(--red)' : 'var(--ok)' }}>{money(rec + des)}</b>
            </dd>
          </dl>
        </div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Preço do ingresso</h3>
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Ingresso mais caro rende mais por torcedor, mas esvazia o estádio. O preço padrão da {DIV_NAME[me.div]} é R${' '}
            {TICKET[me.div]}.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range"
              min={Math.round(TICKET[me.div] * 0.4)}
              max={Math.round(TICKET[me.div] * 3)}
              value={price}
              onChange={(e) => mutate((W) => (W.ticket = +e.target.value))}
              style={{ flex: 1 }}
              aria-label="Preço do ingresso"
            />
            <b className="num" style={{ fontFamily: 'var(--fd)', fontSize: 24 }}>
              R$ {price}
            </b>
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Público médio em casa: {avgAtt ? int(avgAtt) : 'sem jogos ainda'} (capacidade {int(me.cap)})
          </p>
        </div>
        <div className="panel">
          <h3>Maiores salários</h3>
          <table className="t">
            <tbody>
              {sq
                .sort((a, b) => b.sal - a.sal)
                .slice(0, 8)
                .map((p) => (
                  <tr key={p.id} className="click" onClick={() => openModal({ kind: 'player', id: p.id })}>
                    <td>
                      <PosTag p={p.p} />
                    </td>
                    <td className="nm">{p.n}</td>
                    <td className="r num">{money(p.sal)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="note" style={{ marginTop: 14 }}>
        Versão simplificada: receitas de bilheteria e patrocínio, despesa de salários. As outras fontes entram nas
        próximas versões.
      </p>
    </>
  );
}
