# Prancheta

Manager de futebol brasileiro, da Série D à elite. Esta é a versão modular do `Prancheta.html`
original (que continua guardado em `legacy/` como referência), feita com **Vite + React + TypeScript**.

## Como rodar

Precisa do [Node.js](https://nodejs.org) LTS (22 ou mais novo).

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

| Comando             | O que faz                                                                       |
| ------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento com recarga automática                              |
| `npm run build`     | gera a versão final em `dist/` (dá para hospedar em qualquer servidor estático) |
| `npm run preview`   | serve a pasta `dist/` para conferir o build                                     |
| `npm test`          | roda os testes (inclui a paridade com o jogo original)                          |
| `npm run lint`      | ESLint                                                                          |
| `npm run typecheck` | verificação de tipos do TypeScript                                              |
| `npm run format`    | formata o código com Prettier                                                   |

## Arquitetura

O código é separado em camadas. Cada camada só conhece as de baixo:

```
ui/  (telas React)  ──►  app/ (fluxo do jogo)  ──►  store/ (estado)  ──►  core/ (regras)
                                      persistence/ e spreadsheet/ (arquivos e saves)
```

- **`src/core/`**: as regras do jogo em TypeScript puro, sem React e sem DOM. Dá para rodar no Node (é o que os testes fazem).
- **`src/store/`**: estado com [Zustand](https://zustand.docs.pmnd.rs). O núcleo muda o `World` direto (são ~10 mil jogadores, copiar tudo a cada lance seria lento); o store só incrementa um contador `rev` para o React redesenhar.
- **`src/app/`**: o que acontece quando o usuário clica em "Continuar", joga uma partida, vira a temporada. Liga o núcleo aos stores.
- **`src/ui/`**: componentes React. Telas em `pages/`, janelas em `modals/`, partida ao vivo em `match/`.
- **`src/persistence/`**: saves (IndexedDB, gzip, arquivos). Abre saves do jogo antigo.
- **`src/spreadsheet/`**: planilha `.xlsx` do banco de dados e CSV do editor. A biblioteca de planilhas só carrega quando é usada.
- **`src/data/default-db.json`**: clubes e elencos reais de 2026 (Transfermarkt, 10/11/2026). Carregado sob demanda.
- **`src/styles/`**: CSS do original separado por área; as cores ficam em `tokens.css`.

### Mapa do núcleo (`src/core/`)

| Pasta / arquivo      | Responsabilidade                                                        |
| -------------------- | ----------------------------------------------------------------------- |
| `rng.ts`             | aleatório determinístico (mesma seed = mesmo jogo)                      |
| `constants/`         | atributos, posições, formações, divisões, regras de acesso              |
| `types.ts`           | tipos de `World`, `Club`, `Player`, `Competition`, `Fixture`…           |
| `player/`            | OVR, geração de atributos, valor de mercado, salário, nomes             |
| `world/`             | criação do mundo, elencos, índice de jogadores por clube, força do time |
| `youth/`             | categoria de base: peneira, evolução, subir e dispensar                 |
| `lineup/`            | escalação automática e validação da escalação                           |
| `match/`             | motor de partida (`engine.ts`), narração, efeitos pós-jogo              |
| `season/`            | tabelas, mata-mata, calendário, dia de jogos, virada de temporada       |
| `finance/`, `board/` | bilheteria, patrocínio, salários; metas e confiança da diretoria        |
| `db/`                | leitura e validação do banco de dados                                   |

## Receitas

**Adicionar uma formação**: inclua a formação em `FORMATIONS` e o peso em `FORMATION_WEIGHTS`
(`src/core/constants/formations.ts`). Ela aparece sozinha nos seletores.

**Adicionar uma página no menu**: crie o componente em `src/ui/pages/`, registre em `src/ui/pages/index.ts`,
adicione o id em `PageId` (`src/store/uiStore.ts`) e o item em `src/ui/layout/navItems.ts`.

**Adicionar uma janela (modal)**: inclua o tipo em `ModalSpec` (`src/store/uiStore.ts`) e o `case` em
`src/ui/modals/ModalHost.tsx`. Abra com `useUi.getState().openModal({ kind: '...' })`.

**Mudar regras de acesso e rebaixamento**: `src/core/season/advance.ts` (fases e quem sobe/cai),
`src/core/season/buildSeason.ts` (formato da primeira fase) e `targetC`/`promD` em `src/core/constants/divisions.ts`.
Atualize também a legenda em `src/ui/components/Standings.tsx`.

**Ajustar o motor de partida**: `src/core/match/engine.ts`. Os pesos ficam no topo (`ROLE_W`, `ACT_W`, `DEF_W`).

**Mudar o formato do save**: aumente `WORLD_VERSION` (`src/core/world/createWorld.ts`) e adicione uma migração em
`src/persistence/serialize.ts`, para os saves antigos continuarem abrindo.

## Testes de paridade

`tests/parity/` carrega o núcleo do `legacy/Prancheta.html` original no Node e compara com o núcleo novo, usando a
mesma seed: criação do mundo, uma temporada inteira, a virada de ano e uma partida narrada lance a lance. Enquanto
esses testes passam, o jogo novo se comporta exatamente como o antigo.

Quando você **quiser** mudar uma regra (balanceamento, novo formato de campeonato), os testes de paridade vão
falhar, e isso é esperado. Nesse caso, apague ou ajuste o teste afetado e mantenha os testes de `tests/core/`.

## Diferenças em relação ao original

- Saves ficam no IndexedDB do navegador (o original usava localStorage, limitado a ~5 MB). O salvamento em nuvem do
  claude.ai foi removido; `src/persistence/storage.ts` tem a interface `SaveBackend` para ligar outra nuvem depois.
- Saves do jogo antigo entram por **Jogo e saves → Importar save** (arquivo `.save` ou texto copiado).
- Fontes e a biblioteca de planilhas vêm do próprio projeto: o jogo funciona offline depois do build.
- Novidades de interface (não mudam as regras, os testes de paridade continuam valendo):
  - Caixa de entrada com mensagens novas em negrito. Ao clicar, a mensagem abre com ações (ver relatório, ajustar
    escalação, ir para a base…) e a ação tomada fica registrada.
  - Coluna **Evolução** no Elenco e na Base (`src/core/player/evolution.ts`). Até 21 anos mostra quanto falta para o
    próximo ponto de OVR; acima disso, quanto o OVR deve mudar na virada da temporada.
  - Tática: arrastar jogadores entre campo, banco e reservas. O banco é escolhido pelo usuário (`swapSpots` em
    `src/core/lineup/lineup.ts`) e não é mais refeito sozinho.
  - Finanças com extrato diário (`W.finLog`), gráfico do saldo com projeção, simulador do preço do ingresso, folha por
    setor e histórico por temporada (`W.finHist`).
- Regra nova, opcional: ampliar o estádio em Finanças (`expandStadium`). Custa dinheiro e aumenta o público.
- Pequenas correções: o placar agregado do mata-mata ficava fora do lugar; os gols do relatório da partida agora
  ficam do lado do time que marcou; a legenda da Série D só cita a repescagem nos anos em que ela existe; a notícia de título agora cita a divisão
  em que o clube foi campeão (antes, o campeão da Série B aparecia como campeão da Série A).
