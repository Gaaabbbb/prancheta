import { useEffect, useState } from 'react';
import { useUi } from '@/store/uiStore';

function ToastMessage({ msg, ms }: { msg: string; ms: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return (
    <div id="toast" role="status" style={{ opacity: visible ? 1 : 0 }}>
      {msg}
    </div>
  );
}

/** Aviso rápido no rodapé. Cada novo aviso remonta o componente (key = id). */
export function Toast() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return <ToastMessage key={toast.id} msg={toast.msg} ms={toast.ms} />;
}
