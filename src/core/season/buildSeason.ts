import { DIV_NAME, DIVS, REGION_ORDER, type Div } from '../constants/divisions';
import { setBoardGoals } from '../board/board';
import { autoLineup } from '../lineup/lineup';
import { ovr } from '../player/ratings';
import type { Competition, World } from '../types';
import { dirty } from '../world/squad';
import { RULES } from '../rules';
import { DAYS_START, leagueDays } from './calendar';
import { addLeagueStage } from './fixtures';

const byRegion = (W: World) => (a: number, b: number) =>
  REGION_ORDER.indexOf(W.clubs[a].uf) - REGION_ORDER.indexOf(W.clubs[b].uf);

/** Monta as competições da temporada (primeira fase de cada divisão) e zera o dia. */
export const buildSeason = (W: World): void => {
  W.comps = {} as Record<Div, Competition>;
  const days = RULES.calendar === 'days';
  if (days) W.cal = 'days';
  else delete W.cal;
  W.day = days ? DAYS_START : 0;
  W.seasonDone = false;
  for (const div of DIVS) {
    const clubs = W.clubs.filter((c) => c.div === div).map((c) => c.id);
    const comp: Competition = {
      id: div,
      name: DIV_NAME[div],
      stages: [],
      fx: [],
      si: 0,
      done: false,
      res: { champ: null, prom: [], rel: [] },
      n: clubs.length,
    };
    if (days) comp.dates = leagueDays(W.year, div);
    W.comps[div] = comp;
    if (div === 'A' || div === 'B') addLeagueStage(comp, 'Pontos corridos', [clubs], true, 1);
    else if (div === 'C') {
      if (clubs.length <= 24) addLeagueStage(comp, 'Primeira fase', [clubs], false, 1);
      else {
        const s = clubs.slice().sort(byRegion(W));
        const h = Math.ceil(s.length / 2);
        addLeagueStage(comp, 'Primeira fase', [s.slice(0, h), s.slice(h)], true, 1);
      }
    } else {
      let groups: number[][];
      let fixed: number[][] | null = null;
      // em 2026 usa os grupos reais, se a planilha trouxer todos
      if (W.year === 2026 && W.clubs.filter((c) => c.div === 'D' && c.grp >= 0).length === clubs.length) {
        fixed = [];
        for (const id of clubs) {
          const g = W.clubs[id].grp;
          (fixed[g] = fixed[g] || []).push(id);
        }
        if (fixed.length !== 16 || fixed.some((g) => !g || g.length < 4)) fixed = null;
      }
      if (fixed) groups = fixed;
      else {
        const s = clubs.slice().sort((a, b) => byRegion(W)(a, b) || W.clubs[b].rep - W.clubs[a].rep);
        const ng = 16;
        groups = Array.from({ length: ng }, () => []);
        const base = Math.floor(s.length / ng),
          extra = s.length % ng;
        let k = 0;
        for (let g = 0; g < ng; g++) {
          const sz = base + (g < extra ? 1 : 0);
          for (let i = 0; i < sz; i++) groups[g].push(s[k++]);
        }
      }
      addLeagueStage(comp, 'Fase de grupos', groups, true, 1);
    }
  }
  dirty(W);
  for (const p of W.players) p.sy = ovr(p);
  for (const c of W.clubs) {
    c.lineup = null;
    c.bench = null;
    c.spon = null;
    autoLineup(W, c);
  }
  setBoardGoals(W);
};
