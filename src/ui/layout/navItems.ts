import type { PageId } from '@/store/uiStore';

/** Itens do menu lateral. Para adicionar uma página, inclua aqui e em ui/pages/index.ts. */
export const NAV: (readonly [PageId, string] | '-')[] = [
  ['home', 'Início'],
  ['squad', 'Elenco'],
  ['youth', 'Base'],
  ['tactics', 'Tática'],
  ['fixtures', 'Jogos'],
  ['tables', 'Competições'],
  ['clubs', 'Clubes'],
  ['finance', 'Finanças'],
  '-',
  ['editor', 'Editor'],
  ['game', 'Jogo e saves'],
];

export const APP_VERSION = '1.0';
