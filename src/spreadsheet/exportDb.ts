import { ovr, POS, type World } from '@/core';
import { loadXlsx } from './xlsx';

/** Gera a planilha do banco de dados atual (.xlsx) para editar no Excel. */
export const exportDb = async (W: World): Promise<{ data: ArrayBuffer; filename: string }> => {
  const X = await loadXlsx();
  const DIVORD = { A: 0, B: 1, C: 2, D: 3 };
  const clubs = W.clubs
    .slice()
    .sort((a, b) => DIVORD[a.div] - DIVORD[b.div] || (a.div === 'D' ? a.grp - b.grp : 0) || b.rep - a.rep);
  const corder: Record<number, number> = {};
  clubs.forEach((c, i) => (corder[c.id] = i));
  const players = W.players
    .filter((p) => p.c >= 0 && !p.y)
    .sort((a, b) => corder[a.c] - corder[b.c] || POS.indexOf(a.p) - POS.indexOf(b.p) || ovr(b) - ovr(a));
  const cnt: Record<number, number> = {},
    sum: Record<number, number> = {};
  players.forEach((p) => {
    cnt[p.c] = (cnt[p.c] || 0) + 1;
    sum[p.c] = (sum[p.c] || 0) + ovr(p);
  });
  const avg = (id: number) => (cnt[id] ? Math.round((sum[id] / cnt[id]) * 10) / 10 : '');

  const wsC = X.utils.aoa_to_sheet([
    [
      'Clube',
      'Sigla',
      'Divisão',
      'UF',
      'Estádio',
      'Capacidade',
      'Reputação',
      'Cor 1',
      'Cor 2',
      'Grupo Série D',
      'Jogadores',
      'Nota média',
    ],
    ...clubs.map((c) => [
      c.n,
      c.s,
      c.div,
      c.uf,
      c.std,
      c.cap,
      c.rep,
      c.c1,
      c.c2,
      c.div === 'D' && c.grp >= 0 ? c.grp + 1 : '',
      cnt[c.id] || 0,
      avg(c.id),
    ]),
  ]);
  clubs.forEach((c, i) => {
    const r = i + 2;
    wsC['K' + r] = { t: 'n', v: cnt[c.id] || 0, f: `COUNTIF(Jogadores!$A:$A,A${r})` };
    wsC['L' + r] = {
      t: 'n',
      v: avg(c.id) || 0,
      f: `IFERROR(ROUND(AVERAGEIF(Jogadores!$A:$A,A${r},Jogadores!$F:$F),1),"")`,
    };
  });
  wsC['!cols'] = [24, 8, 9, 6, 26, 12, 11, 10, 10, 13, 11, 11].map((w) => ({ wch: w }));

  const divFormula = (r: number) => `IFERROR(INDEX(Clubes!$C:$C,MATCH(A${r},Clubes!$A:$A,0)),"?")`;
  const wsJ = X.utils.aoa_to_sheet([
    ['Clube', 'Divisão', 'Nome', 'Posição', 'Idade', 'Nota', 'Origem', 'Nacionalidade'],
    ...players.map((p) => [
      W.clubs[p.c].n,
      W.clubs[p.c].div,
      p.n,
      p.p,
      p.a,
      ovr(p),
      p.real ? 'Real' : 'Gerado',
      p.nat || 'Brasil',
    ]),
  ]);
  players.forEach((p, i) => (wsJ['B' + (i + 2)] = { t: 's', v: W.clubs[p.c].div, f: divFormula(i + 2) }));
  wsJ['!cols'] = [24, 9, 26, 9, 8, 8, 10, 14].map((w) => ({ wch: w }));

  const kids = W.players
    .filter((p) => p.c >= 0 && p.y)
    .sort((a, b) => corder[a.c] - corder[b.c] || POS.indexOf(a.p) - POS.indexOf(b.p) || b.pt - a.pt);
  const wsB = X.utils.aoa_to_sheet([
    ['Clube', 'Divisão', 'Nome', 'Posição', 'Idade', 'Nota', 'Potencial', 'Origem', 'Nacionalidade'],
    ...kids.map((p) => [
      W.clubs[p.c].n,
      W.clubs[p.c].div,
      p.n,
      p.p,
      p.a,
      ovr(p),
      p.pt,
      p.real ? 'Real' : 'Gerado',
      p.nat || 'Brasil',
    ]),
  ]);
  kids.forEach((p, i) => (wsB['B' + (i + 2)] = { t: 's', v: W.clubs[p.c].div, f: divFormula(i + 2) }));
  wsB['!cols'] = [24, 9, 26, 9, 8, 8, 10, 10, 14].map((w) => ({ wch: w }));

  const wsL = X.utils.aoa_to_sheet([
    ['Prancheta: banco de dados de clubes e jogadores'],
    [
      'Exportado do jogo em ' +
        new Date().toLocaleDateString('pt-BR') +
        ' (temporada ' +
        W.year +
        ', ' +
        W.clubs[W.user!].n +
        ').',
    ],
    [''],
    ['Edite as abas Clubes e Jogadores e importe no jogo em Editor > Planilha do banco de dados.'],
    [
      'A Divisão das abas Jogadores e Base vem da aba Clubes. Origem: Real ou Gerado. Na Base, o Potencial é o teto real do garoto (no jogo ele aparece como faixa).',
    ],
    ['Posições: GOL, ZAG, LD, LE, VOL, MC, MEI, PD, PE, ATA. Nota de 1 a 99.'],
  ]);
  wsL['!cols'] = [{ wch: 110 }];

  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, wsL, 'Leia-me');
  X.utils.book_append_sheet(wb, wsC, 'Clubes');
  X.utils.book_append_sheet(wb, wsJ, 'Jogadores');
  X.utils.book_append_sheet(wb, wsB, 'Base');
  const data = X.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return { data, filename: 'Prancheta - Banco de dados ' + W.year + '.xlsx' };
};
