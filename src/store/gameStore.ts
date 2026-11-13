import { create } from 'zustand';
import { addForeignClubs, loadSulaDb, RULES, type World } from '@/core';
import { gunzip, gzip } from '@/persistence/compression';
import { deserialize, serialize } from '@/persistence/serialize';
import { getBackend, LEGACY_SLOT, type SaveMeta } from '@/persistence/storage';

interface GameState {
  /** O mundo é mutado no lugar pelo núcleo; `rev` avisa o React que algo mudou. */
  world: World | null;
  rev: number;
  lastSave: number | null;
  saveError: string | null;

  setWorld: (W: World | null) => void;
  /** Executa uma mudança no mundo e redesenha a interface. */
  mutate: (fn: (W: World) => void) => void;
  /** Só redesenha (para mudanças já feitas no mundo). */
  touch: () => void;
  save: () => Promise<boolean>;
  exportSave: () => Promise<string>;
  /** Abre um save; `slot` é a vaga de onde ele veio (os próximos salvamentos vão para ela). */
  loadSave: (data: string, slot?: string) => Promise<void>;
}

export const saveMeta = (W: World): SaveMeta => ({
  ts: Date.now(),
  club: W.clubs[W.user!].n,
  year: W.year,
  day: W.day,
  ...(W.cal === 'days' ? { cal: 'days' as const } : {}),
  v: 1,
  coach: W.coach || '',
  s: W.clubs[W.user!].s,
  c1: W.clubs[W.user!].c1,
  c2: W.clubs[W.user!].c2,
  div: W.clubs[W.user!].div,
});

export const useGame = create<GameState>((setState, getState) => ({
  world: null,
  rev: 0,
  lastSave: null,
  saveError: null,

  setWorld: (W) => setState((s) => ({ world: W, rev: s.rev + 1 })),

  mutate: (fn) => {
    const W = getState().world;
    if (!W) return;
    fn(W);
    setState((s) => ({ rev: s.rev + 1 }));
  },

  touch: () => setState((s) => ({ rev: s.rev + 1 })),

  exportSave: async () => {
    const W = getState().world;
    if (!W) throw new Error('Nenhum jogo em andamento');
    return gzip(serialize(W));
  },

  save: async () => {
    const W = getState().world;
    if (!W || W.user == null) return false;
    try {
      const data = await gzip(serialize(W));
      const meta = saveMeta(W);
      await getBackend().save(W.slot || LEGACY_SLOT, { meta, data });
      setState({ lastSave: meta.ts, saveError: null });
      return true;
    } catch (e) {
      setState({ saveError: e instanceof Error ? e.message : 'erro' });
      return false;
    }
  },

  loadSave: async (data, slot) => {
    const json = await gunzip(data.trim());
    const W = deserialize(json);
    // save importado (arquivo ou jogo antigo) ganha uma vaga nova; os outros continuam na deles
    W.slot = slot && slot !== 'legacy-local' ? slot : W.slot || 'c' + Date.now().toString(36);
    // saves de antes da v0.4: os clubes sul-americanos entram agora (as copas começam na próxima temporada)
    if (RULES.market && W.user != null && addForeignClubs(W, await loadSulaDb()))
      W.news.unshift({
        y: W.year,
        d: W.day,
        t: 'Clubes sul-americanos no jogo',
        b: 'Clubes de nove países chegaram ao mercado. A Copa do Brasil, a Libertadores, a Sul-Americana e o avanço por dias começam na próxima temporada.',
        k: 'info',
      });
    setState((s) => ({ world: W, rev: s.rev + 1 }));
  },
}));

/** Hook para telas do jogo: devolve o mundo e redesenha a cada mudança. */
export const useWorld = (): World => {
  useGame((s) => s.rev);
  const W = useGame((s) => s.world);
  if (!W) throw new Error('useWorld chamado sem jogo carregado');
  return W;
};
