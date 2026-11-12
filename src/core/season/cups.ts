import { DIVS } from '../constants/divisions';
import { addMoney } from '../finance/ledger';
import { news } from '../news';
import { shuffle } from '../rng';
import type { Competition, Fixture, KOStage, World } from '../types';
import { dateOf, deadlineTxt } from './calendar';
import { CDB_2026, cupDays } from './cupDates';
import { addKOStage, addSingleStage } from './fixtures';
import { isForeignLeague } from './foreignLeagues';
import { stageDone, tieResult } from './table';

// ---------------------------------------------------------------- utilitários das copas

const brl = (v: number) =>
  v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : 'R$ ' + Math.round(v / 1e3) + ' mil';

/** Paga a premiação de uma fase a cada clube (com aviso para o usuário). */
export const payPrize = (W: World, clubs: number[], value: number, why: string): void => {
  if (!value) return;
  for (const id of clubs) {
    addMoney(W, W.clubs[id], 'pre', value);
    if (id === W.user) news(W, 'Premiação: ' + brl(value), why + '.', 'cup');
  }
};

/** Vencedores da fase atual (e marca a fase como concluída). */
export const closeStage = (comp: Competition): number[] => {
  const st = comp.stages[comp.si] as KOStage;
  st.ties.forEach((t) => (t.w = tieResult(comp, t, st.seedDecides)));
  st.done = true;
  return st.ties.map((t) => t.w!);
};

/** Avisa o usuário do adversário na fase nova da copa. */
export const announceStage = (W: World, comp: Competition, si: number): void => {
  const st = comp.stages[si];
  if (st.type !== 'ko') return;
  const tie = st.ties.find((t) => t.a === W.user || t.b === W.user);
  if (!tie) return;
  const opp = W.clubs[tie.a === W.user ? tie.b : tie.a];
  const f = comp.fx[tie.f[0]];
  const home = f.h === W.user;
  const where = f.neu ? 'em campo neutro' : home ? 'em casa' : 'fora';
  news(
    W,
    `${comp.name}: ${st.name}`,
    st.single
      ? `Jogo único contra o ${opp.n}, ${deadlineTxt(W, f.d)}, ${where}.${f.neu ? '' : ' Empate leva aos pênaltis.'}`
      : `Contra o ${opp.n}. Ida ${deadlineTxt(W, f.d)} (${home ? 'em casa' : 'fora'}), volta ${deadlineTxt(W, comp.fx[tie.f[1]].d)}.`,
    'cup',
    { comp: comp.id, fid: f.id },
  );
};

/** Avisa a eliminação do usuário. */
const announceOut = (W: World, comp: Competition, winners: number[]): void => {
  const st = comp.stages[comp.si] as KOStage;
  const tie = st.ties.find((t) => t.a === W.user || t.b === W.user);
  if (tie && !winners.includes(W.user!))
    news(
      W,
      `Eliminado da ${comp.name}`,
      `O ${W.clubs[tie.w!].n} passou na ${st.name.toLowerCase()}. A temporada segue nas outras competições.`,
      'cup',
    );
};

/** Competições de liga (os jogos delas é que são adiados quando batem com copa). */
const isLeague = (id: string) => (DIVS as readonly string[]).includes(id) || isForeignLeague(id);

/**
 * Nenhum clube joga duas vezes com menos de 2 dias de intervalo: o jogo de liga que bater com jogo de copa é
 * adiado para o primeiro dia livre dos dois clubes depois da copa.
 */
