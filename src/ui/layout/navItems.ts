import type { PageId } from '@/store/uiStore';

/** Itens do menu lateral. Para adicionar uma página, inclua aqui e em ui/pages/index.ts. */
export const NAV: (readonly [PageId, string] | '-')[] = [
  ['home', 'Início'],
  ['calendar', 'Calendário'],
  ['squad', 'Elenco'],
  ['market', 'Mercado'],
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

/** Páginas da barra de baixo no celular (as outras ficam em "Mais"). */
export const NAV_MOBILE: PageId[] = ['home', 'tactics', 'fixtures', 'market'];

export const APP_VERSION = '1.0';
