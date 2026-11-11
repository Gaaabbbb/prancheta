import { useEffect, useRef, type ReactNode } from 'react';
import { useUi } from '@/store/uiStore';

/** Janela modal. `lock` impede fechar clicando fora ou com Esc. */
export function Modal({ children, wide, lock }: { children: ReactNode; wide?: boolean; lock?: boolean }) {
  const close = useUi((s) => s.closeModal);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const f = box?.querySelector<HTMLElement>('[autofocus]') || box?.querySelector<HTMLElement>('button');
    f?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lock) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, lock]);

  return (
    <div
      id="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !lock) close();
      }}
    >
      <div ref={boxRef} className={`box ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

/** Cabeçalho padrão de modal com botão de fechar. */
export function ModalHeader({ children, closable = true }: { children: ReactNode; closable?: boolean }) {
  const close = useUi((s) => s.closeModal);
  return (
    <div className="mh">
      {children}
      {closable && (
        <button className="btn ghost" onClick={close} aria-label="Fechar">
          ✕
        </button>
      )}
    </div>
  );
}
