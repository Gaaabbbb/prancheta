import { promD, table, type Competition, type Div, type KOStage, type LeagueStage, type Tie, type World } from '@/core';
import { zoneOf } from '../zones';
import { useUi } from '@/store/uiStore';
import { Crest } from './Crest';
import { FormStrip } from './Badges';

const LEGEND: Record<Div, [string, string][]> = {
  A: [
    ['z-lib', 'Libertadores'],
    ['z-sul', 'Sul-Americana'],
    ['z-dn', 'Rebaixamento'],
  ],
  B: [
    ['z-up', 'Acesso direto'],
    ['z-po', 'Playoff de acesso'],
    ['z-dn', 'Rebaixamento'],
  ],
  C: [
    ['z-po', 'Classifica'],
    ['z-up', 'Acesso'],
    ['z-dn', 'Rebaixamento'],
  ],
  D: [['z-po', 'Classifica para o mata-mata']],
  SUL: [],
};

const rulesText = (div: Div, year: number): string =>
  ({
    A: '38 rodadas, pontos corridos. Os 4 últimos caem.',
    B: '38 rodadas. 1º e 2º sobem direto; 3º a 6º disputam playoff (3x6 e 4x5, ida e volta, vantagem do melhor colocado) por mais 2 vagas.',
    C: 'Primeira fase em turno único; os 8 melhores vão a dois quadrangulares e os 2 primeiros de cada sobem. Final entre os líderes.',
    D:
      '16 grupos regionais de 6; os 4 melhores avançam ao mata-mata em ida e volta. Os semifinalistas sobem' +
      (promD(year) === 6 ? ', e os eliminados nas quartas disputam a repescagem por mais 2 vagas.' : '.'),
    SUL: '',
  })[div];

export function Legend({ div, year }: { div: Div; year: number }) {
  return (
    <div className="panel">
      <h3>Regulamento</h3>
      <p className="note" style={{ margin: '0 0 8px' }}>
        {rulesText(div, year)}
      </p>
      {LEGEND[div].map(([cls, label]) => (
        <div key={cls} style={{ fontSize: 12 }}>
          <span className={`zone ${cls}`} />
          {label}
        </div>
      ))}
    </div>
  );
}

export function LeagueTable({ W, comp, si, gi }: { W: World; comp: Competition; si: number; gi: number }) {
  const openModal = useUi((s) => s.openModal);
  const t = table(W, comp, si, gi);
  const st = comp.stages[si] as LeagueStage;
  const title = st.groups.length > 1 ? (comp.id === 'D' || si === 0 ? 'Grupo ' : 'Quadrangular ') + (gi + 1) : st.name;
  return (
    <div className="panel">
      <h3>{title}</h3>
      <table className="t">
        <thead>
          <tr>
            <th>#</th>
            <th>Clube</th>
            <th className="r">J</th>
            <th className="r">V</th>
            <th className="r">E</th>
            <th className="r">D</th>
            <th className="r">GP</th>
            <th className="r">GC</th>
            <th className="r">SG</th>
            <th className="r">Pts</th>
            <th>Últimos</th>
          </tr>
        </thead>
        <tbody>
          {t.map((r, i) => (
            <tr
              key={r.c}
              className={`click ${r.c === W.user ? 'me' : ''}`}
              onClick={() => openModal({ kind: 'club', id: r.c })}
            >
              <td className="num">
                <span className={`zone ${zoneOf(W, comp, si, i + 1, t.length)}`} />
                {i + 1}
              </td>
              <td className="nm">
                <Crest club={W.clubs[r.c]} size={18} /> {W.clubs[r.c].n}
              </td>
              <td className="r num">{r.j}</td>
              <td className="r num">{r.v}</td>
              <td className="r num">{r.e}</td>
              <td className="r num">{r.d}</td>
              <td className="r num">{r.gp}</td>
              <td className="r num">{r.gc}</td>
              <td className="r num">{r.gp - r.gc}</td>
              <td className="r num">
                <b>{r.pts}</b>
              </td>
              <td>
                <FormStrip form={r.form} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TieBox({ W, comp, tie }: { W: World; comp: Competition; st: KOStage; tie: Tie }) {
  const f1 = comp.fx[tie.f[0]],
    f2 = comp.fx[tie.f[1]];
  const ga = (f1.pl ? f1.hg! : 0) + (f2.pl ? f2.ag! : 0),
    gb = (f1.pl ? f1.ag! : 0) + (f2.pl ? f2.hg! : 0);
  const sc = (f: typeof f1, side: 'h' | 'a') => (f.pl ? (side === 'h' ? f.hg : f.ag) : '–');
  const mine = tie.a === W.user || tie.b === W.user;
  const row = (c: number, s1: 'h' | 'a', s2: 'h' | 'a', agg: number) => (
    <div className={`row ${tie.w === c ? 'w' : ''}`}>
      <span>
        <Crest club={W.clubs[c]} size={16} /> {W.clubs[c].n}
      </span>
      <span className="num c">{sc(f1, s1)}</span>
      <span className="num c">{sc(f2, s2)}</span>
      <span className="agg">{f1.pl ? agg : ''}</span>
    </div>
  );
  return (
    <div className={`tie ${mine ? 'me' : ''}`} style={mine ? { outline: '1px solid var(--yellow)' } : undefined}>
      {row(tie.a, 'h', 'a', ga)}
      {row(tie.b, 'a', 'h', gb)}
      {f2.hp !== undefined && (
        <div className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
          ({f2.ap}x{f2.hp} pên.)
        </div>
      )}
    </div>
  );
}

/** Mini classificação (7 linhas ao redor do usuário). */
export function MiniTable({
  W,
  comp,
  si,
  gi,
  cols = 'full',
}: {
  W: World;
  comp: Competition;
  si: number;
  gi: number;
  cols?: 'full' | 'short';
}) {
  const t = table(W, comp, si, gi);
  const i = t.findIndex((r) => r.c === W.user);
  const from = Math.max(0, Math.min(i - 3, t.length - 7));
  return (
    <table className="t">
      {cols === 'full' && (
        <thead>
          <tr>
            <th>#</th>
            <th>Clube</th>
            <th className="r">J</th>
            <th className="r">SG</th>
            <th className="r">Pts</th>
          </tr>
        </thead>
      )}
      <tbody>
        {t.slice(from, from + 7).map((r, k) => (
          <tr key={r.c} className={r.c === W.user ? 'me' : ''}>
            <td className="num">
              {cols === 'short' && <span className={`zone ${zoneOf(W, comp, si, from + k + 1, t.length)}`} />}
              {from + k + 1}
            </td>
            <td className="nm">{W.clubs[r.c].n}</td>
            <td className="r num">{r.j}</td>
            {cols === 'full' && <td className="r num">{r.gp - r.gc}</td>}
            <td className="r num">
              <b>{r.pts}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
