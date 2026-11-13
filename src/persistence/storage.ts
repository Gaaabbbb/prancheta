import { createStore, del, entries, get, set } from 'idb-keyval';

export interface SaveMeta {
  ts: number;
  club: string;
  year: number;
  day: number;
  v: number;
  coach: string;
  /** 'days' = calendário por dias (o `day` é o dia do ano) */
  cal?: 'days';
  /** sigla, cores e divisão do clube (para o escudo na lista de saves) */
  s?: string;
  c1?: string;
  c2?: string;
  div?: string;
}

export interface SaveRecord {
  meta: SaveMeta;
  data: string;
}

/** Save guardado numa vaga (uma por carreira). */
export interface SaveSlot extends SaveRecord {
  key: string;
}

/**
 * Onde o jogo guarda os saves: uma vaga por carreira. Hoje só existe o IndexedDB do navegador, mas um backend na nuvem
 * pode implementar a mesma interface.
 */
export interface SaveBackend {
  readonly name: string;
  list(): Promise<SaveSlot[]>;
  load(key: string): Promise<SaveRecord | null>;
  save(key: string, rec: SaveRecord): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Vaga dos saves de antes de existir mais de uma carreira. */
export const LEGACY_SLOT = 'career';

export const createIndexedDbBackend = (): SaveBackend => {
  const store = createStore('prancheta', 'saves');
  return {
    name: 'Neste navegador',
    async list() {
      const all = await entries<string, SaveRecord>(store);
      return all
        .filter(([, v]) => v && v.meta && typeof v.data === 'string')
        .map(([k, v]) => ({ key: String(k), ...v }))
        .sort((a, b) => b.meta.ts - a.meta.ts);
    },
    async load(key) {
      return (await get<SaveRecord>(key, store)) ?? null;
    },
    async save(key, rec) {
      await set(key, rec, store);
    },
    async remove(key) {
      await del(key, store);
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

/** Todos os saves, do mais recente para o mais antigo (inclui o do jogo antigo, se houver). */
export const listSaves = async (): Promise<SaveSlot[]> => {
  const list = await getBackend()
    .list()
    .catch(() => [] as SaveSlot[]);
  const legacy = loadLegacyLocalStorage();
  if (legacy) list.push({ key: 'legacy-local', ...legacy });
  return list.sort((a, b) => b.meta.ts - a.meta.ts);
};

/** Apaga um save (o do jogo antigo fica no localStorage). */
export const removeSave = async (key: string): Promise<void> => {
  if (key === 'legacy-local') {
    try {
      localStorage.removeItem('prancheta.save');
      localStorage.removeItem('prancheta.meta');
    } catch {
      /* sem acesso ao localStorage */
    }
    return;
  }
  await getBackend().remove(key);
};
