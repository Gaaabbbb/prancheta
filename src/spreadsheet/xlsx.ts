/** Carrega a biblioteca de planilhas (SheetJS) só quando ela for usada. */
export const loadXlsx = () => import('xlsx');
