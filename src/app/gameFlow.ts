/**
 * Orquestração do fluxo do jogo (o que acontece ao clicar em "Continuar", jogar uma partida etc.).
 * Liga o núcleo (regras) aos stores (estado da interface). Não desenha nada.
 */
import {
  buildSeason,
  endSeason,
  lineupIssues,
  tidyLineup,
  ensureSponsors,
  ensureMarket,
  EXP_TXT,
  news,
  playDay,
  prepareMatch,
  rng,
  simulateUntilUserMatch,
  userFixture,
  type FixtureRef,
  type Match,
  type World,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, ui } from '@/store/uiStore';
import { useLive } from '@/store/liveStore';

const game = () => useGame.getState();
const world = (): World => {
  const W = game().world;
  if (!W) throw new Error('Nenhum jogo carregado');
  return W;
};

/** Assume um clube e começa a carreira no mundo de pré-visualização. */
export const startCareer = (W: World, clubId: number, coach: string): void => {
  W.user = clubId;
  W.coach = coach.trim() || 'Técnico';
  rng.seed(Date.now() >>> 0);
  buildSeason(W);
  ensureSponsors(W);
  ensureMarket(W);
  news(
    W,
    'Bem-vindo ao ' + W.clubs[clubId].n,
    'A diretoria espera: ' + EXP_TXT[W.board!.exp].toLowerCase() + '. Boa sorte, ' + W.coach + '!',
    'board',
  );
  game().setWorld(W);
  void game().save();
  ui().go('home');
};

/** O jogo do usuário no próximo dia, se houver. */
export const currentFixture = (): FixtureRef | undefined => {
  const W = world();
  return userFixture(W, W.day + 1);
};

/** Botão "Continuar": abre o pré-jogo ou simula até o próximo jogo do usuário. */
export const continueGame = (): void => {
  const W = game().world;
  if (!W) return;
  ui().closeModal();
  if (W.seasonDone) return ui().openModal({ kind: 'seasonEnd' });
  if (currentFixture()) return ui().openModal({ kind: 'prematch' });
  const n = simulateUntilUserMatch(W, (d) => !!userFixture(W, d));
  game().touch();
  void game().save();
  if (W.seasonDone) ui().openModal({ kind: 'seasonEnd' });
  else toast(n === 1 ? 'Rodada simulada.' : n + ' rodadas simuladas.');
};

/** Lesionados e suspensos têm que ser trocados à mão antes do jogo. */
const lineupReady = (W: World): boolean => {
  const me = W.clubs[W.user!];
  tidyLineup(W, me);
  const issues = lineupIssues(W, me);
  if (!issues.length) return true;
  toast(issues.map((i) => W.pmap[i.pid].n + ' (' + i.why + ')').join(', ') + ': troque antes do jogo.', 4000);
  ui().closeModal();
  ui().go('tactics');
  return false;
};

const userSideOf = (W: World, uf: FixtureRef) => (uf.f.h === W.user ? 0 : 1);

/** Resultado rápido: simula a partida do usuário sem animação. */
export const quickMatch = (): void => {
  const W = world();
  const uf = currentFixture();
  if (!uf || !lineupReady(W)) return;
  ui().closeModal();
  const m = prepareMatch(W, uf.comp, uf.f, { userSide: userSideOf(W, uf) });
  m.runToEnd();
  afterUserMatch(uf, m);
};

/** Abre a partida ao vivo. */
export const liveMatch = (): void => {
  const W = world();
  const uf = currentFixture();
  if (!uf || !lineupReady(W)) return;
  ui().closeModal();
  const m = prepareMatch(W, uf.comp, uf.f, { userSide: userSideOf(W, uf) });
  useLive.getState().start(uf, m);
};

/** Depois do jogo do usuário: joga o resto do dia, salva e mostra a rodada. */
export const afterUserMatch = (uf: FixtureRef, m: Match): void => {
  game().mutate((W) => playDay(W, m));
  void game().save();
  ui().openModal({ kind: 'round', comp: uf.comp.id, fid: uf.f.id });
};

/** Fecha a temporada e começa a próxima. */
export const newSeason = (): void => {
  ui().closeModal();
  game().mutate((W) => endSeason(W));
  void game().save();
  ui().go('home');
  toast('Nova temporada: ' + world().year + '.');
};

/** Volta para a tela inicial para começar outra carreira. */
export const abandonCareer = (): void => {
  ui().set({ modal: null, page: 'home', tab: null, stage: null, rday: null, edClub: null });
  game().setWorld(null);
};
