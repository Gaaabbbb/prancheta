import { DIVS, SEASON_DAYS, type Div } from '../constants/divisions';
import { hash } from '../rng';
import type { Competition, Fixture, World } from '../types';
import { cupWeeks } from './cupDates';

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

// ---------------------------------------------------------------- calendário por dias

/** A temporada anda dia a dia? (`W.day` = dia do ano, 0 = 1º de janeiro) */
export const isDays = (W: World): boolean => W.cal === 'days';

/** Dia em que a temporada começa no calendário por dias (4 de janeiro já passado: o 1º dia jogável é 5/jan). */
export const DAYS_START = 3;

/** Uma rodada equivale a ~3,5 dias: converte chances e prazos que eram por rodada. */
export const ROUND_DAYS = 3.5;

/** Chance por "tique": igual à de antes por rodada, ou a equivalente diária. */
export const perTick = (W: World, p: number): number => (isDays(W) ? 1 - Math.pow(1 - p, 1 / ROUND_DAYS) : p);

/** Prazo em tiques: `rounds` rodadas, ou os dias equivalentes. */
export const ticks = (W: World, rounds: number): number => (isDays(W) ? Math.round(rounds * ROUND_DAYS) : rounds);

/** Último dia da temporada (rodada 40, ou 31 de dezembro). */
export const seasonLastDay = (W: World): number => (isDays(W) ? 364 : SEASON_DAYS);

/** Quanto da temporada já passou (0 a 1). */
export const seasonProgress = (W: World): number =>
  Math.max(0, Math.min(1, isDays(W) ? (W.day - DAYS_START) / (seasonLastDay(W) - DAYS_START) : W.day / SEASON_DAYS));

/** "3 dias" ou "3 rodadas", conforme o calendário. */
export const unitTxt = (W: World, n: number): string =>
  isDays(W) ? `${n} dia${n === 1 ? '' : 's'}` : `${n} rodada${n === 1 ? '' : 's'}`;

/** Rodada do jogo dentro da competição. */
export const roundOf = (f: Fixture): number => f.r ?? f.d;

const DAY_MS_ = 86400000;
/** Dia do ano de uma data. */
export const dayOfYear = (dt: Date): number =>
  Math.round(
    (new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime() - new Date(dt.getFullYear(), 0, 1).getTime()) /
      DAY_MS_,
  );

/** Rodadas que cada divisão precisa no ano (fase de liga + mata-matas + folga). */
const LEAGUE_SLOTS: Record<Div, number> = { A: 40, B: 42, C: 36, D: 28, SUL: 40 };

/**
 * Datas das rodadas de uma divisão no calendário por dias (dias do ano). Usa as mesmas pausas do WEEK_PLAN, uma
 * rodada por fim de semana e, quando faltam datas, rodadas no meio da semana só nas semanas sem jogos de copa.
 */
export const leagueDays = (year: number, div: Div, need = LEAGUE_SLOTS[div]): number[] => {
  const jan28 = new Date(year, 0, 28);
  const monday0 = new Date(year, 0, 28 - ((jan28.getDay() + 6) % 7));
  const last = new Date(year, 11, 6).getTime();
  const cups = cupWeeks(year);
  let seed = hash('dias' + year + div) >>> 0 || 1;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = (opts: [number, number][]) => {
    let r = rnd();
    for (const [o, w] of opts) {
      if (r < w) return o;
      r -= w;
    }
    return opts[opts.length - 1][0];
  };
  const weeks: { mon: Date; plan: string }[] = [];
  for (let w = 0; ; w++) {
    const mon = new Date(monday0.getFullYear(), monday0.getMonth(), monday0.getDate() + w * 7);
    if (mon.getTime() > last) break;
    weeks.push({ mon, plan: WEEK_PLAN[w] ?? 'W' });
  }
  const open = weeks.filter((w) => w.plan !== '-');
  const at = (mon: Date, off: number) => dayOfYear(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + off));
  const slots: number[] = open.slice(0, need).map((w) => at(w.mon, pick(WEEKDAYS[div].end)));
  const missing = need - slots.length;
  if (missing > 0) {
    // meio de semana: semanas livres de copa, primeiro as marcadas com 'D', espalhadas pela temporada
    const free = open.filter((w) => !cups.has(dayOfYear(w.mon)));
    const pref = [...free.filter((w) => w.plan === 'D'), ...free.filter((w) => w.plan !== 'D')];
    const chosen = pref.length <= missing ? pref : pref.slice(0, missing);
    for (const w of chosen) slots.push(at(w.mon, pick(WEEKDAYS[div].mid)));
  }
  slots.sort((a, b) => a - b);
  // pelo menos três dias entre uma rodada e outra
  for (let i = 1; i < slots.length; i++) if (slots[i] - slots[i - 1] < 3) slots[i] = slots[i - 1] + 3;
  return slots;
};

/** Data (no calendário) de um dia de jogos. Sem divisão, usa a do clube do usuário. */
export const dateOf = (W: World, d: number, div?: Div): Date => {
  if (isDays(W)) return new Date(W.year, 0, 1 + d);
  const dv = div ?? (W.user != null ? W.clubs[W.user].div : 'A');
  const list = seasonDates(W.year, dv);
  return new Date(list[Math.max(0, Math.min(list.length - 1, d - 1))]);
};

/** Dias de descanso antes da rodada `d` (na pré-temporada, 30). */
export const restDays = (W: World, d: number, div: Div): number =>
  d <= 1 ? 30 : Math.round((dateOf(W, d, div).getTime() - dateOf(W, d - 1, div).getTime()) / DAY_MS);

/** Dias desde o último jogo do clube antes do dia `d` (calendário por dias; 30 se ainda não jogou). */
export const clubRestBefore = (W: World, club: number, d: number): number => {
  let last = -Infinity;
  for (const comp of Object.values(W.comps))
    for (const f of comp.fx) if (f.d < d && f.d > last && (f.h === club || f.a === club)) last = f.d;
  return last === -Infinity ? 30 : d - last;
};

export const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const fmtDate = (dt: Date): string => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** Prazo para texto: "12 de fev." (por dias) ou "a rodada 8" (por rodadas). */
export const deadlineTxt = (W: World, d: number): string =>
  isDays(W) ? dateOf(W, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'a rodada ' + d;

/** Jogos ainda não disputados num dia (de todas as competições). */
export const dayFixtures = (W: World, day: number): FixtureRef[] => {
  const out: FixtureRef[] = [];
  for (const comp of compList(W)) for (const f of comp.fx) if (f.d === day && !f.pl) out.push({ comp, f });
  return out;
};

/** Competições da temporada na ordem de exibição: Séries A–D, depois as copas e as ligas de fora. */
export const compList = (W: World): Competition[] => {
  const br = DIVS.map((d) => W.comps[d]).filter(Boolean);
  const rest = Object.values(W.comps).filter((c) => !(DIVS as readonly string[]).includes(c.id));
  return [...br, ...rest];
};

export const userFixture = (W: World, day: number): FixtureRef | undefined =>
  dayFixtures(W, day).find((x) => x.f.h === W.user || x.f.a === W.user);

export const nextUserFixture = (W: World): FixtureRef | null => {
  let best: FixtureRef | null = null;
  for (const comp of compList(W))
    for (const f of comp.fx)
      if (!f.pl && (f.h === W.user || f.a === W.user) && (!best || best.f.d > f.d)) best = { comp, f };
  return best;
};
