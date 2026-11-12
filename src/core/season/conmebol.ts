import { FOREIGN } from '../constants/divisions';
import { normName } from '../math';
import { news } from '../news';
import { shuffle } from '../rng';
import type { Competition, KOStage, LeagueStage, Qualifiers, World } from '../types';
import { LIB_2026, SULA_2026, cupDays } from './cupDates';
import { announceStage, closeStage, drawPairs, payPrize, resolveConflicts } from './cups';
import { addKOStage, addLeagueStage, addSingleStage } from './fixtures';
import { stageDone, table } from './table';

// ---------------------------------------------------------------- vagas

/** Classificados reais de 2026 (Wikipedia), por país e fase. */
const REAL_2026 = {
  libChamp: 'Flamengo',
  sulaChamp: 'Lanús',
  lib: {
    BRA: { g: ['Corinthians', 'Palmeiras', 'Cruzeiro', 'Mirassol', 'Fluminense'], p2: ['Botafogo', 'Bahia'] },
    ARG: {
      g: ['Platense', 'Estudiantes', 'Independiente Rivadavia', 'Rosario Central', 'Boca Juniors'],
      p2: ['Argentinos Juniors'],
    },
    BOL: { g: ['Always Ready', 'Bolívar'], p2: ['Nacional Potosí'], p1: ['The Strongest'] },
    CHI: { g: ['Coquimbo Unido', 'Universidad Católica'], p2: ["O'Higgins", 'Huachipato'] },
    COL: { g: ['Santa Fe', 'Junior'], p2: ['Deportes Tolima', 'Independiente Medellín'] },
    ECU: { g: ['Independiente del Valle', 'LDU Quito'], p2: ['Barcelona'], p1: ['Universidad Católica'] },
    PAR: { g: ['Cerro Porteño', 'Libertad'], p2: ['Guaraní'], p1: ['2 de Mayo'] },
    PER: { g: ['Universitario', 'Cusco'], p2: ['Sporting Cristal'], p1: ['Alianza Lima'] },
    URU: { g: ['Nacional', 'Peñarol'], p2: ['Liverpool'], p1: ['Juventud'] },
    VEN: { g: ['Universidad Central', 'Deportivo La Guaira'], p2: ['Carabobo'], p1: ['Deportivo Táchira'] },
  } as Record<string, { g: string[]; p2?: string[]; p1?: string[] }>,
  sula: {
    BRA: ['São Paulo', 'Grêmio', 'Red Bull Bragantino', 'Atlético-MG', 'Santos', 'Vasco'],
    ARG: ['River Plate', 'Racing', 'Deportivo Riestra', 'San Lorenzo', 'Tigre', 'Barracas Central'],
    BOL: ['San Antonio Bulo Bulo', 'Blooming', 'Independiente Petrolero', 'Guabirá'],
    CHI: ['Universidad de Chile', 'Audax Italiano', 'Palestino', 'Cobresal'],
    COL: ['Atlético Nacional', 'América de Cali', 'Atlético Bucaramanga', 'Millonarios'],
    ECU: ['Orense', 'Libertad', 'Macará', 'Deportivo Cuenca'],
    PAR: ['Sportivo Trinidense', 'Nacional', 'Recoleta', 'Olimpia'],
    PER: ['Alianza Atlético', 'Melgar', 'Deportivo Garcilaso', 'Cienciano'],
    URU: ['Defensor Sporting', 'Boston River', 'Racing', 'Montevideo City Torque'],
    VEN: ['Academia Puerto Cabello', 'Monagas', 'Caracas', 'Metropolitanos'],
  } as Record<string, string[]>,
};

/** Vagas de cada país na Libertadores: [fase de grupos, 2ª fase, 1ª fase]. */
const LIB_BERTHS: Record<string, [number, number, number]> = {
  BRA: [5, 2, 0],
  ARG: [5, 1, 0],
  CHI: [2, 2, 0],
  COL: [2, 2, 0],
  BOL: [2, 1, 1],
  ECU: [2, 1, 1],
  PAR: [2, 1, 1],
  PER: [2, 1, 1],
  URU: [2, 1, 1],
  VEN: [2, 1, 1],
};

const countryClubs = (W: World, k: string) =>
  W.clubs.filter((c) => (k === 'BRA' ? c.div !== 'SUL' : c.country === k)).map((c) => c.id);

