import { FORM_KEYS, LINE, MENT_SHORT, PRESS, TEMPO, type Tactic } from '@/core';
import { Seg } from './Badges';

const opts = (labels: string[]) => labels.map((label, value) => ({ value, label }));

/** Formação + mentalidade, marcação, ritmo e linha. Usado na Tática e na partida ao vivo. */
export function TacticControls({
  tac,
  onChange,
  lineLabel = 'Linha defensiva',
}: {
  tac: Tactic;
  onChange: (patch: Partial<Tactic>) => void;
  lineLabel?: string;
}) {
  return (
    <div className="ctl">
      <label htmlFor="fsel">Formação</label>
      <select id="fsel" value={tac.f} onChange={(e) => onChange({ f: e.target.value })}>
        {FORM_KEYS.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <label>Mentalidade</label>
      <Seg options={opts(MENT_SHORT)} value={tac.men} onChange={(v) => onChange({ men: v })} />
      <label>Marcação</label>
      <Seg options={opts(PRESS)} value={tac.pres} onChange={(v) => onChange({ pres: v })} />
      <label>Ritmo</label>
      <Seg options={opts(TEMPO)} value={tac.temp} onChange={(v) => onChange({ temp: v })} />
      <label>{lineLabel}</label>
      <Seg options={opts(LINE)} value={tac.lin} onChange={(v) => onChange({ lin: v })} />
    </div>
  );
}
