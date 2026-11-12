import {
  available,
  dateOf,
  fmtDate,
  FORMATIONS,
  koContext,
  MENT,
  ovr,
  ovrRole,
  squad,
  teamStrength,
  lineupIssues,
  tidyLineup,
  restDays,
  clubRestBefore,
  isDays,
  WEEKDAY_SHORT,
  type KOStage,
} from '@/core';
import { currentFixture, liveMatch, quickMatch } from '@/app/gameFlow';
import { useWorld } from '@/store/gameStore';
import { useUi } from '@/store/uiStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';
import { FitBar, Ovr, PosTag, StatusTags, StrengthStars } from '../components/Badges';

export function PrematchModal() {
  const W = useWorld();
  const { closeModal, go } = useUi();
  const uf = currentFixture();
  if (!uf) return null;
  const { comp, f } = uf;
  const me = W.clubs[W.user!];
  tidyLineup(W, me);
  const issues = lineupIssues(W, me);
  const h = W.clubs[f.h],
    a = W.clubs[f.a];
  const oppC = f.h === W.user ? a : h;
  const missing = squad(W, W.user!).filter((p) => !available(p));
  const tired = me.lineup!.map((id) => W.pmap[id!]).filter((p) => p && p.f < 75);
  const rest = isDays(W) ? clubRestBefore(W, me.id, f.d) : restDays(W, f.d, me.div);
  const ko = koContext(comp, f);
  const f1 = ko && ko.leg === 2 ? comp.fx[(comp.stages[f.st] as KOStage).ties[f.g].f[0]] : null;
  const slots = FORMATIONS[me.tac.f];
  const highlights = squad(W, oppC.id)
    .filter(available)
    .sort((x, y) => ovr(y) - ovr(x))
    .slice(0, 3)
    .map((p) => p.n)
    .join(', ');
  return (
    <Modal wide>
      <ModalHeader>
        <h2>
          {comp.name}: {comp.stages[f.st].name}
          {f.leg ? ', ' + f.leg + 'º jogo' : ''}
        </h2>
      </ModalHeader>
      <div className="nextmatch">
        <div className="tm">
          <Crest club={h} size={56} />
          {h.n}
        </div>
        <div className="vs">
          {h.std}
          <br />
          {WEEKDAY_SHORT[dateOf(W, f.d).getDay()]}, {fmtDate(dateOf(W, f.d))}
          <br />
          <span className={rest <= 4 ? 'restwarn' : ''}>
            {rest >= 20 ? 'início da temporada' : `${rest} dias de descanso`}
          </span>
        </div>
        <div className="tm">
          <Crest club={a} size={56} />
          {a.n}
        </div>
      </div>
      {f1 && (
        <p className="muted" style={{ textAlign: 'center', margin: '6px 0 0' }}>
          Jogo de ida: {W.clubs[f1.h].n} {f1.hg} x {f1.ag} {W.clubs[f1.a].n}
        </p>
      )}
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div>
          <h3 style={{ marginBottom: 6 }}>
            Seu time{' '}
            <small className="muted" style={{ fontFamily: 'var(--fb)', fontSize: 12 }}>
              {me.tac.f}, {MENT[me.tac.men].toLowerCase()}
            </small>
          </h3>
          <table className="t">
            <tbody>
              {me.lineup!.map((id, i) => {
                const p = W.pmap[id!];
                const role = slots[i][0];
                if (!p) return null;
                return (
                  <tr key={i}>
                    <td>
                      <PosTag p={role} />
                    </td>
                    <td className="nm">
                      {p.n}
                      <StatusTags p={p} />
                    </td>
                    <td className="c">
                      <Ovr v={ovrRole(p, role)} />
                    </td>
                    <td style={{ width: 60 }}>
                      <FitBar f={p.f} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style={{ marginBottom: 6 }}>Adversário</h3>
          <dl className="kv">
            <dt>Força do elenco</dt>
            <dd>
              <StrengthStars s={teamStrength(W, oppC)} /> <span className="muted">(seu time</span>{' '}
              <StrengthStars s={teamStrength(W, me)} />
              <span className="muted">)</span>
            </dd>
            <dt>Formação habitual</dt>
            <dd>{oppC.tac.f}</dd>
            <dt>Destaques</dt>
            <dd>{highlights}</dd>
          </dl>
          {missing.length > 0 && (
            <p style={{ margin: '12px 0 0' }}>
              <b>Desfalques:</b>{' '}
              {missing.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  {p.n}
                  <StatusTags p={p} />
                </span>
              ))}
            </p>
          )}
          {rest <= 4 && rest < 20 && (
            <p style={{ margin: '8px 0 0', color: 'var(--yellow)' }}>
              Sequência apertada: só {rest} dias desde o último jogo. Quem jogou recuperou pouco.
            </p>
          )}
          {tired.length > 0 && (
            <p style={{ margin: '8px 0 0', color: 'var(--orange)' }}>
              Cansados entre os titulares: {tired.map((p) => p.n + ' (' + Math.round(p.f) + '%)').join(', ')}
            </p>
          )}
        </div>
      </div>
      {issues.length > 0 && (
        <p className="warnbox" style={{ marginTop: 14 }}>
          <b>Não dá para começar:</b>{' '}
          {issues.map((x) => `${W.pmap[x.pid].n} (${x.why}, ${x.where === 'xi' ? 'titular' : 'banco'})`).join(', ')}.
          Troque na Tática.
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button
          className={`btn ${issues.length ? 'pri big' : ''}`}
          onClick={() => {
            closeModal();
            go('tactics');
          }}
        >
          Mexer na escalação
        </button>
        <button className="btn" onClick={quickMatch} disabled={issues.length > 0}>
          Resultado rápido
        </button>
        <button className="btn pri big" onClick={liveMatch} disabled={issues.length > 0} autoFocus>
          Ir para o jogo
        </button>
      </div>
    </Modal>
  );
}
