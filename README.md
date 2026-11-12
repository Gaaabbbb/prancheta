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
- Novidades de interface (não mudam as regras esportivas):
  - Caixa de entrada com mensagens novas em negrito. Ao clicar, a mensagem abre com ações (ver relatório, ajustar
    escalação, ver patrocínios…) e a ação tomada fica registrada.
  - **Calendário** (`src/ui/pages/Calendar.tsx`): grade mensal e lista com os jogos, casa/fora, resultados e dias de
    pagamento.
  - Elenco: coluna **Evolução** (`src/core/player/evolution.ts`) e cartões amarelos/vermelhos da temporada (CA/CV).
  - Tática: arrastar jogadores entre campo, banco e reservas; o banco é escolhido pelo usuário (`swapSpots`);
    até 8 táticas salvas com nome (`src/core/lineup/presets.ts`), que também podem ser aplicadas durante o jogo.
- Regras novas de dinheiro (o saldo não influencia nada esportivo, então os testes de paridade deixam o saldo de fora):
  - Salários e patrocínios são pagos **uma vez por mês**, de fevereiro a novembro (`src/core/finance/ledger.ts`).
    O total da temporada continua igual ao do original (10 meses de salário).
  - **Patrocínio master e secundário** (`src/core/finance/sponsors.ts`), com 33 marcas fictícias em
    `sponsorCatalog.ts`. Contratos por desempenho pagam bônus por vitória de até R$ 1 mi na Série A (menos nas outras séries). Propostas chegam ao longo da temporada; dá para aceitar, pedir mais, recusar, rescindir
    (pagando multa) ou buscar marcas. Marcas insatisfeitas podem romper, e outras tentam tirar o patrocinador atual.
    Os patrocínios usam um sorteio próprio, separado do sorteio dos jogos.
  - Finanças em abas: resumo com gráficos, patrocínio e extrato mensal.
- Regras esportivas novas, todas em `src/core/rules.ts` (`CURRENT_RULES`). Os testes de paridade chamam
  `applyLegacyRules()` para continuar comparando com o original:
  - **Calendário real** (`seasonDates` em `src/core/season/calendar.ts`): semanas com uma ou duas rodadas e pausas;
    cada divisão joga nos dias da semana de costume (Série A sáb/dom e qua/qui, Série B sex a seg e ter/qua, Séries C
    e D no fim de semana). Os pagamentos mensais seguem essas datas.
  - **Condição física:** a recuperação depende dos dias de descanso até a rodada seguinte (uma semana devolve cerca de
    65% do cansaço, três dias cerca de 36%). Quem joga sempre começa as partidas com ~88% em média e cai para ~75% nas
    semanas com duas rodadas; cansado rende menos e se lesiona mais. A IA roda o elenco.
  - **Desempenho:** além de OVR e condição, a moral (±6%) e a nota média da temporada (±4%) entram no rendimento
    (`src/core/player/performance.ts`). A Tática mostra o desempenho previsto de cada jogador.
  - **Lesões e cartões:** menos cartões por falta, menos lesões e menos lesões longas (`cardRate`, `injuryRate`,
    `longInjury`): em média um desfalque a cada quatro jogos.
  - **Base:** evolução dos jovens pela metade (`youthGrowth`).
  - **Desfalques:** lesionados e suspensos não saem sozinhos da escalação do usuário (`tidyLineup` / `lineupIssues`).
    O jogo só começa depois da troca, e a caixa de entrada avisa quando o jogador volta a ficar disponível.
  - **Patrocínio:** cada espaço só pode ser trocado uma vez por temporada, salvo se a marca romper.
- **Mercado e contratos (v0.2)**, em `src/core/market/market.ts` e na página Mercado (desligado com
  `applyLegacyRules()`, então a paridade não muda):
  - Janelas de transferência na pré-temporada (até a 5ª rodada) e no meio do ano (junho e julho). Fora delas, só
    jogadores livres e renovações.
  - Compra em duas etapas: valor com o clube (aceita, contraproposta ou recusa, até 3 tentativas por janela) e
    salário/duração com o jogador, que pode recusar clube muito menor.
  - Empréstimos até o fim da temporada, com divisão do salário; jogadores livres; renovação; dispensa com multa de
    metade do salário que falta; lista de observação com avisos.
  - Contratos vencem: quem não renova sai de graça no fim da temporada. A IA renova a maioria, compra e vende entre si
    e manda propostas pelos jogadores do usuário (principalmente os colocados à venda).
  - Transferências entram em Finanças (extrato, cascata do caixa e histórico).
- Pequenas correções: o placar agregado do mata-mata ficava fora do lugar; os gols do relatório da partida agora
  ficam do lado do time que marcou; a legenda da Série D só cita a repescagem nos anos em que ela existe; a notícia de título agora cita a divisão
  em que o clube foi campeão (antes, o campeão da Série B aparecia como campeão da Série A).
