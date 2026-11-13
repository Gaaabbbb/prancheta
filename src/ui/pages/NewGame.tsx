import { useEffect, useState } from 'react';
import {
  createWorld,
  DEFAULT_DB_SOURCE,
  DIV_NAME,
  DIVS,
  loadDefaultDb,
  withSula,
  ovr,
  validateDb,
  teamStrength,
  type Database,
  type Div,
  type World,
} from '@/core';
import { startCareer } from '@/app/gameFlow';
import { toast, useUi } from '@/store/uiStore';
import { pickFile } from '@/persistence/saveFile';
import { readDb } from '@/spreadsheet/readDb';
import { Crest } from '../components/Crest';
import { Seg, StrengthStars } from '../components/Badges';
import { DivTabs } from '../components/DivTabs';
import { int, money } from '../format';
import { sortClubs } from '../sortClubs';

/** Seed fixa da pré-visualização: todo mundo vê os mesmos elencos ao escolher o clube. */
const PREVIEW_SEED = 20260128;

interface SheetInfo {
  file: string;
  clubs: number;
  players: number;
  warn: string[];
}

/** Novo jogo: escolha do clube e do nome do técnico (`onBack` volta para a abertura). */
export function NewGame({ onBack }: { onBack?: () => void }) {
  const openModal = useUi((s) => s.openModal);
  const [preview, setPreview] = useState<World | null>(null);
  const [div, setDiv] = useState<Div>('A');
  const [club, setClub] = useState<number | null>(null);
  const [coach, setCoach] = useState('');
  const [sort, setSort] = useState<'str' | 'az'>('str');
  const [sheet, setSheet] = useState<SheetInfo | null>(null);

  const buildPreview = (db: Database) => setPreview(createWorld(PREVIEW_SEED, db));

  useEffect(() => {
    let alive = true;
    loadDefaultDb().then((db) => alive && buildPreview(db));
    return () => {
      alive = false;
    };
  }, []);

  const startFromSheet = async () => {
    const file = await pickFile('.xlsx');
    if (!file) return;
    toast('Lendo a planilha…', 6000);
    try {
      const db = await readDb(file);
      const v = validateDb(db);
      if (v.errs.length) {
        openModal({
          kind: 'info',
          title: 'A planilha precisa de ajustes',
          body: (
            <>
              <p>Para começar uma carreira nova:</p>
              <ul>
                {v.errs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {db.errs.length > 0 && <p className="muted">Avisos: {db.errs.slice(0, 8).join('; ')}</p>}
            </>
          ),
        });
        return;
      }
      buildPreview(await withSula(db));
      setSheet({
        file: file.name,
        clubs: db.clubs.length,
        players: db.players.length + db.youth.length,
        warn: db.errs,
      });
      setClub(null);
      toast(
        'Planilha carregada: ' +
          db.clubs.length +
          ' clubes, ' +
          db.players.length +
          ' jogadores e ' +
          db.youth.length +
          ' garotos da base.' +
          (db.errs.length ? ' ' + db.errs.length + ' aviso(s).' : ''),
        4500,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui ler essa planilha.', 5000);
    }
  };

  const dropSheet = async () => {
    setSheet(null);
    setClub(null);
    buildPreview(await loadDefaultDb());
  };

  const PW = preview;
  const clubs = PW ? PW.clubs.filter((c) => c.div === div) : [];
  const str = PW ? sortClubs(PW, clubs, sort) : {};
  const sel = PW && club != null ? PW.clubs[club] : null;
  const counts = Object.fromEntries(
    DIVS.map((d) => [d, PW ? PW.clubs.filter((c) => c.div === d).length : 0]),
  ) as Record<Div, number>;

  let detail = <p className="muted">Escolha um clube para ver os detalhes.</p>;
  if (PW && sel) {
    const sq = PW.players.filter((p) => p.c === sel.id && !p.y).sort((a, b) => ovr(b) - ovr(a));
    const nb = PW.players.filter((p) => p.c === sel.id && p.y).length;
    const top13 = sq.slice(0, 13).reduce((s, p) => s + ovr(p), 0) / 13;
    detail = (
      <>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <Crest club={sel} size={44} />
          <div>
            <h3 style={{ fontSize: 22 }}>{sel.n}</h3>
            <div className="muted">
              {DIV_NAME[sel.div]}, {sel.uf} &nbsp; <StrengthStars s={teamStrength(PW, sel)} />
            </div>
          </div>
        </div>
        <dl className="kv">
          <dt>Estádio</dt>
          <dd>
            {sel.std} ({int(sel.cap)})
          </dd>
          <dt>Força do elenco</dt>
          <dd>
            <StrengthStars s={+top13.toFixed(1)} />
          </dd>
          <dt>Caixa</dt>
          <dd>{money(sel.bal)}</dd>
          <dt>Elenco</dt>
          <dd>
            {sq.length} profissionais, {nb} na base
          </dd>
          <dt>Destaques</dt>
          <dd>
            {sq
              .slice(0, 3)
              .map((p) => p.n)
              .join(', ')}
          </dd>
        </dl>
      </>
    );
  }

  return (
    <div className="start">
      <div className="l">
        {onBack && (
          <button className="btn ghost sm" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
            ‹ Voltar
          </button>
        )}
        <div className="logo">
          Novo jogo<small>Escolha o clube e diga seu nome de técnico</small>
        </div>
        <div>
          <label className="muted" htmlFor="coach">
            Seu nome de técnico
          </label>
          <br />
          <input
            id="coach"
            type="text"
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
            placeholder="Ex.: Gabriel"
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>
        <div className="panel">{detail}</div>
        <button
          className="btn pri big"
          disabled={!sel}
          onClick={() => PW && club != null && startCareer(PW, club, coach)}
        >
          Assumir o {sel ? sel.n : 'clube'}
        </button>
        <p className="note">
          Clubes, divisões e elencos reais de 2026 ({DEFAULT_DB_SOURCE}), com profissionais e categorias de base. Tudo é
          editável no Editor ou pela planilha.
        </p>
        {sheet && (
          <div className="panel">
            <h3>Usando sua planilha</h3>
            <p className="muted" style={{ margin: '0 0 8px' }}>
              {sheet.file}: {sheet.clubs} clubes, {sheet.players} jogadores
              {sheet.warn.length ? ', ' + sheet.warn.length + ' aviso(s)' : ''}.
            </p>
            <button className="btn sm" onClick={dropSheet}>
              Voltar à base padrão
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={startFromSheet}>
            Começar com minha planilha (.xlsx)
          </button>
          <button className="btn sm ghost" onClick={() => openModal({ kind: 'importSave' })}>
            Importar arquivo de save
          </button>
        </div>
      </div>
      <div className="r">
        <DivTabs
          value={div}
          counts={counts}
          onChange={(d) => {
            setDiv(d);
            setClub(null);
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Ordenar por
          </span>
          <Seg
            options={[
              { value: 'str', label: 'Força do elenco' },
              { value: 'az', label: 'Ordem alfabética' },
            ]}
            value={sort}
            onChange={setSort}
          />
        </div>
        {!PW && <p className="muted">Carregando clubes…</p>}
        <div className="clubgrid">
          {clubs.map((c, i) => (
            <button
              key={c.id}
              className={`clubcard ${club === c.id ? 'on' : ''}`}
              onClick={() => {
                setClub(c.id);
                // no celular a lista fica embaixo: volta para os detalhes e o botão "Assumir"
                if (window.innerWidth <= 820) setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
            >
              <Crest club={c} size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>
                  {sort === 'str' && (
                    <span className="dim num" style={{ fontWeight: 400 }}>
                      {i + 1}.{' '}
                    </span>
                  )}
                  {c.n}
                </b>
                <span>{c.uf}</span> <StrengthStars s={str[c.id]} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
