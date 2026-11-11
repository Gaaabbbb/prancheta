import { promote, release, type Player } from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';

/** Ações da base, reaproveitadas no modal do jogador e no editor. */
export const youthActions = {
  promote: (p: Player) => {
    useGame.getState().mutate((W) => promote(W, p));
    useUi.getState().closeModal();
    toast(p.n + ' subiu para o profissional.');
  },
  release: (p: Player) => {
    useUi.getState().openModal({
      kind: 'confirm',
      title: 'Dispensar ' + p.n + '?',
      body: 'O garoto deixa o clube e sai do jogo.',
      ok: 'Dispensar',
      onOk: () => {
        useGame.getState().mutate((W) => release(W, p));
        toast(p.n + ' foi dispensado.');
      },
    });
  },
};
