# Tela: Central (hub da carreira)

## Resumo

A Central é a **primeira aba** do modo carreira (`tab === 0`, rótulo `CENTRAL` na navegação superior). É o "hub" no estilo FIFA 14: uma grade de **tiles coloridos grandes** com o próximo jogo, o botão de avançar o calendário, o card do manager, prévia das mensagens, resumo do elenco e posição na tabela. Abaixo ficam o painel **Mercado da Bola** (`MarketFeed`, mundo vivo) e o **ticker MANDO NEWS**.

Após o redesign, a Central também mostra uma faixa compacta com os próximos cinco dias: destaca o dia atual e marca o próximo jogo do clube com a sigla do adversário. Em celular, a tela é suportada apenas na horizontal; a orientação retrato é bloqueada pela casca do app.

É a tela onde o jogador passa o tempo do calendário (dia a dia, até o próximo evento ou em modo automático), por isso concentra os estados mais importantes da carreira: dia de jogo, decisão pendente, temporada encerrada, demitido ("CARGO ENCERRADO") e modo automático.

## Como se chega / como se sai

**Entradas**
- Ao criar uma carreira (`CreateManager.onStart` → `setTab(0)`).
- Ao continuar um save no menu (`continueCareer` → `setTab(0)`).
- Ao terminar uma partida (`MatchScreen.onFinish` → `setTab(0)`; a coletiva pós-jogo abre por cima, se houver).
- Clicando em `CENTRAL` na navegação superior ou ciclando abas com **L1/R1 (LB/RB)** ou teclas `[` `]`.

**Saídas (a partir de elementos da tela)**
- Tile do próximo jogo → Escritório (se há decisão pendente), modal "Dia de jogo" (se o jogo é hoje) ou aba Temporada (demais casos).
- Tile de avanço → Escritório (demitido ou decisão pendente), nova temporada (temporada encerrada), modal "Dia de jogo" (dia de jogo) ou avança o calendário.
- Tile do manager → Escritório (aba 3).
- Linhas de mensagens → Escritório (aba 3).
- Tile "Seu time" → Time (aba 1).
- Tile da tabela → Temporada (aba 4).
- Globais: △/Y → Escritório; START/Options/☰ → modal "Preferências de avanço"; ○/B/Esc → modal "Pausa".

## Arquivos-fonte

- `src\screens\CareerCentral.tsx` — componente `CareerCentral` (tela inteira).
- `src\components\LivingPanels.tsx` — componente `MarketFeed` (painel "Mercado da Bola") e o subcomponente interno `Bar`.
- `src\App.tsx` — renderização da aba 0, callbacks `onAdvance`/`onMatch`/`onTab`/`onNewSeason`, função `advance`, loop de simulação contínua (`running`), mapeamento do controle (`useControllerActions`), header/footer globais, `demo-strip`, modais `prefs`/`pause`/`prematch`.
- `src\components\ui.tsx` — `Badge` (escudo), `ManagerPortrait` (retrato/silhueta), `money`, `dateLabel`.
- `src\game\calendar.ts` — `nextFixture`, `fixtureLabel`, `competitionName`.
- `src\game\engine.ts` — `standings`, `advanceDay`, `advanceStep`, `startNextSeason`.
- `src\game\matches.ts` (`squad`), `src\game\ratings.ts` (`overall`), `src\game\npc.ts` (`clubById`, `findPlayer`), `src\game\random.ts` (`addDays`).
- `src\controller\GamepadProvider.tsx`, `FocusManager.ts`, `xboxMapping.ts`, `dualsenseMapping.ts` — navegação por controle.
- `src\styles.css` — seção "Tiles coloridos" (~l. 768–895), seção "Central" (~l. 1354–1566), `.living-*` (~l. 6289–6300), media queries (~l. 3183 e ~l. 3276).

## Wireframe atual (ASCII)

