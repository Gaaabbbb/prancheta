import { useState } from 'react';
import { type Match, type Tactic } from '@/core';
import { toast } from '@/store/uiStore';
import { TacticControls } from '../components/TacticControls';

/**
 * Painel para mudar a formação e as instruções durante a partida (o jogo fica pausado enquanto ele está aberto).
 * As substituições e trocas de posição são feitas direto no campo.
 */
export function LiveTacticsPanel({ m, onClose }: { m: Match; onClose: () => void }) {
  const [, force] = useState(0);
  const s = m.sides[m.userSide];
  const setTac = (patch: Partial<Tactic>) => {
    m.setTactic(m.userSide, patch);
    force((x) => x + 1);
  };
  return (
    <div className="side-panel">
      <div className="mh" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2 style={{ flex: 1 }}>Tática</h2>
        <button className="btn pri" onClick={onClose}>
          Voltar ao jogo
        </button>
      </div>
      {(m.W.tacs || []).length > 0 && (
        <div className="stlist" style={{ marginBottom: 12 }}>
          <span className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>
            Táticas salvas:
          </span>
          {m.W.tacs!.map((t) => (
            <button
              key={t.id}
              className="stchip"
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
      <TacticControls tac={s.tac} onChange={setTac} lineLabel="Linha" />
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Para substituir, arraste um reserva até o jogador que sai (ou toque nos dois). Para trocar dois jogadores de
        posição, arraste um sobre o outro.
      </p>
    </div>
  );
}
