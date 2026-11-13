import { useEffect, useState } from 'react';
import { DIV_NAME, type Div } from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { listSaves, removeSave, type SaveSlot } from '@/persistence/storage';
import { Crest } from '../components/Crest';
import { NewGame } from './NewGame';

type View = 'menu' | 'saves' | 'new';

/** Data do save: dia e mês (calendário por dias) ou a rodada. */
const saveWhen = (s: SaveSlot) =>
  s.meta.cal === 'days'
    ? new Date(s.meta.year, 0, 2 + s.meta.day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : `rodada ${s.meta.day} de 40`;

/** Abertura: o nome do jogo em destaque e as opções Novo jogo e Jogo salvo. */
export function Start() {
  const [view, setView] = useState<View>('menu');
  const [saves, setSaves] = useState<SaveSlot[] | null>(null);

  useEffect(() => {
    let alive = true;
    listSaves().then((l) => alive && setSaves(l));
    return () => {
      alive = false;
    };
  }, []);

  if (view === 'new') return <NewGame onBack={() => setView('menu')} />;
  if (view === 'saves')
    return (
      <SavedGames saves={saves || []} setSaves={setSaves} onBack={() => setView('menu')} onNew={() => setView('new')} />
    );

  const n = saves?.length ?? 0;
  return (
    <div className="opening">
      <div className="op-glow" aria-hidden="true" />
      <div className="op-pitch" aria-hidden="true" />
      <div className="op-box">
        <h1 className="op-title">Prancheta</h1>
        <p className="op-sub">Manager de futebol brasileiro, da Série D à elite</p>
        <div className="op-btns">
          <button className="op-btn pri" onClick={() => setView('new')}>
            <b>Novo jogo</b>
            <span>Escolha um clube e comece uma carreira</span>
          </button>
          <button className="op-btn" onClick={() => setView('saves')} disabled={saves !== null && n === 0}>
            <b>Jogo salvo</b>
            <span>
              {saves === null
                ? 'Procurando saves…'
                : n === 0
                  ? 'Nenhum jogo salvo neste navegador'
                  : n === 1
                    ? `${saves[0].meta.club}, ${saves[0].meta.year}`
                    : `${n} carreiras salvas`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lista de saves: abrir ou excluir. */
function SavedGames({
  saves,
  setSaves,
  onBack,
  onNew,
}: {
  saves: SaveSlot[];
  setSaves: (l: SaveSlot[]) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const loadSave = useGame((s) => s.loadSave);
  const openModal = useUi((s) => s.openModal);
  const [busy, setBusy] = useState<string | null>(null);

  const open = async (s: SaveSlot) => {
    setBusy(s.key);
    try {
      await loadSave(s.data, s.key);
      useUi.getState().go('home');
    } catch {
      toast('Não consegui abrir esse save.');
      setBusy(null);
    }
  };

  const remove = (s: SaveSlot) =>
    openModal({
      kind: 'confirm',
      title: `Excluir o save do ${s.meta.club}?`,
      body: `A carreira de ${s.meta.coach || 'técnico'} no ${s.meta.club} (temporada ${s.meta.year}) será apagada deste navegador. Não dá para desfazer.`,
      ok: 'Excluir',
      onOk: async () => {
        await removeSave(s.key);
        setSaves(saves.filter((x) => x.key !== s.key));
        toast('Save excluído.');
      },
    });

  return (
    <div className="opening list">
      <div className="op-glow" aria-hidden="true" />
      <div className="op-panel">
        <div className="op-head">
          <button className="btn ghost" onClick={onBack}>
            ‹ Voltar
          </button>
          <h2>Jogos salvos</h2>
          <button className="btn sm" onClick={() => openModal({ kind: 'importSave' })}>
            Importar arquivo
          </button>
        </div>
        {saves.length === 0 && (
          <p className="muted">
            Nenhum jogo salvo neste navegador.{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNew();
              }}
            >
              Começar um novo jogo
            </a>
          </p>
        )}
        <div className="op-saves">
          {saves.map((s) => (
            <div key={s.key} className="op-save">
              <Crest
                club={{
                  s: s.meta.s || s.meta.club.slice(0, 3).toUpperCase(),
                  c1: s.meta.c1 || '#2a3d5d',
                  c2: s.meta.c2 || '#93a1b8',
                }}
                size={42}
              />
              <div className="op-save-i">
                <b>{s.meta.club}</b>
                <span className="muted">
                  {s.meta.div && s.meta.div in DIV_NAME ? DIV_NAME[s.meta.div as Div] + ' · ' : ''}
                  Temporada {s.meta.year}, {saveWhen(s)}
                  {s.meta.coach ? ` · ${s.meta.coach}` : ''}
                </span>
                <small className="dim">Salvo em {new Date(s.meta.ts).toLocaleString('pt-BR')}</small>
              </div>
              <button className="btn pri" onClick={() => open(s)} disabled={busy != null}>
                {busy === s.key ? 'Abrindo…' : 'Jogar'}
              </button>
              <button className="btn ghost" onClick={() => remove(s)} disabled={busy != null} aria-label="Excluir save">
                Excluir
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
