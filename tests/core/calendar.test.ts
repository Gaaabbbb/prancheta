import { describe, expect, it } from 'vitest';
import { SEASON_DAYS, seasonDates } from '../../src/core';

describe('calendário das rodadas', () => {
  it('as rodadas caem nos dias da semana de cada divisão e andam sempre para frente', () => {
    // quinta só aparece quando a rodada anterior foi numa segunda (mínimo de 3 dias)
    const allowed = { A: [0, 1, 3, 4, 6], B: [0, 1, 2, 3, 4, 5, 6], C: [0, 1, 3, 4, 6], D: [0, 1, 3, 4, 6] };
    for (const year of [2026, 2027, 2030])
      for (const div of ['A', 'B', 'C', 'D'] as const) {
        const ds = seasonDates(year, div);
        expect(ds.length).toBe(SEASON_DAYS);
        expect(ds[0].getMonth()).toBe(0);
        expect(ds[SEASON_DAYS - 1].getMonth()).toBe(10);
        for (let i = 1; i < ds.length; i++)
          expect(ds[i].getTime() - ds[i - 1].getTime()).toBeGreaterThanOrEqual(3 * 864e5 - 3600e3);
        for (const d of ds) expect(allowed[div]).toContain(d.getDay());
      }
  });

  it('há semanas com duas rodadas (meio de semana) e pausas', () => {
    const ds = seasonDates(2027, 'A');
    const gaps = ds.slice(1).map((d, i) => Math.round((d.getTime() - ds[i].getTime()) / 864e5));
    expect(gaps.filter((g) => g <= 4).length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(28);
  });
});
