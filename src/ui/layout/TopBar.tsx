import { DIV_NAME, fmtDate, dateOf, isDays, nextUserFixture, userStanding, WEEKDAY_SHORT, type World } from '@/core';
import { advanceOneDay, continueGame } from '@/app/gameFlow';
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
    const inDays = nf.f.d - (W.day + 1);
    const when = !isDays(W)
      ? fmtDate(dateOf(W, nf.f.d))
      : inDays <= 0
        ? 'hoje'
        : inDays === 1
          ? 'amanhã'
          : `${fmtDate(dateOf(W, nf.f.d))} (em ${inDays} dias)`;
    next = (
      <>
        Próximo jogo: <b>{opp.n}</b> ({nf.f.h === W.user ? 'casa' : 'fora'})
        <br />
        {when}, {nf.comp.name}
        {nf.comp.stages[nf.f.st].name !== 'Pontos corridos' ? ' · ' + nf.comp.stages[nf.f.st].name : ''}
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
      {isDays(W) && !W.seasonDone && (
        <div className="today" title="Data de hoje">
          <span>{WEEKDAY_SHORT[dateOf(W, W.day + 1).getDay()]}</span>
          <b className="num">{dateOf(W, W.day + 1).getDate()}</b>
          <span>
            {dateOf(W, W.day + 1)
              .toLocaleDateString('pt-BR', { month: 'short' })
              .replace('.', '')}
          </span>
        </div>
      )}
      <div className="next">{next}</div>
      {isDays(W) && !W.seasonDone && (
        <button className="btn big" onClick={advanceOneDay} title="Passa só um dia (se hoje tem jogo, abre o pré-jogo)">
          +1 dia
        </button>
      )}
      <button
        className="btn pri big"
        onClick={continueGame}
        title={
          isDays(W) ? 'Avança até o próximo jogo ou até uma decisão importante (proposta, janela, contrato)' : undefined
        }
      >
        {W.seasonDone ? 'Fechar temporada' : 'Avançar'}
      </button>
    </header>
  );
}