/** Clubes do país pela classificação da liga (ou pela reputação, se a liga ainda não foi jogada). */
const ranking = (W: World, k: string): number[] => {
  if (k === 'BRA') {
    const a = W.comps.A;
    const t = a && a.stages[0]?.type === 'league' && a.fx.some((f) => f.pl) ? table(W, a, 0, 0).map((r) => r.c) : [];
    const rest = countryClubs(W, 'BRA')
      .filter((id) => !t.includes(id))
      .sort((x, y) => W.clubs[y].rep - W.clubs[x].rep);
    return [...t, ...rest];
  }
  const lg = W.comps[k];
  const t = lg?.done && lg.res.lib ? lg.res.lib.filter((id) => W.clubs[id]?.country === k) : [];
  const rest = countryClubs(W, k)
    .filter((id) => !t.includes(id))
    .sort((x, y) => W.clubs[y].rep - W.clubs[x].rep);
  return [...t, ...rest];
};

/** Acha um clube do país pelo nome (exato, depois "Nome (País)", depois contém). */
const byName = (W: World, k: string, name: string): number | null => {
  const ids = countryClubs(W, k);
  const n = normName(name);
  const hit =
    ids.find((id) => normName(W.clubs[id].n) === n) ??
    ids.find((id) => normName(W.clubs[id].n).startsWith(n + ' (')) ??
    ids.find((id) => normName(W.clubs[id].n).includes(n));
  return hit ?? null;
};

/**
 * Monta as vagas a partir de uma lista por país (ranking) e dos campeões. Os clubes já classificados para a
 * Libertadores ficam fora da Sul-Americana; vaga sem clube passa para o próximo do ranking.
 */
const assemble = (
  year: number,
  rank: (k: string) => number[],
  libChamp: number | null,
  sulaChamp: number | null,
  cdbChamp: number | null,
): Qualifiers => {
  const used = new Set<number>();
  const take = (list: number[], n: number) => {
    const out: number[] = [];
    for (const id of list) {
      if (out.length >= n) break;
      if (!used.has(id)) {
        used.add(id);
        out.push(id);
      }
    }
    return out;
  };
  const q: Qualifiers = { year, lib: { g: [], p2: [], p1: [] }, sula: { g: [], p1: {} } };
  // campeões: vaga própria na fase de grupos (sem campeão, a vaga vai para o melhor do Brasil / Argentina)
  q.lib.g.push(...take(libChamp != null ? [libChamp] : rank('BRA'), 1));
  q.lib.g.push(...take(sulaChamp != null ? [sulaChamp] : rank('ARG'), 1));
  for (const k of ['BRA', ...FOREIGN]) {
    const [g, p2, p1] = LIB_BERTHS[k];
    // no Brasil, o campeão da Copa do Brasil é o primeiro da lista
    const list = k === 'BRA' && cdbChamp != null ? [cdbChamp, ...rank(k)] : rank(k);
    q.lib.g.push(...take(list, g));
    q.lib.p2.push(...take(list, p2));
    q.lib.p1.push(...take(list, p1));
  }
  for (const k of ['BRA', 'ARG']) q.sula.g.push(...take(rank(k), 6));
  for (const k of FOREIGN) if (k !== 'ARG') q.sula.p1[k] = take(rank(k), 4);
  return q;
};

/** Vagas reais de 2026 (carreira nova), com o ranking como reserva se faltar algum clube. */
const real2026 = (W: World): Qualifiers => {
  const R = REAL_2026;
  const rank = (k: string): number[] => {
    const named = [...(R.lib[k]?.g || []), ...(R.lib[k]?.p2 || []), ...(R.lib[k]?.p1 || []), ...(R.sula[k] || [])]
      .map((n) => byName(W, k, n))
      .filter((x): x is number => x != null);
    return [...named, ...ranking(W, k).filter((id) => !named.includes(id))];
  };
  return assemble(2026, rank, byName(W, 'BRA', R.libChamp), byName(W, 'ARG', R.sulaChamp), null);
};

/** Vagas para o ano seguinte, pelas tabelas da temporada que acabou (chamado na virada, com o ano antigo). */
export const computeQualifiers = (W: World): Qualifiers =>
  assemble(
    W.year + 1,
    (k) => ranking(W, k),
    W.comps.LIB?.res.champ ?? null,
    W.comps.SULA?.res.champ ?? null,
    W.comps.CDB?.res.champ ?? null,
  );

