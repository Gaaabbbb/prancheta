import type { Div } from '@/core';
import { useWorld } from '@/store/gameStore';
import { Crest } from '../components/Crest';
import { Modal, ModalHeader } from '../components/Modal';

export function ReportModal({ comp: cid, fid }: { comp: Div; fid: number }) {
  const W = useWorld();
  const comp = W.comps[cid];
  const f = comp.fx[fid];
  const h = W.clubs[f.h],
    a = W.clubs[f.a];
  let stats = null;
  if (f.stats) {
    const [x, y] = f.stats;
    const tot = x.pt + y.pt || 1;
    const row = (l: string, p: string | number, q: string | number) => (
      <tr key={l}>
        <td className="r num">{p}</td>
        <td className="c muted">{l}</td>
        <td className="num">{q}</td>
      </tr>
    );
    stats = (
      <table className="t" style={{ maxWidth: 420, margin: '10px auto 0' }}>
        <tbody>
          {row('Posse', Math.round((x.pt / tot) * 100) + '%', Math.round((y.pt / tot) * 100) + '%')}
          {row('Finalizações', x.sh, y.sh)}
          {row('No gol', x.sot, y.sot)}
          {row('xG', x.xg.toFixed(2), y.xg.toFixed(2))}
          {row('Escanteios', x.cor, y.cor)}
          {row('Faltas', x.fou, y.fou)}
          {row('Cartões', x.yc + '/' + x.rc, y.yc + '/' + y.rc)}
        </tbody>
      </table>
    );
  }
  return (
    <Modal>
      <ModalHeader>
        <h2>
          {comp.name}: {comp.stages[f.st].name}
        </h2>
      </ModalHeader>
      <div className="nextmatch">
        <div className="tm">
          <Crest club={h} size={48} />
          {h.n}
        </div>
        <div className="led" style={{ fontSize: 48 }}>
          {f.hg}
          <span className="sep">:</span>
          {f.ag}
        </div>
        <div className="tm">
          <Crest club={a} size={48} />
          {a.n}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', marginTop: 10 }}>
        {(f.goals || []).map((g, i) => (
          <div key={i} style={{ textAlign: g.s === 0 ? 'left' : 'right', gridColumn: g.s === 0 ? 1 : 2 }}>
            {g.m}' {g.p}
            {g.pen ? ' (pên.)' : ''}
          </div>
        ))}
      </div>
      {stats}
    </Modal>
  );
}
