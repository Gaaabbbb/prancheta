import { useState } from 'react';
import { type Match, type Tactic } from '@/core';
import { toast } from '@/store/uiStore';
import { TacticControls } from '../components/TacticControls';

/** Tática do usuário durante a partida, sempre à vista (embaixo do banco): formação, instruções e táticas salvas. */
export function TacticDock({ m }: { m: Match }) {
  const [, force] = useState(0);
  const s = m.sides[m.userSide];
  const setTac = (patch: Partial<Tactic>) => {
    m.setTactic(m.userSide, patch);
    force((x) => x + 1);
  };
  return (
    <section className="mpanel mtac">
      <header>
        <h3>Tática</h3>
        {(m.W.tacs || []).length > 0 && (
          <div className="mtac-saved">
            {m.W.tacs!.map((t) => (
              <button
                key={t.id}
                className="stchip"
                disabled={m.ended}
                title="Aplica a formação e as instruções desta tática (os jogadores em campo continuam os mesmos)"
                onClick={() => {
                  setTac({ ...t.tac });
                  toast(`Tática "${t.name}" aplicada.`);
                }}
              >
                <b>{t.name}</b>
                <span>{t.tac.f}</span>
              </button>
            ))}
          </div>
        )}
      </header>
      <TacticControls tac={s.tac} onChange={setTac} lineLabel="Linha" />
    </section>
  );
}
