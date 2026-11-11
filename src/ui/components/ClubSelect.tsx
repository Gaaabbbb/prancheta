import { DIV_NAME, DIVS, type World } from '@/core';
import type { SelectHTMLAttributes } from 'react';

/** Seletor de clube agrupado por divisão. */
export function ClubSelect({ W, ...rest }: { W: World } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest}>
      {DIVS.map((d) => (
        <optgroup key={d} label={DIV_NAME[d]}>
          {W.clubs
            .filter((x) => x.div === d)
            .sort((a, b) => a.n.localeCompare(b.n))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.n}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
