import { clamp, type Match, type Side, type World } from '@/core';

/** Resumo no apito final: notas e melhor em campo. */
export function LiveEndPanel({ W, m, onClose }: { W: World; m: Match; onClose: () => void }) {
  const ratTable = (s: Side) =>
    [...s.played]
      .map((id) => W.pmap[id])
      .filter(Boolean)
      .map((p) => ({
        p,
        r: clamp(s.rat[p.id] || 6, 3, 10),
        g: m.goals.filter((g) => g.pid === p.id && g.side === s.idx).length,
      }))
      .sort((a, b) => b.r - a.r);
  const all = [...ratTable(m.sides[0]), ...ratTable(m.sides[1])];
  const motm = all.slice().sort((a, b) => b.r - a.r)[0];
  const tbl = (s: Side) => (
    <table className="t">
      <tbody>
        {ratTable(s).map((x) => (
          <tr key={x.p.id}>
            <td className="nm">
              {x.p.n}
              {x.g ? ' ' + '⚽'.repeat(x.g) : ''}
            </td>
            <td className="r num">
              <b style={{ color: x.r >= 7.5 ? 'var(--ok)' : x.r < 6 ? '#ff9a9d' : 'var(--chalk)' }}>{x.r.toFixed(1)}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const [h, a] = m.sides;
  return (
    <div className="side-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2 style={{ flex: 1 }}>
          Fim de jogo: {h.club.n} {h.goals} x {a.goals} {a.club.n}
        </h2>
        <button className="btn pri big" onClick={onClose} autoFocus>
          Continuar
        </button>
      </div>
      {m.penLog && (
        <p style={{ textAlign: 'center', margin: '6px 0 0' }}>
          Pênaltis: {h.pens} x {a.pens}
        </p>
      )}
      {motm && (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Melhor em campo: <b style={{ color: 'var(--chalk)' }}>{motm.p.n}</b> ({motm.r.toFixed(1)})
        </p>
      )}
      <div className="grid g2">
        <div>
          <h3 style={{ marginBottom: 6 }}>{h.club.n}</h3>
          {tbl(h)}
        </div>
        <div>
          <h3 style={{ marginBottom: 6 }}>{a.club.n}</h3>
          {tbl(a)}
        </div>
      </div>
    </div>
  );
}
