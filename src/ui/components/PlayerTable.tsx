import { ovr, type Player } from '@/core';
import { useUi, type SortKey } from '@/store/uiStore';
import { useWorld } from '@/store/gameStore';
import { EvoBar } from './EvoBar';
import { money, potTxt, rating } from '../format';
import { sortPlayers } from '../sortPlayers';
import { FitBar, MoraleBar, Ovr, PosTag, StatusTags } from './Badges';

/** Cabeçalho de coluna ordenável. */
export function SortTh({ k, label, cls }: { k: SortKey; label: string; cls?: string }) {
  const sort = useUi((s) => s.sort);
  const setSort = useUi((s) => s.setSort);
  return (
    <th className={`s ${cls || ''}`} onClick={() => setSort(k)}>
      {label}
      {sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

/** Tabela completa de elenco. `highlight` destaca (ex.: titulares). */
export function PlayerTable({ players, highlight }: { players: Player[]; highlight?: Set<number> }) {
  const sort = useUi((s) => s.sort);
  const openModal = useUi((s) => s.openModal);
  const W = useWorld();
  const rows = sortPlayers(players, sort.k, sort.d, W);
  return (
    <table className="t">
      <thead>
        <tr>
          <SortTh k="pos" label="Pos" />
          <SortTh k="n" label="Nome" />
          <SortTh k="a" label="Idade" cls="r" />
          <SortTh k="ovr" label="OVR" cls="c" />
          <SortTh k="pt" label="Pot" cls="c" />
          <SortTh k="prog" label="Evolução" />
          <SortTh k="f" label="Cond." />
          <SortTh k="mo" label="Moral" />
          <SortTh k="j" label="J" cls="r" />
          <SortTh k="g" label="G" cls="r" />
          <SortTh k="as" label="A" cls="r" />
          <SortTh k="nt" label="Nota" cls="r" />
          <SortTh k="val" label="Valor" cls="r" />
          <SortTh k="sal" label="Salário" cls="r" />
          <SortTh k="ct" label="Contrato" cls="r" />
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr
            key={p.id}
            className={`click ${highlight?.has(p.id) ? 'me' : ''}`}
            onClick={() => openModal({ kind: 'player', id: p.id })}
          >
            <td>
              <PosTag p={p.p} />
            </td>
            <td className="nm">
              {p.n}
              <StatusTags p={p} />
            </td>
            <td className="r num">{p.a}</td>
            <td className="c">
              <Ovr v={ovr(p)} />
            </td>
            <td className="c dim num">{potTxt(p)}</td>
            <td>
              <EvoBar W={W} p={p} />
            </td>
            <td style={{ width: 70 }}>
              <FitBar f={p.f} />
            </td>
            <td style={{ width: 70 }}>
              <MoraleBar m={p.mo} />
            </td>
            <td className="r num">{p.st.j}</td>
            <td className="r num">{p.st.g}</td>
            <td className="r num">{p.st.as}</td>
            <td className="r num">{rating(p)}</td>
            <td className="r num">{money(p.val)}</td>
            <td className="r num">{money(p.sal)}</td>
            <td className="r num">{p.ct}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
