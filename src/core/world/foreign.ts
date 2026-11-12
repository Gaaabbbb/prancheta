import { POS, type Pos } from '../constants/attributes';
import { COUNTRIES, DIV_NAME } from '../constants/divisions';
import { FORM_KEYS, FORMATION_WEIGHTS } from '../constants/formations';
import { clamp, normName } from '../math';
import { calcValue, calcWage } from '../player/value';
import { wpick } from '../rng';
import type { Club, Database, World } from '../types';
import { defaultTac, foreignBalances } from './createWorld';
import { makePlayer } from './factory';
import { fillSquad } from './fillSquad';
import { dirty } from './squad';

/** O clube é sul-americano (de fora do Brasil)? */
export const isForeign = (c: Club): boolean => c.div === 'SUL';

/** País do clube (sigla FIFA). */
export const countryOf = (c: Club): string => c.country || 'BRA';

/** Onde o clube joga: "Série B" ou, para os sul-americanos, o país ("Argentina"). */
export const leagueName = (c: Club): string => (c.div === 'SUL' ? COUNTRIES[countryOf(c)] : DIV_NAME[c.div]);

/**
 * Acrescenta os clubes sul-americanos (e seus jogadores) a um mundo que ainda não os tem — saves de antes da v0.4.
 * Os ids novos vêm depois dos clubes que já existem. Não faz nada se o mundo já tiver clubes SUL.
 */
export const addForeignClubs = (W: World, db: Database): number => {
  if (W.clubs.some(isForeign)) return 0;
  const added: Club[] = [];
  const usedSig = new Set(W.clubs.map((c) => c.s));
  const usedName = new Set(W.clubs.map((c) => normName(c.n)));
  const byName: Record<string, Club> = {};
  for (const d of db.clubs) {
    if (d.div !== 'SUL') continue;
    let n = d.n;
    if (usedName.has(normName(n))) n = `${n} (${d.uf})`;
    let s = (d.s || n.slice(0, 3)).toUpperCase();
    if (usedSig.has(s)) s = s.slice(0, 2) + (d.uf || 'X')[0];
    usedSig.add(s);
    usedName.add(normName(n));
    const c = {
      id: W.clubs.length,
      n,
      s,
      div: 'SUL',
      c1: d.c1 || '#888888',
      c2: d.c2 || '#FFFFFF',
      rep: clamp(+(d.rep ?? 0) || 60, 1, 99),
      cap: +(d.cap ?? 0) || 15000,
      uf: d.uf || '',
      std: d.std || 'Estádio ' + n,
      grp: -1,
      country: d.uf,
      tac: defaultTac(),
      bal: 0,
      lineup: null,
      bench: null,
    } as Club;
    c.tac.f = wpick(FORM_KEYS, (k) => FORMATION_WEIGHTS[k]);
    W.clubs.push(c);
    added.push(c);
    byName[normName(d.n)] = c;
  }
  const isPos = (p: string): p is Pos => (POS as readonly string[]).includes(p);
  for (const d of db.players) {
    const c = byName[normName(d.club)];
    if (!c || !isPos(d.p)) continue;
    const p = makePlayer(W, c.id, d.n, d.p, clamp(+d.a || 25, 15, 50), clamp(+d.o || 50, 25, 99), !!d.real, {
      nat: d.nat,
    });
    p.val = calcValue(p);
    p.sal = calcWage(p, 'SUL');
  }
  for (const c of added)
    for (const p of fillSquad(W, c)) {
      p.val = calcValue(p);
      p.sal = calcWage(p, 'SUL');
    }
  foreignBalances(W, added);
  dirty(W);
  return added.length;
};
