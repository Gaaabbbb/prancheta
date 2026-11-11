import type { Database } from '../types';

/** Formato compacto do arquivo src/data/default-db.json */
export interface RawDb {
  src: string;
  nat: string[];
  /** [nome, sigla, divisão, cor1, cor2, reputação, capacidade, UF, estádio, grupo] */
  clubs: [string, string, string, string, string, number, number, string, string, number][];
  /** por clube: [nome, posição, idade, OVR, índice da nacionalidade] */
  pro: [string, string, number, number, number][][];
  /** por clube: [nome, posição, idade, OVR, potencial, gerado?, índice da nacionalidade] */
  base: [string, string, number, number, number, number, number][][];
}

/** Converte o JSON compacto no formato de banco usado pelo jogo. */
export const expandDb = (D: RawDb): Database => {
  const clubs = D.clubs.map((r) => ({
    n: r[0],
    s: r[1],
    div: r[2],
    c1: r[3],
    c2: r[4],
    rep: r[5],
    cap: r[6],
    uf: r[7],
    std: r[8],
    grp: r[9],
  }));
  const players: Database['players'] = [],
    youth: Database['youth'] = [];
  D.pro.forEach((list, i) =>
    list.forEach((p) =>
      players.push({ club: clubs[i].n, n: p[0], p: p[1], a: p[2], o: p[3], nat: D.nat[p[4]], real: true }),
    ),
  );
  D.base.forEach((list, i) =>
    list.forEach((p) =>
      youth.push({ club: clubs[i].n, n: p[0], p: p[1], a: p[2], o: p[3], pt: p[4], real: !p[5], nat: D.nat[p[6]] }),
    ),
  );
  return { clubs, players, youth };
};

let cached: Database | null = null;

/** Carrega (sob demanda) o banco padrão com clubes e jogadores reais de 2026. */
export const loadDefaultDb = async (): Promise<Database> => {
  if (!cached) {
    const mod = await import('../../data/default-db.json');
    cached = expandDb(mod.default as unknown as RawDb);
  }
  return cached;
};

/** Fonte dos dados do banco padrão (para exibir na interface). */
export const DEFAULT_DB_SOURCE = 'Transfermarkt, coletado em 10/11/2026';
