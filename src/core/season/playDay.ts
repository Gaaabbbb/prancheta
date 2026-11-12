import { boardAfterMatch } from '../board/board';
import { DIVS } from '../constants/divisions';
import { dailyMoney, matchMoney } from '../finance/finance';
import { sponsorTick } from '../finance/sponsors';
import { marketTick } from '../market/market';
import { autoLineup, validateLineup } from '../lineup/lineup';
import { applyMatch } from '../match/applyMatch';
import { Match, type KoContext, type MatchOptions } from '../match/engine';
import { news } from '../news';
import { recoverFitness } from '../rules';
import type { Club, Competition, Fixture, World } from '../types';
import { teamStrength } from '../world/strength';
import { dirty } from '../world/squad';
import { youthReport, youthTick } from '../youth/youth';
import { advanceComp } from './advance';
import { dayFixtures, restDays } from './calendar';

/** Contexto de mata-mata de um jogo (placar da ida, pênaltis). */
export const koContext = (comp: Competition, f: Fixture): KoContext | null => {
  const st = comp.stages[f.st];
  if (st.type !== 'ko') return null;
  if (f.leg === 1) return { leg: 1 };
  const tie = st.ties[f.g];
  const f1 = comp.fx[tie.f[0]];
  // f é o jogo de volta: mandante = tie.b; no jogo de ida tie.b foi visitante
  return { leg: 2, agg: [f1.ag!, f1.hg!], pens: !st.seedDecides };
};

/** IA ajusta mentalidade e marcação conforme a força relativa. */
export const aiTactic = (W: World, c: Club, opp: Club, home: boolean): void => {
  const diff = teamStrength(W, c) - teamStrength(W, opp) + (home ? 2 : -2);
  c.tac.men = diff > 4 ? 3 : diff < -5 ? 1 : 2;
  c.tac.pres = diff > 2 ? 2 : diff < -6 ? 0 : 1;
};

/** Escala os dois times e cria a partida. */
export const prepareMatch = (W: World, comp: Competition, f: Fixture, opts?: MatchOptions): Match => {
  const h = W.clubs[f.h],
    a = W.clubs[f.a];
  for (const c of [h, a]) {
    if (c.id === W.user) validateLineup(W, c);
    else {
      aiTactic(W, c, c === h ? a : h, c === h);
      autoLineup(W, c);
    }
  }
  const ko = koContext(comp, f);
  return new Match(W, h, a, Object.assign({ ko }, opts || {}));
};

/** Grava o resultado no jogo e aplica efeitos (jogadores, bilheteria). */
export const recordResult = (W: World, comp: Competition, f: Fixture, m: Match): void => {
  const r = applyMatch(W, m);
  f.hg = r.hg;
  f.ag = r.ag;
  f.pl = true;
  if (r.pens) {
    f.hp = r.hp;
    f.ap = r.ap;
  }
  if (f.h === W.user || f.a === W.user) {
    f.stats = m.sides.map((s) => Object.assign({ g: s.goals }, s.s));
    f.goals = m.goals.map((g) => ({ s: g.side, m: g.m, p: W.pmap[g.pid] ? W.pmap[g.pid].n : '?', pen: g.pen }));
  }
  matchMoney(W, comp, f);
};

/** Notícias e diretoria depois do jogo do usuário. */
export const userAfterMatch = (W: World, comp: Competition, f: Fixture, m: Match): void => {
  const home = f.h === W.user;
  const gf = (home ? f.hg : f.ag)!,
    ga = (home ? f.ag : f.hg)!;
  const opp = W.clubs[home ? f.a : f.h];
  const res = gf > ga ? 'Vitória' : gf < ga ? 'Derrota' : 'Empate';
  let extra = '';
  if (f.hp !== undefined) extra = ' (pênaltis ' + (home ? f.hp + 'x' + f.ap : f.ap + 'x' + f.hp) + ')';
  news(
    W,
    res + ' ' + gf + ' x ' + ga + ' contra o ' + opp.n + extra,
    comp.name + ', ' + comp.stages[f.st].name + '. Público: ' + (f.att || 0).toLocaleString('pt-BR') + '.',
    'res',
    { comp: comp.id, fid: f.id },
  );
  const side = m.sides[home ? 0 : 1];
  for (const pid of side.played) {
    const p = W.pmap[pid];
    if (p.inj > 0) news(W, 'Lesão: ' + p.n, p.n + ' vai desfalcar o time por ' + p.inj + ' jogo(s).', 'med', { pid });
    if (p.sus > 0) news(W, 'Suspensão: ' + p.n, p.n + ' está suspenso para a próxima partida.', 'disc', { pid });
  }
  boardAfterMatch(W, gf, ga);
};

/**
 * Joga um dia inteiro: todas as partidas, recuperação física, finanças,
 * evolução da base e avanço das competições.
 * `userMatch` é a partida do usuário já jogada (ao vivo ou rápida).
 */
export const playDay = (W: World, userMatch?: Match): void => {
  W.day++;
  dirty(W);
  const list = dayFixtures(W, W.day);
  const playingClubs = new Set<number>();
  list.forEach(({ f }) => {
    playingClubs.add(f.h);
    playingClubs.add(f.a);
  });
  const serving = new Set(W.players.filter((p) => p.sus > 0 && playingClubs.has(p.c)).map((p) => p.id));
  for (const { comp, f } of list) {
    let m: Match;
    if (userMatch && (f.h === W.user || f.a === W.user)) m = userMatch;
    else {
      m = prepareMatch(W, comp, f, { quiet: true });
      m.runToEnd();
    }
    recordResult(W, comp, f, m);
    if (f.h === W.user || f.a === W.user) userAfterMatch(W, comp, f, m);
  }
  for (const id of serving) {
    const p = W.pmap[id];
    if (p && p.sus > 0) {
      p.sus--;
      if (p.sus === 0 && p.c === W.user)
        news(W, 'Liberado: ' + p.n, p.n + ' cumpriu a suspensão e pode voltar a jogar.', 'apt', { pid: p.id });
    }
  }
  // recuperação (pelos dias de descanso até a próxima rodada da divisão) e lesões
  const rest: Record<string, number> = {};
  for (const div of DIVS) rest[div] = restDays(W, W.day + 1, div);
  for (const p of W.players) {
    p.f = recoverFitness(p.f, p.at[9], p.c >= 0 ? rest[W.clubs[p.c].div] : 7);
    if (p.inj > 0) {
      p.inj--;
      if (p.inj === 0 && p.c === W.user)
        news(W, 'Departamento médico', p.n + ' está recuperado e liberado para jogar.', 'med', { pid: p.id });
    }
  }
  dailyMoney(W);
  sponsorTick(W);
  marketTick(W);
  youthTick(W);
  if (W.day % 10 === 0) youthReport(W);
  for (const div of DIVS) {
    const comp = W.comps[div];
    if (!comp.done) advanceComp(W, comp);
  }
  if (DIVS.every((d) => W.comps[d].done)) W.seasonDone = true;
  // segurança: se nenhuma competição tiver mais jogos, encerra
  if (!W.seasonDone && !DIVS.some((d) => W.comps[d].fx.some((f) => !f.pl))) W.seasonDone = true;
};

/** Simula os dias sem jogo do usuário até o próximo jogo dele (ou o fim da temporada). */
export const simulateUntilUserMatch = (W: World, isUserDay: (day: number) => boolean, maxDays = 60): number => {
  let n = 0;
  while (!W.seasonDone && !isUserDay(W.day + 1) && n < maxDays) {
    playDay(W);
    n++;
  }
  return n;
};
