import { squad } from '@/core';
import { PlayerTable } from '../components/PlayerTable';
import { money } from '../format';
import type { PageProps } from './types';

export function Squad({ W }: PageProps) {
  const sq = squad(W, W.user!);
  const avgAge = (sq.reduce((s, p) => s + p.a, 0) / Math.max(1, sq.length)).toFixed(1);
  const wage = sq.reduce((s, p) => s + p.sal, 0);
  const lineup = new Set((W.clubs[W.user!].lineup || []).filter((x): x is number => x != null));
  return (
    <>
      <div className="ph">
        <h2>Elenco</h2>
        <span className="muted">
          {sq.length} jogadores &nbsp; idade média {avgAge} &nbsp; folha {money(wage)}/mês
        </span>
        <span className="sp" />
        <span className="muted" style={{ fontSize: 12 }}>
          Destacados: titulares. Evolução: até 21 anos, quanto falta para o próximo ponto de OVR; acima disso, quanto o
          OVR deve mudar na virada da temporada.
        </span>
      </div>
      <div className="panel">
        <PlayerTable players={sq} highlight={lineup} />
      </div>
    </>
  );
}
