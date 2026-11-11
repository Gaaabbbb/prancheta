import type { InputHTMLAttributes } from 'react';

/**
 * Campo que só confirma o valor ao sair do campo ou apertar Enter
 * (como o evento "change" nativo). Evita recalcular o jogo a cada tecla.
 */
export function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string | number; onCommit: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange'
>) {
  return (
    <input
      key={String(value)}
      defaultValue={value}
      onBlur={(e) => {
        if (e.target.value !== String(value)) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      {...rest}
    />
  );
}