/** Vagas da temporada atual: as guardadas na virada, as reais de 2026 ou pelo ranking. */
const currentQualifiers = (W: World): Qualifiers => {
  const q = W.qual;
  if (q && q.year === W.year) return q;
  if (W.year === 2026) return real2026(W);
  return assemble(W.year, (k) => ranking(W, k), null, null, null);
};

// ---------------------------------------------------------------- utilitários

type CupComp = Competition & { entry?: Record<string, number[]> };

const country = (W: World, id: number) => W.clubs[id].country || 'BRA';

/** Sorteio de 8 grupos de 4 por potes de reputação, evitando dois clubes do mesmo país no grupo. */
export const drawGroups = (W: World, ids: number[], n = 8): number[][] => {
  const sorted = ids.slice().sort((x, y) => W.clubs[y].rep - W.clubs[x].rep);
  const size = Math.ceil(sorted.length / n);
  const groups: number[][] = Array.from({ length: n }, () => []);
  for (let p = 0; p < size; p++) {
    const pot = sorted.slice(p * n, p * n + n);
    let best: number[] | null = null,
      bestClash = Infinity;
    for (let t = 0; t < 60 && bestClash > 0; t++) {
      const s = shuffle(pot.slice());
      const clash = s.reduce((k, id, gi) => k + (groups[gi].some((x) => country(W, x) === country(W, id)) ? 1 : 0), 0);
      if (clash < bestClash) {
        bestClash = clash;
        best = s;
      }
    }
    best!.forEach((id, gi) => groups[gi].push(id));
  }
  return groups;
};

/** Líderes x segundos de outros grupos (o líder decide em casa). */
const pairWinnersRunners = (winners: number[], runners: number[]) => {
  let idx = runners.map((_, i) => i);
  for (let t = 0; t < 100; t++) {
    idx = shuffle(idx.slice());
    if (idx.every((j, i) => j !== i)) break;
  }
  return winners.map((w, i) => ({ a: runners[idx[i]], b: w }));
};

/** Classificação final dos grupos: [líderes, segundos, terceiros] e vitórias de cada clube. */
const groupResults = (W: World, comp: Competition, si: number) => {
  const st = comp.stages[si] as LeagueStage;
  const tabs = st.groups.map((_g, gi) => table(W, comp, si, gi));
  const wins: Record<number, number> = {};
  tabs.forEach((t) => t.forEach((r) => (wins[r.c] = r.v)));
  return {
    first: tabs.map((t) => t[0].c),
    second: tabs.map((t) => t[1].c),
    third: tabs.map((t) => t[2].c),
    wins,
    tabs,
  };
};

/** Avisa o usuário do grupo dele. */
const announceGroup = (W: World, comp: Competition, si: number) => {
  const st = comp.stages[si] as LeagueStage;
  const gi = st.groups.findIndex((g) => g.includes(W.user!));
  if (gi < 0) return;
  const rivals = st.groups[gi].filter((id) => id !== W.user).map((id) => W.clubs[id].n);
  news(
    W,
    `${comp.name}: grupo ${String.fromCharCode(65 + gi)}`,
    `Adversários: ${rivals.join(', ')}. Os dois primeiros avançam${comp.id === 'LIB' ? '; o terceiro cai para a Sul-Americana' : ''}.`,
    'cup',
    { comp: comp.id },
  );
};

const groupNews = (W: World, comp: Competition, first: number[], second: number[], third: number[]) => {
  const u = W.user!;
  const st = comp.stages[comp.si] as LeagueStage;
  if (!st.groups.some((g) => g.includes(u))) return;
  const txt = first.includes(u)
    ? 'Primeiro do grupo: classificado para as oitavas.'
    : second.includes(u)
      ? comp.id === 'LIB'
        ? 'Segundo do grupo: classificado para as oitavas.'
        : 'Segundo do grupo: vai aos playoffs contra um terceiro da Libertadores.'
      : third.includes(u) && comp.id === 'LIB'
        ? 'Terceiro do grupo: segue nos playoffs da Sul-Americana.'
        : 'Eliminado na fase de grupos.';
  news(W, `${comp.name}: fim da fase de grupos`, txt, 'cup', { comp: comp.id });
};

// ---------------------------------------------------------------- Libertadores

