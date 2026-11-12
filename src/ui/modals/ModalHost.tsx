import { useGame } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { Modal, ModalHeader } from '../components/Modal';
import { ClubModal } from './ClubModal';
import { EditAttrsModal } from './EditAttrsModal';
import { ImportSaveModal } from './ImportSaveModal';
import { MovePlayerModal } from './MovePlayerModal';
import { NewsModal } from './NewsModal';
import { DealModal } from './DealModal';
import { PlayerModal } from './PlayerModal';
import { PrematchModal } from './PrematchModal';
import { ReportModal } from './ReportModal';
import { RoundModal } from './RoundModal';
import { SeasonEndModal } from './SeasonEndModal';

/** Mostra o modal aberto no uiStore. */
export function ModalHost() {
  const m = useUi((s) => s.modal);
  const closeModal = useUi((s) => s.closeModal);
  const hasWorld = useGame((s) => !!s.world);
  if (!m) return null;
  // modais que dependem de um jogo carregado
  if (!hasWorld && m.kind !== 'importSave' && m.kind !== 'confirm' && m.kind !== 'info') return null;
  switch (m.kind) {
    case 'player':
      return <PlayerModal key={m.id} id={m.id} />;
    case 'club':
      return <ClubModal key={m.id} id={m.id} />;
    case 'report':
      return <ReportModal comp={m.comp} fid={m.fid} />;
    case 'editAttrs':
      return <EditAttrsModal key={m.id} id={m.id} />;
    case 'movePlayer':
      return <MovePlayerModal key={m.id} id={m.id} />;
    case 'prematch':
      return <PrematchModal />;
    case 'round':
      return <RoundModal comp={m.comp} fid={m.fid} />;
    case 'seasonEnd':
      return <SeasonEndModal />;
    case 'deal':
      return <DealModal key={m.pid + m.mode} pid={m.pid} mode={m.mode} />;
    case 'news':
      return <NewsModal item={m.item} />;
    case 'importSave':
      return <ImportSaveModal />;
    case 'confirm':
      return (
        <Modal>
          <ModalHeader closable={false}>
            <h2>{m.title}</h2>
          </ModalHeader>
          <p>{m.body}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="btn" onClick={closeModal}>
              Cancelar
            </button>
            <button
              className="btn pri"
              onClick={() => {
                closeModal();
                m.onOk();
              }}
            >
              {m.ok}
            </button>
          </div>
        </Modal>
      );
    case 'info':
      return (
        <Modal wide={m.wide}>
          <ModalHeader>
            <h2>{m.title}</h2>
          </ModalHeader>
          {m.body}
        </Modal>
      );
  }
}
