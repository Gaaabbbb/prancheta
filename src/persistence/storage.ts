import { createStore, del, get, set } from 'idb-keyval';

export interface SaveMeta {
  ts: number;
  club: string;
  year: number;
  day: number;
  v: number;
  coach: string;
}

export interface SaveRecord {
  meta: SaveMeta;
  data: string;
}

/**
 * Onde o jogo guarda o save. Hoje só existe o IndexedDB do navegador,
 * mas um backend na nuvem pode implementar a mesma interface.
 */
export interface SaveBackend {
  readonly name: string;
  load(): Promise<SaveRecord | null>;
  save(rec: SaveRecord): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'career';

export const createIndexedDbBackend = (): SaveBackend => {
  const store = createStore('prancheta', 'saves');
  return {
    name: 'Neste navegador',
    async load() {
      return (await get<SaveRecord>(KEY, store)) ?? null;
    },
    async save(rec) {
      await set(KEY, rec, store);
    },
    async clear() {
      await del(KEY, store);
    },
  };
};

/** Saves do jogo antigo, se ele tiver sido aberto nesta mesma origem. */
export const loadLegacyLocalStorage = (): SaveRecord | null => {
  try {
    const d = localStorage.getItem('prancheta.save'),
      m = localStorage.getItem('prancheta.meta');
    if (!d || !m) return null;
    return { meta: JSON.parse(m) as SaveMeta, data: d };
  } catch {
    return null;
  }
};

let backend: SaveBackend | null = null;
export const getBackend = (): SaveBackend => (backend ??= createIndexedDbBackend());

/** O save mais recente entre o IndexedDB e o localStorage antigo. */
export const bestSave = async (): Promise<SaveRecord | null> => {
  const main = await getBackend()
    .load()
    .catch(() => null);
  const legacy = loadLegacyLocalStorage();
  if (main && legacy) return main.meta.ts >= legacy.meta.ts ? main : legacy;
  return main || legacy;
};
