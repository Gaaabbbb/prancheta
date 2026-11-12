/**
 * Converte a planilha "Banco de dados Sul-Americano" (abas Clubes e Jogadores) em src/data/sula-db.json,
 * no mesmo formato compacto do banco brasileiro (RawDb). Uso:
 *   node scripts/sulaDb.mjs "caminho/da/planilha.xlsx"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const COUNTRY = {
  Argentina: 'ARG',
  Bolívia: 'BOL',
  Chile: 'CHI',
  Colômbia: 'COL',
  Equador: 'ECU',
  Paraguai: 'PAR',
  Peru: 'PER',
  Uruguai: 'URU',
  Venezuela: 'VEN',
};
const POS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'];

const file = process.argv[2];
if (!file) throw new Error('Informe o caminho da planilha.');
const wb = XLSX.read(readFileSync(file));
const clubsIn = XLSX.utils.sheet_to_json(wb.Sheets['Clubes']);
const playersIn = XLSX.utils.sheet_to_json(wb.Sheets['Jogadores']);

// nomes e siglas do banco brasileiro, para não haver dois clubes com o mesmo nome ou sigla
const br = JSON.parse(readFileSync(new URL('../src/data/default-db.json', import.meta.url)));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const usedNames = new Set(br.clubs.map((c) => norm(c[0])));
const usedSig = new Set(br.clubs.map((c) => c[1]));

const nat = [];
const natIdx = (n) => {
  const k =
    String(n || '')
      .split('/')[0]
      .trim() || 'Desconhecida';
  let i = nat.indexOf(k);
  if (i < 0) i = nat.push(k) - 1;
  return i;
};

const clubs = [];
const pro = [];
const renamed = {};
for (const c of clubsIn) {
  const country = COUNTRY[c['País']];
  if (!country) throw new Error('País desconhecido: ' + c['País']);
  let name = String(c['Clube']).trim();
  if (usedNames.has(norm(name))) {
    renamed[name] = `${name} (${c['País']})`;
    name = renamed[name];
  }
  usedNames.add(norm(name));
  let sig = String(c['Sigla'] || name.slice(0, 3)).toUpperCase();
  if (usedSig.has(sig)) {
    const alt = [sig.slice(0, 2) + country[0], sig[0] + sig[2] + country[0], sig.slice(0, 2) + country[1]];
    sig = alt.find((s) => !usedSig.has(s)) || sig + country[0];
  }
  usedSig.add(sig);
  clubs.push([
    name,
    sig,
    'SUL',
    c['Cor 1'] || '#888888',
    c['Cor 2'] || '#FFFFFF',
    +c['Reputação'] || 60,
    +c['Capacidade'] || 15000,
    country,
    c['Estádio'] || 'Estádio ' + name,
    -1,
  ]);
  pro.push([]);
}
const idx = new Map(clubsIn.map((c, i) => [String(c['Clube']).trim(), i]));
let skipped = 0;
for (const p of playersIn) {
  const i = idx.get(String(p['Clube']).trim());
  if (i == null || !POS.includes(p['Posição'])) {
    skipped++;
    continue;
  }
  pro[i].push([
    String(p['Nome']).trim(),
    p['Posição'],
    +p['Idade'] || 25,
    +p['Nota'] || 60,
    natIdx(p['Nacionalidade']),
  ]);
}
const out = {
  src: 'Transfermarkt, coletado em 12/11/2026',
  nat,
  clubs,
  pro,
  base: clubs.map(() => []),
};
writeFileSync(new URL('../src/data/sula-db.json', import.meta.url), JSON.stringify(out));
console.log(`${clubs.length} clubes, ${pro.flat().length} jogadores (${skipped} ignorados).`);
if (Object.keys(renamed).length) console.log('Renomeados:', renamed);