export const resolveConflicts = (W: World): number => {
  if (W.cal !== 'days') return 0;
  let moved = 0;
  for (let pass = 0; pass < 6; pass++) {
    const byClub = new Map<number, { comp: Competition; f: Fixture }[]>();
    for (const comp of Object.values(W.comps))
      for (const f of comp.fx)
        if (!f.pl && f.d > W.day)
          for (const c of [f.h, f.a]) {
            let l = byClub.get(c);
            if (!l) byClub.set(c, (l = []));
            l.push({ comp, f });
          }
    const busy = (c: number, d: number, self: Fixture) =>
      (byClub.get(c) || []).some((x) => x.f !== self && Math.abs(x.f.d - d) < 2);
    let changed = false;
    for (const [, list] of byClub) {
      list.sort((x, y) => x.f.d - y.f.d);
      for (let i = 1; i < list.length; i++) {
        const p = list[i - 1],
          q = list[i];
        if (q.f.d - p.f.d >= 2) continue;
        const lg = isLeague(q.comp.id) ? q : isLeague(p.comp.id) ? p : null;
        const cup = lg === q ? p : q;
        if (!lg || isLeague(cup.comp.id)) continue;
        let d = Math.max(cup.f.d + 2, W.day + 1);
        while (d < 364 && (busy(lg.f.h, d, lg.f) || busy(lg.f.a, d, lg.f))) d++;
        const old = lg.f.d;
        lg.f.d = d;
        moved++;
        changed = true;
        if (lg.f.h === W.user || lg.f.a === W.user)
          news(
            W,
            'Jogo adiado',
            `${W.clubs[lg.f.h].n} x ${W.clubs[lg.f.a].n} (${lg.comp.name}) saiu de ${deadlineTxt(W, old)} para ${deadlineTxt(W, d)} por causa da ${cup.comp.name}.`,
            'info',
          );
      }
    }
    if (!changed) break;
  }
  return moved;
};

// ---------------------------------------------------------------- Copa do Brasil

interface CupPhase {
  name: string;
  slot: number;
  single?: boolean;
  neutral?: boolean;
  /** premiação para quem disputa a fase */
  prize: number;
}

/** Fases da Copa do Brasil (rodadas = índices das datas em CDB_2026). Premiação ~1/4 da real. */
export const CDB_PHASES: CupPhase[] = [
  { name: '1ª fase', slot: 1, single: true, prize: 1e5 },
  { name: '2ª fase', slot: 2, single: true, prize: 2e5 },
  { name: '3ª fase', slot: 3, single: true, prize: 2.5e5 },
  { name: '4ª fase', slot: 4, single: true, prize: 3e5 },
  { name: '5ª fase', slot: 5, prize: 5e5 },
  { name: 'Oitavas de final', slot: 7, prize: 7.5e5 },
  { name: 'Quartas de final', slot: 9, prize: 1e6 },
  { name: 'Semifinal', slot: 11, prize: 2.25e6 },
  { name: 'Final', slot: 13, single: true, neutral: true, prize: 0 },
];
export const CDB_CHAMP_PRIZE = 19.5e6;
export const CDB_VICE_PRIZE = 8.5e6;

const DIV_ORD: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** "Ranking da CBF" simplificado: divisão, depois reputação. */
export const cbfRank = (W: World, ids: number[]): number[] =>
  ids.slice().sort((x, y) => DIV_ORD[W.clubs[x].div] - DIV_ORD[W.clubs[y].div] || W.clubs[y].rep - W.clubs[x].rep);

/** Melhor x pior colocado; o pior manda o jogo (`a` = mandante). */
const bestVsWorst = (ranked: number[]) => {
  const out: { a: number; b: number }[] = [];
  for (let i = 0; i < Math.floor(ranked.length / 2); i++) out.push({ a: ranked[ranked.length - 1 - i], b: ranked[i] });
  return out;
};

/** Sorteio livre; `b` (quem decide em casa) é o de maior reputação. */
export const drawPairs = (W: World, ids: number[]) => {
  const s = shuffle(ids.slice());
  const out: { a: number; b: number }[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const [x, y] = [s[i], s[i + 1]];
    out.push(W.clubs[x].rep >= W.clubs[y].rep ? { a: y, b: x } : { a: x, b: y });
  }
  return out;
};

/** Entradas da Copa do Brasil guardadas na competição (para as fases seguintes). */
type CdbComp = Competition & { entry?: { p2: number[]; p3: number[]; a: number[] } };

/**
 * Monta a Copa do Brasil (126 clubes): os 20 da Série A entram na 5ª fase; dos outros, pelo ranking, os 4 melhores
 * entram na 3ª fase, os 74 seguintes na 2ª e os 28 seguintes na 1ª. Os demais (os mais fracos da Série D) ficam fora.
 */
