import { FAM, POS, type Pos } from '../constants/attributes';
import { SQUAD_PLAN, SQUAD_PLAN_D } from '../constants/divisions';
import { clamp } from '../math';
import { genName } from '../player/names';
import { ovr, ovrRole } from '../player/ratings';
import { calcValue, calcWage } from '../player/value';
import { gauss } from '../rng';
import type { Club, Player, World } from '../types';
import { promote } from '../youth/youth';
import { clubLevel, genAge, makePlayer } from './factory';
import { squad, youth } from './squad';

/**
 * Completa o elenco até o plano por posição.
 * Com `fromBase`, primeiro sobe o melhor garoto da base para a vaga.
 */
export const fillSquad = (W: World, c: Club, opts?: { fromBase?: boolean }): Player[] => {
  opts = opts || {};
  const plan = c.div === 'D' ? SQUAD_PLAN_D : SQUAD_PLAN;
  const have = {} as Record<Pos, number>;
  POS.forEach((p) => (have[p] = 0));
  const sq = squad(W, c.id);
  sq.forEach((p) => have[p.p]++);
  const used = new Set(sq.map((p) => p.n));
  const lvl = clubLevel(c);
  const added: Player[] = [];
  for (const pos of POS) {
    while (have[pos] < plan[pos]) {
      let pl: Player | null = null;
      if (opts.fromBase) {
        const kid = youth(W, c.id)
          .filter((p) => p.a >= 17 && ovrRole(p, pos) >= ovr(p) - 6)
          .sort((a, b) => ovrRole(b, pos) - ovrRole(a, pos))[0];
        if (kid) {
          promote(W, kid, true);
          if (kid.p !== pos && FAM[kid.p + pos] < 0.8) kid.p = pos;
          pl = kid;
          pl._promoted = true;
        }
      }
      if (!pl) {
        const age = genAge();
        const o = Math.round(
          lvl + gauss() * 3.2 - 1.5 - (age <= 20 ? 4 : 0) - (have[pos] >= plan[pos] - 1 && plan[pos] > 2 ? 2 : 0),
        );
        pl = makePlayer(W, c.id, genName(used), pos, age, clamp(o, 30, 90), false);
        pl.val = calcValue(pl);
        pl.sal = calcWage(pl, c.div);
      }
      have[pos]++;
      added.push(pl);
    }
  }
  return added;
};
