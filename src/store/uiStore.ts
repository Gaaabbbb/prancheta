import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { NewsItem } from '@/core';

export type PageId =
  | 'home'
  | 'squad'
  | 'market'
  | 'youth'
  | 'tactics'
  | 'calendar'
  | 'fixtures'
  | 'tables'
  | 'clubs'
  | 'finance'
  | 'editor'
  | 'game';

export type SortKey =
  'pos' | 'n' | 'a' | 'ovr' | 'pt' | 'f' | 'mo' | 'j' | 'g' | 'as' | 'ca' | 'cv' | 'nt' | 'val' | 'sal' | 'ct';

/** Abas da página Mercado. */
export type MarketTab = 'search' | 'sale' | 'loan' | 'free' | 'watch' | 'offers' | 'mine' | 'log';

/** Abas da página Finanças. */
export type FinTab = 'sum' | 'spon' | 'ledger';

/** Modais conhecidos. Para criar um novo, adicione aqui e em ui/modals/ModalHost.tsx. */
export type ModalSpec =
  | { kind: 'player'; id: number }
  | { kind: 'club'; id: number }
  | { kind: 'report'; comp: string; fid: number }
  | { kind: 'editAttrs'; id: number }
  | { kind: 'movePlayer'; id: number }
  | { kind: 'prematch' }
  | { kind: 'round'; comp: string; fid: number }
  | { kind: 'seasonEnd' }
  | { kind: 'importSave' }
  | { kind: 'news'; item: NewsItem }
  | { kind: 'deal'; pid: number; mode: 'buy' | 'loan' | 'free' | 'renew' }
  | { kind: 'offer'; id: number }
  | { kind: 'sponsorOffer'; id: number }
  | { kind: 'confirm'; title: string; body: ReactNode; ok: string; onOk: () => void }
  | { kind: 'info'; title: string; body: ReactNode; wide?: boolean };

interface UiState {
  page: PageId;
  sort: { k: SortKey; d: 1 | -1 };
  /** divisão aberta nas abas de Competições/Clubes */
  tab: string | null;
  stage: number | null;
  stageDiv: string | null;
  rday: number | null;
  clubSort: 'str' | 'az';
  edClub: number | null;
  edPool: 'pro' | 'base';
  /** velocidade preferida da partida ao vivo */
  liveSpeed: number;
  finTab: FinTab;
  marketTab: MarketTab;
  modal: ModalSpec | null;
  toast: { msg: string; ms: number; id: number } | null;

  go: (page: PageId) => void;
  setSort: (k: SortKey) => void;
  set: (p: Partial<UiState>) => void;
  openModal: (m: ModalSpec) => void;
  closeModal: () => void;
  showToast: (msg: string, ms?: number) => void;
}

export const useUi = create<UiState>((setState, getState) => ({
  page: 'home',
  sort: { k: 'pos', d: 1 },
  tab: null,
  stage: null,
  stageDiv: null,
  rday: null,
  clubSort: 'str',
  edClub: null,
  edPool: 'pro',
  liveSpeed: 1,
  finTab: 'sum',
  marketTab: 'search',
  modal: null,
  toast: null,

  go: (page) => {
    setState({ page });
    document.getElementById('main')?.scrollTo(0, 0);
  },
  setSort: (k) => {
    const s = getState().sort;
    if (s.k === k) setState({ sort: { k, d: s.d === 1 ? -1 : 1 } });
    else setState({ sort: { k, d: ['n', 'pos', 'a', 'ct'].includes(k) ? 1 : -1 } });
  },
  set: (p) => setState(p),
  openModal: (modal) => setState({ modal }),
  closeModal: () => setState({ modal: null }),
  showToast: (msg, ms = 2600) => setState({ toast: { msg, ms, id: Date.now() + Math.random() } }),
}));

/** Atalhos para usar fora de componentes. */
export const ui = () => useUi.getState();
export const toast = (msg: string, ms?: number) => useUi.getState().showToast(msg, ms);
