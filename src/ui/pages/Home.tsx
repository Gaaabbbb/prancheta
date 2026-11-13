import {
  available,
  EXP_TXT,
  fmtDate,
  dateOf,
  nextUserFixture,
  squad,
  teamStrength,
  userStanding,
  leagueName,
} from '@/core';
import { goToMatch } from '@/app/gameFlow';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { StatusTags, StrengthStars } from '../components/Badges';
import { MiniTable } from '../components/Standings';
import { Inbox } from '../components/Inbox';
import { rating } from '../format';
import type { PageProps } from './types';

export function Home({ W }: PageProps) {
  const go = useUi((s) => s.go);
  const openModal = useUi((s) => s.openModal);
  const me = W.clubs[W.user!];
  const nf = nextUserFixture(W);
  const st = userStanding(W);
  const b = W.board || { exp: 1, conf: 60 };
  const confCol = b.conf > 65 ? 'var(--ok)' : b.conf > 40 ? 'var(--yellow)' : 'var(--red)';
  const sq = squad(W, W.user!);
  const tops = sq
    .filter((p) => p.st.g > 0)
    .sort((a, b) => b.st.g - a.st.g)
    .slice(0, 5);
  const best = sq
    .filter((p) => p.st.j >= 3)
    .sort((a, b) => b.st.nt / b.st.j - a.st.nt / a.st.j)
    .slice(0, 5);
  const out = sq.filter((p) => !available(p));
  const playerLink = (id: number, name: string) => (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        openModal({ kind: 'player', id });
      }}
    >
      {name}
    </a>
  );

  let nextMatch = <p className="muted">Nenhum jogo restante nesta temporada.</p>;
  if (nf) {
    const h = W.clubs[nf.f.h],
      a = W.clubs[nf.f.a];
    const oppId = nf.f.h === W.user ? nf.f.a : nf.f.h;
    let oppPos = '';
    if (st) {
      const r = st.table.findIndex((x) => x.c === oppId);
      if (r >= 0) oppPos = r + 1 + 'º, ' + st.table[r].pts + ' pts';
    }
    nextMatch = (
      <>
        <div className="nextmatch">
          <div className="tm">
            <Crest club={h} size={54} />
            <span>{h.n}</span>
          </div>
          <div className="vs">
            {fmtDate(dateOf(W, nf.f.d))}
            <br />
            <b style={{ fontSize: 24, color: 'var(--chalk)' }}>x</b>
            <br />
            {nf.comp.stages[nf.f.st].name}
            {nf.f.leg ? ', ' + nf.f.leg + 'º jogo' : ''}
          </div>
          <div className="tm">
            <Crest club={a} size={54} />
            <span>{a.n}</span>
          </div>
        </div>
        <p className="muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>
          {h.std} &nbsp; Adversário: {oppPos || leagueName(W.clubs[oppId])} &nbsp; força{' '}
          <StrengthStars s={teamStrength(W, W.clubs[oppId])} /> contra <StrengthStars s={teamStrength(W, me)} /> do seu
          time
        </p>
      </>
    );
  }

  return (
    <div className="grid g21">
      <div className="grid">
        <div className="panel">
          <h3>Próximo jogo</h3>
          {nextMatch}
          {nf && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn" onClick={() => go('tactics')}>
                Ajustar escalação
              </button>
              <button className="btn pri" onClick={goToMatch}>
                Ir para o jogo
              </button>
            </div>
          )}
        </div>
        <Inbox W={W} />
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="panel">
          <h3>Diretoria</h3>
          <p style={{ margin: '0 0 8px' }}>
            Meta: <b>{EXP_TXT[b.exp]}</b>
          </p>
          <div className="meter">
            <i style={{ width: `${b.conf}%`, background: confCol }} />
          </div>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            Confiança {Math.round(b.conf)}%
          </p>
        </div>
        {st && (
          <div className="panel">
            <h3>
              Classificação{' '}
              <small>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    go('tables');
                  }}
                >
                  ver tudo
                </a>
              </small>
            </h3>
            <MiniTable W={W} comp={st.comp} si={st.si} gi={st.gi} />
          </div>
        )}
        <div className="panel">
          <h3>Destaques do elenco</h3>
          {tops.length ? (
            <>
              <p className="muted" style={{ margin: '0 0 4px', fontSize: 12 }}>
                Artilheiros
              </p>
              {tops.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {playerLink(p.id, p.n)}
                  <b className="num">{p.st.g}</b>
                </div>
              ))}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              A temporada ainda não começou.
            </p>
          )}
          {best.length > 0 && (
            <>
              <p className="muted" style={{ margin: '10px 0 4px', fontSize: 12 }}>
                Melhores notas
              </p>
              {best.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {playerLink(p.id, p.n)}
                  <b className="num">{rating(p)}</b>
                </div>
              ))}
            </>
          )}
          {out.length > 0 && (
            <>
              <p className="muted" style={{ margin: '10px 0 4px', fontSize: 12 }}>
                Desfalques
              </p>
              {out.map((p) => (
                <div key={p.id}>
                  {p.n} <StatusTags p={p} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
