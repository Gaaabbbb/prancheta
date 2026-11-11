import { DIV_NAME, DIVS, type Div } from '@/core';

export function DivTabs({
  value,
  onChange,
  counts,
}: {
  value: Div;
  onChange: (d: Div) => void;
  counts?: Record<Div, number>;
}) {
  return (
    <div className="tabs">
      {DIVS.map((d) => (
        <button key={d} className={d === value ? 'on' : ''} onClick={() => onChange(d)}>
          {DIV_NAME[d]} {counts && <span className="dim">{counts[d]}</span>}
        </button>
      ))}
    </div>
  );
}
