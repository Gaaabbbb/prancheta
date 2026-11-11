import { useId } from 'react';
import type { Club } from '@/core';
import { isLight } from '../format';

/** Escudo gerado com as cores e a sigla do clube. */
export function Crest({ club, size = 36 }: { club: Pick<Club, 'c1' | 'c2' | 's'>; size?: number }) {
  const id = useId();
  const h = Math.round(size * 1.15);
  const light = isLight(club.c1);
  const txt = light ? (isLight(club.c2) ? '#111' : club.c2) : isLight(club.c2) ? club.c2 : '#fff';
  const shape = 'M3 3h34v19c0 12-8 19-17 22C11 41 3 34 3 22z';
  return (
    <svg className="crest" width={size} height={h} viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="46" fill={club.c1} />
        <path d="M0 30L40 14V46H0z" fill={club.c2} opacity=".9" />
      </g>
      <path d={shape} fill="none" stroke="#ffffff55" strokeWidth="1.5" />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fontFamily="Saira Condensed,Arial Narrow,sans-serif"
        fontWeight="800"
        fontSize="11.5"
        textLength={club.s.length > 2 ? 23 : 17}
        lengthAdjust="spacingAndGlyphs"
        fill={txt}
        stroke={light ? '#fff' : '#000'}
        strokeWidth=".4"
        paintOrder="stroke"
      >
        {club.s}
      </text>
    </svg>
  );
}
