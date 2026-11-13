import { useState } from 'react';
import { dateOf, isDays, windowOn, type Competition, type Fixture, type World } from '@/core';
import { useUi } from '@/store/uiStore';
import { compColor } from '../compStyle';
import { Crest } from './Crest';
import { VenueIcon } from './Icons';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const key = (d: Date) => d.getMonth() * 100 + d.getDate();

/**
 * Calendário do mês na tela de Início: jogos do clube pintados na cor da competição (casa ou fora, escudo do
 * adversário e resultado), hoje destacado e os dias de janela de transferências marcados.
 */
export function MiniCalendar({ W }: { W: World }) {
  const go = useUi((s) => s.go);
  const openModal = useUi((s) => s.openModal);
  const today = dateOf(W, isDays(W) ? W.day + 1 : Math.max(1, W.day));
  const [month, setMonth] = useState(today.getMonth());

  const games = new Map<number, { f: Fixture; comp: Competition }>();
  for (const comp of Object.values(W.comps))
    for (const f of comp.fx) if (f.h === W.user || f.a === W.user) games.set(key(dateOf(W, f.d)), { f, comp });

  // grade começando na segunda-feira
  const first = new Date(W.year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(W.year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(W.year, month, d));
  while (cells.length % 7) cells.push(null);

  return (
    <div className="panel hcal">
      <h3>
        <span>Calendário</span>
        <span className="hcal-nav">
          <button
            className="btn ghost sm"
            disabled={month === 0}
            onClick={() => setMonth(month - 1)}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <b>{MONTHS[month]}</b>
          <button
            className="btn ghost sm"
            disabled={month === 11}
            onClick={() => setMonth(month + 1)}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </span>
      </h3>
      <div className="mcal">
        {WEEK.map((w) => (
          <span key={w} className="mcal-w">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="mcal-c off" />;
          const g = games.get(key(d));
          const isToday = key(d) === key(today) && d.getFullYear() === today.getFullYear();
          const past = d < today && !isToday;
          const win = !!windowOn(d);
          if (!g)
            return (
              <span key={i} className={`mcal-c ${isToday ? 'today' : ''} ${past ? 'past' : ''} ${win ? 'win' : ''}`}>
                <i className="dn">{d.getDate()}</i>
              </span>
            );
          const home = g.f.h === W.user;
          const opp = W.clubs[home ? g.f.a : g.f.h];
          const col = compColor(g.comp.id);
          let res = '';
          let rc = '';
          if (g.f.pl) {
            const gf = (home ? g.f.hg : g.f.ag)!,
              ga = (home ? g.f.ag : g.f.hg)!;
            res = `${gf}-${ga}`;
            rc =
              gf > ga
                ? 'V'
                : gf < ga
                  ? 'D'
                  : g.f.hp != null
                    ? (home ? g.f.hp > g.f.ap! : g.f.ap! > g.f.hp)
                      ? 'V'
                      : 'D'
                    : 'E';
          }
          return (
            <button
              key={i}
              className={`mcal-c game ${isToday ? 'today' : ''} ${past ? 'past' : ''} ${win ? 'win' : ''}`}
              style={{ background: col + '2b', borderColor: col + '88' }}
              title={`${g.comp.name}: ${W.clubs[g.f.h].n} x ${W.clubs[g.f.a].n}`}
              onClick={() => (g.f.pl ? openModal({ kind: 'report', comp: g.comp.id, fid: g.f.id }) : go('calendar'))}
            >
              <i className="dn">{d.getDate()}</i>
              <span className="mcal-g">
                <Crest club={opp} size={18} />
                <VenueIcon home={home} neutral={g.f.neu} size={10} />
              </span>
              {res && <span className={`mcal-r r${rc}`}>{res}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
