import { POS } from '../constants/attributes';
import { clamp } from '../math';
import { news } from '../news';
import { ovr, shiftOvr } from '../player/ratings';
import { calcValue, calcWage } from '../player/value';
import { genName } from '../player/names';
import { chance, gauss, ri, wpick } from '../rng';
import type { Club, Player, World, YouthDecision } from '../types';
import { clubLevel, makePlayer } from '../world/factory';
import { dirty, removeFromLineups, youth } from '../world/squad';

/** Qualidade da estrutura de base do clube (multiplica a evolução). */
export const youthFac = (c: Club): number => 0.85 + c.rep / 300;
/** Ritmo anual de evolução por idade. */
export const youthRate = (a: number): number => (a <= 16 ? 0.3 : a <= 18 ? 0.26 : a <= 20 ? 0.2 : 0.14);

const KID_POS_WEIGHT: Record<string, number> = {
  GOL: 1,
  ZAG: 2,
  LD: 1,
  LE: 1,
  VOL: 1.3,
  MC: 1.5,
  MEI: 1.2,
  PD: 1,
  PE: 1,
  ATA: 1.5,
};

export const newKid = (W: World, c: Club, age: number, o: number, pot: number, used: Set<string>): Player =>
  makePlayer(
    W,
    c.id,
    genName(used),
    wpick(POS, (p) => KID_POS_WEIGHT[p]),
    age,
    clamp(Math.round(o), 20, 85),
    false,
    {
      y: 1,
      pt: clamp(Math.round(pot), 25, 96),
      pk: 0,
    },
  );

/** Cria uma base inicial para clubes que não têm garotos no banco de dados. */
export const seedYouth = (W: World, c: Club, n?: number): void => {
  n = n || ri(12, 16);
  const lvl = clubLevel(c),
    used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const age = ri(16, 19);
    const o = lvl - 13 + (age - 16) * 2 + gauss() * 3;
    newKid(W, c, age, o, o + 8 + Math.abs(gauss()) * 8 + (chance(0.04) ? 12 : 0), used).pk = 0.2;
  }
};

/** Peneira anual: novos garotos de 15–16 anos. */
export const youthIntake = (W: World, c: Club): Player[] => {
  const n = ri(3, 5) + (c.rep >= 80 ? 2 : c.rep >= 55 ? 1 : 0);
  const lvl = clubLevel(c),
    used = new Set(youth(W, c.id).map((p) => p.n)),
    out: Player[] = [];
  for (let i = 0; i < n; i++) {
    const age = chance(0.6) ? 15 : 16;
    const o = lvl - 16 + (age - 15) * 2 + gauss() * 3.5;
    const joia = chance(0.04 * youthFac(c));
    const kid = newKid(W, c, age, o, o + 10 + Math.abs(gauss()) * 9 + (joia ? 14 : 0), used);
    kid.val = calcValue(kid);
    kid.sal = 0;
    out.push(kid);
  }
  return out;
};

/** Evolução contínua de quem tem até 21 anos (base e profissional), a cada dia de jogo. */
export const youthTick = (W: World): void => {
  for (const p of W.players) {
    if (p.c < 0 || p.a > 21) continue;
    const gap = p.pt - ovr(p);
    p.pk = Math.min(1, (p.pk || 0) + 0.008);
    if (gap <= 0) continue;
    const c = W.clubs[p.c];
    const play = p.y ? 1 : 1 + Math.min(p.st.j, 20) / 40;
    const top = 1 - Math.max(0, ovr(p) - 74) / 40;
    const yearly = gap * youthRate(p.a) * youthFac(c) * (p.dv || 1) * play * top;
    p.gx = (p.gx || 0) + yearly / 40 + gauss() * 0.03;
    let k = 0;
    while (p.gx >= 1 && k++ < 3) {
      const o = ovr(p);
      shiftOvr(p, 1);
      if (ovr(p) > o || chance(0.5)) p.gx -= 1;
    }
  }
};

/** Sobe um garoto da base para o profissional. */
export const promote = (W: World, p: Player, silent?: boolean): void => {
  p.y = 0;
  p.sal = calcWage(p, W.clubs[p.c].div);
  p.ct = W.year + 3;
  p.mo = Math.max(p.mo, 75);
  dirty(W);
  if (!silent && p.c === W.user)
    news(
      W,
      'Subiu da base: ' + p.n,
      p.n + ' (' + p.p + ', ' + p.a + ' anos) agora treina com o elenco profissional.',
      'youth',
    );
};

/** Manda um jogador jovem do profissional para a base. */
export const demote = (W: World, p: Player): void => {
  p.y = 1;
  p.sal = 0;
  dirty(W);
  removeFromLineups(W, p.id, [p.c]);
};

/** Limite de idade da base: quem completa 21 sobe ou sai. */
export const youthRecommend = (W: World, p: Player): YouthDecision =>
  ovr(p) >= clubLevel(W.clubs[p.c]) - 8 ? 'up' : 'out';

/** Relatório periódico de quem mais evoluiu na base do usuário. */
export const youthReport = (W: World): void => {
  if (W.user == null) return;
  const kids = youth(W, W.user)
    .map((p) => ({ p, d: ovr(p) - (p.sy || ovr(p)) }))
    .filter((x) => x.d >= 2)
    .sort((a, b) => b.d - a.d)
    .slice(0, 4);
  if (kids.length)
    news(
      W,
      'Relatório da base',
      'Quem mais evoluiu na temporada: ' +
        kids.map((x) => x.p.n + ' (+' + x.d + ', agora ' + ovr(x.p) + ')').join(', ') +
        '.',
      'youth',
    );
};
