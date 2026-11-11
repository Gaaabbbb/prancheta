import { create } from 'zustand';
import type { FixtureRef, Match } from '@/core';

interface LiveState {
  session: { uf: FixtureRef; m: Match } | null;
  start: (uf: FixtureRef, m: Match) => void;
  stop: () => void;
}

/** Partida ao vivo em andamento (o objeto Match é mutado pelo motor). */
export const useLive = create<LiveState>((setState) => ({
  session: null,
  start: (uf, m) => setState({ session: { uf, m } }),
  stop: () => setState({ session: null }),
}));