Layout desktop (grid `2fr 1fr 1fr 1.15fr`, 2 linhas, áreas `'fix fix adv man' / 'inb sq tab man'`):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo] MANDO   [L1] CENTRAL  TIME  TRANSFERÊNCIAS  ESCRITÓRIO•  TEMPORADA [R1]  [escudo] 04 DE NOV. DE 2026 │
│                                                                              R$ 12,3 mi  (wifi)(🎮)│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [DEMONSTRAÇÃO · Atletas e finanças sintéticos]   (só no mundo demo)                          │
│ BOM TRABALHO, RUAN    ● TEMPORADA 2026 · EM ANDAMENTO · 04 DE NOVEMBRO DE 2026                │
│ ┌──────────────────────────────────────┬──────────────────┬──────────────────────┐           │
│ │ ((•)) PRÓXIMO JOGO      RODADA 32    │ O CLUBE NÃO PARA │ MANAGER · FLA        │           │
│ │                                      │ AVANÇAR DIA      │                      │           │
│ │  [ESCUDO]        VS        [ESCUDO]  │                  │    (retrato/         │           │
│ │  FLAMENGO               PALMEIRAS    │  04      ➜   05  │     silhueta)        │           │
│ │                                      │  NOV.        NOV.│                      │           │
│ │ BRASILEIRÃO SÉRIE A · 08 DE NOV. ... │[CONTINUAR · START│  RUAN                │           │
│ │                         · MARACANÃ   │  MUDA O MODO]    │  CARDOSO             │           │
│ ├──────────────────┬───────────────────┼──────────────────┤  CONFIANÇA 72%       │           │
│ │ ✉ MENSAGENS (3)  │ 👥 SEU TIME 4-3-3 │ 🏆 SÉRIE A       │  ▓▓▓▓▓▓▓░░░          │           │
│ │ • Presidência ·… │  78               │  4º              │                      │           │
│ │   Título msg     │  OVR MÉDIO        │  NA TABELA       │                      │           │
│ │ • Auxiliar …     │ 32 atletas · 2 les│ Caixa R$ 12,3 mi │                      │           │
│ │ (até 4 linhas)   │ [GERENCIAR →]     │ [TEMPORADA →]    │                      │           │
│ └──────────────────┴───────────────────┴──────────────────┴──────────────────────┘           │
│ ┌─ MERCADO DA BOLA ─────────────────────────────────────────────────────────────┐            │
│ │ (manchete do mundo vivo, se ativa)                                             │            │
│ │ Torcida  [=========-----]  64                                                  │            │
│ │ • Fulano  Santos → Benfica · R$ 45 mi                                          │            │
│ │ • ... (até 6 movimentações)                                                    │            │
│ └────────────────────────────────────────────────────────────────────────────────┘            │
│ [MANDO NEWS] Título da notícia mais recente…                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ (A) Selecionar (B) Voltar (X) Avançar dia (RT) Sub-menu (☰) Pausa               ✔ SALVO       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Em largura ≤ 760 px a grade vira 2 colunas: `'fix fix' / 'adv man' / 'inb inb' / 'sq tab'` (linhas de no mínimo 150 px, a página rola).

## Elementos

### Contexto global (fora do componente, mas visível com a Central)

