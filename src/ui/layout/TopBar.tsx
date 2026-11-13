import { DIV_NAME, dateOf, isDays, userStanding, WEEKDAY_SHORT, type World } from '@/core';
import { continueGame } from '@/app/gameFlow';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { money } from '../format';
import { useOffers, useUnread } from './counts';
import { Badge } from './Nav';
import { MENU } from './navItems';

/**
 * Cabeçalho fixo: data de hoje, o clube (botão que leva ao Início), os menus e o botão Avançar, que corre os dias até o
 * próximo jogo ou até uma decisão importante (proposta, janela, contrato).
 */
export function TopBar({ W }: { W: World }) {
  const page = useUi((s) => s.page);
  const go = useUi((s) => s.go);
  const unread = useUnread();
  const offers = useOffers();
  const me = W.clubs[W.user!];
  const s = userStanding(W);
  const today = dateOf(W, isDays(W) ? W.day + 1 : Math.max(1, W.day));
  return (
    <header id="top">
      <div className="today" title="Data de hoje">
        <span>{WEEKDAY_SHORT[today.getDay()]}</span>
        <b className="num">{today.getDate()}</b>
        <span>{today.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
      </div>
      <button className={`club ${page === 'home' ? 'on' : ''}`} onClick={() => go('home')} title="Ir para o Início">
        <Crest club={me} size={40} />
        <span className="cinfo">
          <span className="cname">{me.n}</span>
          <span className="status">
            {DIV_NAME[me.div]}
            {s && (
              <>
                {' · '}
                <b>{s.pos}º</b>
                {s.stage.groups.length > 1 ? ' no grupo' : ''}
              </>
            )}
            {' · '}Saldo <b className={me.bal < 0 ? 'neg' : ''}>{money(me.bal)}</b>
          </span>
        </span>
        <Badge n={unread} />
      </button>
      <nav className="menu" aria-label="Menu">
        {MENU.map((n, i) =>
          n === '-' ? (
            <span key={i} className="msep" aria-hidden="true" />
          ) : (
            <button key={n[0]} className={page === n[0] ? 'on' : ''} onClick={() => go(n[0])}>
              {n[1]}
              {n[0] === 'market' && <Badge n={offers} what="propostas" alert />}
            </button>
          ),
        )}
      </nav>
      <button
        className="btn advance"
        onClick={continueGame}
        title="Avança os dias até o próximo jogo ou até uma decisão importante (proposta, janela, contrato)"
      >
        {W.seasonDone ? 'Fechar temporada' : 'Avançar'} <span aria-hidden="true">▶</span>
      </button>
    </header>
  );
}
