import { COUNTRIES, FOREIGN } from '../constants/divisions';
import { matchMoney } from '../finance/finance';
import { rand } from '../rng';
import type { Competition, Fixture, World } from '../types';
import { teamStrength } from '../world/strength';
import { leagueDays } from './calendar';
import { addLeagueStage } from './fixtures';
import { table } from './table';

/** Nome do campeonato de cada país. */
export const LEAGUE_NAME: Record<string, string> = {
  ARG: 'Liga Argentina',
  BOL: 'Liga Boliviana',
  CHI: 'Liga Chilena',
  COL: 'Liga Colombiana',
  ECU: 'Liga Equatoriana',
  PAR: 'Liga Paraguaia',
  PER: 'Liga Peruana',
  URU: 'Liga Uruguaia',
  VEN: 'Liga Venezuelana',
};

/** A competição é uma liga sul-americana simulada nos bastidores? */
export const isForeignLeague = (id: string): boolean => (FOREIGN as readonly string[]).includes(id);

/**
 * Monta as ligas nacionais dos clubes sul-americanos (calendário por dias). Turno e returno, ou só turno com mais de
 * 20 clubes (Argentina), uma rodada por fim de semana.
 */
export const buildForeignLeagues = (W: World): void => {
  for (const k of FOREIGN) {
    const clubs = W.clubs.filter((c) => c.div === 'SUL' && c.country === k).map((c) => c.id);
    if (clubs.length < 4) continue;
    const double = clubs.length <= 20;
    const rounds = (clubs.length % 2 ? clubs.length : clubs.length - 1) * (double ? 2 : 1);
    const comp: Competition = {
      id: k,
      name: LEAGUE_NAME[k] || 'Liga ' + COUNTRIES[k],
      stages: [],
      fx: [],
      si: 0,
      done: false,
      res: { champ: null, prom: [], rel: [] },
      n: clubs.length,
      dates: leagueDays(W.year, 'SUL', rounds),
    };
    W.comps[k] = comp;
    addLeagueStage(comp, double ? 'Turno e returno' : 'Turno único', [clubs], double, 1);
  }
};

/** Sorteio de Poisson (número de gols). */
const poisson = (lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L && k < 12);
  return k - 1;
};

/**
 * Resultado rápido, sem o motor de partida: gols por Poisson a partir da força dos elencos e do fator casa.
 * Gera público e bilheteria, mas não mexe em estatísticas, cansaço ou lesões dos jogadores.
 */
export const quickPlay = (W: World, comp: Competition, f: Fixture): void => {
  const h = W.clubs[f.h],
    a = W.clubs[f.a];
  const diff = (teamStrength(W, h) - teamStrength(W, a) + 2) / 10;
  f.hg = poisson(Math.max(0.2, 1.35 * Math.exp(diff * 0.6)));
  f.ag = poisson(Math.max(0.2, 1.05 * Math.exp(-diff * 0.6)));
  f.pl = true;
  matchMoney(W, comp, f);
};

/** Fim da liga: guarda campeão e classificação (usada nas vagas da Libertadores e da Sul-Americana). */
export const advanceForeignLeague = (W: World, comp: Competition): void => {
  if (comp.fx.some((f) => !f.pl)) return;
  const t = table(W, comp, 0, 0);
  comp.stages[0].done = true;
  comp.res.champ = t[0].c;
  comp.res.lib = t.map((r) => r.c);
  comp.done = true;
};