- **Header (`.app-header`)**: nova marca horizontal `logo-mando.png`, ou símbolo compacto `logo-mando-160.png` até 1000px, sem texto duplicado; navegação `.main-nav` com as 5 abas (`CENTRAL`, `TIME`, `TRANSFERÊNCIAS`, `ESCRITÓRIO`, `TEMPORADA`) entre dicas de ombro L1/R1 (`ControllerButtonHint previousTab/nextTab`, só aparecem com controle); ponto laranja `.nav-dot` em `ESCRITÓRIO` quando há mensagem `important && !resolved`; bloco `.club-header` com `Badge` pequeno do clube, data curta (`dateLabel(career.date)`, ex. "04 de nov. de 2026") e caixa (`money(finances[clubId].cash)`, ex. "R$ 12,3 mi"); ícones de status (`WifiOff` se offline, `Gamepad2` aceso em lime quando há controle conectado).
- **Faixa demo (`.demo-strip`)**: se `career.mode === 'demo'`, texto fixo "DEMONSTRAÇÃO · Atletas e finanças sintéticos" (amarelo) acima da Central.
- **Footer (`.app-footer`)**: dicas de botões `Selecionar` (confirm), `Voltar` (back), `Avançar dia` (secondary — texto fixo, não muda com o modo de avanço), `Sub-menu` (nextView), `Pausa` (menu); à direita `.save-status` com `LoaderCircle` girando "SALVANDO", `CheckCircle2` "SALVO" ou `X` "ERRO NO SAVE".
- **Toast (`.toast`)**: avisos (`notice`, verde, somem em 2,6 s) e erros (`error`, vermelho, 4 s), no topo central, sem botão de fechar.

### 1. Faixa de título (`.central-strip`)
- `h1.screen-title`: "Bom trabalho, {manager.firstName}" (CSS em caixa alta, itálico, fonte display).
- `.strip-meta`: `.live-dot` (bolinha lime pulsando) + "TEMPORADA {season} · {fase} · {data longa em maiúsculas}".
  - Fase: `ENCERRADA` se `seasonEnded`; `PRÉ-TEMPORADA` se `date < "{season}-01-11"`; senão `EM ANDAMENTO`.
  - Data: `dateLabel(date, true).toUpperCase()` → ex. "04 DE NOVEMBRO DE 2026".

### 2. Tile do próximo jogo (`button.tile.tile-blue.fixture-tile`, área `fix`)
- Tem `data-autofocus`: é o elemento focado ao entrar na tela com controle.
- Dados: `fixture = nextFixture(career)` (primeiro jogo sem resultado do clube), `home`/`away` = `clubById(world, ...)`, `label = fixtureLabel(fixture)` (`{name, stage}`), `isMatchDay = fixture.date <= career.date`.
- `.tile-label`: ícone `Radio` (14) + "HOJE É DIA DE JOGO" (se `isMatchDay`) ou "PRÓXIMO JOGO"; à direita `<em>` com `label.stage` em maiúsculas (ex. "RODADA 32", "GRUPO B · 1º JOGO", "PLAYOFF DE ACESSO", "OITAVAS · 2º JOGO") ou "FIM DA TEMPORADA" se não há jogo.
- Com jogo: `.matchup` (grid 3 colunas) — escudo `Badge size="large"` + nome do mandante; texto "VS" (`.versus`, lime com brilho); escudo + nome do visitante. Abaixo, `.fixture-meta`: "{NOME DA COMPETIÇÃO} · {data curta} · {estádio do mandante}" (ex. "BRASILEIRÃO SÉRIE A · 08 de nov. de 2026 · Maracanã").
- Sem jogo (fim do calendário): `.season-complete` com ícone `Trophy` (64) e "O apito final de {season}.".
- Escudo: imagem real (`clubLogo(id)`) quando existe; senão círculo com a cor do clube, sigla e "• • •".

### 3. Tile de avanço (`button.tile.advance-tile`, área `adv`)
- `disabled` quando `busy`.
- **Cor** (classe), avaliada nesta ordem: `tile-pink` se demitido → `tile-green` se modo automático → `tile-orange` se dia de jogo → `tile-pink` se há decisão pendente → `tile-green`.
- **Rótulo** (`.tile-label`) e **título** (`h2`), avaliados nesta ordem:

