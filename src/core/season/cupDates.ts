/**
 * Datas das copas, tiradas do calendário de 2026 (CBF e Conmebol). Nos outros anos cada data cai no mesmo dia da
 * semana, na semana mais próxima.
 */

type MD = [month: number, day: number];

/** Copa do Brasil: fases 1–4 em jogo único, 5ª fase a semifinal em ida e volta, final em jogo único. */
export const CDB_2026: MD[] = [
  [1, 18], // 1ª fase
  [1, 25], // 2ª fase
  [2, 11], // 3ª fase
  [2, 18], // 4ª fase
  [3, 22], // 5ª fase (ida)
  [4, 13], // 5ª fase (volta)
  [7, 2], // oitavas (ida)
  [7, 5], // oitavas (volta)
  [7, 26], // quartas (ida)
  [8, 2], // quartas (volta)
  [10, 4], // semifinal (ida)
  [10, 11], // semifinal (volta)
  [11, 6], // final
];

/** Libertadores: três fases preliminares, 6 rodadas de grupos, mata-mata e final única. */
export const LIB_2026: MD[] = [
  [1, 3], // 1ª fase
  [1, 10],
  [1, 17], // 2ª fase
  [1, 24],
  [2, 3], // 3ª fase
  [2, 10],
  [3, 7], // grupos
  [3, 14],
  [3, 28],
  [4, 5],
  [4, 19],
  [4, 26],
  [7, 12], // oitavas
  [7, 19],
  [8, 9], // quartas
  [8, 16],
  [9, 14], // semifinal
  [9, 21],
  [10, 28], // final
];

/** Sul-Americana: 1ª fase única (dentro do país), grupos, playoffs, mata-mata e final única. */
export const SULA_2026: MD[] = [
  [2, 4], // 1ª fase
  [3, 8], // grupos
  [3, 15],
  [3, 29],
  [4, 6],
  [4, 20],
  [4, 27],
  [6, 22], // playoffs
  [6, 29],
  [7, 13], // oitavas
  [7, 20],
  [8, 10], // quartas
  [8, 17],
  [9, 15], // semifinal
  [9, 22],
  [10, 21], // final
];

const DAY_MS = 86400000;
const jan1 = (y: number) => new Date(y, 0, 1).getTime();

/** Dia do ano (0 = 1º de janeiro) da data de 2026 levada para o ano `year`, no mesmo dia da semana. */
export const cupDay = (year: number, [m, d]: MD): number => {
  const wd = new Date(2026, m, d).getDay();
  const base = new Date(year, m, d);
  let delta = (wd - base.getDay() + 7) % 7;
  if (delta > 3) delta -= 7;
  return Math.round((base.getTime() + delta * DAY_MS - jan1(year)) / DAY_MS);
};

export const cupDays = (year: number, list: MD[]): number[] => list.map((md) => cupDay(year, md));

/** Semanas (segunda-feira, em dia do ano) que têm algum jogo de copa: o campeonato não marca rodada no meio delas. */
export const cupWeeks = (year: number): Set<number> => {
  const out = new Set<number>();
  for (const list of [CDB_2026, LIB_2026, SULA_2026])
    for (const md of list) {
      const d = cupDay(year, md);
      const wd = (new Date(year, 0, 1 + d).getDay() + 6) % 7; // 0 = segunda
      out.add(d - wd);
    }
  return out;
};