/** Premiação da Libertadores (~1/4 da real, dólar a R$ 5,50). */
export const LIB_PRIZE = {
  p1: 5.5e5,
  p2: 6.9e5,
  p3: 8.25e5,
  group: 4.1e6,
  win: 4.5e5,
  r16: 1.7e6,
  qf: 2.3e6,
  sf: 3.2e6,
  champ: 33e6,
  vice: 9.6e6,
};

/** Monta a Libertadores: 1ª fase (ida e volta) com os 6 de entrada, as outras fases esperando. */
export const buildLibertadores = (W: World): void => {
  const q = currentQualifiers(W);
  if (q.lib.p1.length < 2) return;
  const comp: CupComp = {
    id: 'LIB',
    name: 'Libertadores',
    stages: [],
    fx: [],
    si: 0,
    done: false,
    res: { champ: null, prom: [], rel: [] },
    n: q.lib.g.length + q.lib.p2.length + q.lib.p1.length,
    dates: cupDays(W.year, LIB_2026),
    entry: { g: q.lib.g, p2: q.lib.p2 },
  };
  W.comps.LIB = comp;
  addKOStage(comp, '1ª fase', drawPairs(W, q.lib.p1), 1);
  payPrize(W, q.lib.p1, LIB_PRIZE.p1, 'Participação na 1ª fase da Libertadores');
  announceStage(W, comp, 0);
  for (const id of [...q.lib.g, ...q.lib.p2])
    if (id === W.user)
      news(
        W,
        'Libertadores ' + W.year,
        q.lib.g.includes(id)
          ? 'O clube está na fase de grupos.'
          : 'O clube entra na 2ª fase (ida e volta em fevereiro).',
        'cup',
        { comp: 'LIB' },
      );
};

/** Clubes que caíram na 3ª fase da Libertadores (vão para os grupos da Sul-Americana). */
const libP3Losers = (W: World): number[] | null => {
  const lib = W.comps.LIB;
  const st = lib?.stages[2] as KOStage | undefined;
  if (!st || !st.done) return null;
  return st.ties.map((t) => (t.w === t.a ? t.b : t.a));
};

export const advanceLibertadores = (W: World, comp: Competition): void => {
  if (!stageDone(comp, comp.si)) return;
  const c = comp as CupComp;
  const k = comp.stages.length;
  const cur = comp.stages[comp.si];
  if (cur.type === 'league') {
    // fim dos grupos: oitavas (líderes x segundos); terceiros vão para a Sul-Americana
    cur.done = true;
    const { first, second, third, wins } = groupResults(W, comp, comp.si);
    for (const id of Object.keys(wins).map(Number))
      payPrize(W, [id], wins[id] * LIB_PRIZE.win, `${wins[id]} vitória(s) na fase de grupos da Libertadores`);
    groupNews(W, comp, first, second, third);
    c.entry = { ...c.entry, third };
    addKOStage(comp, 'Oitavas de final', pairWinnersRunners(first, second), 13);
    payPrize(W, [...first, ...second], LIB_PRIZE.r16, 'Classificação para as oitavas da Libertadores');
    announceStage(W, comp, comp.si);
    resolveConflicts(W);
    return;
  }
  const winners = closeStage(comp);
  const st = cur as KOStage;
  const tieOfUser = st.ties.find((t) => t.a === W.user || t.b === W.user);
  if (tieOfUser && !winners.includes(W.user!) && k !== 3)
    news(W, 'Eliminado da Libertadores', `O ${W.clubs[tieOfUser.w!].n} passou na ${st.name.toLowerCase()}.`, 'cup');
  if (k === 1) {
    const list = [...(c.entry?.p2 || []), ...winners];
    addKOStage(comp, '2ª fase', drawPairs(W, list), 3);
    payPrize(W, c.entry?.p2 || [], LIB_PRIZE.p2, 'Participação na 2ª fase da Libertadores');
  } else if (k === 2) {
    addKOStage(comp, '3ª fase', drawPairs(W, winners), 5);
    payPrize(W, winners, LIB_PRIZE.p3, 'Classificação para a 3ª fase da Libertadores');
  } else if (k === 3) {
    if (tieOfUser && !winners.includes(W.user!))
      news(
        W,
        'Fora da Libertadores',
        'Eliminado na 3ª fase: o clube vai para a fase de grupos da Sul-Americana.',
        'cup',
      );
    const groups = drawGroups(W, [...(c.entry?.g || []), ...winners]);
    addLeagueStage(comp, 'Fase de grupos', groups, true, 7);
    payPrize(W, groups.flat(), LIB_PRIZE.group, 'Participação na fase de grupos da Libertadores');
    announceGroup(W, comp, comp.si);
  } else if (k === 5) {
    addKOStage(comp, 'Quartas de final', drawPairs(W, winners), 15);
    payPrize(W, winners, LIB_PRIZE.qf, 'Classificação para as quartas da Libertadores');
  } else if (k === 6) {
    addKOStage(comp, 'Semifinal', drawPairs(W, winners), 17);
    payPrize(W, winners, LIB_PRIZE.sf, 'Classificação para a semifinal da Libertadores');
  } else if (k === 7) {
    const [x, y] = winners;
    addSingleStage(comp, 'Final', [W.clubs[x].rep >= W.clubs[y].rep ? { a: x, b: y } : { a: y, b: x }], 19, {
      neutral: true,
    });
  } else {
    const champ = winners[0];
    const vice = st.ties[0].a === champ ? st.ties[0].b : st.ties[0].a;
    comp.res.champ = champ;
    comp.done = true;
    payPrize(W, [champ], LIB_PRIZE.champ, 'Título da Libertadores');
    payPrize(W, [vice], LIB_PRIZE.vice, 'Vice-campeonato da Libertadores');
    news(
      W,
      champ === W.user ? 'Campeão da Libertadores!' : 'Libertadores',
      champ === W.user
        ? 'O clube é campeão da América.'
        : `O ${W.clubs[champ].n} é o campeão da Libertadores ${W.year}.`,
      'cup',
      { comp: 'LIB' },
    );
    return;
  }
  announceStage(W, comp, comp.si);
  resolveConflicts(W);
};