| Condição (primeira verdadeira) | Rótulo | Título h2 | CTA (`.tile-cta`) | Ação ao clicar |
|---|---|---|---|---|
| `sacked` | CARGO ENCERRADO | Escolher novo clube | "{jobOffers.length} propostas na Diretoria" | `onTab(3)` (Escritório; abre na aba Diretoria) |
| modo `auto` (e não encerrada/demitido) | MODO AUTOMÁTICO | Simular temporada | "Continuar · START muda o modo" (ou "{n} ação necessária" se houver pendência) | `onAdvance` (inicia simulação contínua) |
| decisão pendente (`important && !resolved`) | UMA DECISÃO ESPERA POR VOCÊ | Abrir escritório | "{n} ação necessária" | `onTab(3)` |
| `seasonEnded` | FÉRIAS ACABARAM | Iniciar {season+1} | "Nova temporada" | `onNewSeason` |
| dia de jogo | O ESTÁDIO ESTÁ PRONTO | Dia de jogo | "Continuar · START muda o modo" | `onMatch` |
| modo `event` | O CLUBE NÃO PARA | Avançar até o evento | "Continuar · START muda o modo" | `onAdvance` |
| modo `day` | O CLUBE NÃO PARA | Avançar dia | "Continuar · START muda o modo" | `onAdvance` |

  - CTA tem prioridade própria: `busy` → "Processando…"; `sacked` → propostas; pendência → "{n} ação necessária" (sem plural); `seasonEnded` → "Nova temporada"; senão "Continuar · START muda o modo".
- `.advance-dates`: dia atual e dia seguinte lado a lado, ex. "04 / NOV." `CircleArrowRight` (34, traço 1.6) "05 / NOV." — número = `date.slice(8)`, mês = `toLocaleDateString('pt-BR', {month:'short'})` em maiúsculas. Sempre mostra +1 dia, mesmo nos modos evento/automático, em dia de jogo ou com a temporada encerrada.

### 4. Tile do manager (`button.tile.tile-purple.manager-tile`, área `man`, ocupa as 2 linhas)
- `.tile-label`: "MANAGER · {club.short}" (sigla do clube).
- `ManagerPortrait`: se `manager.avatar` existe, `<img class="manager-portrait photo">` (retrato gerado por IA); senão SVG de silhueta com iniciais (cor do traje: `Agasalho` verde `#1b9e5a`, `Camisa social` `#e9eef7`, `Terno azul` `#13285e`). Posicionado absoluto ocupando o tile abaixo do rótulo.
- `.manager-title` (faixa com degradê roxo na base): nome em duas linhas (`firstName` / `lastName`), "CONFIANÇA {round(confidence)}%" em lime, `<meter min=0 max=100 value=confidence>`.
- Clique → `onTab(3)` (Escritório).

### 5. Prévia de mensagens (`section.tile.tile-glass.inbox-preview`, área `inb`)
- Não é botão (é `section`); só as linhas são focáveis.
- `.tile-label`: `MessageSquare` (14) + "MENSAGENS" + `b.count` (bolha laranja) com o total de **não lidas** (`!read`).
- `.inbox-rows`: as **4 primeiras** mensagens de `career.messages` (ordem do array = mais recente primeiro). Cada `button.inbox-row`:
  - `.message-indicator` (bolinha 8 px; laranja com brilho se `important && !resolved`, senão branca translúcida).
  - `small`: "{from} · {data curta}"; `strong`: `title` (uma linha com reticências).
  - Clique → `onTab(3)` (não seleciona aquela mensagem específica no Escritório).
- Rola internamente (`overflow: auto`) se não couber.

### 6. Tile "Seu time" (`button.tile.tile-orange.squad-preview`, área `sq`)
- `.tile-label`: `Users` (14) + "SEU TIME" + `<em>` com `tactic.formation` (ex. "4-3-3").
- `.big-stat`: média arredondada de `overall(p, p.position, career.players[p.id])` sobre `squad(career, world)` + legenda "OVR MÉDIO".
- `.tile-sub`: "{n} atletas · {m} lesionados" (`injuryDays > 0`).
- `.tile-cta`: "GERENCIAR" + `ArrowRight` (16). Clique → `onTab(1)`.

