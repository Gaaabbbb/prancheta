import { useState } from 'react';
import { unreadNews } from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi, type PageId } from '@/store/uiStore';
import { APP_VERSION, NAV, NAV_MOBILE } from './navItems';

/** Contador de mensagens não lidas (o seletor roda a cada mudança de rev). */
const useUnread = () => useGame((s) => (s.world && s.rev >= 0 ? unreadNews(s.world) : 0));

const Badge = ({ n }: { n: number }) =>
  n > 0 ? (
    <span className="badge" aria-label={`${n} mensagens não lidas`}>
      {n > 99 ? '99+' : n}
    </span>
  ) : null;

/** Menu lateral (computador e tablet). No celular vira a barra de baixo (`MobileNav`). */
export function Nav({ year }: { year: number }) {
  const page = useUi((s) => s.page);
  const go = useUi((s) => s.go);
  const unread = useUnread();
  return (
    <nav id="nav" aria-label="Menu">
      {NAV.map((n, i) =>
        n === '-' ? (
          <div key={i} className="sep" />
        ) : (
          <button key={n[0]} className={page === n[0] ? 'on' : ''} onClick={() => go(n[0])}>
            {n[1]}
            {n[0] === 'home' && <Badge n={unread} />}
          </button>
        ),
      )}
      <div className="foot">
        Prancheta v{APP_VERSION}
        <br />
        Temporada {year}
      </div>
    </nav>
  );
}

/** Barra de baixo no celular: as páginas mais usadas e "Mais", que abre a lista completa. */
export function MobileNav() {
  const page = useUi((s) => s.page);
  const go = useUi((s) => s.go);
  const unread = useUnread();
  const [more, setMore] = useState(false);
  const main = NAV_MOBILE.map((id) => NAV.find((n) => n !== '-' && n[0] === id) as readonly [PageId, string]);
  const inMore = !NAV_MOBILE.includes(page);
  const open = (id: PageId) => {
    setMore(false);
    go(id);
  };
  return (
    <>
      <nav id="mnav" aria-label="Menu">
        {main.map(([id, label]) => (
          <button key={id} className={page === id ? 'on' : ''} onClick={() => open(id)}>
            {label}
            {id === 'home' && <Badge n={unread} />}
          </button>
        ))}
        <button className={inMore || more ? 'on' : ''} onClick={() => setMore(!more)} aria-expanded={more}>
          Mais ▴
        </button>
      </nav>
      {more && (
        <div className="msheet" onClick={() => setMore(false)}>
          <div className="msheet-box" onClick={(e) => e.stopPropagation()} role="menu">
            {NAV.map((n, i) =>
              n === '-' ? (
                <div key={i} className="sep" />
              ) : (
                <button key={n[0]} role="menuitem" className={page === n[0] ? 'on' : ''} onClick={() => open(n[0])}>
                  {n[1]}
                  {n[0] === 'home' && <Badge n={unread} />}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </>
  );
}
