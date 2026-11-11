import { DIV_NAME, fmtDate, dateOf, nextUserFixture, userStanding, type World } from '@/core';
import { continueGame } from '@/app/gameFlow';
import { Crest } from '../components/Crest';
import { money } from '../format';

export function TopBar({ W }: { W: World }) {
  const me = W.clubs[W.user!];
  const s = userStanding(W);
  const nf = nextUserFixture(W);
  let next;
  if (W.seasonDone)
    next = (
      <>
        <b>Temporada encerrada</b>
        <br />
        Veja o resumo e comece {W.year + 1}
      </>
    );
  else if (nf) {
    const opp = W.clubs[nf.f.h === W.user ? nf.f.a : nf.f.h];
    next = (
      <>
        Próximo jogo: <b>{opp.n}</b> ({nf.f.h === W.user ? 'casa' : 'fora'})
        <br />
        {fmtDate(dateOf(W, nf.f.d))}, {nf.comp.stages[nf.f.st].name}
      </>
    );
  } else
    next = (
      <>
        <b>Sem jogos restantes</b>
        <br />
        Simule até o fim da temporada
      </>
    );
  return (
    <header id="top">
      <div className="club">
        <Crest club={me} size={34} />
        <div>
          <h1>{me.n}</h1>
          <div className="status">
            {DIV_NAME[me.div]}
            {s && (
              <>
                {' '}
                &nbsp; <b>{s.pos}º</b> {s.stage.groups.length > 1 ? 'no grupo ' + (s.gi + 1) : ''} &nbsp; {s.row.pts}{' '}
                pts
              </>
            )}{' '}
            &nbsp; Saldo <b>{money(me.bal)}</b>
          </div>
        </div>
      </div>
      <div className="spacer" />
      <div className="next">{next}</div>
      <button className="btn pri big" onClick={continueGame}>
        {W.seasonDone ? 'Fechar temporada' : 'Continuar'}
      </button>
    </header>
  );
}