### 7. Tile da tabela (`button.tile.tile-cyan.table-preview`, área `tab`)
- `.tile-label`: `Trophy` (14) + "SÉRIE {club.league}" (A ou B).
- `.big-stat`: "{posição}º" + "NA TABELA" (posição = índice em `standings(career, world, league)` + 1).
- `.tile-sub`: "Caixa {money(cash)}".
- `.tile-cta`: "TEMPORADA" + `ArrowRight`. Clique → `onTab(4)`.

### 8. Mercado da Bola (`MarketFeed` → `section.panel.living-feed`)
- `h2` "Mercado da Bola".
- Manchete (`p.living-headline`, negrito âmbar `#b45309`): `living.headline.text`, só se `living.headline.until >= career.date`.
- Barra "Torcida" (`Bar` → `.living-bar`): rótulo, `<meter min=0 max=100 low=35 high=65 optimum=90 value=living.fans>`, valor arredondado.
- Lista (`ul`) com as **6 últimas** movimentações de `living.transfers` (mais recente primeiro). Cada `li`: **nome do jogador** (`findPlayer`, fallback "Atleta") + "{clube origem} → {clube destino}" + " · {money(fee)}" ou " · livre" (se `fee === 0`). Nome de clube via `clubById` (fallback: o próprio id, ex. destinos no exterior).
- Campos não exibidos: `date` e `kind` (`compra`/`exterior`/`retorno`/`livre`).
- Vazio: "Nenhuma movimentação recente no mercado." (muted).
- Não tem elementos focáveis.

### 9. Ticker MANDO NEWS (`.news-ticker`)
- Selo rosa `span` "MANDO NEWS" (itálico, display).
- `p`: título da primeira mensagem com `kind === 'news'` (a mais recente) ou o texto padrão "{club.name} inicia um novo projeto. A primeira decisão é sua.".
- Estático: uma linha com reticências, sem rolagem/animação. Some em telas com altura ≤ 760 px.

## Estados e variações

| Estado | Como detectar | O que muda |
|---|---|---|
| **Normal / dia comum** | sem pendências, sem jogo hoje | Tile de avanço verde "O CLUBE NÃO PARA" / "Avançar dia" ou "Avançar até o evento". Tile do jogo "PRÓXIMO JOGO". |
| **Dia de jogo** | `nextFixture.date <= career.date` | Tile do jogo "HOJE É DIA DE JOGO"; tile de avanço laranja "O ESTÁDIO ESTÁ PRONTO" / "Dia de jogo"; clicar abre o modal `prematch` ("Dia de jogo": data, formação · mentalidade, odds `MatchOdds`, botões "Coletiva pré-jogo", "Revisar escalação", "Começar partida"). Em modo `day`, □/X dá erro "Hoje é dia de jogo. Prepare a equipe e comece a partida."; em modo `event`, □/X para imediatamente com o aviso "Dia de jogo! O avanço parou." e abre o `prematch`; em modo `auto`, o jogo é simulado sem interação. |
| **Decisão pendente** | alguma mensagem `important && !resolved` | Tile de avanço rosa "UMA DECISÃO ESPERA POR VOCÊ" / "Abrir escritório" / "{n} ação necessária"; ponto laranja em ESCRITÓRIO; linha da mensagem com bolinha laranja; clicar no tile do jogo também leva ao Escritório. Se for dia de jogo **e** houver pendência, o tile fica **laranja** (a cor prioriza o dia de jogo) mas o texto é o da decisão. Em modo `auto`, a pendência não bloqueia: o automático responde "apoio" sozinho. |
| **Temporada encerrada** | `career.seasonEnded` | Faixa "ENCERRADA"; tile do jogo normalmente vira "FIM DA TEMPORADA" + troféu "O apito final de {season}."; tile de avanço verde "FÉRIAS ACABARAM" / "Iniciar {season+1}" / "Nova temporada" → `startNextSeason` + toast "Temporada {season+1} iniciada. Confira elenco e objetivos.". □/X não inicia a temporada: em `day` dá erro do motor; em `event`/`auto` para na hora com "Temporada encerrada.". |
| **Demitido** | `career.sacked` | Tile de avanço rosa "CARGO ENCERRADO" / "Escolher novo clube" / "{n} propostas na Diretoria" → Escritório (que abre direto na aba Diretoria). □/X também só leva ao Escritório (`advance` faz `setTab(3)`). |
| **Modo automático** | `prefs.advance === 'auto'` e não encerrada/demitido | Tile de avanço verde "MODO AUTOMÁTICO" / "Simular temporada" (tem prioridade sobre decisão pendente e dia de jogo). Clique/□ inicia a simulação contínua (overlay, ver doc 11). |
| **Modo evento** | `prefs.advance === 'event'` | Título "Avançar até o evento"; clique/□ inicia simulação contínua que para em jogo, decisão, mensagem nova, fim de temporada ou demissão. |
| **Modo dia** | `prefs.advance === 'day'` (padrão) | Título "Avançar dia"; cada clique/□ executa `advanceDay` uma vez. |
| **Ocupado** | `busy` | Tile de avanço desabilitado com CTA "Processando…"; indicador global `.busy-indicator` "Processando…"; `main` fica `inert`. |
| **Simulação em andamento** | `running` | Overlay inferior "Avançando…/Simulando…" (doc 11). A Central continua clicável por baixo. |
| **Sem jogos restantes** | `nextFixture` indefinido | Tile do jogo com troféu; clique leva à Temporada. |
| **Sem transferências / sem manchete / sem notícia** | listas vazias | Textos de vazio descritos acima; ticker usa a frase padrão. |
| **Mundo demo** | `mode === 'demo'` | Faixa amarela acima da tela. |
| **Tela baixa (≤ 760 px de altura)** | media query | Ticker oculto; gaps menores. |
| **Tela estreita (≤ 760 px de largura)** | media query | Grade 2 colunas, página rola; header sem marca, ombros e bloco do clube. |

