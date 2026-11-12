import { FORMATIONS } from '../constants/formations';
import { available, ovr, ovrRole } from '../player/ratings';
import type { Pos } from '../constants/attributes';
import type { Club, Player, World } from '../types';
import { squad } from '../world/squad';

export const BENCH_SIZE = 9;

const fitScore = (pl: Player, role: Pos) => ovrRole(pl, role) * (0.75 + (0.25 * pl.f) / 100);
const benchScore = (p: Player) => ovr(p) * (0.8 + (0.2 * p.f) / 100);

/** Monta o banco: um goleiro e os melhores restantes. */
export const pickBench = (rest: Player[]): number[] => {
  const sorted = rest.slice().sort((a, b) => benchScore(b) - benchScore(a));
  const bench: number[] = [];
  const gk = sorted.find((p) => p.p === 'GOL');
  if (gk) bench.push(gk.id);
  for (const p of sorted) {
    if (bench.length >= BENCH_SIZE) break;
    if (!bench.includes(p.id)) bench.push(p.id);
  }
  return bench;
};

/** Escalação automática: preenche as vagas da formação com o melhor disponível. */
export const autoLineup = (W: World, club: Club): Club => {
  const slots = FORMATIONS[club.tac.f];
  const pool = squad(W, club.id).filter(available);
  const usedIds = new Set<number>();
  const lineup: (number | null)[] = new Array(11).fill(null);
  // ordem: goleiro, depois as demais vagas
  const order = slots
    .map((_s, i) => i)
    .sort((a, b) => (slots[a][0] === 'GOL' ? -1 : 0) - (slots[b][0] === 'GOL' ? -1 : 0));
  for (const i of order) {
    const role = slots[i][0];
    let best: Player | null = null,
      bs = -1;
    for (const pl of pool) {
      if (usedIds.has(pl.id)) continue;
      const s = fitScore(pl, role);
      if (s > bs) {
        bs = s;
        best = pl;
      }
    }
    if (best) {
      lineup[i] = best.id;
      usedIds.add(best.id);
    }
  }
  // melhora com trocas 2-opt simples
  for (let it = 0; it < 2; it++)
    for (let i = 1; i < 11; i++)
      for (let j = i + 1; j < 11; j++) {
        const a = W.pmap[lineup[i]!],
          b = W.pmap[lineup[j]!];
        if (!a || !b) continue;
        const ri = slots[i][0],
          rj = slots[j][0];
        if (fitScore(a, rj) + fitScore(b, ri) > fitScore(a, ri) + fitScore(b, rj) + 0.5) {
          lineup[i] = b.id;
          lineup[j] = a.id;
        }
      }
  const rest = pool.filter((p) => !usedIds.has(p.id));
  club.lineup = lineup;
  club.bench = pickBench(rest);
  return club;
};

/** Valida a escalação do usuário: troca lesionados/suspensos e completa o banco. */
export const validateLineup = (W: World, club: Club): Club => {
  if (!club.lineup || club.lineup.length !== 11) return autoLineup(W, club);
  const sq = new Set(
    squad(W, club.id)
      .filter(available)
      .map((p) => p.id),
  );
  let bad = false;
  club.lineup = club.lineup.map((id) => (id && sq.has(id) ? id : ((bad = true), null)));
  club.bench = (club.bench || []).filter((id) => sq.has(id) && !club.lineup!.includes(id));
  if (bad) {
    const slots = FORMATIONS[club.tac.f];
    const used = new Set([...club.lineup.filter(Boolean)]);
    for (let i = 0; i < 11; i++)
      if (!club.lineup[i]) {
        let best: Player | null = null,
          bs = -1;
        for (const id of sq) {
          if (used.has(id)) continue;
          const p = W.pmap[id];
          const s = fitScore(p, slots[i][0]);
          if (s > bs) {
            bs = s;
            best = p;
          }
        }
        if (best) {
          club.lineup[i] = best.id;
          used.add(best.id);
          club.bench = club.bench.filter((x) => x !== best!.id);
        }
      }
  }
  while (club.bench.length < BENCH_SIZE) {
    const cand = [...sq]
      .map((id) => W.pmap[id])
      .filter((p) => !club.lineup!.includes(p.id) && !club.bench!.includes(p.id))
      .sort((a, b) => ovr(b) - ovr(a))[0];
    if (!cand) break;
    club.bench.push(cand.id);
  }
  return club;
};

/** Refaz o banco depois que o usuário mexe nos titulares. */
export const refreshBench = (W: World, club: Club): void => {
  const inXI = new Set(club.lineup);
  club.bench = pickBench(squad(W, club.id).filter((p) => available(p) && !inXI.has(p.id)));
};

/** Lugar de um jogador na escalação do usuário: titular (vaga), banco (posição) ou reservas. */
export type Spot = { z: 'xi'; i: number } | { z: 'bench'; i: number } | { z: 'res'; pid: number };

/** Quem ocupa o lugar (null = vaga vazia). */
export const spotPlayer = (club: Club, s: Spot): number | null =>
  s.z === 'xi' ? (club.lineup?.[s.i] ?? null) : s.z === 'bench' ? (club.bench?.[s.i] ?? null) : s.pid;

/**
 * Troca dois lugares (arrastar ou clicar em dois jogadores). Retorna o motivo quando não pode trocar.
 * O banco é escolhido pelo usuário e fica como está até ele mudar (ou alguém ficar indisponível).
 */
export const swapSpots = (W: World, club: Club, a: Spot, b: Spot): string | null => {
  const pa = spotPlayer(club, a),
    pb = spotPlayer(club, b);
  if (pa === pb) return null;
  if (a.z === 'res' && b.z === 'res') return null;
  // um titular não pode sair deixando a vaga vazia
  if ((a.z === 'xi' && pb == null) || (b.z === 'xi' && pa == null))
    return 'Para tirar um titular, troque-o por outro jogador.';
  const check = (pid: number | null, to: Spot) => {
    if (pid == null || to.z === 'res') return null;
    const p = W.pmap[pid];
    return available(p) ? null : p.n + ' não está disponível.';
  };
  const err = check(pa, b) || check(pb, a);
  if (err) return err;
  const lineup = club.lineup!;
  const bench: (number | null)[] = (club.bench || []).slice();
  const put = (s: Spot, pid: number | null) => {
    if (s.z === 'xi') lineup[s.i] = pid;
    else if (s.z === 'bench') {
      if (s.i >= bench.length) bench.push(pid);
      else bench[s.i] = pid;
    }
  };
  put(a, pb);
  put(b, pa);
  club.bench = bench.filter((x): x is number => x != null).slice(0, BENCH_SIZE);
  return null;
};
