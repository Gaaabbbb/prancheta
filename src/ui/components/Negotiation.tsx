import { useEffect, useRef, type ReactNode } from 'react';
import type { Club, Talk } from '@/core';
import { Crest } from './Crest';

/** Conversa da negociação, uma fala por linha (o outro lado à esquerda, o usuário à direita). */
export function TalkLog({ talk, them, themName }: { talk: Talk; them?: Club | null; themName: string }) {
  const end = useRef<HTMLDivElement>(null);
  const n = talk.log.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [n]);
  return (
    <div className="talk" aria-live="polite">
      {talk.log.map((m, i) => (
        <div key={i} className={`tmsg ${m.by}${i === n - 1 ? ' last' : ''}`}>
          {m.by === 'them' &&
            (them ? <Crest club={them} size={22} /> : <span className="tava">{themName.slice(0, 1)}</span>)}
          <p>{m.txt}</p>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

/** Paciência do outro lado: quantas rodadas ainda aceita conversar. */
export function Patience({ talk }: { talk: Talk }) {
  const left = Math.max(0, talk.pat);
  const label = talk.end
    ? talk.end === 'deal'
      ? 'Acordo fechado'
      : 'Conversa encerrada'
    : left <= 1
      ? 'Última rodada'
      : `Paciência: ${left} rodadas`;
  return (
    <span
      className={`patience ${left <= 1 && !talk.end ? 'low' : ''}`}
      title="Cada proposta gasta uma rodada; proposta ofensiva gasta duas"
    >
      {Array.from({ length: talk.pat0 }, (_, i) => (
        <i key={i} className={i < left ? 'on' : ''} />
      ))}
      <span>{label}</span>
    </span>
  );
}

/** Valor com botões de menos e mais e uma régua. */
export function Amount({
  value,
  onChange,
  min,
  max,
  step,
  fmt,
  stepDown,
  stepUp,
  label,
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => ReactNode;
  stepDown: (v: number) => number;
  stepUp: (v: number) => number;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <div className="amount">
      <div className="feerow">
        <button className="btn" onClick={() => onChange(Math.max(min, stepDown(value)))} aria-label="Diminuir">
          −
        </button>
        <b className="num">{fmt(value)}</b>
        <button className="btn" onClick={() => onChange(Math.min(max, stepUp(value)))} aria-label="Aumentar">
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: '100%' }}
        aria-label={label}
      />
      {hint && <p className="amount-hint muted">{hint}</p>}
    </div>
  );
}
