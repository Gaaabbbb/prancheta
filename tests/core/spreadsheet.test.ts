import { describe, expect, it } from 'vitest';
import rawDb from '../../src/data/default-db.json';
import { buildSeason, createWorld, expandDb, ovr, rng, validateDb, type RawDb } from '../../src/core';
import { applyDb } from '../../src/spreadsheet/applyDb';
import { exportCsv, importCsv } from '../../src/spreadsheet/csv';
import { exportDb } from '../../src/spreadsheet/exportDb';
import { readDb } from '../../src/spreadsheet/readDb';

const career = () => {
  const W = createWorld(5, expandDb(rawDb as unknown as RawDb));
  W.user = 0;
  rng.seed(6);
  buildSeason(W);
  return W;
};

describe('planilha .xlsx', () => {
  it('exporta e lê de volta sem erros', async () => {
    const W = career();
    const { data, filename } = await exportDb(W);
    expect(filename).toContain('2026');
    const db = await readDb(new File([data], filename));
    expect(db.errs).toEqual([]);
    expect(db.clubs).toHaveLength(156);
    expect(validateDb(db).errs).toEqual([]);
    expect(db.players.length).toBe(W.players.filter((p) => !p.y).length);
    expect(db.youth.length).toBe(W.players.filter((p) => p.y).length);
  });

  it('reimportar a própria planilha não cria nem remove jogadores', async () => {
    const W = career();
    const before = W.players.length;
    const { data, filename } = await exportDb(W);
    const db = await readDb(new File([data], filename));
    const rep = applyDb(W, db);
    expect(rep.unknown).toEqual([]);
    expect(rep.add).toBe(0);
    expect(rep.del).toBe(0);
    expect(rep.fill).toBe(0);
    expect(W.players.length).toBe(before);
  });

  it('aplica uma mudança de nota da planilha', async () => {
    const W = career();
    const { data, filename } = await exportDb(W);
    const db = await readDb(new File([data], filename));
    const target = db.players.find((p) => p.club === 'Flamengo')!;
    const before = target.o;
    target.o = 60;
    applyDb(W, db);
    const pl = W.players.find((p) => p.n === target.n && p.c === 0)!;
    // o ajuste mexe nos atributos em até 4 passos (mesmo algoritmo do original): chega perto do alvo
    expect(ovr(pl)).toBeLessThan(before - 10);
    expect(Math.abs(ovr(pl) - 60)).toBeLessThanOrEqual(4);
  });
});

describe('CSV do editor', () => {
  it('copia e importa um elenco', () => {
    const W = career();
    const csv = exportCsv(W, W.clubs[1]);
    const lines = csv.split('\n').length;
    const res = importCsv(W, csv.replaceAll(W.clubs[1].n + ';', W.clubs[2].n + ';'), true);
    expect(res.errs).toEqual([]);
    expect(res.ok).toBe(lines);
  });
});
