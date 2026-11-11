export const ATTR = ['fin', 'cab', 'pas', 'cru', 'dri', 'vis', 'des', 'mar', 'vel', 'res', 'for', 'gol'] as const;
export type AttrKey = (typeof ATTR)[number];

export const ATTR_NAME: Record<AttrKey, string> = {
  fin: 'Finalização',
  cab: 'Cabeceio',
  pas: 'Passe',
  cru: 'Cruzamento',
  dri: 'Drible',
  vis: 'Visão',
  des: 'Desarme',
  mar: 'Marcação',
  vel: 'Velocidade',
  res: 'Resistência',
  for: 'Força',
  gol: 'Goleiro',
};

/** Índice de cada atributo no array `player.at`. */
export const A = Object.fromEntries(ATTR.map((k, i) => [k, i])) as Record<AttrKey, number>;

export const POS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'] as const;
export type Pos = (typeof POS)[number];

export const POS_NAME: Record<Pos, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LD: 'Lateral-direito',
  LE: 'Lateral-esquerdo',
  VOL: 'Volante',
  MC: 'Meio-campista',
  MEI: 'Meia-armador',
  PD: 'Ponta-direita',
  PE: 'Ponta-esquerda',
  ATA: 'Centroavante',
};

/** 0 goleiro, 1 defesa, 2 meio, 3 ataque */
export const POS_GROUP: Record<Pos, number> = {
  GOL: 0,
  ZAG: 1,
  LD: 1,
  LE: 1,
  VOL: 2,
  MC: 2,
  MEI: 2,
  PD: 3,
  PE: 3,
  ATA: 3,
};

/** Peso de cada atributo no OVR da posição. Ordem: fin cab pas cru dri vis des mar vel res for gol */
export const POS_W: Record<Pos, number[]> = {
  GOL: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 10],
  ZAG: [0, 3, 1, 0, 0, 0, 4, 4, 1, 1, 3, 0],
  LD: [0, 0, 2, 3, 1, 0, 3, 3, 3, 2, 1, 0],
  LE: [0, 0, 2, 3, 1, 0, 3, 3, 3, 2, 1, 0],
  VOL: [0, 1, 3, 0, 0, 2, 4, 3, 1, 2, 2, 0],
  MC: [1, 0, 4, 0, 2, 3, 2, 1, 1, 2, 1, 0],
  MEI: [2, 0, 4, 1, 3, 4, 0, 0, 1, 1, 0, 0],
  PD: [2, 0, 1, 3, 4, 1, 0, 0, 4, 1, 0, 0],
  PE: [2, 0, 1, 3, 4, 1, 0, 0, 4, 1, 0, 0],
  ATA: [5, 3, 1, 0, 2, 1, 0, 0, 3, 1, 2, 0],
};

export const POS_WSUM = Object.fromEntries(POS.map((p) => [p, POS_W[p].reduce((a, b) => a + b, 0)])) as Record<
  Pos,
  number
>;

/** Familiaridade: jogador da posição p atuando na função r (chave `p + r`). */
export const FAM: Record<string, number> = (() => {
  const near: Record<string, number> = {
    'ZAG-VOL': 0.82,
    'ZAG-LD': 0.8,
    'ZAG-LE': 0.8,
    'LD-LE': 0.85,
    'LD-PD': 0.82,
    'LE-PE': 0.82,
    'VOL-MC': 0.93,
    'MC-MEI': 0.92,
    'MEI-PD': 0.85,
    'MEI-PE': 0.85,
    'PD-PE': 0.9,
    'PD-ATA': 0.84,
    'PE-ATA': 0.84,
    'MEI-ATA': 0.82,
    'VOL-MEI': 0.8,
    'MC-PD': 0.78,
    'MC-PE': 0.78,
    'LD-VOL': 0.75,
    'LE-VOL': 0.75,
    'LD-MC': 0.72,
    'LE-MC': 0.72,
  };
  const f: Record<string, number> = {};
  for (const p of POS)
    for (const r of POS) {
      let v = p === r ? 1 : near[p + '-' + r] || near[r + '-' + p] || 0.62;
      if ((p === 'GOL') !== (r === 'GOL') && p !== r) v = 0.25;
      f[p + r] = v;
    }
  return f;
})();
