import { useGame } from '@/store/gameStore';
import { useLive } from '@/store/liveStore';
import { AppShell } from '@/ui/layout/AppShell';
import { LiveMatch } from '@/ui/match/LiveMatch';
import { ModalHost } from '@/ui/modals/ModalHost';
import { Toast } from '@/ui/components/Toast';
import { Start } from '@/ui/pages/Start';

export function App() {
  const hasWorld = useGame((s) => !!s.world);
  const live = useLive((s) => !!s.session);
  return (
    <>
      {hasWorld ? <AppShell /> : <Start />}
      {hasWorld && live && <LiveMatch />}
      <ModalHost />
      <Toast />
    </>
  );
}
