import { useState } from 'react';
import { ATTR, ATTR_NAME, calcValue, calcWage, clamp, ovr, ovrAt } from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { Modal, ModalHeader } from '../components/Modal';

export function EditAttrsModal({ id }: { id: number }) {
  const W = useWorld();
  const p = W.pmap[id];
  const [at, setAt] = useState<number[]>(() => p.at.slice());
  const openModal = useUi((s) => s.openModal);
  const closeModal = useUi((s) => s.closeModal);
  const mutate = useGame((s) => s.mutate);
  const clean = at.map((x) => clamp(+x || 1, 1, 20));
  return (
    <Modal>
      <ModalHeader>
        <h2>Atributos de {p.n}</h2>
      </ModalHeader>
      <div className="attrs">
        {ATTR.map((k, i) => (
          <label className="attr" key={k}>
            <span>{ATTR_NAME[k]}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={at[i]}
              onChange={(e) => setAt((a) => a.map((v, j) => (j === i ? +e.target.value : v)))}
              style={{ width: 60 }}
            />
          </label>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        OVR como {p.p}: {ovrAt(clean, p.p)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={() => openModal({ kind: 'player', id: p.id })}>
          Voltar
        </button>
        <button
          className="btn pri"
          onClick={() => {
            mutate((W) => {
              p.at = clean;
              p.pt = Math.max(p.pt, ovr(p));
              p.val = calcValue(p);
              if (p.c >= 0) p.sal = calcWage(p, W.clubs[p.c].div);
            });
            closeModal();
            toast('Atributos salvos.');
          }}
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
}
