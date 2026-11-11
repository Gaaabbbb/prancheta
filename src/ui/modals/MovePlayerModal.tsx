import { useState } from 'react';
import { autoLineup, calcWage, dirty } from '@/core';
import { useGame, useWorld } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { ClubSelect } from '../components/ClubSelect';
import { Modal, ModalHeader } from '../components/Modal';

export function MovePlayerModal({ id }: { id: number }) {
  const W = useWorld();
  const p = W.pmap[id];
  const [to, setTo] = useState(p.c);
  const closeModal = useUi((s) => s.closeModal);
  const mutate = useGame((s) => s.mutate);
  const go = () => {
    mutate((W) => {
      const from = p.c;
      p.c = to;
      dirty(W);
      p.sal = p.y ? 0 : calcWage(p, W.clubs[to].div);
      [from, to].forEach((cid) => {
        const c = W.clubs[cid];
        if (c.lineup) c.lineup = c.lineup.map((x) => (x === p.id ? null : x));
        if (cid !== W.user) autoLineup(W, c);
      });
    });
    closeModal();
    toast(p.n + ' agora é do ' + W.clubs[to].n + '.');
  };
  return (
    <Modal>
      <ModalHeader closable={false}>
        <h2>Transferir {p.n}</h2>
      </ModalHeader>
      <ClubSelect W={W} value={to} onChange={(e) => setTo(+e.target.value)} style={{ width: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button className="btn" onClick={closeModal}>
          Cancelar
        </button>
        <button className="btn pri" onClick={go}>
          Transferir
        </button>
      </div>
    </Modal>
  );
}
