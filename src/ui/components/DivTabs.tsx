import { DIV_NAME, DIVS, type Div } from '@/core';

export function DivTabs({
  value,
  onChange,
  counts,
  withSul,
}: {
  value: Div;
  onChange: (d: Div) => void;
  counts?: Partial<Record<Div, number>>;
  /** inclui a aba dos clubes sul-americanos */
  withSul?: boolean;
}) {
  const list: Div[] = withSul ? [...DIVS, 'SUL'] : [...DIVS];
  return (
    <div className="tabs">
      {list.map((d) => (
        <button key={d} className={d === value ? 'on' : ''} onClick={() => onChange(d)}>
          {DIV_NAME[d]} {counts && <span className="dim">{counts[d]}</span>}
        </button>
      ))}
    </div>
  );
}
