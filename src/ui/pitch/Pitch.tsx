import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { PITCH_RATIO, shirtSize } from './layout';

export interface TeamColors {
  /** cor principal (camisa) */ f: string;
  /** cor do detalhe (número e borda) */ s: string;
}

/** Camisa com o número, nas cores do time. */
export function Shirt({ col, n, size }: { col: TeamColors; n: number | string; size?: number }) {
  return (
    <svg className="shirt" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path
        d="M14 4 L8 6 L2 13 L7 18 L10 15 L10 37 L30 37 L30 15 L33 18 L38 13 L32 6 L26 4 Q20 9 14 4 Z"
        fill={col.f}
        stroke={col.s}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text x="20" y="29" textAnchor="middle" fill={col.s}>
        {n}
      </text>
    </svg>
  );
}

/**
 * Campo (goleiro embaixo) do maior tamanho que cabe no espaço, na proporção `PITCH_RATIO`. `children` recebe a largura
 * do campo para posicionar as fichas.
 */
export function PitchFrame({
  className,
  children,
  flash,
}: {
  className?: string;
  children: (w: number) => ReactNode;
  flash?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      const W0 = el.clientWidth,
        H0 = el.clientHeight || W0 / PITCH_RATIO;
      let w = W0,
        h = w / PITCH_RATIO;
      if (h > H0) {
        h = H0;
        w = h * PITCH_RATIO;
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`vpitch-wrap ${className || ''}`} ref={wrap}>
      <div
        className={`vpitch ${flash ? 'goalflash' : ''}`}
        key={flash}
        style={{ width: size.w, height: size.h, '--tk': shirtSize(size.w) + 'px' } as CSSProperties}
      >
        <svg className="lines" viewBox="0 0 80 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="77" height="97" />
          <line x1="1.5" y1="50" x2="78.5" y2="50" />
          <ellipse cx="40" cy="50" rx="10" ry="8" />
          <rect x="18" y="1.5" width="44" height="15" />
          <rect x="29" y="1.5" width="22" height="5" />
          <rect x="18" y="83.5" width="44" height="15" />
          <rect x="29" y="93.5" width="22" height="5" />
        </svg>
        {size.w > 0 && children(size.w)}
      </div>
    </div>
  );
}

/** Ficha de jogador: camisa com número e um cartão com função e nota (ou OVR), nome e barra de fôlego. */
export function PlayerToken({
  col,
  num,
  role,
  value,
  valueCls,
  name,
  fit,
  fitColor,
  width,
  sel,
  dim,
  marks,
  tag,
  className,
  style,
  ...rest
}: {
  col: TeamColors;
  num: number | string;
  role: string;
  value: string | number;
  valueCls?: string;
  name: string;
  fit: number;
  fitColor: string;
  width?: number;
  sel?: boolean;
  dim?: boolean;
  /** gol, cartão, lesão (ícones na camisa) */
  marks?: ReactNode;
  /** etiqueta embaixo do nome (ex.: lesionado) */
  tag?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const f = Math.round(fit);
  return (
    <div
      className={`ptok ${sel ? 'sel' : ''} ${dim ? 'hurt' : ''} ${className || ''}`}
      style={{ ...style, ...(width ? ({ '--cw': width + 'px' } as CSSProperties) : null) }}
      {...rest}
    >
      <span className="pshirt">
        <Shirt col={col} n={num} />
        {marks}
      </span>
      <span className="pcard">
        <span className="pr">
          <b>{role}</b>
          <span className={`prt ${valueCls || ''}`}>{value}</span>
        </span>
        <span className="pn">{name}</span>
        <span className="pf" aria-label={`fôlego ${f}%`}>
          <i style={{ width: f + '%', background: fitColor }} />
        </span>
      </span>
      {tag}
    </div>
  );
}
