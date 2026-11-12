import { DIVS, SEASON_DAYS, type Div } from '../constants/divisions';
import { hash } from '../rng';
import type { Competition, Fixture, World } from '../types';

export interface FixtureRef {
  comp: Competition;
  f: Fixture;
}

/**
 * Semanas da temporada, a partir da semana de 28 de janeiro:
 * D = rodada no meio da semana e no fim de semana, W = só fim de semana, - = pausa (Data FIFA, pausa do meio do ano).
 */
const WEEK_PLAN = 'DWW-WDW-WWDWWDWW-WW----DWDWW-DWWW-W-DWW-WWWWWWWW';

/** Rodada no meio ou no fim de semana, e a semana em que cai. */
const SLOTS: { week: number; mid: boolean }[] = (() => {
  const out: { week: number; mid: boolean }[] = [];
  for (let w = 0; w < WEEK_PLAN.length && out.length < SEASON_DAYS; w++) {
    if (WEEK_PLAN[w] === 'D') out.push({ week: w, mid: true });
    if (WEEK_PLAN[w] !== '-' && out.length < SEASON_DAYS) out.push({ week: w, mid: false });
  }
  return out;
})();

/**
 * Dias da semana preferidos de cada divisão (deslocamento a partir da segunda-feira: 1 = ter … 6 = dom, 7 = seg
 * seguinte) e o peso de cada um. Série A: sáb/dom e às vezes seg; qua/qui. Série B: sex a seg, mais domingo, às vezes
 * qui; ter/qua. Série C: sáb, dom e seg. Série D: sáb e dom, raramente seg.
 */
const WEEKDAYS: Record<Div, { mid: [number, number][]; end: [number, number][] }> = {
  A: {
    mid: [
      [2, 0.55],
      [3, 0.45],
    ],
    end: [
      [5, 0.45],
      [6, 0.45],
      [7, 0.1],
    ],
  },
  B: {
    mid: [
      [1, 0.5],
      [2, 0.5],
    ],
    end: [
      [3, 0.05],
      [4, 0.2],
      [5, 0.25],
      [6, 0.4],
      [7, 0.1],
    ],
  },
  C: {
    mid: [[2, 1]],
    end: [
      [5, 0.35],
      [6, 0.4],
      [7, 0.25],
    ],
  },
  D: {
    mid: [[2, 1]],
    end: [
      [5, 0.45],
      [6, 0.5],
      [7, 0.05],
    ],
  },
  SUL: {
    mid: [[2, 1]],
    end: [
      [5, 0.5],
      [6, 0.5],
    ],
  },
};

const DAY_MS = 86400000;
const cache = new Map<string, Date[]>();

/** Datas das 40 rodadas de uma divisão numa temporada (sorteio fixo por ano e divisão). */
export const seasonDates = (year: number, div: Div): Date[] => {
  const key = year + div;
  const hit = cache.get(key);
  if (hit) return hit;
  // segunda-feira da semana de 28 de janeiro
  const jan28 = new Date(year, 0, 28);
  const monday0 = new Date(year, 0, 28 - ((jan28.getDay() + 6) % 7));
  let seed = hash(key) >>> 0 || 1;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: Date[] = [];
  let prev = -Infinity;
  for (const slot of SLOTS) {
    const opts = WEEKDAYS[div][slot.mid ? 'mid' : 'end'];
    let r = rnd(),
      off = opts[opts.length - 1][0];
    for (const [o, w] of opts) {
      if (r < w) {
        off = o;
        break;
      }
      r -= w;
    }
    let t = new Date(monday0.getFullYear(), monday0.getMonth(), monday0.getDate() + slot.week * 7 + off).getTime();
    // pelo menos três dias entre uma rodada e outra
    if (t - prev < 3 * DAY_MS) t = prev + 3 * DAY_MS;
    prev = t;
    out.push(new Date(t));
  }
  cache.set(key, out);
  return out;
};

/** Data (no calendário) de um dia de jogos. Sem divisão, usa a do clube do usuário. */
export const dateOf = (W: World, d: number, div?: Div): Date => {
  const dv = div ?? (W.user != null ? W.clubs[W.user].div : 'A');
  const list = seasonDates(W.year, dv);
  return new Date(list[Math.max(0, Math.min(list.length - 1, d - 1))]);
};

/** Dias de descanso antes da rodada `d` (na pré-temporada, 30). */
export const restDays = (W: World, d: number, div: Div): number =>
  d <= 1 ? 30 : Math.round((dateOf(W, d, div).getTime() - dateOf(W, d - 1, div).getTime()) / DAY_MS);

export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const fmtDate = (dt: Date): string => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** Jogos ainda não disputados num dia. */
export const dayFixtures = (W: World, day: number): FixtureRef[] => {
  const out: FixtureRef[] = [];
  for (const div of DIVS) {
    const comp = W.comps[div];
    for (const f of comp.fx) if (f.d === day && !f.pl) out.push({ comp, f });
  }
  return out;
};

export const userFixture = (W: World, day: number): FixtureRef | undefined =>
  dayFixtures(W, day).find((x) => x.f.h === W.user || x.f.a === W.user);

export const nextUserFixture = (W: World): FixtureRef | null => {
  let best: FixtureRef | null = null;
  for (const div of DIVS)
    for (const f of W.comps[div].fx)
      if (!f.pl && (f.h === W.user || f.a === W.user) && (!best || best.f.d > f.d)) best = { comp: W.comps[div], f };
  return best;
};
