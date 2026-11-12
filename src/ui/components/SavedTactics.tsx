import { useState } from 'react';
import {
  applyTactic,
  deleteTactic,
  MAX_TACTICS,
  MENT_SHORT,
  renameTactic,
  saveTactic,
  tacticMatches,
  updateTactic,
  type World,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';

/** Táticas salvas: trocar com um clique, salvar como nova, atualizar, renomear e excluir. */
export function SavedTactics({ W }: { W: World }) {
  const mutate = useGame((s) => s.mutate);
  const openModal = useUi((s) => s.openModal);
  const [editing, setEditing] = useState<{ mode: 'new' | 'rename'; name: string } | null>(null);
  const list = W.tacs || [];
  const active = list.find((t) => t.id === W.tacActive);
  const changed = active ? !tacticMatches(W, active) : false;
  const save = () => void useGame.getState().save();

  const submit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast('Dê um nome para a tática.');
    if (editing.mode === 'new') {
      let id: number | null = null;
      mutate((W) => {
        id = saveTactic(W, name);
      });
      if (id == null) return toast(`Dá para guardar até ${MAX_TACTICS} táticas.`);
      toast(`Tática "${name}" salva.`);
    } else if (active) {
      mutate((W) => renameTactic(W, active.id, name));
    }
    setEditing(null);
    save();
  };

  return (
    <div className="savedtac">
      <div className="stlist">
        {list.length === 0 && <span className="muted">Nenhuma tática salva ainda.</span>}
        {list.map((t) => (
          <button
            key={t.id}
            className={`stchip ${t.id === W.tacActive ? 'on' : ''}`}
            title={`${t.tac.f}, ${MENT_SHORT[t.tac.men].toLowerCase()} · clique para usar (formação, instruções, titulares e banco)`}
            onClick={() => {
              mutate((W) => applyTactic(W, t.id));
              toast(`Usando a tática "${t.name}".`);
              save();
            }}
          >
            <b>{t.name}</b>
            <span>
              {t.tac.f} · {MENT_SHORT[t.tac.men]}
            </span>
          </button>
        ))}
      </div>
      {editing ? (
        <form
          className="stform"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            maxLength={24}
            placeholder="Nome da tática (ex.: Fora de casa)"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <button className="btn pri sm" type="submit">
            {editing.mode === 'new' ? 'Salvar' : 'Renomear'}
          </button>
          <button className="btn ghost sm" type="button" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </form>
      ) : (
        <div className="stbtns">
          <button
            className="btn sm"
            disabled={list.length >= MAX_TACTICS}
            onClick={() => setEditing({ mode: 'new', name: '' })}
          >
            Salvar como nova
          </button>
          {active && (
            <>
              <button
                className={`btn sm ${changed ? 'pri' : ''}`}
                onClick={() => {
                  mutate((W) => updateTactic(W, active.id));
                  toast(`Tática "${active.name}" atualizada.`);
                  save();
                }}
                title="Grava a formação, as instruções, os titulares e o banco atuais nesta tática"
              >
                Atualizar "{active.name}"
              </button>
              <button className="btn ghost sm" onClick={() => setEditing({ mode: 'rename', name: active.name })}>
                Renomear
              </button>
              <button
                className="btn ghost sm"
                onClick={() =>
                  openModal({
                    kind: 'confirm',
                    title: `Excluir a tática "${active.name}"?`,
                    body: 'A escalação atual continua como está; só a tática salva some.',
                    ok: 'Excluir',
                    onOk: () => {
                      mutate((W) => deleteTactic(W, active.id));
                      save();
                    },
                  })
                }
              >
                Excluir
              </button>
            </>
          )}
        </div>
      )}
      {active && changed && !editing && (
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
          Você mudou a formação ou as instruções desde que carregou "{active.name}".
        </p>
      )}
    </div>
  );
}
