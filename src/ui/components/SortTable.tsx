import { useState, type ReactNode } from 'react';

/** Coluna de uma tabela ordenável. Sem `get`, a coluna não ordena (ex.: botões). */
export interface Col<T> {
  k: string;
  label: ReactNode;
  /** classe da célula: 'r' (direita), 'c' (centro), 'nm' (nome)… */
  cls?: string;
  title?: string;
  get?: (row: T) => number | string;
  /** direção do primeiro clique: 1 = crescente (padrão para texto), -1 = decrescente (padrão para números) */
  first?: 1 | -1;
  cell: (row: T) => ReactNode;
  /** classe extra da célula conforme a linha */
  tdCls?: (row: T) => string;
}

/**
 * Tabela em que todo cabeçalho com `get` ordena ao clicar (de novo inverte). `limit` mostra só as primeiras linhas
 * depois de ordenar.
 */
export function SortTable<T>({
  rows,
  cols,
  rowKey,
  onRow,
  initial,
  limit,
  rowCls,
}: {
  rows: T[];
  cols: Col<T>[];
  rowKey: (row: T) => string | number;
  onRow?: (row: T) => void;
  initial?: { k: string; d: 1 | -1 };
  limit?: number;
  rowCls?: (row: T) => string;
}) {
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(initial ?? null);
  const col = sort ? cols.find((c) => c.k === sort.k && c.get) : undefined;
  const list = rows.slice();
  if (col && sort) {
    const get = col.get!;
    list.sort((a, b) => {
      const x = get(a),
        y = get(b);
      const r = typeof x === 'string' ? x.localeCompare(String(y), 'pt-BR') : x - (y as number);
      return r * sort.d;
    });
  }
  const shown = limit ? list.slice(0, limit) : list;
  const click = (c: Col<T>) => {
    if (!c.get) return;
    const sample = rows.length ? c.get(rows[0]) : 0;
    const first = c.first ?? (typeof sample === 'string' ? 1 : -1);
    setSort((s) => ({ k: c.k, d: s && s.k === c.k ? (s.d === 1 ? -1 : 1) : first }));
  };
  return (
    <>
      <table className="t">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c.k}
                className={`${c.get ? 's' : ''} ${c.cls || ''}`}
                title={c.title ?? (c.get ? 'Clique para ordenar' : undefined)}
                onClick={c.get ? () => click(c) : undefined}
              >
                {c.label}
                {sort && sort.k === c.k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={rowKey(r)}
              className={`${onRow ? 'click' : ''} ${rowCls ? rowCls(r) : ''}`}
              onClick={onRow ? () => onRow(r) : undefined}
            >
              {cols.map((c) => (
                <td key={c.k} className={`${c.cls || ''} ${c.tdCls ? c.tdCls(r) : ''}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit != null && list.length > shown.length && (
        <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
          Mostrando os {shown.length} primeiros de {list.length}. Ordene por outra coluna ou use os filtros para ver
          outros.
        </p>
      )}
    </>
  );
}
