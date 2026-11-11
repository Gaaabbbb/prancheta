import type { Pos } from './attributes';

/** Cada vaga: [função, x (0 = gol próprio, 1 = gol adversário), y (0..1, largura)] */
export type Slot = [Pos, number, number];

export const FORMATIONS: Record<string, Slot[]> = {
  '4-4-2': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.3, 0.86],
    ['ZAG', 0.23, 0.62],
    ['ZAG', 0.23, 0.38],
    ['LE', 0.3, 0.14],
    ['PD', 0.55, 0.86],
    ['MC', 0.47, 0.6],
    ['MC', 0.47, 0.4],
    ['PE', 0.55, 0.14],
    ['ATA', 0.76, 0.6],
    ['ATA', 0.76, 0.4],
  ],
  '4-3-3': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.31, 0.86],
    ['ZAG', 0.23, 0.62],
    ['ZAG', 0.23, 0.38],
    ['LE', 0.31, 0.14],
    ['VOL', 0.4, 0.5],
    ['MC', 0.52, 0.68],
    ['MC', 0.52, 0.32],
    ['PD', 0.74, 0.86],
    ['ATA', 0.8, 0.5],
    ['PE', 0.74, 0.14],
  ],
  '4-2-3-1': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.31, 0.86],
    ['ZAG', 0.23, 0.62],
    ['ZAG', 0.23, 0.38],
    ['LE', 0.31, 0.14],
    ['VOL', 0.42, 0.62],
    ['VOL', 0.42, 0.38],
    ['PD', 0.64, 0.84],
    ['MEI', 0.62, 0.5],
    ['PE', 0.64, 0.16],
    ['ATA', 0.8, 0.5],
  ],
  '4-1-4-1': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.3, 0.86],
    ['ZAG', 0.23, 0.62],
    ['ZAG', 0.23, 0.38],
    ['LE', 0.3, 0.14],
    ['VOL', 0.38, 0.5],
    ['PD', 0.58, 0.86],
    ['MC', 0.52, 0.62],
    ['MC', 0.52, 0.38],
    ['PE', 0.58, 0.14],
    ['ATA', 0.78, 0.5],
  ],
  '4-4-2 losango': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.31, 0.86],
    ['ZAG', 0.23, 0.62],
    ['ZAG', 0.23, 0.38],
    ['LE', 0.31, 0.14],
    ['VOL', 0.4, 0.5],
    ['MC', 0.51, 0.7],
    ['MC', 0.51, 0.3],
    ['MEI', 0.62, 0.5],
    ['ATA', 0.78, 0.6],
    ['ATA', 0.78, 0.4],
  ],
  '3-5-2': [
    ['GOL', 0.04, 0.5],
    ['ZAG', 0.22, 0.72],
    ['ZAG', 0.2, 0.5],
    ['ZAG', 0.22, 0.28],
    ['LD', 0.47, 0.9],
    ['VOL', 0.4, 0.5],
    ['MC', 0.52, 0.66],
    ['MC', 0.52, 0.34],
    ['LE', 0.47, 0.1],
    ['ATA', 0.77, 0.6],
    ['ATA', 0.77, 0.4],
  ],
  '3-4-3': [
    ['GOL', 0.04, 0.5],
    ['ZAG', 0.22, 0.72],
    ['ZAG', 0.2, 0.5],
    ['ZAG', 0.22, 0.28],
    ['LD', 0.47, 0.88],
    ['MC', 0.46, 0.6],
    ['MC', 0.46, 0.4],
    ['LE', 0.47, 0.12],
    ['PD', 0.74, 0.82],
    ['ATA', 0.8, 0.5],
    ['PE', 0.74, 0.18],
  ],
  '5-3-2': [
    ['GOL', 0.04, 0.5],
    ['LD', 0.3, 0.9],
    ['ZAG', 0.21, 0.7],
    ['ZAG', 0.19, 0.5],
    ['ZAG', 0.21, 0.3],
    ['LE', 0.3, 0.1],
    ['VOL', 0.4, 0.5],
    ['MC', 0.5, 0.68],
    ['MC', 0.5, 0.32],
    ['ATA', 0.74, 0.6],
    ['ATA', 0.74, 0.4],
  ],
};
export const FORM_KEYS = Object.keys(FORMATIONS);

/** Probabilidade relativa de cada formação ser a preferida de um clube da IA. */
export const FORMATION_WEIGHTS: Record<string, number> = {
  '4-4-2': 3,
  '4-3-3': 3,
  '4-2-3-1': 4,
  '4-1-4-1': 1.5,
  '4-4-2 losango': 1,
  '3-5-2': 1.2,
  '3-4-3': 0.6,
  '5-3-2': 0.8,
};

export const MENT = ['Muito defensiva', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Muito ofensiva'];
export const MENT_SHORT = ['Muito def.', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Muito of.'];
export const PRESS = ['Baixa', 'Média', 'Alta'];
export const TEMPO = ['Cadenciado', 'Normal', 'Rápido'];
export const LINE = ['Recuada', 'Normal', 'Adiantada'];