export const buildCopaDoBrasil = (W: World): void => {
  const br = W.clubs.filter((c) => c.div !== 'SUL');
  const a = br.filter((c) => c.div === 'A').map((c) => c.id);
  const others = cbfRank(
    W,
    br.filter((c) => c.div !== 'A').map((c) => c.id),
  ).slice(0, 106);
  if (a.length < 20 || others.length < 106) return;
  const comp: CdbComp = {
    id: 'CDB',
    name: 'Copa do Brasil',
    stages: [],
    fx: [],
    si: 0,
    done: false,
    res: { champ: null, prom: [], rel: [] },
    n: 126,
    dates: cupDays(W.year, CDB_2026),
    entry: { p3: others.slice(0, 4), p2: others.slice(4, 78), a },
  };
  W.comps.CDB = comp;
  const p1 = others.slice(78, 106);
  const ph = CDB_PHASES[0];
  addSingleStage(comp, ph.name, bestVsWorst(p1), ph.slot);
  payPrize(W, p1, ph.prize, `Participação na ${ph.name} da Copa do Brasil`);
  announceStage(W, comp, 0);
};

/** Avança a Copa do Brasil quando a fase atual termina. */
export const advanceCopaDoBrasil = (W: World, comp: Competition): void => {
  if (!stageDone(comp, comp.si)) return;
  const c = comp as CdbComp;
  const k = comp.stages.length; // índice da próxima fase
  const winners = closeStage(comp);
  announceOut(W, comp, winners);
  if (k >= CDB_PHASES.length) {
    // final: campeão e vice
    const champ = winners[0];
    const st = comp.stages[comp.si] as KOStage;
    const vice = st.ties[0].a === champ ? st.ties[0].b : st.ties[0].a;
    comp.res.champ = champ;
    comp.res.lib = [champ, vice];
    comp.done = true;
    payPrize(W, [champ], CDB_CHAMP_PRIZE, 'Título da Copa do Brasil');
    payPrize(W, [vice], CDB_VICE_PRIZE, 'Vice-campeonato da Copa do Brasil');
    if (champ === W.user)
      news(W, 'Campeão da Copa do Brasil!', 'O título garante vaga na fase de grupos da Libertadores.', 'cup');
    else news(W, 'Copa do Brasil', `O ${W.clubs[champ].n} é o campeão da Copa do Brasil ${W.year}.`, 'cup');
    return;
  }
  const ph = CDB_PHASES[k];
  let ties: { a: number; b: number }[];
  if (k === 1) ties = bestVsWorst(cbfRank(W, [...winners, ...(c.entry?.p2 || [])]));
  else if (k === 2) ties = bestVsWorst(cbfRank(W, [...winners, ...(c.entry?.p3 || [])]));
  else if (k === 3) ties = bestVsWorst(cbfRank(W, winners));
  else if (k === 4) {
    // 5ª fase: os 12 que vieram das fases iniciais pegam clubes da Série A (ida na casa deles); os outros 8 da A se
    // enfrentam entre si
    const a = shuffle((c.entry?.a || []).slice());
    ties = winners.map((w, i) => ({ a: w, b: a[i] }));
    ties.push(...drawPairs(W, a.slice(winners.length)));
  } else if (ph.single) {
    // final: o de maior reputação aparece como "mandante" (campo neutro)
    const [x, y] = winners;
    ties = [W.clubs[x].rep >= W.clubs[y].rep ? { a: x, b: y } : { a: y, b: x }];
  } else ties = drawPairs(W, winners);
  if (ph.single) addSingleStage(comp, ph.name, ties, ph.slot, { neutral: ph.neutral });
  else addKOStage(comp, ph.name, ties, ph.slot);
  const inStage = ties.flatMap((t) => [t.a, t.b]);
  payPrize(W, inStage, ph.prize, `Classificação para a ${ph.name.toLowerCase()} da Copa do Brasil`);
  announceStage(W, comp, comp.si);
  resolveConflicts(W);
};

/** Avanço das copas por id da competição. */
export const CUP_ADVANCE: Record<string, (W: World, comp: Competition) => void> = {
  CDB: advanceCopaDoBrasil,
};

/** Data de um jogo para mensagens. */
export const fxDate = (W: World, f: Fixture): Date => dateOf(W, f.d);
