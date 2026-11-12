import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import {
  buildSeason,
  createWorld,
  CURRENT_RULES,
  expandDb,
  LEGACY_RULES,
  stepDay,
  userFixture,
  recoverFitness,
  rng,
  RULES,
  type RawDb,
} from '../../src/core';

describe('regras novas', () => {
  it('o jogo usa as regras atuais por padrão', () => {
    expect(RULES).toEqual(CURRENT_RULES);
    expect(CURRENT_RULES.youthGrowth).toBeLessThan(LEGACY_RULES.youthGrowth);
  });

  it('a recuperação depende dos dias de descanso', () => {
    const week = recoverFitness(50, 14, 7),
      mid = recoverFitness(50, 14, 3);
    expect(week).toBeGreaterThan(75);
    expect(week).toBeLessThan(90);
    expect(mid).toBeLessThan(week - 10);
    expect(recoverFitness(50, 20, 7)).toBeGreaterThan(recoverFitness(50, 5, 7));
    expect(recoverFitness(99, 20, 30)).toBeLessThanOrEqual(100);
  });

  it('quem joga sempre fica cansado; a IA roda o elenco', () => {
    const W = createWorld(5, expandDb(rawDb as unknown as RawDb));
    W.user = 0;
    W.coach = 'x';
    rng.seed(5);
    buildSeason(W);
    const me = W.clubs[0];
    const xi = me.lineup!.slice() as number[];
    let sum = 0,
      n = 0;
    // condição na véspera de cada jogo (calendário por dias: corre os dias até o próximo jogo)
    for (let d = 0; d < 10; d++) {
      while (!userFixture(W, W.day + 1)) stepDay(W);
      if (d >= 4)
        for (const id of xi)
          if (W.pmap[id].p !== 'GOL') {
            sum += W.pmap[id].f;
            n++;
          }
      me.lineup = xi.map((id) => (W.pmap[id] && W.pmap[id].inj <= 0 && W.pmap[id].sus <= 0 ? id : null));
      stepDay(W);
    }
    expect(sum / n).toBeLessThan(93);
    expect(sum / n).toBeGreaterThan(78);
  }, 30000);

  it('avisa quando um suspenso do usuário volta a ficar disponível', () => {
    const W = createWorld(8, expandDb(rawDb as unknown as RawDb));
    W.user = 0;
    W.coach = 'x';
    rng.seed(8);
    buildSeason(W);
    const p = W.pmap[W.clubs[0].bench![0]];
    p.sus = 1;
    W.clubs[0].bench = W.clubs[0].bench!.slice(1);
    while (!userFixture(W, W.day + 1)) stepDay(W);
    stepDay(W);
    expect(p.sus).toBe(0);
    expect(W.news.some((n) => n.k === 'apt' && n.ref?.pid === p.id)).toBe(true);
  });
});
