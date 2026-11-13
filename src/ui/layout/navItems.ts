import type { PageId } from '@/store/uiStore';

/** Menus do cabeçalho, na ordem. Para adicionar uma página, inclua aqui e em ui/pages/index.ts. */
export const MENU: (readonly [PageId, string] | '-')[] = [
  ['calendar', 'Calendário'],
  ['tactics', 'Tática'],
  ['squad', 'Elenco'],
  ['youth', 'Base'],
  ['market', 'Mercado'],
  ['finance', 'Finanças'],
  ['tables', 'Competições'],
  ['fixtures', 'Jogos'],
  ['clubs', 'Clubes'],
  '-',
  ['editor', 'Editor'],
  ['game', 'Jogo e saves'],
];

/** Lista completa (o "Mais" do celular): o Início e os menus do cabeçalho. */
export const NAV: (readonly [PageId, string] | '-')[] = [['home', 'Início'], ...MENU];

/** Páginas da barra de baixo no celular (as outras ficam em "Mais"). */
export const NAV_MOBILE: PageId[] = ['home', 'tactics', 'fixtures', 'market'];
