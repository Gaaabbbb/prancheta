import { available, ovr } from '../player/ratings';
import type { Club, World } from '../types';
import { squad } from './squad';

/** Força do elenco: média do OVR dos 13 melhores disponíveis. */
export const teamStrength = (W: World, c: Club): number => {
  const sq = squad(W, c.id)
    .filter(available)
    .map(ovr)
    .sort((a, b) => b - a);
  const top = sq.slice(0, 13);
  return top.reduce((s, x) => s + x, 0) / Math.max(1, top.length);
};
