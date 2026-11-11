import { useRef, useState } from 'react';
import {
  autoLineup,
  calcValue,
  calcWage,
  clamp,
  clubLevel,
  demote,
  dirty,
  genAttrs,
  makePlayer,
  ovr,
  POS,
  promote,
  removeFromLineups,
  validateLineup,
  type Club,
  type Player,
  type Pos,
} from '@/core';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { applyDb, setOvr } from '@/spreadsheet/applyDb';
import { exportCsv, importCsv } from '@/spreadsheet/csv';
import { exportDb } from '@/spreadsheet/exportDb';
import { readDb } from '@/spreadsheet/readDb';
import { downloadBlob, pickFile } from '@/persistence/saveFile';
import { ClubSelect } from '../components/ClubSelect';
import { CommitInput } from '../components/CommitInput';
import { Crest } from '../components/Crest';
import { Seg } from '../components/Badges';
import { sortPlayers } from '../sortPlayers';
import type { PageProps } from './types';

export function Editor({ W }: PageProps) {
  const { edClub, edPool, set, openModal } = useUi();
  const { mutate, save } = useGame();
  const csvRef = useRef<HTMLTextAreaElement>(null);
  const [csvReplace, setCsvReplace] = useState(false);
  const cid = edClub ?? W.user!;
  const c = W.clubs[cid];
  const base = edPool === 'base';
  const sq = sortPlayers(
    W.players.filter((p) => p.c === cid && !!p.y === base),
    'pos',
    1,
  );

  const editPlayer = (p: Player, fn: (p: Player) => void) => mutate(() => fn(p));
  const editClub = (fn: (c: Club) => void) => mutate(() => fn(c));

  const removePlayer = (p: Player) =>
    openModal({
      kind: 'confirm',
      title: 'Remover ' + p.n + '?',
      body: 'O jogador sai do jogo de vez.',
      ok: 'Remover',
      onOk: () =>
        mutate((W) => {
          W.players = W.players.filter((x) => x !== p);
          delete W.pmap[p.id];
          dirty(W);
          removeFromLineups(W, p.id);
        }),
    });

  const addPlayer = () =>
    mutate((W) => {
      const pl = base
        ? makePlayer(W, c.id, 'Novo Garoto', 'MC', 17, Math.round(clubLevel(c) - 12), false, {
            y: 1,
            pt: Math.round(clubLevel(c) + 2),
          })
        : makePlayer(W, c.id, 'Novo Jogador', 'MC', 22, Math.round(clubLevel(c)), false);
      pl.val = calcValue(pl);
      pl.sal = base ? 0 : calcWage(pl, c.div);
    });

  const swapPool = (p: Player) =>
    mutate((W) => {
      if (p.y) promote(W, p, true);
      else {
        demote(W, p);
        if (p.c === W.user) validateLineup(W, W.clubs[W.user]);
        else autoLineup(W, W.clubs[p.c]);
      }
    });

  const importSheet = async () => {
    const file = await pickFile('.xlsx');
    if (!file) return;
    toast('Lendo a planilha…', 6000);
    let db;
    try {
      db = await readDb(file);
    } catch (e) {
      return toast(e instanceof Error ? e.message : 'Não consegui ler essa planilha.', 5000);
    }
    let rep!: ReturnType<typeof applyDb>;
    mutate((W) => (rep = applyDb(W, db)));
    void save();
    openModal({
      kind: 'info',
      title: 'Planilha importada',
      body: (
        <>
          <dl className="kv">
            <dt>Clubes atualizados</dt>
            <dd>{rep.clubs}</dd>
            <dt>Jogadores atualizados</dt>
            <dd>{rep.upd}</dd>
            <dt>Jogadores novos</dt>
            <dd>{rep.add}</dd>
            <dt>Transferências</dt>
            <dd>{rep.mov}</dd>
            <dt>Jogadores que saíram</dt>
            <dd>{rep.del}</dd>
            <dt>Completados pelo jogo</dt>
            <dd>{rep.fill}</dd>
          </dl>
          {rep.divs > 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              {rep.divs} clube(s) com divisão diferente na planilha. Mudanças de divisão só valem numa carreira nova.
            </p>
          )}
          {rep.unknown.length > 0 && (
            <p className="muted">
              Clubes que não existem no jogo foram ignorados: {rep.unknown.slice(0, 8).join(', ')}
              {rep.unknown.length > 8 ? '…' : ''}
            </p>
          )}
          {db.errs.length > 0 && <p className="muted">Avisos: {db.errs.slice(0, 8).join('; ')}</p>}
        </>
      ),
    });
  };

  const exportSheet = async () => {
    try {
      const { data, filename } = await exportDb(W);
      downloadBlob(data, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast('Planilha baixada.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para gerar a planilha.', 5000);
    }
  };

  const doCsvImport = () => {
    let res!: ReturnType<typeof importCsv>;
    mutate((W) => (res = importCsv(W, csvRef.current?.value || '', csvReplace)));
    toast(
      res.ok + ' jogador(es) importado(s)' + (res.errs.length ? '. Ignorei: ' + res.errs.slice(0, 5).join(', ') : '.'),
      4000,
    );
  };

  const doCsvExport = async () => {
    const txt = exportCsv(W, c);
    try {
      await navigator.clipboard.writeText(txt);
      toast('Elenco copiado em CSV.');
    } catch {
      if (csvRef.current) csvRef.current.value = txt;
      toast('Elenco colocado na caixa de texto.');
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Editor</h2>
        <span className="muted">
          Mude nomes, posições, idades e notas. Mudar o OVR reajusta os atributos mantendo o estilo do jogador.
        </span>
      </div>
      <div className="grid g12">
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h3>Clube</h3>
            <ClubSelect
              W={W}
              value={cid}
              onChange={(e) => set({ edClub: +e.target.value })}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <div className="ctl">
              <label>Nome</label>
              <CommitInput type="text" value={c.n} onCommit={(v) => v.trim() && editClub((c) => (c.n = v.trim()))} />
              <label>Sigla</label>
              <CommitInput
                type="text"
                maxLength={3}
                value={c.s}
                style={{ width: 70 }}
                onCommit={(v) => v.trim() && editClub((c) => (c.s = v.trim().toUpperCase().slice(0, 3)))}
              />
              <label>Cores</label>
              <span>
                <input
                  type="color"
                  value={c.c1.toLowerCase()}
                  onChange={(e) => editClub((c) => (c.c1 = e.target.value.toUpperCase()))}
                />{' '}
                <input
                  type="color"
                  value={c.c2.toLowerCase()}
                  onChange={(e) => editClub((c) => (c.c2 = e.target.value.toUpperCase()))}
                />
              </span>
              <label>Reputação</label>
              <CommitInput
                type="number"
                min={1}
                max={99}
                value={c.rep}
                style={{ width: 70 }}
                onCommit={(v) => editClub((c) => (c.rep = clamp(+v || 50, 1, 99)))}
              />
              <label>Estádio</label>
              <CommitInput
                type="text"
                value={c.std}
                onCommit={(v) => v.trim() && editClub((c) => (c.std = v.trim()))}
              />
              <label>Capacidade</label>
              <CommitInput
                type="number"
                min={1000}
                max={100000}
                value={c.cap}
                style={{ width: 100 }}
                onCommit={(v) => editClub((c) => (c.cap = clamp(+v || 5000, 1000, 100000)))}
              />
              <label>Caixa (R$)</label>
              <CommitInput
                type="number"
                value={Math.round(c.bal)}
                style={{ width: 140 }}
                onCommit={(v) => !isNaN(+v) && editClub((c) => (c.bal = +v))}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Crest club={c} size={48} />
            </div>
          </div>
          <div className="panel">
            <h3>Planilha do banco de dados</h3>
            <p className="note" style={{ margin: '0 0 10px' }}>
              A planilha Excel guarda clubes, jogadores e a base (clube, divisão, nome, posição, idade, nota e, na base,
              potencial). Edite no Excel e importe aqui para atualizar os elencos desta carreira. Mudanças de divisão só
              valem numa carreira nova.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn pri" onClick={importSheet}>
                Importar planilha (.xlsx)
              </button>
              <button className="btn" onClick={exportSheet}>
                Baixar planilha atual
              </button>
            </div>
          </div>
          <div className="panel">
            <h3>Colar jogadores (CSV)</h3>
            <p className="note" style={{ margin: '0 0 8px' }}>
              Uma linha por jogador: <b>Clube;Nome;Posição;Idade;OVR</b>. Posições: {POS.join(', ')}. O clube pode ser o
              nome ou a sigla.
            </p>
            <textarea ref={csvRef} style={{ width: '100%', height: 130 }} placeholder="Corinthians;Memphis;ATA;32;80" />
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, margin: '8px 0' }}>
              <input type="checkbox" checked={csvReplace} onChange={(e) => setCsvReplace(e.target.checked)} />{' '}
              Substituir os elencos dos clubes citados
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn pri" onClick={doCsvImport}>
                Importar
              </button>
              <button className="btn" onClick={doCsvExport}>
                Copiar elenco em CSV
              </button>
            </div>
          </div>
        </div>
        <div className="panel">
          <h3>
            <span>
              {c.n}{' '}
              <small className="muted" style={{ fontFamily: 'var(--fb)', fontSize: 12 }}>
                {sq.length} jogadores
              </small>
            </span>
            <Seg
              options={[
                { value: 'pro', label: 'Profissional' },
                { value: 'base', label: 'Base' },
              ]}
              value={edPool}
              onChange={(v) => set({ edPool: v })}
            />
          </h3>
          <table className="t">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Nome</th>
                <th>Idade</th>
                <th>OVR</th>
                <th>Pot. real</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sq.map((p) => (
                <tr key={p.id}>
                  <td>
                    <select
                      value={p.p}
                      onChange={(e) =>
                        editPlayer(p, (p) => {
                          const o = ovr(p);
                          p.p = e.target.value as Pos;
                          p.at = genAttrs(p.p, o);
                          p.val = calcValue(p);
                        })
                      }
                    >
                      {POS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <CommitInput
                      type="text"
                      value={p.n}
                      style={{ width: 180 }}
                      onCommit={(v) => v.trim() && editPlayer(p, (p) => (p.n = v.trim()))}
                    />
                  </td>
                  <td>
                    <CommitInput
                      type="number"
                      min={14}
                      max={50}
                      value={p.a}
                      style={{ width: 62 }}
                      onCommit={(v) =>
                        editPlayer(p, (p) => {
                          p.a = clamp(+v || p.a, 14, 50);
                          p.val = calcValue(p);
                        })
                      }
                    />
                  </td>
                  <td>
                    <CommitInput
                      type="number"
                      min={25}
                      max={99}
                      value={ovr(p)}
                      style={{ width: 62 }}
                      onCommit={(v) =>
                        editPlayer(p, (p) => {
                          setOvr(p, clamp(+v || 50, 25, 99));
                          p.pt = Math.max(p.pt, ovr(p));
                          p.val = calcValue(p);
                          p.sal = calcWage(p, W.clubs[p.c].div);
                        })
                      }
                    />
                  </td>
                  <td>
                    <CommitInput
                      type="number"
                      min={25}
                      max={99}
                      value={p.pt}
                      style={{ width: 62 }}
                      onCommit={(v) =>
                        editPlayer(p, (p) => {
                          p.pt = clamp(+v || p.pt, ovr(p), 99);
                          p.val = calcValue(p);
                        })
                      }
                    />
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 230 }}>
                    <button className="btn sm" onClick={() => openModal({ kind: 'editAttrs', id: p.id })}>
                      Atributos
                    </button>{' '}
                    <button className="btn sm" onClick={() => openModal({ kind: 'movePlayer', id: p.id })}>
                      Transferir
                    </button>{' '}
                    <button className="btn sm" onClick={() => swapPool(p)}>
                      {p.y ? 'Subir' : 'Para a base'}
                    </button>{' '}
                    <button className="btn sm danger" onClick={() => removePlayer(p)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={addPlayer}>
              Adicionar jogador
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