### Props e lógica de avanço vindas do `App.tsx`

- `career`, `world` (= `live`, mundo da carreira com divisões atuais), `busy`.
- `onAdvance` = `advance()`: se `sacked` → `setTab(3)`; se modo `day` → `setCareer(advanceDay(career, live))` (erros viram toast vermelho: decisão pendente, dia de jogo, temporada encerrada); se `event`/`auto` → zera contador `played` e liga `running` (loop de `advanceStep` a cada 110 ms).
- `onMatch`: se há pendência → `setTab(3)`; se jogo é hoje (`f.date <= date`) → `setPopup('prematch')`; senão → `setTab(4)` (Temporada).
- `onTab(n)` = `setTab(n)`.
- `onNewSeason`: `startNextSeason(career, live)` + toast "Temporada {season+1} iniciada. Confira elenco e objetivos.".
- Paradas do avanço contínuo: `match` → popup `prematch`; `decision`/`message`/`sacked` → aba Escritório; `season` → permanece. Avisos: ver doc 11.

## Interações

### Mouse / toque
- Clique em qualquer tile-botão executa a ação descrita (fixture, avanço, manager, linhas de mensagem, seu time, tabela). Hover: `brightness(1.1)`.
- Não há botão de mouse para abrir a Pausa nem as Preferências de avanço (só teclado Esc / controle).

### Teclado
- Setas: foco espacial entre tiles (FocusManager).
- Enter/Espaço: ativa o tile focado (comportamento nativo do botão).
- `Esc`: "voltar" → abre a Pausa (sem modal aberto).
- `[` / `]`: aba anterior / próxima.
- `q` / `e`: sub-abas (não há `.segmented` na Central; sem efeito).
- Não há tecla para □ (avançar) nem para START (preferências).

### Controle (PS5 / Xbox)

