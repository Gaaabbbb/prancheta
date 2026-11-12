import { useWorld } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { PAGES } from '../pages';
import { MobileNav, Nav } from './Nav';
import { TopBar } from './TopBar';

export function AppShell() {
  const W = useWorld();
  const page = useUi((s) => s.page);
  const Page = PAGES[page] || PAGES.home;
  return (
    <div id="app">
      <TopBar W={W} />
      <Nav year={W.year} />
      <main id="main">
        <Page W={W} />
      </main>
      <MobileNav />
    </div>
  );
}
