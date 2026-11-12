import { DIV_NAME, DIV_REP_TARGET, DIVS, type Div } from '../constants/divisions';
import { closeFinances } from '../finance/finance';
import { sponsorSeasonEnd } from '../finance/sponsors';
import { marketSeasonEnd } from '../market/market';
import { RULES } from '../rules';
import { clamp } from '../math';
import { news } from '../news';
import { ageEvoRange, seasonPlayBonus } from '../player/evolution';
import { ovr, shiftOvr } from '../player/ratings';
import { calcValue, calcWage } from '../player/value';
import { chance, gauss, ri } from '../rng';
import type { SeasonReport, World } from '../types';
import { clubLevel } from '../world/factory';
import { fillSquad } from '../world/fillSquad';
import { dirty, rebuildPmap, release, squad, youth } from '../world/squad';
import { promote, youthIntake, youthRecommend } from '../youth/youth';
import { buildSeason } from './buildSeason';
import { storeQualifiers } from './conmebol';
import { table } from './table';
import type { LeagueStage } from '../types';

/**
 * Vira a temporada: registra o histórico, sobe/desce clubes, decide a base,
 * envelhece e evolui jogadores, aposenta veteranos, faz a peneira e monta a nova temporada.
 */
export const endSeason = (W: World): SeasonReport => {
  const rep: SeasonReport = { year: W.year, champs: {}, prom: {}, rel: {}, scorers: {} };
  // vagas da Libertadores e da Sul-Americana do ano que vem (antes de mexer nas divisões)
  if (RULES.calendar === 'days') storeQualifiers(W);
  closeFinances(W);
  for (const div of DIVS) {
    const c = W.comps[div];
    rep.champs[div] = c.res.champ;
    rep.prom[div] = c.res.prom.slice();
    rep.rel[div] = c.res.rel.slice();
    const top = W.players
      .filter((p) => p.c >= 0 && W.clubs[p.c].div === div && p.st.g > 0)
      .sort((a, b) => b.st.g - a.st.g)[0];
    if (top) rep.scorers[div] = { n: top.n, c: top.c, g: top.st.g };
  }
  // copas
  for (const id of ['CDB', 'LIB', 'SULA']) if (W.comps[id]) (rep.cups ||= {})[id] = W.comps[id].res.champ;
  // posição final do usuário
  const user = W.user!;
  const me = W.clubs[user];
  const uc = W.comps[me.div];
  let upos: { pos: number; pts: number; grp: number } | null = null;
  const st0 = uc.stages[0] as LeagueStage;
  st0.groups.forEach((_g, gi) => {
    const t = table(W, uc, 0, gi);
    const i = t.findIndex((r) => r.c === user);
    if (i >= 0) upos = { pos: i + 1, pts: t[i].pts, grp: st0.groups.length > 1 ? gi + 1 : 0 };
  });
  rep.user = {
    club: user,
    div: me.div,
    pos: upos,
    champ: uc.res.champ === user,
    prom: uc.res.prom.includes(user),
    rel: uc.res.rel.includes(user),
  };
  W.hist.push(rep);
  // movimentação entre divisões
  const move = (ids: number[] | undefined, div: Div) =>
    (ids || []).forEach((id) => {
      if (id != null) W.clubs[id].div = div;
    });
  move(rep.rel.A, 'B');
  move(rep.prom.B, 'A');
  move(rep.rel.B, 'C');
  move(rep.prom.C, 'B');
  move(rep.rel.C, 'D');
  move(rep.prom.D, 'C');
  W.clubs.forEach((c) => {
    if (c.div !== 'D') c.grp = -1;
  });
  // notícias
  const txt: string[] = [];
  if (rep.user.champ) txt.push('Campeão da ' + DIV_NAME[rep.user.div] + '!');
  if (rep.user.prom) txt.push('Acesso conquistado!');
  if (rep.user.rel) txt.push('Rebaixado.');
  news(
    W,
    'Fim da temporada ' + W.year,
    (txt.join(' ') || 'Temporada encerrada.') + ' Campeão da Série A: ' + W.clubs[rep.champs.A!].n + '.',
    'season',
  );
  // base: decisões de quem completa 21 anos (usuário decide pela tela; IA decide sozinha)
  const dec = W.youthDecisions || {};
  const upU: string[] = [],
    outU: string[] = [];
  for (const c of W.clubs) {
    const lvl = clubLevel(c);
    for (const p of youth(W, c.id)) {
      if (c.id === user) {
        if (p.a >= 20) {
          const d = dec[p.id] || youthRecommend(W, p);
          if (d === 'up') {
            promote(W, p, true);
            upU.push(p.n);
          } else {
            release(W, p);
            outU.push(p.n);
          }
        }
      } else {
        const proN = squad(W, c.id).length,
          planN = c.div === 'D' ? 24 : 27;
        if (p.a >= 20) {
          if (ovr(p) >= lvl - 7 && proN < planN + 10) promote(W, p, true);
          else release(W, p);
        } else if (ovr(p) >= lvl - 2 && proN < planN + 10) promote(W, p, true);
      }
    }
  }
  W.youthDecisions = {};
  if (upU.length || outU.length)
    news(
      W,
      'Base: limite de idade',
      (upU.length ? 'Subiram para o profissional: ' + upU.join(', ') + '. ' : '') +
        (outU.length ? 'Dispensados: ' + outU.join(', ') + '.' : ''),
      'youth',
    );
  // jogadores: envelhecimento, evolução, aposentadoria
  const retired = new Set<number>();
  for (const p of W.players) {
    if (p.c < 0) continue;
    const young = p.a <= 21;
    p.a++;
    if (young) {
      // a evolução dos jovens já acontece durante a temporada; aqui só o potencial oscila
      p.pt = clamp(p.pt + Math.round(gauss() * 1.6), ovr(p), 99);
      p.pk = Math.min(1, (p.pk || 0) + 0.15);
    } else {
      const o = ovr(p);
      const [lo, hi] = ageEvoRange(p.a);
      let d = ri(lo, hi) - (p.a <= 24 && o >= 78 ? 1 : 0);
      if (d > 0) d = Math.min(d, Math.max(0, p.pt - o));
      const playBonus = seasonPlayBonus(p);
      shiftOvr(p, d + playBonus);
      p.pk = 1;
      const retireP =
        p.a >= 40 ? 1 : p.a >= 37 ? 0.55 : p.a >= 35 ? 0.3 : p.a >= 33 && o < clubLevel(W.clubs[p.c]) - 10 ? 0.2 : 0;
      if (p.c !== user || p.a >= 38) {
        if (chance(retireP)) retired.add(p.id);
      } else if (chance(retireP * 0.6)) retired.add(p.id);
    }
    p.st = { j: 0, g: 0, as: 0, nt: 0 };
    p.yc = 0;
    p.sus = 0;
    p.inj = Math.max(0, p.inj - 4);
    p.f = 100;
    p.mo = clamp(p.mo * 0.6 + 28, 30, 90);
  }
  const retNames = W.players.filter((p) => retired.has(p.id) && p.c === user).map((p) => p.n);
  if (retNames.length) news(W, 'Aposentadorias', retNames.join(', ') + ' encerraram a carreira.', 'info');
  W.players = W.players.filter((p) => !retired.has(p.id));
  rebuildPmap(W);
  dirty(W);
  // mercado: empréstimos voltam, contratos vencidos acabam (só com as regras novas)
  marketSeasonEnd(W);
  // IA enxuga elencos muito inchados e a base muito cheia
  for (const c of W.clubs) {
    if (c.id === user) continue;
    const planN = c.div === 'D' ? 24 : 27;
    const pro = squad(W, c.id);
    if (pro.length > planN + 12)
      pro
        .filter((p) => p.a >= 24)
        .sort((a, b) => ovr(a) - ovr(b))
        .slice(0, pro.length - (planN + 10))
        .forEach((p) => release(W, p));
    const yb = youth(W, c.id);
    if (yb.length > 30)
      yb.sort((a, b) => a.pt - b.pt)
        .slice(0, yb.length - 26)
        .forEach((p) => release(W, p));
  }
  // peneira: novos garotos na base; elenco profissional completado (primeiro com garotos da base)
  for (const c of W.clubs) {
    // clubes sul-americanos não têm base: o elenco é completado direto
    const kids = c.div === 'SUL' ? [] : youthIntake(W, c);
    const filled = fillSquad(W, c, { fromBase: true });
    if (c.id === user) {
      news(
        W,
        'Peneira: ' + kids.length + ' garotos chegaram à base',
        kids.map((p) => p.n + ' (' + p.p + ', ' + p.a + ')').join(', ') + '. Veja a página Base.',
        'youth',
      );
      const up = filled.filter((p) => p._promoted),
        gen = filled.filter((p) => !p._promoted);
      if (up.length)
        news(
          W,
          'Elenco completado com a base',
          'Faltavam jogadores em algumas posições. Subiram: ' + up.map((p) => p.n).join(', ') + '.',
          'youth',
        );
      if (gen.length)
        news(
          W,
          'Reforços para completar o elenco',
          'Chegaram para completar posições vazias: ' + gen.map((p) => p.n + ' (' + p.p + ')').join(', ') + '.',
          'info',
        );
    }
    filled.forEach((p) => delete p._promoted);
  }
  for (const p of W.players) {
    p.val = calcValue(p);
    if (p.c < 0) continue;
    // com o mercado ligado, o salário é o do contrato (só quem não tem salário ganha um agora)
    p.sal = p.y ? 0 : RULES.market && p.sal ? p.sal : calcWage(p, W.clubs[p.c].div);
  }
  // reputação acompanha a divisão
  for (const c of W.clubs) {
    if (c.div === 'SUL') continue;
    const target = DIV_REP_TARGET[c.div];
    c.rep = Math.round(c.rep + (target - c.rep) * 0.12);
  }
  W.year++;
  W.fin = {};
  buildSeason(W);
  sponsorSeasonEnd(W);
  return rep;
};