| Botão PS5 | Botão Xbox | Ação na Central |
|---|---|---|
| ✕ | A | Ativa o tile/linha focado. Ao entrar, o foco vai para o tile do próximo jogo (`data-autofocus`). |
| ○ | B | Abre o modal **Pausa** (se não há modal/detalhe/simulação). Durante simulação: para. |
| □ | X | **Avançar** (`advance()`): modo dia = 1 dia; evento/auto = inicia simulação contínua; demitido = vai ao Escritório. Atenção: não segue a lógica do tile (não abre Escritório por pendência, não abre `prematch`, não inicia temporada) — nesses casos gera toast de erro (modo dia) ou parada imediata (evento/auto). Durante simulação: para. |
| △ | Y | Vai para o Escritório (aba 3). |
| L1 / R1 | LB / RB | Aba anterior / próxima (circular entre as 5). Bloqueado em partida, com popup, detalhe de jogador ou `busy`. |
| L2 / R2 | LT / RT | Ciclo de sub-abas `.segmented` — sem efeito na Central. |
| Options | ☰ (Menu) | **Na Central abre "Preferências de avanço"** (`prefs`); se `prefs` ou `pause` já estiver aberto, fecha. Nas outras abas, abre/fecha a Pausa. Durante simulação: para. |
| D-pad / analógico esquerdo | idem | Move o foco espacialmente entre tiles e linhas da prévia de mensagens. |
| Analógico direito (vertical) | idem | Rola a área rolável mais próxima (ex.: `.inbox-rows`, painel Mercado da Bola). |
| R3 | RS | Sem efeito (só no teclado virtual). |

- Vibração: `rumble('tab')` ao trocar abas, `confirm` ao confirmar, `whistle` quando o avanço contínuo para, `error` em erro, `goal` ao desbloquear conquista.

## Classes CSS e visual atual

- Paleta (`:root`): fundo `--bg0 #040b33`, azuis `--bg1 #0a2a8f`/`--bg2 #0b56c9`, `--lime #c6ff00` (foco/destaques), `--cyan #00d2ff`, `--orange #ff8a00`, `--pink #ff2e88`, `--purple #8b45ff`, `--yellow #ffd400`. Fontes: `--display` "Saira Condensed" (títulos itálicos 800 em caixa alta), `--body` "Saira Semi Condensed".
- `.screen.central` (coluna flex, gap 10); `.central-strip`; `.screen-title` (itálico 800, `clamp(26px,3vw,44px)`); `.strip-meta`; `.live-dot` (pulso lime).
- `.central-grid`: grid `2fr 1fr 1fr 1.15fr` × `minmax(0,1.15fr) minmax(0,1fr)`, áreas `fix/adv/man/inb/sq/tab`, gap 14.
- `.tile`: cantos 4 px, padding 18×20, sombra profunda, `::before` com reflexo diagonal + listras finas. Variantes de degradê: `.tile-blue`, `.tile-green`, `.tile-orange`, `.tile-purple`, `.tile-pink`, `.tile-cyan`, `.tile-glass` (vidro com blur). Foco: `scale(1.025)`, contorno branco 4 px + halo lime 8 px.
- `.tile-label` (800 14 px, espaçamento 1.6, maiúsculas; `em` à direita), `.tile-cta` (selo escuro 22% no rodapé), `.tile-sub`, `.big-stat` (itálico 800 `clamp(48px,6vh,76px)`).
- `.matchup`, `.versus` (lime com brilho), `.fixture-meta`, `.season-complete`, `.club-badge.large`.
- `.advance-tile h2`, `.advance-dates` (números grandes 34–52 px).
- `.manager-tile` (retrato absoluto), `.manager-title` (degradê roxo, nome itálico 26 px, confiança lime, `meter` 6 px).
- `.inbox-preview`, `.inbox-rows`, `.inbox-row`, `.message-indicator(.important)`, `.count`.
- `.panel.living-feed`, `.living-headline` (`#b45309`), `.living-bar` (grid 110px/1fr/36px).
- `.news-ticker` (fundo azul escuro 60%, selo `--pink`).
- Animação de entrada da `main`: `stage-in` (desliza 46 px da direita, 0,32 s) a cada troca de aba.

