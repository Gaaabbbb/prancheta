import { dateOf, DIV_NAME, isDays, SEASON_DAYS } from '@/core';
import { abandonCareer } from '@/app/gameFlow';
import { useGame } from '@/store/gameStore';
import { toast, useUi } from '@/store/uiStore';
import { downloadBlob, saveFileName } from '@/persistence/saveFile';
import type { PageProps } from './types';

export function Saves({ W }: PageProps) {
  const { lastSave, saveError, save, exportSave } = useGame();
  const openModal = useUi((s) => s.openModal);
  const me = W.clubs[W.user!];

  const download = async () => {
    downloadBlob(await exportSave(), saveFileName(W.year, me.s), 'text/plain');
    toast('Arquivo de save baixado.');
  };
  const copy = async () => {
    const data = await exportSave();
    try {
      await navigator.clipboard.writeText(data);
      toast('Save copiado. Cole num arquivo de texto para guardar.');
    } catch {
      openModal({
        kind: 'info',
        title: 'Copiar save',
        body: (
          <>
            <p className="muted">Selecione tudo e copie:</p>
            <textarea style={{ width: '100%', height: 240 }} readOnly value={data} />
          </>
        ),
      });
    }
  };

  return (
    <>
      <div className="ph">
        <h2>Jogo e saves</h2>
      </div>
      <div className="grid g2">
        <div className="panel">
          <h3>Salvar</h3>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            O jogo salva sozinho a cada rodada neste navegador. Baixe um arquivo de vez em quando como cópia de
            segurança.
          </p>
          <dl className="kv">
            <dt>Neste navegador</dt>
            <dd>
              {saveError
                ? 'erro: ' + saveError
                : lastSave
                  ? 'salvo (' + new Date(lastSave).toLocaleString('pt-BR') + ')'
                  : 'ainda não salvo nesta sessão'}
            </dd>
          </dl>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              className="btn pri"
              onClick={async () =>
                toast((await save()) ? 'Jogo salvo.' : 'Não deu para salvar neste navegador. Use “Baixar save”.')
              }
            >
              Salvar agora
            </button>
            <button className="btn" onClick={download}>
              Baixar save
            </button>
            <button className="btn" onClick={copy}>
              Copiar save
            </button>
            <button className="btn" onClick={() => openModal({ kind: 'importSave' })}>
              Importar save
            </button>
          </div>
        </div>
        <div className="panel">
          <h3>Carreira</h3>
          <dl className="kv">
            <dt>Técnico</dt>
            <dd>{W.coach || ''}</dd>
            <dt>Clube</dt>
            <dd>{me.n}</dd>
            <dt>Temporada</dt>
            <dd>
              {W.year},{' '}
              {isDays(W)
                ? dateOf(W, W.day + 1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
                : `rodada ${W.day} de ${SEASON_DAYS}`}
            </dd>
          </dl>
          {W.hist.length > 0 && (
            <>
              <h3 style={{ margin: '14px 0 6px' }}>Histórico</h3>
              <table className="t">
                <tbody>
                  {W.hist.map((h) => (
                    <tr key={h.year}>
                      <td className="num">{h.year}</td>
                      <td>{W.clubs[h.user!.club].n}</td>
                      <td>{DIV_NAME[h.user!.div]}</td>
                      <td>
                        {h.user!.pos
                          ? h.user!.pos.pos + 'º' + (h.user!.pos.grp ? ' (grupo ' + h.user!.pos.grp + ')' : '')
                          : ''}
                      </td>
                      <td>{h.user!.champ ? 'Campeão' : h.user!.prom ? 'Acesso' : h.user!.rel ? 'Rebaixado' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <button
              className="btn danger"
              onClick={() =>
                openModal({
                  kind: 'confirm',
                  title: 'Começar um novo jogo?',
                  body: 'A carreira atual será substituída no próximo salvamento. Baixe o save antes se quiser guardá-la.',
                  ok: 'Começar do zero',
                  onOk: abandonCareer,
                })
              }
            >
              Começar um novo jogo
            </button>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Sobre os dados</h3>
        <p className="note" style={{ margin: 0 }}>
          Os 156 clubes e os formatos das Séries A, B, C e D são os de 2026. Os elencos profissionais e as bases vêm da
          planilha (Transfermarkt, coletado em 10/11/2026). Para atualizar, edite a planilha e importe em Editor &gt;
          Planilha do banco de dados.
        </p>
      </div>
    </>
  );
}