// ---------------------------------------------------------------- Sul-Americana

export const SULA_PRIZE = {
  p1: 3.4e5,
  group: 1.24e6,
  win: 1.6e5,
  po: 6.9e5,
  r16: 8.25e5,
  qf: 9.6e5,
  sf: 1.4e6,
  champ: 8.9e6,
  vice: 3.4e6,
};

/** Monta a Sul-Americana: 1ª fase em jogo único entre clubes do mesmo país. */
export const buildSulamericana = (W: World): void => {
  const q = currentQualifiers(W);
  const ties: { a: number; b: number }[] = [];
  for (const k of Object.keys(q.sula.p1)) {
    const l = q.sula.p1[k];
    // 1º x 4º e 2º x 3º do país; o melhor colocado manda
    if (l.length >= 4) ties.push({ a: l[0], b: l[3] }, { a: l[1], b: l[2] });
  }
  if (!ties.length) return;
  const comp: CupComp = {
    id: 'SULA',
    name: 'Sul-Americana',
    stages: [],
    fx: [],
    si: 0,
    done: false,
    res: { champ: null, prom: [], rel: [] },
    n: q.sula.g.length + ties.length * 2 + 4,
    dates: cupDays(W.year, SULA_2026),
    entry: { g: q.sula.g },
  };
  W.comps.SULA = comp;
  addSingleStage(comp, '1ª fase', ties, 1);
  payPrize(
    W,
    ties.flatMap((t) => [t.a, t.b]),
    SULA_PRIZE.p1,
    'Participação na 1ª fase da Sul-Americana',
  );
  announceStage(W, comp, 0);
  if (q.sula.g.includes(W.user!))
    news(W, 'Sul-Americana ' + W.year, 'O clube está na fase de grupos da Sul-Americana.', 'cup', { comp: 'SULA' });
};

