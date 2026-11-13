import { unreadNews } from '@/core';
import { useGame } from '@/store/gameStore';

/** Contador de mensagens não lidas (o seletor roda a cada mudança de rev). */
export const useUnread = () => useGame((s) => (s.world && s.rev >= 0 ? unreadNews(s.world) : 0));

/** Propostas recebidas pelos jogadores do usuário, esperando resposta no Mercado. */
export const useOffers = () => useGame((s) => (s.world && s.rev >= 0 ? s.world.mk?.offers.length || 0 : 0));
