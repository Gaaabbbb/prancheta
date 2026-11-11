import { useUi } from '@/store/uiStore';
import { APP_VERSION, NAV } from './navItems';

export function Nav({ year }: { year: number }) {
  const page = useUi((s) => s.page);
  const go = useUi((s) => s.go);
  return (
    <nav id="nav" aria-label="Menu">
      {NAV.map((n, i) =>
        n === '-' ? (
          <div key={i} className="sep" />
        ) : (
          <button key={n[0]} className={page === n[0] ? 'on' : ''} onClick={() => go(n[0])}>
            {n[1]}
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
