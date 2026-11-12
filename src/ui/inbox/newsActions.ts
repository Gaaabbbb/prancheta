import { actOnNews, type NewsItem, type World } from '@/core';
import { useGame } from '@/store/gameStore';
import { useUi, type FinTab, type ModalSpec, type PageId } from '@/store/uiStore';

/** Nome e cor de cada categoria de mensagem. */
export const NEWS_KIND: Record<string, { label: string; color: string }> = {
  res: { label: 'Resultado', color: 'var(--blue)' },
  med: { label: 'Médico', color: 'var(--red)' },
  disc: { label: 'Disciplina', color: 'var(--yellow)' },
  youth: { label: 'Base', color: 'var(--ok)' },
  board: { label: 'Diretoria', color: 'var(--orange)' },
  season: { label: 'Temporada', color: 'var(--chalk)' },
  spon: { label: 'Patrocínio', color: 'var(--yellow2)' },
  info: { label: 'Clube', color: 'var(--muted)' },
};
export const newsKind = (k: string) => NEWS_KIND[k] || NEWS_KIND.info;

export interface NewsAction {
  /** texto do botão */
  label: string;
  /** como a ação aparece depois na caixa de entrada */
  done: string;
  go?: PageId;
  /** aba de Finanças a abrir */
  finTab?: FinTab;
  modal?: ModalSpec;
  primary?: boolean;
}

/** Ações que fazem sentido para cada mensagem. A última é sempre "Ciente". */
export const newsActions = (W: World, it: NewsItem): NewsAction[] => {
  const out: NewsAction[] = [];
  const pid = it.ref?.pid;
  const hasPlayer = pid != null && !!W.pmap[pid];
  const playerAct = (done: string): NewsAction => ({ label: 'Ver jogador', done, modal: { kind: 'player', id: pid! } });
  switch (it.k) {
    case 'res': {
      const r = it.ref;
      const ok = r?.comp && r.fid != null && it.y === W.year && W.comps[r.comp]?.fx.some((f) => f.id === r.fid);
      if (ok)
        out.push({
          label: 'Ver relatório',
          done: 'Relatório visto',
          modal: { kind: 'report', comp: r!.comp!, fid: r!.fid! },
          primary: true,
        });
      out.push({ label: 'Ver classificação', done: 'Classificação vista', go: 'tables' });
      break;
    }
    case 'med':
    case 'disc':
      out.push({ label: 'Ajustar escalação', done: 'Escalação revista', go: 'tactics', primary: true });
      if (hasPlayer) out.push(playerAct('Jogador visto'));
      break;
    case 'youth':
      if (hasPlayer) out.push(playerAct('Jogador visto'));
      out.push({ label: 'Ir para a base', done: 'Base vista', go: 'youth', primary: !hasPlayer });
      if (/elenco|Subiram/i.test(it.t + it.b)) out.push({ label: 'Ver elenco', done: 'Elenco visto', go: 'squad' });
      break;
    case 'spon':
      out.push({ label: 'Ver patrocínios', done: 'Patrocínios vistos', go: 'finance', finTab: 'spon', primary: true });
      break;
    case 'board':
      out.push({ label: 'Ver finanças', done: 'Finanças vistas', go: 'finance', finTab: 'sum', primary: true });
      out.push({ label: 'Ver elenco', done: 'Elenco visto', go: 'squad' });
      break;
    case 'season':
      out.push({ label: 'Ver competições', done: 'Competições vistas', go: 'tables', primary: true });
      out.push({ label: 'Ver elenco', done: 'Elenco visto', go: 'squad' });
      break;
    default:
      out.push({ label: 'Ver elenco', done: 'Elenco visto', go: 'squad', primary: true });
  }
  out.push({ label: 'Ciente', done: 'Ciente' });
  return out;
};

/** Executa a ação: registra na mensagem, salva e leva o usuário até onde precisa. */
export const runNewsAction = (it: NewsItem, a: NewsAction): void => {
  const game = useGame.getState();
  game.mutate(() => actOnNews(it, a.done));
  void game.save();
  const ui = useUi.getState();
  if (a.modal) ui.openModal(a.modal);
  else ui.closeModal();
  if (a.finTab) ui.set({ finTab: a.finTab });
  if (a.go) ui.go(a.go);
};
