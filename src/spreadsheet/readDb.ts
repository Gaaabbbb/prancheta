import { clamp, COUNTRIES, normName, POS, type Database, type DbClub, type DbPlayer } from '@/core';
import { loadXlsx } from './xlsx';

export const normHex = (v: unknown, def: string): string => {
  const s = String(v || '').trim();
  if (/^#?[0-9a-f]{6}$/i.test(s)) return ('#' + s.replace('#', '')).toUpperCase();
  return def;
};

const isPos = (p: string) => (POS as readonly string[]).includes(p);

export type SheetDb = Database & { errs: string[] };

/**
 * Lê a planilha do banco de dados (.xlsx).
 * Abas: "Clubes" e "Jogadores" (obrigatórias) e "Base" (opcional).
 * As colunas são achadas pelo nome do cabeçalho, sem acento e sem diferenciar maiúsculas.
 */
export const readDb = async (file: File): Promise<SheetDb> => {
  const X = await loadXlsx();
  const wb = X.read(await file.arrayBuffer(), { type: 'array' });
  const find = (name: string) => wb.SheetNames.find((n) => normName(n) === name);
  const sc = find('clubes'),
    sj = find('jogadores'),
    sb = find('base');
  if (!sc || !sj) throw new Error('A planilha precisa ter as abas “Clubes” e “Jogadores”.');
  const tableOf = (sh: string) => {
    const rows = X.utils.sheet_to_json<unknown[]>(wb.Sheets[sh], { header: 1, defval: '' });
    const hi = rows.findIndex((r) => r.some((x) => normName(x) === 'clube'));
    if (hi < 0) throw new Error('Não achei a linha de cabeçalho (com “Clube”) na aba ' + sh + '.');
    const head = rows[hi].map(normName);
    const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));
    return { rows: rows.slice(hi + 1), col, line0: hi + 2 };
  };
  const str = (v: unknown) => String(v || '').trim();
  const errs: string[] = [];

  // clubes
  const C = tableOf(sc);
  const ci = {
    n: C.col('clube'),
    s: C.col('sigla'),
    div: C.col('divisao'),
    uf: C.col('uf'),
    pais: C.col('pais'),
    std: C.col('estadio'),
    cap: C.col('capacidade'),
    rep: C.col('reputacao'),
    c1: C.col('cor 1', 'cor1'),
    c2: C.col('cor 2', 'cor2'),
    grp: C.col('grupo'),
  };
  if (ci.div < 0) throw new Error('A aba Clubes precisa da coluna “Divisão”.');
  const clubs: DbClub[] = [];
  // país dos clubes sul-americanos (Divisão = SUL): aceita o nome ("Argentina") ou a sigla ("ARG")
  const countryOf = (v: unknown): string => {
    const t = normName(str(v));
    const hit = Object.entries(COUNTRIES).find(([k, name]) => normName(k) === t || normName(name) === t);
    return hit ? hit[0] : '';
  };
  C.rows.forEach((r, i) => {
    const n = str(r[ci.n]);
    if (!n) return;
    const div = str(r[ci.div]).toUpperCase();
    if (div === 'SUL' && !countryOf(ci.pais >= 0 ? r[ci.pais] : '')) {
      errs.push(`Linha ${C.line0 + i}: ${n} é SUL mas o país não foi reconhecido.`);
      return;
    }
    const g = ci.grp >= 0 ? parseInt(String(r[ci.grp]), 10) : NaN;
    clubs.push({
      n,
      s: ci.s >= 0 ? str(r[ci.s]).toUpperCase().slice(0, 3) || null : null,
      div,
      uf: div === 'SUL' ? countryOf(r[ci.pais]) : ci.uf >= 0 ? str(r[ci.uf]).toUpperCase() : '',
      std: ci.std >= 0 ? str(r[ci.std]) : '',
      cap: ci.cap >= 0 ? +(r[ci.cap] as number) || 0 : 0,
      rep: ci.rep >= 0 ? +(r[ci.rep] as number) || 0 : 0,
      c1: normHex(ci.c1 >= 0 ? r[ci.c1] : '', '#888888'),
      c2: normHex(ci.c2 >= 0 ? r[ci.c2] : '', '#FFFFFF'),
      grp: g >= 1 && g <= 16 ? g - 1 : -1,
      line: C.line0 + i,
    });
  });

  // jogadores
  const J = tableOf(sj);
  const ji = {
    club: J.col('clube'),
    n: J.col('nome'),
    p: J.col('posicao'),
    a: J.col('idade'),
    o: J.col('nota', 'ovr'),
    real: J.col('origem'),
    nat: J.col('nacionalidade'),
  };
  if (ji.n < 0 || ji.p < 0 || ji.o < 0)
    throw new Error('A aba Jogadores precisa das colunas Clube, Nome, Posição, Idade e Nota.');
  const players: DbPlayer[] = [];
  J.rows.forEach((r, i) => {
    const n = str(r[ji.n]);
    if (!n) return;
    const p = str(r[ji.p]).toUpperCase();
    const club = str(r[ji.club]);
    if (!isPos(p)) return void errs.push('Jogadores, linha ' + (J.line0 + i) + ': posição “' + p + '” inválida');
    if (!club) return void errs.push('Jogadores, linha ' + (J.line0 + i) + ': sem clube');
    players.push({
      club,
      n,
      p,
      a: clamp(parseInt(String(r[ji.a]), 10) || 25, 15, 50),
      o: clamp(parseInt(String(r[ji.o]), 10) || 50, 1, 99),
      real: ji.real >= 0 ? normName(r[ji.real]) === 'real' : true,
      nat: ji.nat >= 0 ? str(r[ji.nat]) || 'Brasil' : 'Brasil',
      line: J.line0 + i,
    });
  });

  // base (opcional)
  const youth: DbPlayer[] = [];
  if (sb) {
    const B = tableOf(sb);
    const bi = {
      club: B.col('clube'),
      n: B.col('nome'),
      p: B.col('posicao'),
      a: B.col('idade'),
      o: B.col('nota', 'ovr'),
      pt: B.col('potencial'),
      real: B.col('origem'),
      nat: B.col('nacionalidade'),
    };
    B.rows.forEach((r, i) => {
      const n = str(r[bi.n]);
      if (!n) return;
      const p = str(r[bi.p]).toUpperCase(),
        club = str(r[bi.club]);
      if (!isPos(p) || !club) return void errs.push('Base, linha ' + (B.line0 + i) + ': posição ou clube inválido');
      const o = clamp(parseInt(String(r[bi.o]), 10) || 40, 1, 99);
      youth.push({
        club,
        n,
        p,
        a: clamp(parseInt(String(r[bi.a]), 10) || 17, 14, 21),
        o,
        pt: bi.pt >= 0 ? clamp(parseInt(String(r[bi.pt]), 10) || o + 10, o, 99) : o + 10,
        real: bi.real >= 0 ? normName(r[bi.real]) === 'real' : true,
        nat: bi.nat >= 0 ? str(r[bi.nat]) || 'Brasil' : 'Brasil',
      });
    });
  }

  // jogadores com clube que não existe na aba Clubes
  const known = new Set(clubs.map((c) => normName(c.n))),
    knownS = new Set(clubs.filter((c) => c.s).map((c) => c.s));
  const orphan = [...players, ...youth].filter(
    (p) => !known.has(normName(p.club)) && !knownS.has(p.club.toUpperCase()),
  );
  if (orphan.length) {
    const names = [...new Set(orphan.map((p) => p.club))];
    errs.push(
      orphan.length +
        ' jogador(es) com clube que não está na aba Clubes: ' +
        names.slice(0, 6).join(', ') +
        (names.length > 6 ? '…' : ''),
    );
  }
  return { clubs, players, youth, errs };
};
