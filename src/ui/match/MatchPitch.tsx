import { type PointerEvent as RPointerEvent } from 'react';
import { FORMATIONS, injuryRisk, riskLevel, RULES, type Match, type MatchEvent, type Side } from '@/core';
import { fitCol } from './colors';
import { placeFormation } from '../pitch/layout';
import { shortName } from '../pitch/numbers';
import { PitchFrame, PlayerToken, type TeamColors } from '../pitch/Pitch';

/** O que está selecionado ou sendo arrastado: jogador em campo, no banco ou vaga vazia. */
export type Pick = { kind: 'on' | 'bench' | 'slot'; side: number; id: number };

export interface FeedItem {
  key: number;
  e: MatchEvent;
}

/** Campo com o seu time na formação. As fichas (camisa + cartão com função, nota, nome e fôlego) são arrastáveis. */
export function MatchPitch({
  m,
  col,
  nums,
  sel,
  onDown,
  goalFlash,
}: {
  m: Match;
  col: TeamColors;
  nums: Map<number, number>;
  sel: Pick | null;
  onDown: (p: Pick, e: RPointerEvent) => void;
  goalFlash: number;
}) {
  const s: Side = m.sides[m.userSide];
  const slots = FORMATIONS[s.tac.f];
  const used = new Set(s.on.map((o) => o.slot));
  return (
    <PitchFrame flash={goalFlash}>
      {(w) => {
        const pos = placeFormation(slots, w);
        return (
          <>
            {s.on.map((o) => {
              const p = o.pl;
              const at = pos[o.slot] || pos[0];
              const goals = m.goals.filter((g) => g.pid === p.id && g.side === s.idx).length;
              const rat = s.rat[p.id] ?? 6;
              const hurt = s.out[p.id] === 'inj';
              const risk = RULES.injuryModel === 'risk' && !hurt ? injuryRisk(m.W, p) : null;
              const lv = risk ? riskLevel(risk.w) : 'baixo';
              return (
                <PlayerToken
                  key={p.id}
                  col={col}
                  num={nums.get(p.id) ?? ''}
                  role={o.role}
                  value={rat.toFixed(1)}
                  valueCls={rat >= 7.5 ? 'hi' : rat < 6 ? 'lo' : ''}
                  name={shortName(p.n)}
                  fit={p.f}
                  fitColor={fitCol(p.f)}
                  width={at.w}
                  sel={sel?.kind === 'on' && sel.id === p.id}
                  dim={hurt}
                  style={{ top: at.top + '%', left: at.left + '%' }}
                  data-drop={`on:${s.idx}:${p.id}`}
                  onPointerDown={(e) => onDown({ kind: 'on', side: s.idx, id: p.id }, e)}
                  title={`${p.n} · ${o.role} · fôlego ${Math.round(p.f)}% · nota ${rat.toFixed(1)}`}
                  marks={
                    <>
                      {goals > 0 && <i className="pgoal">{goals > 1 ? goals : ''}⚽</i>}
                      {s.yel[p.id] ? <i className="pyc" /> : null}
                      {hurt && <i className="phurt">✚</i>}
                      {lv !== 'baixo' && (
                        <i
                          className={`prisk ${lv === 'alto' ? 'hi' : 'md'}`}
                          title={`Risco de lesão ${lv}: ${risk!.why.join(', ')}`}
                        >
                          !
                        </i>
                      )}
                    </>
                  }
                />
              );
            })}
            {slots.map((sl, i) => {
              if (used.has(i)) return null;
              const at = pos[i];
              const on = sel?.kind === 'slot' && sel.id === i;
              return (
                <div
                  key={'e' + i}
                  className={`ptok empty ${on ? 'sel' : ''}`}
                  style={{ top: at.top + '%', left: at.left + '%' }}
                  data-drop={`slot:${s.idx}:${i}`}
                  onPointerDown={(e) => onDown({ kind: 'slot', side: s.idx, id: i }, e)}
                >
                  <span className="eshirt">{sl[0]}</span>
                  <span className="pcard">
                    <span className="pn">vaga livre</span>
                  </span>
                </div>
              );
            })}
          </>
        );
      }}
    </PitchFrame>
  );
}
