import { useRef } from 'react';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Modal, ModalHeader } from '../components/Modal';

export function ImportSaveModal() {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { closeModal, go } = useUi();
  const { loadSave, save } = useGame();
  const load = async () => {
    let txt = textRef.current?.value.trim() || '';
    const fl = fileRef.current?.files?.[0];
    if (fl) txt = (await fl.text()).trim();
    if (!txt) return toast('Nenhum save informado.');
    try {
      await loadSave(txt);
      closeModal();
      go('home');
      void save();
      toast('Save carregado.');
    } catch {
      toast('Esse conteúdo não é um save válido.');
    }
  };
  return (
    <Modal>
      <ModalHeader>
        <h2>Importar save</h2>
      </ModalHeader>
      <p className="muted">
        Escolha um arquivo .save ou cole o conteúdo copiado. Saves da versão antiga (Prancheta.html) também funcionam.
      </p>
      <input ref={fileRef} type="file" accept=".save,.txt" />
      <p className="muted" style={{ margin: '12px 0 6px' }}>
        ou cole aqui:
      </p>
      <textarea ref={textRef} style={{ width: '100%', height: 140 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={closeModal}>
          Cancelar
        </button>
        <button className="btn pri" onClick={load}>
          Carregar
        </button>
      </div>
    </Modal>
  );
}
