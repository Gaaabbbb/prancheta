import type { NewsItem } from '@/core';
import { useWorld } from '@/store/gameStore';
import { Modal, ModalHeader } from '../components/Modal';
import { newsActions, newsKind, runNewsAction } from '../inbox/newsActions';

/** Mensagem aberta: texto completo e o que dá para fazer a partir dela. */
export function NewsModal({ item }: { item: NewsItem }) {
  const W = useWorld();
  const kind = newsKind(item.k);
  const acts = newsActions(W, item);
  return (
    <Modal>
      <ModalHeader>
        <div style={{ flex: 1 }}>
          <span className="nk" style={{ color: kind.color }}>
            {kind.label}
          </span>
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            Temporada {item.y}, dia {item.d}
          </span>
          <h2 style={{ marginTop: 4 }}>{item.t}</h2>
        </div>
      </ModalHeader>
      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{item.b}</p>
      {item.ac && (
        <p className="muted" style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--ok)' }}>✓</span> Ação tomada: {item.ac}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
        {acts.map((a) => (
          <button key={a.label} className={`btn ${a.primary ? 'pri' : ''}`} onClick={() => runNewsAction(item, a)}>
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