## Regras que o redesign deve preservar

1. Os 6 blocos de informação (próximo jogo, avanço, manager, mensagens, elenco, tabela) + mercado + notícias, com todos os dados listados.
2. A **máquina de estados do tile de avanço** (demitido > automático > decisão > temporada encerrada > dia de jogo > modo evento/dia), com textos de rótulo, título e CTA equivalentes e as mesmas ações.
3. Tile do próximo jogo com escudos reais, nomes, competição, fase/rodada, data e estádio; estado "fim da temporada".
4. Foco inicial do controle no tile do próximo jogo; navegação espacial por D-pad entre todos os blocos clicáveis.
5. Atalhos globais: □/X avança, △/Y Escritório, L1/R1 abas, START abre Preferências de avanço **nesta tela**, ○/B Pausa.
6. Indicação clara de mensagens não lidas e de decisões pendentes (contador + destaque laranja), e do modo de avanço atual ("START muda o modo").
7. Retrato do manager (foto IA ou silhueta com iniciais) e barra de confiança da diretoria.
8. Avisos em toast que somem sozinhos (2,6 s / 4 s), sem botão de fechar.
9. Funcionar com o avanço contínuo rodando (overlay) e com `busy` (bloqueio do tile de avanço).
10. Layout responsivo (2 colunas em telas estreitas).

## Problemas atuais e oportunidades

1. **□/X e o tile de avanço divergem**: o botão do controle chama `advance()` direto e gera erro em dia de jogo/decisão/temporada encerrada (modo dia), enquanto o tile resolve a situação. Sugestão: □ executar a mesma `advanceAction` do tile (como o "Continuar" do FIFA).
2. **Dica do footer fixa "Avançar dia"** mesmo em modo evento/automático, dia de jogo ou demitido. Deveria refletir a ação atual ("Jogar", "Abrir escritório", "Simular temporada"…).
3. **Cor × texto inconsistentes**: dia de jogo + decisão pendente gera tile laranja com texto de decisão. Unificar prioridade.
4. **Datas do tile de avanço** sempre "hoje → amanhã", mesmo em modo evento/automático (deveria mostrar "até o próximo evento"/"até o fim da temporada") e com temporada encerrada.
5. CTA "{n} ação necessária" sem plural.
6. **Prévia de mensagens** leva ao Escritório sem abrir a mensagem clicada; deveria abrir já selecionada (como o "Inbox" do FIFA). A prévia é uma `section` não clicável como um todo.
7. **Sem botão de mouse para Pausa e Preferências de avanço**; só Esc/controle. FIFA mostra a legenda de START clicável.
8. **Mercado da Bola** é um painel de texto "não-FIFA": sem escudos, sem foto, sem data, sem tipo (compra/exterior/retorno/livre) e não focável pelo controle. Oportunidade: virar um tile "Transfer News" com cards de escudo→escudo e valor, ou um carrossel.
9. **Ticker MANDO NEWS estático** (uma única manchete truncada, some em telas baixas). Oportunidade: ticker rolando com as últimas notícias, transferências e resultados, como a barra inferior do FIFA 14.
10. Manchete do mundo vivo em `#b45309` tem baixo contraste sobre o azul escuro.
11. A barra "Torcida" está escondida dentro do mercado; poderia ser um medidor próprio (humor da torcida) ao lado da confiança.
12. Não há tile de "Último resultado", "Artilheiro"/"Destaque do elenco", objetivos da diretoria ou calendário dos próximos jogos — típicos do hub FIFA.
13. O tile da tabela mostra só a posição; poderia mostrar mini-tabela (vizinhos acima/abaixo) e pontos.
14. O MarketFeed empurra a grade para cima e reduz os tiles em telas menores (main com `overflow: hidden`).
15. Ao trocar de aba a tela inteira remonta (animação `stage-in`); manter o foco/estado seria mais fluido.