export const advanceSulamericana = (W: World, comp: Competition): void => {
  if (!stageDone(comp, comp.si)) return;
  const c = comp as CupComp;
  const k = comp.stages.length;
  const cur = comp.stages[comp.si];
  if (cur.type === 'league') {
    // os playoffs esperam os terceiros dos grupos da Libertadores
    const libThird = (W.comps.LIB as CupComp | undefined)?.entry?.third;
    if (W.comps.LIB && !libThird) return;
    cur.done = true;
    const { first, second, third, wins } = groupResults(W, comp, comp.si);
    for (const id of Object.keys(wins).map(Number))
      payPrize(W, [id], wins[id] * SULA_PRIZE.win, `${wins[id]} vitória(s) na fase de grupos da Sul-Americana`);
    groupNews(W, comp, first, second, third);
    c.entry = { ...c.entry, first };
    const third8 = libThird && libThird.length === second.length ? libThird : null;
    const ties = third8
      ? shuffle(third8.slice()).map((t, i) => ({ a: t, b: second[i] }))
      : pairWinnersRunners(first, second);
    addKOStage(comp, third8 ? 'Playoffs' : 'Oitavas de final', ties, third8 ? 8 : 10);
    payPrize(
      W,
      ties.flatMap((t) => [t.a, t.b]),
      third8 ? SULA_PRIZE.po : SULA_PRIZE.r16,
      'Classificação no mata-mata da Sul-Americana',
    );
    announceStage(W, comp, comp.si);
    resolveConflicts(W);
    return;
  }
  if (k === 1) {
    // grupos: 16 da 1ª fase + 12 diretos + 4 que caíram na 3ª fase da Libertadores
    const losers = libP3Losers(W);
    if (W.comps.LIB && !losers) return;
    const winners = closeStage(comp);
    const st = cur as KOStage;
    const tie = st.ties.find((t) => t.a === W.user || t.b === W.user);
    if (tie && !winners.includes(W.user!)) news(W, 'Eliminado da Sul-Americana', 'O clube caiu na 1ª fase.', 'cup');
    const groups = drawGroups(W, [...(c.entry?.g || []), ...winners, ...(losers || [])]);
    addLeagueStage(comp, 'Fase de grupos', groups, true, 2);
    payPrize(W, groups.flat(), SULA_PRIZE.group, 'Participação na fase de grupos da Sul-Americana');
    announceGroup(W, comp, comp.si);
    resolveConflicts(W);
    return;
  }
  const winners = closeStage(comp);
  const st = cur as KOStage;
  const tieOfUser = st.ties.find((t) => t.a === W.user || t.b === W.user);
  if (tieOfUser && !winners.includes(W.user!))
    news(W, 'Eliminado da Sul-Americana', `O ${W.clubs[tieOfUser.w!].n} passou na ${st.name.toLowerCase()}.`, 'cup');
  const name = st.name;
  if (name === 'Playoffs') {
    const ties = shuffle(winners.slice()).map((w, i) => ({ a: w, b: c.entry!.first[i] }));
    addKOStage(comp, 'Oitavas de final', ties, 10);
    payPrize(
      W,
      ties.flatMap((t) => [t.a, t.b]),
      SULA_PRIZE.r16,
      'Classificação para as oitavas da Sul-Americana',
    );
  } else if (name === 'Oitavas de final') {
    addKOStage(comp, 'Quartas de final', drawPairs(W, winners), 12);
    payPrize(W, winners, SULA_PRIZE.qf, 'Classificação para as quartas da Sul-Americana');
  } else if (name === 'Quartas de final') {
    addKOStage(comp, 'Semifinal', drawPairs(W, winners), 14);
    payPrize(W, winners, SULA_PRIZE.sf, 'Classificação para a semifinal da Sul-Americana');
  } else if (name === 'Semifinal') {
    const [x, y] = winners;
    addSingleStage(comp, 'Final', [W.clubs[x].rep >= W.clubs[y].rep ? { a: x, b: y } : { a: y, b: x }], 16, {
      neutral: true,
    });
  } else {
    const champ = winners[0];
    const vice = st.ties[0].a === champ ? st.ties[0].b : st.ties[0].a;
    comp.res.champ = champ;
    comp.done = true;
    payPrize(W, [champ], SULA_PRIZE.champ, 'Título da Sul-Americana');
    payPrize(W, [vice], SULA_PRIZE.vice, 'Vice-campeonato da Sul-Americana');
    news(
      W,
      champ === W.user ? 'Campeão da Sul-Americana!' : 'Sul-Americana',
      champ === W.user
        ? 'Título continental, com vaga na fase de grupos da Libertadores.'
        : `O ${W.clubs[champ].n} é o campeão da Sul-Americana ${W.year}.`,
      'cup',
      { comp: 'SULA' },
    );
    return;
  }
  announceStage(W, comp, comp.si);
  resolveConflicts(W);
};

/** Avanço das copas da Conmebol por id. */
export const CONMEBOL_ADVANCE: Record<string, (W: World, comp: Competition) => void> = {
  LIB: advanceLibertadores,
  SULA: advanceSulamericana,
};

/** As vagas da próxima temporada (guardadas no mundo na virada). */
export const storeQualifiers = (W: World): void => {
  W.qual = computeQualifiers(W);
};
