import { unreadNews } from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { APP_VERSION, NAV } from './navItems';

export function Nav({ year }: { year: number }) {
  const page = useUi((s) => s.page);
  const go = useUi((s) => s.go);
  // o seletor roda a cada mudança de rev, então o contador acompanha o mundo
  const unread = useGame((s) => (s.world && s.rev >= 0 ? unreadNews(s.world) : 0));
  return (
    <nav id="nav" aria-label="Menu">
      {NAV.map((n, i) =>
        n === '-' ? (
          <div key={i} className="sep" />
        ) : (
          <button key={n[0]} className={page === n[0] ? 'on' : ''} onClick={() => go(n[0])}>
            {n[1]}
            {n[0] === 'home' && unread > 0 && (
              <span className="badge" aria-label={`${unread} mensagens não lidas`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
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
