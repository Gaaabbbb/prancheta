import { evoOutlook, ovr, seasonLastDay, unitTxt, type Player, type World } from '@/core';

const signed = (v: number) => (v > 0 ? '+' + v : String(v));
const range = (lo: number, hi: number) => (lo === hi ? signed(lo) : `${signed(lo)} a ${signed(hi)}`);

/** Barra de evolução do OVR: quanto falta para o próximo nível. */
export function EvoBar({ W, p }: { W: World; p: Player }) {
  const o = evoOutlook(W, p);
  const now = ovr(p);
  let title: string;
  if (o.kind === 'young') {
    const pct = Math.round(o.progress * 100);
    title =
      `${pct}% do caminho até o OVR ${now + 1}.` +
      (o.days != null ? ` No ritmo atual, faltam cerca de ${unitTxt(W, o.days)}.` : '') +
      ` Ritmo: ~${o.perYear.toFixed(1)} ponto(s) por temporada. Jogar mais acelera.`;
  } else if (o.kind === 'ceiling') {
    title = `Chegou ao potencial (${p.pt}). Não evolui mais.`;
  } else {
    const left = Math.max(0, seasonLastDay(W) - W.day);
    title =
      `O OVR muda na virada da temporada (faltam ${unitTxt(W, left)}): ${range(o.lo, o.hi)}.` +
      (o.bonus
        ? ' Inclui +1 por ter jogado mais de 20 partidas.'
        : p.a + 1 <= 24
          ? ' Ganha +1 se passar de 20 jogos na temporada.'
          : '');
  }
  return (
    <div className="evob" title={title}>
      <div className="meter">
        <i style={{ width: `${o.progress * 100}%`, background: 'var(--chalk)' }} />
      </div>
    </div>
  );
}
