# Design System do Mando (estado atual)

## Resumo

Mando é um jogo web (React + TypeScript + Vite, PWA) de carreira de técnico no futebol brasileiro 2026. A identidade visual atual imita o hub do **FIFA 14**: fundo azul profundo com feixes de luz animados, tiles grandes e coloridos com gradiente diagonal, tipografia condensada em itálico e caixa alta, navegação por abas no topo e uma barra de dicas de controle no rodapé. Tudo foi pensado para funcionar com **controle de PS5 (DualSense) ou Xbox**, além de mouse, toque e teclado. Este documento lista tokens, classes base, componentes compartilhados e o mapeamento global do controle, que valem para todas as telas.

> Público: "amantes do FIFA". Tudo deve parecer FIFA. O redesign deve manter esse DNA e elevar o acabamento.

## Arquivos-fonte

| Arquivo                                                | Papel                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/index.css` + 48 arquivos em `src/styles/`  | Tokens (`:root`), reset, botões, inputs, shell, tiles, painéis, modais, cards, telas, responsivo. Era o antigo `src/styles.css` (~6.300 linhas), dividido sem mudar a cascata; veja a tabela "Mapa do antigo styles.css" abaixo |
| `src/main.tsx`                                         | Carrega as fontes (`@fontsource/saira-condensed` 500/600/700/800 e `@fontsource/saira-semi-condensed` 400/500/600) e o `ErrorBoundary` (tela `.fatal-error`)                                                                    |
| `index.html`                                           | Splash de boot: nova marca horizontal `logo-mando.png` até 520px, sem distorcer a proporção, pulsando (`@keyframes boot`) sobre fundo noturno; `theme-color #0b1020`; título "Mando \| Carreira de manager"                     |
| `src/components/ui.tsx`                                | `money`, `dateLabel`, `Badge`, `Tile`, `SectionTitle`, `Metric`, `Modal`, `ManagerPortrait`                                                                                                                                     |
| `src/components/controls.tsx`                          | `OptionCycler`, `TacticSlider`, `ChipGroup`, `NumberStepper`, `ShirtNumberDial`, `niceStep`                                                                                                                                     |
| `src/components/PlayerCard.tsx`                        | `PlayerCard`, `PlayerPicker`, `positionOrder`, `shortName`, `byPosition`, `roleFits`                                                                                                                                            |
| `src/components/PlayerFace.tsx`                        | `PlayerFace`, `playerFaceUrl`                                                                                                                                                                                                   |
| `src/components/cardTier.ts`                           | `cardTier(ovr)` → classe de nível do card                                                                                                                                                                                       |
| `src/components/HeatMap.tsx`                           | Mapa de calor SVG                                                                                                                                                                                                               |
| `src/components/LivePitch.tsx`                         | Campinho 2D animado da partida                                                                                                                                                                                                  |
| `src/components/PortraitCamera.tsx`                    | Modal de webcam para o retrato do manager                                                                                                                                                                                       |
| `src/components/LivingPanels.tsx`                      | Histórico da carreira e análise pós-jogo                                                                                                                                                                                        |
| `src/controller/GamepadProvider.tsx`                   | Leitura do gamepad, ações, teclado virtual, vibração, sons                                                                                                                                                                      |
| `src/controller/FocusManager.ts`                       | Navegação espacial (foco por direção)                                                                                                                                                                                           |
| `src/controller/xboxMapping.ts`, `dualsenseMapping.ts` | Rótulos dos botões e índices do mapeamento padrão                                                                                                                                                                               |
| `src/controller/ControllerButtonHint.tsx`              | Dica de botão (`<kbd>` colorido + rótulo)                                                                                                                                                                                       |
| `src/controller/dualsenseHid.ts`                       | DualSense via WebHID (vibração real no Chrome/Edge, Bluetooth)                                                                                                                                                                  |

---

## 1. Tokens (variáveis CSS em `:root`)

Há **um único tema** (escuro, `color-scheme: dark`). Não existe troca de tema nem `data-theme`.

### Cores de fundo e texto

| Token       | Valor                   | Uso                                      |
| ----------- | ----------------------- | ---------------------------------------- |
| `--bg0`     | `#040b33`               | Fundo mais escuro (base do `body`)       |
| `--bg1`     | `#0a2a8f`               | Azul do gradiente do shell               |
| `--bg2`     | `#0b56c9`               | Azul claro (câmera, acentos)             |
| `--ink`     | `#ffffff`               | Texto principal                          |
| `--ink-2`   | `rgba(255,255,255,.78)` | Texto secundário, labels                 |
| `--ink-3`   | `rgba(255,255,255,.55)` | Texto terciário, abas inativas, `.muted` |
| `--glass`   | `rgba(6,22,86,.72)`     | Fundo de `.panel`                        |
| `--glass-2` | `rgba(255,255,255,.08)` | Vidro claro                              |
| `--line`    | `rgba(255,255,255,.14)` | Bordas finas                             |

### Cores de acento

| Token      | Valor     | Uso típico                                                |
| ---------- | --------- | --------------------------------------------------------- |
| `--blue`   | `#0a8dff` | Acento azul                                               |
| `--cyan`   | `#00d2ff` | Borda superior de painel, `.eyebrow`, brilho da aba ativa |
| `--green`  | `#5ed11c` | Verde                                                     |
| `--lime`   | `#c6ff00` | **Cor de destaque/foco** (sublinhado, valores)            |
| `--orange` | `#ff8a00` | Alertas, `.nav-dot`, `.count`, `.status-pill`             |
| `--pink`   | `#ff2e88` | Acento de destaque e tile rosa                            |
| `--purple` | `#8b45ff` | Tile roxo                                                 |
| `--yellow` | `#ffd400` | Estrelas, aviso PWA                                       |
| `--red`    | `#ff3b4e` | Erro, excluir                                             |
| `--focus`  | `#c6ff00` | Contorno de foco                                          |

### Tipografia

| Token       | Valor                                                       | Uso                                              |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `--display` | `'Saira Condensed', 'Arial Narrow', 'Segoe UI', sans-serif` | `h1/h2/h3`, `strong`, `button`, `.eyebrow`, `th` |
| `--body`    | `'Saira Semi Condensed', 'Segoe UI', sans-serif`            | Corpo (15px, line-height 1.35)                   |

Padrões recorrentes: títulos `italic 800`, `text-transform: uppercase`, `letter-spacing` 0.5–3px. `.screen-title`: `italic 800 clamp(26px,3vw,44px)/1`. `.section-title h1`: `clamp(24px,2.6vw,38px)` itálico caixa alta + ponto final lima (`.title-dot`) quando o título não termina em pontuação. `.eyebrow`: 12px, 700, letter-spacing 2px, ciano, caixa alta.

### Espaçamento e forma

- `--pad-x: clamp(14px, 2.6vw, 44px)` — padding lateral do header, stage e footer.
- Raio de borda baixo e "quadradão" (2–6px) na maior parte: botões e cards de preferências 3px, painéis/tiles 4px, cards 6px. Exceções arredondadas: `.pill` 20px e `kbd` circular.
- Sombra padrão de bloco: `0 14px 34px rgba(0,4,30,.38)`; modal `0 30px 80px rgba(0,0,0,.6)`.
- Sem scroll global: `html, body, #root { height:100%; overflow:hidden }`; scrollbars finas (6px) brancas translúcidas.
- `body { user-select: none }` (exceto inputs).

### Fundo do jogo (`.game-shell` + `.bg-stage`)

- Shell: `height: 100dvh`, grid de 3 linhas (`header / main / footer`). Fundo: radial azul `#1b8cff` no canto superior direito + radial roxo `#6a1fd8` no inferior esquerdo + linear `160deg` de `--bg1` → `#071a66` → `--bg0`.
- `.bg-stage::before`: grade quadriculada de 64px com linhas brancas a 4,5% e máscara que some nas bordas.
- 3 feixes `.beam.b1/.b2/.b3` (ciano, lima, rosa), 60vw × 26vh, `blur(36px)`, rotacionados −18°, atravessando a tela (`@keyframes beam`, 16s/21s/25s, alternate).

### Animações (keyframes)

| Nome                                                 | Efeito                                                                      | Onde                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `beam`                                               | feixes de luz cruzando o fundo                                              | `.beam`                                                  |
| `stage-in`                                           | entra deslizando da direita 46px + fade (0.32s, `cubic-bezier(.2,.8,.2,1)`) | `main.stage` a cada troca de tela/aba, `.dialog` (0.26s) |
| `fade`                                               | fade-in 0.2s                                                                | `.modal-backdrop`                                        |
| `toast-in`                                           | desce 14px + fade 0.3s                                                      | `.toast`                                                 |
| `pulse`                                              | opacidade 0.35 no meio                                                      | `.live-dot`, retrato gerando                             |
| `spin`                                               | rotação 0.9s                                                                | ícones `LoaderCircle` (`.spin`)                          |
| `card-shine`                                         | faixa de brilho diagonal atravessando o card (3.2s, infinito)               | `.card-rare::after`                                      |
| `typing`, `swap-pulse`, `roster-open`, `caret-blink` | digitação, troca de jogador, expandir linha, cursor do teclado virtual      | diversos                                                 |

`@media (prefers-reduced-motion: reduce)` zera todas as animações/transições.

---

## 2. Controles base (CSS)

### Botão padrão (`button`)

- Fundo `rgba(255,255,255,.12)`, texto branco, `padding 9px 16px`, 15px, 700, caixa alta, letter-spacing .4px, raio 3px, `inline-flex` com `gap 8px` (ícone + texto).
- Hover: `filter: brightness(1.12)`. Disabled: `opacity .45`, `cursor: not-allowed`.
- Transição de `transform/background/box-shadow/filter` 0.14s.

| Variante                          | Aparência                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.primary`                        | Gradiente lima `#d8ff3a → #8fdc00`, texto azul-escuro `#06204d`, sombra lima. `.primary.big` = `12px 26px`, 18px |
| `.danger`                         | Gradiente vermelho `#ff5a6a → #d61b3a`                                                                           |
| `.active` / `[aria-pressed=true]` | Fundo branco, texto `#082062`                                                                                    |
| `.ghost-button` / `.text-button`  | Transparente, texto `--ink-2`; hover com fundo 12%                                                               |

### Foco (essencial para controle)

- `:focus-visible` e, quando a entrada é controle/teclado (`.input-xbox :focus`, `.input-playstation :focus`, `.input-keyboard :focus`): contorno **3px lima** `--focus`, offset 2px, halo `0 0 0 6px rgba(198,255,0,.22)` + glow `0 0 28px`. Com mouse, foco não aparece.
- `button.tile:focus`: `scale(1.025)`, contorno **4px branco**, halo lima 8px e sombra forte.
- `.player-card:focus`: `scale(1.05)`.
- `.world-option:focus`: `scale(1.03)`, contorno branco 4px.

### Inputs

`input/select/textarea`: largura 100%, fundo `rgba(0,10,50,.55)`, borda 2px branca 16%, raio 3px, 16px; foco = borda lima. `textarea` sem resize. `label`: coluna, 13px display 700 caixa alta, cor `--ink-2`.

### Blocos compartilhados

| Classe                   | Aparência                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.panel`                 | Vidro `--glass`, borda 1px `--line`, **borda superior 3px ciano**, raio 4px, `padding 16px 18px`, `backdrop-filter: blur(10px)`, sombra; rola internamente (`overflow:auto`). `h2` 22px 800 caixa alta |
| `.panel-heading`         | Linha título + ações                                                                                                                                                                                   |
| `.segmented`             | Sub-abas em "pílula": fundo `rgba(0,8,46,.5)`, botões transparentes; ativo = gradiente branco→`#d8e6ff`, texto azul. `.segmented.compact` menor (ignorado pelo L2/R2)                                  |
| `.pill` / `.status-pill` | Etiqueta arredondada 12px caixa alta; `.pill.success` e `.status-pill.open` = lima; `.status-pill` padrão = laranja                                                                                    |
| `.count`                 | Bolinha laranja com número                                                                                                                                                                             |
| `.metric`                | Caixa com gradiente claro e borda esquerda lima; label 12px, valor `clamp(20px,2vw,30px)`                                                                                                              |
| `.empty-state`           | Centralizado, texto `--ink-2`                                                                                                                                                                          |
| `.button-row`            | Linha de botões com `gap 10px`, wrap                                                                                                                                                                   |
| `.live-dot`              | Bolinha lima pulsando (`.paused` laranja)                                                                                                                                                              |
| `.carousel`              | Faixa horizontal com `scroll-snap` (proximity), sem scrollbar, filhos `flex: 0 0 auto`; o foco centraliza o item (`scrollIntoView inline:center`)                                                      |
| `.muted`, `.small`       | Texto `--ink-3`; 13px                                                                                                                                                                                  |

### Tiles (`.tile`)

Bloco-botão estilo hub do FIFA: `flex column`, `padding 18px 20px`, raio 4px, sombra, `overflow:hidden`; `::before` aplica um brilho diagonal + listras finas a 135°. Variantes de cor (gradiente 135°):

| Classe                | Gradiente                     |
| --------------------- | ----------------------------- |
| `.tile-blue` (padrão) | `#22a6ff → #0b5ce6 → #0a3fb8` |
| `.tile-green`         | `#8be22a → #34b51f → #138a2c` |
| `.tile-orange`        | `#ffb32a → #ff7a00 → #e64a00` |
| `.tile-purple`        | `#a66bff → #7234ec → #4c17b8` |
| `.tile-pink`          | `#ff5fa8 → #f0257a → #b80d5c` |
| `.tile-cyan`          | `#3fe6ff → #00a8e0 → #0074b8` |
| `.tile-glass`         | Vidro translúcido com borda   |

Partes internas: `.tile-label` (14px 800 caixa alta, letter-spacing 1.6px; `em` à direita), `.tile-title` (`clamp(22px,2.2vw,32px)` itálico caixa alta), `.tile-cta` (rodapé "JOGAR →" com fundo preto 22%), `.tile-sub`, `.tile-icon` (círculo 110px branco 18%), `.big-stat` (número gigante itálico), `.tile-arrow` (ícone `ArrowUpRight` no componente `Tile`).

---

## 3. Componentes compartilhados (`src/components/ui.tsx`)

### Formatadores

- `money(value, compact = true)` → `Intl.NumberFormat('pt-BR', BRL)`; compacto: "R$ 12,5 mi", "R$ 850 mil" (1 casa). Não compacto: sem centavos.
- `dateLabel(date, long = false)` → `pt-BR`, UTC: curto "01 de jan. de 2026"; longo "01 de janeiro de 2026".

### `Badge({ club, size: 'normal' | 'large' | 'small' })`

- Se existe escudo real (`clubLogo(club.id)` → `/assets/escudos/<arquivo>` via `club-logos.json`): `<span class="club-badge has-logo {size}"><img></span>` com `drop-shadow`, sem recorte.
- Sem escudo: escudo genérico desenhado em CSS (`clip-path` de brasão, fundo branco→`#dfe8ff`), sigla `club.short` na cor `--club-color` e "• • •" embaixo.
- Tamanhos: normal 48×56, `large` 84×98, `small` 26×31 (sem os pontinhos).

### `Tile({ children, className, onClick, label })`

Botão `.tile` com `ArrowUpRight` (`.tile-arrow`) se clicável; senão `<section class="tile">`. (Hoje pouco usado; MainMenu monta tiles direto.)

### `SectionTitle({ kicker, title, children })`

`.eyebrow` (kicker) + `h1` com ponto lima automático; `children` à direita.

### `Metric({ label, value, note })`.

### `Modal({ title, children, onClose, wide })`

- Estrutura: `.modal-backdrop` (fixo, `z-index 50`, fundo `rgba(2,6,30,.72)` + `blur(6px)`, fade 0.2s) > `section.dialog[data-focus-scope="modal"][role=dialog][aria-modal]` (largura `min(600px,100%)`, `.wide` = `min(980px,100%)`, `max-height 92dvh`, gradiente azul `#0d3bb0 → #071a66 → #050f3f`, **borda superior 4px lima**, entra com `stage-in`).
- `.dialog-heading`: `h2` itálico 28px caixa alta + botão `.text-button[data-dialog-close]` "‹ Voltar" (`ChevronLeft`). **Não existe X**; o fechamento é por "Voltar" ou ○/B/Esc.
- `.dialog-body`: rola, `gap 12px`.
- Foco automático ao abrir: primeiro `[data-autofocus]`; senão o primeiro botão habilitado/input/select do corpo; senão o primeiro botão. Ao fechar, devolve o foco ao elemento anterior.
- Enquanto há modal, o `FocusManager` restringe a navegação ao modal do topo; `Tab` cicla dentro dele.

### `ManagerPortrait({ manager, large })`

- Com `manager.avatar` (URL gerada por IA): `<img class="manager-portrait photo">` com `object-fit: contain`, alinhada embaixo ao centro, sombra.
- Sem avatar: SVG `.manager-portrait.silhouette` (320×400): corpo com cor da roupa (`Terno azul` `#13285e`, `Agasalho` `#1b9e5a`, `Camisa social` `#e9eef7`), camisa branca, gravata vermelha (exceto Agasalho), cabeça em gradiente branco→azul claro, cabelo azul-escuro e **iniciais** do manager (54px, opacidade .55) sobre o rosto.

---

## 4. Controles de formulário "de console" (`controls.tsx`)

Todos substituem `<select>`/`<input type=number>` para serem operáveis no controle sem travar a navegação.

| Componente                                                                               | Visual                                                                                                                                                                     | Interação                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptionCycler({label, value, options, onChange})`                                        | `.option-cycler`: botão largo com `‹ valor ›` (setas lima) e pontinhos (`.cycler-dots`, até 12 opções; ativo = barrinha lima de 14px)                                      | Navegar passa direto. **✕/A** (ou □/X) entra no modo edição (`.editing`, `aria-pressed`); **←/→** trocam a opção (circular); ✕/A ou ○/B saem; perder o foco sai. Mouse: clicar nas setas troca direto                                                 |
| `ChipGroup({label, value, options, onChange})`                                           | `.chip-group` > `.chips`: botões lado a lado; ativo = gradiente branco, texto azul                                                                                         | Cada chip é um botão focável (`role=radio`); ✕/A seleciona                                                                                                                                                                                            |
| `NumberStepper({label, value, onChange, min, max, step, format, placeholder, optional})` | `.number-stepper` > `.stepper-row` (grid `34px 1fr 34px`): `−` input `+`; input centralizado 17px; `.stepper-format` lima abaixo; `.stepper-hint` "← → ajustar · □/B sair" | ✕/A abre o **teclado numérico virtual**; **□/X** entra no modo ajuste (←/→ somam `step` ou `niceStep(valor)`); □/X ou ○/B saem. Botões −/+ são só para mouse (`tabIndex=-1`). Remove zeros à esquerda; `optional` permite vazio = `null` ("Qualquer") |
| `TacticSlider({label, value, min=1, max=5, onChange})`                                   | `.tactic-slider`: cabeçalho label + "v / max", trilha de segmentos `.ts-track i.on`, dica `.ts-hint`                                                                       | ✕/A ou □/X entra em edição; ←/→ ajustam imediatamente; ✕/A, □/X ou ○/B saem. No mouse, o primeiro clique entra em edição; outro clique na trilha altera o valor                                                                                       |
| `ShirtNumberDial({value, onSave, conflict})`                                             | Número gigante da camisa `.dial-number` com setas no modo edição; `.dial-hint`, `.dial-note` (conflito)                                                                    | ✕/A edita; ←/→ trocam 1–99 (circular); ✕/A salva; ○/B cancela o rascunho                                                                                                                                                                              |

---

## 5. Cards de jogador (`PlayerCard.tsx`, `PlayerFace.tsx`, `cardTier.ts`)

### Níveis por overall — `cardTier(ovr)`

| Overall | Classe        | Nome               | `--card-bg`                                                                                                  |
| ------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| ≥ 83    | `card-rare`   | **Ouro brilhante** | `#fff6c4 → #ffcf2e → #e09a00 → #6b3f00` + contorno dourado + **faixa de brilho animada** (`card-shine` 3.2s) |
| 75–82   | `card-gold`   | Ouro               | `#ffe590 → #d4a537 → #7a5512`                                                                                |
| 65–74   | `card-silver` | Prata              | `#f1f5f8 → #a9b4bc → #56636c`                                                                                |
| < 65    | `card-bronze` | Bronze             | `#e7b083 → #b06b35 → #5e3313`                                                                                |

Cada nível também define `--card-name` (cor escura translúcida da faixa do nome). As mesmas classes são aplicadas em `.player-card`, `.hub-card`, `.deal-card`, `.face-tier`, `.pitch-player`. Elas sobrescrevem as cores por setor (`.gk` laranja, `.def` azul, `.mid` verde, `.att` rosa), que hoje só aparecem se o tier não for aplicado.

### `PlayerCard({ player, career, role, onClick, active, disabled, autoFocus, badge })`

- Card **quadrado** (`aspect-ratio: 1`), raio 6px. Overall calculado por `overall(player, role || player.position, stateOf(career, player.id))`.
- **A foto é o card**: `PlayerFace` absoluto (`inset: 6% 0 0 0`), `object-fit: contain`, colada embaixo (`object-position: 50% 100%`).
- `.pc-top` no canto superior esquerdo, empilhado: `.pc-ovr` (overall, `clamp(24px,3.6vh,36px)`, 800) e `.pc-pos` (posição; mostra `role` se diferente da posição natural).
- `.pc-name` na base, `shortName(name)` (último sobrenome se o nome tem 3+ partes), caixa alta, faixa em gradiente transparente → `--card-name`.
- `.pc-badge` (opcional) no canto superior direito.
- `.pc-meta` só quando indisponível: "Lesão {injuryDays}d" ou "Suspenso {suspension}" em faixa vermelha `rgba(158,0,28,.85)` acima do nome; o card fica `.out` (cinza 70% + escurecido).
- `.active` = borda lima. **Sem número de camisa** (a prop `number` existe mas não é renderizada; `note` também não).
- `aria-label`: "Nome, POS, overall N[, status]"; `data-player={id}`.

### `PlayerPicker({ recommended, others, render, recommendedLabel='Recomendados', othersLabel='Demais atletas', extra })`

`.card-scroll` (rolagem vertical) com divisores `.grid-divider` (texto lima + linha) e `.card-grid` de **5 colunas** (`.compact` = 6; ≤1100px muda).

### `PlayerFace({ player, size: 'sm'|'md'|'lg', className })`

- Foto real se `player.id` está em `player-faces.json`: `/assets/jogadores/{id}.webp`; se a imagem falhar (`onError`) cai no fallback.
- Fora do card: círculo (30 / 48 / 120 px) com `object-fit: cover` focado no rosto.
- **Sem foto: bonequinho/silhueta SVG** (cabeça + ombros), branco translúcido (60%; 55% dentro de cards), sem sigla e com o mesmo fundo colorido da foto. Na lista de mercado usa o gradiente do nível; nos cards grandes, a silhueta fica sobre o fundo colorido do próprio card. Há regras CSS legadas para `b` (iniciais) que não são mais renderizadas.

---

## 6. Outros componentes visuais

### `HeatMap({ player, position, state, compact })`

SVG 100×140 de meio-campo vertical (grama `#0d6b34`, linhas brancas 55%), 9 manchas radiais (vermelho → amarelo → lima → ciano) com blur e `mix-blend-mode: screen`. Concentradas na função se o atleta conhece a posição; espalhadas e puxadas para a posição de origem se improvisado. Ponto branco marca a função. Legenda: "**{ROLE}** · {familiarityLabel} · {fam}%" com tom `good` (≥85, lima), `mid` (≥60, âmbar), `bad` (vermelho). Máx. 200px (compact 130px). Usado no Elenco.

### `LivePitch({ home, away, playing, speed, homePossession, goal })` (resumo)

Campo 2D horizontal em CSS (`.live-field` com meio-campo, círculo, áreas, gols) e bolinhas `.field-dot.home/.away` (`.keeper` para goleiro) com a cor de cada time, mais `.ball-dot`. Simulação visual contínua com inércia, passes, chutes e reposição; após gol leva a bola à rede. É ilustrativa — o placar oficial vem da engine. Usado na tela de Partida.

### `PortraitCamera({ style, onCapture, onClose })`

Modal "Retrato do manager" (wide). Detalhado em `04-criar-manager.md`.

---

## 7. Controle (gamepad) — mapeamento global

### Detecção de entrada

`input` ∈ `mouse | keyboard | xbox | playstation`. Vira `xbox`/`playstation` ao apertar botão/mexer analógico (PlayStation se o id contém `dualsense|dualshock|playstation|054c|wireless controller`); `keyboard` em qualquer tecla; `mouse` em pointer. A classe `input-{tipo}` vai no `.game-shell`. Controle sem `mapping === 'standard'` → aviso `.compatibility-note`. No Bluetooth em modo completo, o DualSense é lido via WebHID (`dualsenseHid.ts`).

### Ações e rótulos

| Ação                         | Índice padrão     | Xbox    | PlayStation | Comportamento global                                                                                                                                                       |
| ---------------------------- | ----------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm`                    | 0                 | A       | ✕           | Clica no elemento focado; em campo de texto abre o teclado virtual                                                                                                         |
| `back`                       | 1                 | B       | ○           | 1) sai do modo edição de um controle; 2) clica "Voltar" do modal do topo (`[data-dialog-close]`); 3) clica `[data-trap-exit]` / `main [data-back-action]`; 4) ação da tela |
| `secondary`                  | 2                 | X       | □           | Em controle editável (`data-toggle-edit`) entra/sai da edição; senão ação da tela (na carreira: **Avançar**)                                                               |
| `info`                       | 3                 | Y       | △           | Ação da tela (carreira: ir ao Escritório; criação: abrir câmera)                                                                                                           |
| `previousTab` / `nextTab`    | 4 / 5             | LB / RB | L1 / R1     | Ação da tela (carreira: trocar aba principal; criação: voltar/avançar passo)                                                                                               |
| `previousView` / `nextView`  | 6 / 7             | LT / RT | L2 / R2     | Se a tela não registrar ação: alterna o primeiro `.segmented:not(.compact)` do modal do topo ou do `main` (sub-abas, circular)                                             |
| `menu`                       | 9                 | ☰      | Options     | Ação da tela (carreira: Pausa / Preferências; para a simulação)                                                                                                            |
| `stick` (R3)                 | 11                | RS      | R3          | Só no teclado virtual: alterna letras/especiais                                                                                                                            |
| D-pad / analógico esquerdo   | 12–15 / eixos 0–1 |         |             | Move o foco (repetição a cada 180ms, zona morta .55). Em elemento `data-stepper`, ←/→ ajustam o valor                                                                      |
| Analógico direito vertical   | eixo 3            |         |             | Rola a área rolável mais próxima do foco (ou a maior visível)                                                                                                              |
| Analógico direito horizontal | eixo 2            |         |             | Evento `mando:stick-x` (telas usam via `useStickX`, ex.: trocar competição/ordenação); se ninguém tratar, rola o carrossel/área horizontal 60% da largura                  |

Botão 8 (View/Share/Create) e 10 (L3) não são usados.

**Regra especial — simulação contínua**: se existe na tela um `[data-stop-run]` (overlay de avanço), **✕/A, ○/B, □/X ou START/Options** param a simulação em qualquer tela.

### Equivalentes no teclado

Setas = mover foco; `Esc` = back; `[` / `]` = aba anterior/próxima; `q` / `e` = sub-aba anterior/próxima; `,` / `.` = analógico direito horizontal; `Tab`/`Shift+Tab` cicla dentro do modal; `Enter`/`Espaço` = clique nativo. Dentro de inputs, setas e atalhos são do campo.

### Navegação espacial (`FocusManager`)

- Elementos focáveis: botões habilitados, inputs, selects, textareas, links, `[tabindex="0"]` visíveis, fora de `[inert]` e `aria-hidden`.
- Escopo: o modal do topo (`[data-focus-scope="modal"]`), senão um `[data-focus-trap]` (painel "entrável"), senão a página.
- Ao mover: prioriza candidatos na mesma **região** (`[data-focus-region]`, `header`, `main`, `footer`, modal) e **alinhados** no eixo perpendicular (inclusive quando o painel vizinho inteiro está alinhado), depois a menor distância. Mudar de região na horizontal é penalizado. Após mover: `scrollIntoView` suave, centralizando em `.carousel`.
- `ensure()`: se o foco se perdeu (elemento removido), foca o primeiro `[data-autofocus]`, senão o primeiro do `main`. Um `MutationObserver` chama isso a cada mudança do DOM.
- Atributos que o redesign deve respeitar: `data-autofocus`, `data-focus-scope="modal"`, `data-dialog-close`, `data-focus-trap` + `data-trap-exit`, `data-back-action`, `data-focus-region`, `data-stepper`, `data-toggle-edit`, `data-stop-run`, classes `.segmented`/`.compact` e `.carousel`.

### Teclado virtual (texto e numérico)

Aberto com ✕/A sobre campo de texto. Modal `.virtual-keyboard.dialog` (780px; numérico 420px):

- Cabeçalho `.eyebrow`: "TECLADO" / "CARACTERES ESPECIAIS" / "TECLADO NUMÉRICO" + estado `abc`/`ABC`.
- Visor `.keyboard-value` (22px, cursor lima piscando; senha mostra "•"; vazio = "Digite aqui" / "0").
- Texto: grade 10 colunas (`1234567890 / qwertyuiop / asdfghjklç / zxcvbnm-.@`; especiais `!?#$%&*()_ / +=/\:;,"'´ / áàâãéêíóôõ / úüñ~^<>[]|`), foco inicial na tecla "q".
- Numérico: 3 colunas `1–9`, `Limpar`, `0`, `⌫`, `000`, `00`; foco inicial no "5"; máx. 12 dígitos.
- Barra `.keyboard-actions` com dicas: `R2/RT abc↔ABC`, `R3/RS #@ Especiais`, `△/Y Espaço`, `□/X Apagar`, `○/B Cancelar`, `Options/☰ Salvar` (primary).
- Respeita `maxLength` do campo. Teclado físico funciona junto (Enter salva, Esc cancela, Backspace apaga).

### Dicas de botão (`ControllerButtonHint({ action, label })`)

`<span class="control-hint">` com `<kbd class="pad-{action}">` **só quando a entrada é controle**; com mouse/teclado aparece apenas o texto. Cores dos `kbd`: confirm verde `#27b14a`, back vermelho `#e3283f`, secondary azul `#1f7cff`, info amarelo `#f1b400`; ombros/gatilhos/menu = retângulo branco 85% com texto azul (34px). Rótulos vêm do mapeamento ativo (✕ ○ □ △ L1 R1 L2 R2 Options ou A B X Y LB RB LT RT ☰).

### Vibração (`rumble(kind)`)

Padrões `[duração ms, forte, fraco]`: `move` 42ms leve; `confirm` 70ms; `back` 55ms; `tab` 55ms; `error` 2×90ms; `whistle` 260ms; `goal` 3 pulsos (180/140/420ms, máximo); `concede` 380ms forte. Usa WebHID (DualSense) se conectado; senão `vibrationActuator.playEffect('dual-rumble')` ou `hapticActuators.pulse`. Liga/desliga persistido em `localStorage['mando-vibration']` (padrão ligado). Diagnóstico `haptics()` → `ok | unsupported | nopad`.

---

## 8. Avisos (toasts) e notificações

- `.toast` (`success` verde / `error` vermelho): topo central (`top: 76px`), máx. 640px, entra com `toast-in`. **Fecha sozinho**: notice em **2,6s**, erro em **4s**. **Sem botão X** (decisão de design: no controle não faz sentido navegar até um X). Erros também vibram (`error`).
- `.busy-indicator`: "Processando…" com spinner no canto inferior direito durante operações assíncronas.
- `.compatibility-note` / `.pwa-update`: barra inferior central com borda amarela (o PWA tem botões e **não** some sozinho).

Detalhes de quando cada um aparece estão em `01-casca-do-app.md`.

---

## 9. Responsivo / breakpoints

| Media query                             | Efeitos principais                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max-height: 760px`                     | Header mais baixo (54px), painéis com padding menor, `news-ticker` oculto, títulos de seção 26px                                                                                                                                                                                                                                                                                                        |
| `max-width: 1100px`                     | Header em 3 colunas, **status (offline/controle) oculto**, ajustes na partida e na grade de cards                                                                                                                                                                                                                                                                                                       |
| `max-width: 900px`                      | Hub do jogador em 1 coluna, estatísticas empilhadas                                                                                                                                                                                                                                                                                                                                                     |
| `max-width: 760px` (mobile)             | Fonte 14px; some `brand-word`, `nav-shoulder` e `club-header`; abas roláveis à esquerda (14px); **o `main` passa a rolar verticalmente**; todas as grades de 2 colunas viram 1 (criação, elenco, mercado, escritório, temporada, partida…); tiles do menu 84vw/70vw e altura 320px; campos e carrosséis com alturas mínimas fixas; footer mostra só as 2 primeiras dicas; teclado virtual com 8 colunas |
| `max-width: 720px`                      | Ajustes específicos de listas                                                                                                                                                                                                                                                                                                                                                                           |
| `max-width: 760px`, `max-height: 560px` | Câmera do retrato empilhada (vídeo `min(34vh,80vw)`)                                                                                                                                                                                                                                                                                                                                                    |
| `prefers-reduced-motion`                | Desliga animações                                                                                                                                                                                                                                                                                                                                                                                       |

O alvo principal é **tela grande 16:9 (TV/monitor) sem rolagem da página**: cada tela cabe em `100dvh` e rola só dentro de painéis/carrosséis.

---

## Regras que o redesign deve preservar

1. Navegação 100% por controle: todo elemento interativo precisa ser focável, ter foco visível forte (hoje lima/branco + escala) e funcionar com ✕/○/□/△, L1/R1, L2/R2, Options e analógicos conforme a tabela acima.
2. Atributos de integração com o controle (`data-autofocus`, `data-dialog-close`, `data-focus-scope`, `data-stepper`, `data-toggle-edit`, `data-back-action`, `data-focus-trap`, `data-trap-exit`, `data-stop-run`, `.segmented`, `.carousel`).
3. Avisos que **fecham sozinhos em 2–4s, sem X**.
4. Modais fecham com "Voltar"/○/B/Esc e devolvem o foco; nada de "X" pequeno.
5. Cards de jogador: **a foto é o card** (grande, centralizada, colada na base), nome na faixa inferior, posição e overall no canto, **sem número**; níveis bronze/prata/ouro/ouro brilhante pelas faixas <65 / 65–74 / 75–82 / ≥83; brilho animado no ouro brilhante; sem foto = **bonequinho neutro sem sigla sobre o mesmo fundo colorido**.
6. Dicas de controle com os glifos corretos do controle conectado (PlayStation ou Xbox).
7. Escudos reais quando existirem, com fallback de brasão genérico com sigla.
8. Teclado virtual para qualquer campo de texto/número.
9. Formatação monetária pt-BR compacta e datas pt-BR.
10. Respeito a `prefers-reduced-motion`.

## Problemas atuais e oportunidades

- **CSS monolítico** (~6.300 linhas, regras sobrepostas): por exemplo `.player-card` é redefinido 3 vezes. Sugestão: tokens formais (espaçamento, raio, elevação, z-index) e componentes isolados.
- Raios inconsistentes (3/4/6/14/16/20px). O FIFA 14 usa cantos retos/levemente chanfrados; padronizar.
- Não há escala de z-index documentada para modais, overlays e avisos — formalizar.
- Cores por setor (gk/def/mid/att) ficam ocultas pelo tier; dá para mostrar o setor numa faixa/ícone discreto.
- `ManagerPortrait` sem avatar ainda mostra **iniciais** sobre o rosto — inconsistente com a regra "silhueta sem sigla" dos jogadores.
- Dicas de controle somem com mouse/teclado (só texto). Poderia mostrar teclas (`Esc`, `[ ]`, `Q/E`) no modo teclado.
- Foco com mouse não aparece; hover é só `brightness`. Um estado hover/foco unificado e mais "FIFA" (moldura branca + leve escala) deixaria o hub mais vivo.
- Faltam transições entre abas no estilo FIFA (deslizar na direção da aba escolhida); hoje sempre entra da direita.
- Toasts no topo podem cobrir as abas; considerar posição fixa estilo "notificação do FIFA" no canto com barra de progresso do tempo restante.

## Mapa do antigo styles.css

As outras docs citam linhas do antigo `src/styles.css`. O arquivo foi dividido em blocos contíguos, na mesma ordem; use esta tabela para achar o arquivo atual. Os overrides do tema MANDO 27 LEGACY (antigo `src/styles/legacy.css`) estão em `src/styles/legacy/` e carregam por último. A ordem de carregamento está em `src/styles/index.css` e é a própria cascata: não reordene.

| Linhas no antigo styles.css | Arquivo atual                                     |
| --------------------------- | ------------------------------------------------- |
| 1-98                        | `src/styles/00-tokens.css`                        |
| 99-229                      | `src/styles/01-base.css`                          |
| 230-539                     | `src/styles/02-shell.css`                         |
| 540-746                     | `src/styles/components/typography.css`            |
| 747-767                     | `src/styles/components/carousel.css`              |
| 768-896                     | `src/styles/components/tiles.css`                 |
| 897-959                     | `src/styles/components/crest-portrait.css`        |
| 960-1052                    | `src/styles/screens/main-menu.css`                |
| 1053-1353                   | `src/styles/screens/create-manager.css`           |
| 1354-1567                   | `src/styles/screens/central.css`                  |
| 1568-1822                   | `src/styles/screens/squad.css`                    |
| 1823-1958                   | `src/styles/screens/transfers.css`                |
| 1959-2338                   | `src/styles/screens/office.css`                   |
| 2339-2575                   | `src/styles/screens/season.css`                   |
| 2576-2969                   | `src/styles/screens/match.css`                    |
| 2970-3181                   | `src/styles/components/modals.css`                |
| 3182-3351                   | `src/styles/03-responsive.css`                    |
| 3352-3474                   | `src/styles/components/console-controls.css`      |
| 3475-3705                   | `src/styles/components/player-cards.css`          |
| 3706-3786                   | `src/styles/components/player-faces.css`          |
| 3787-3911                   | `src/styles/screens/squad-pitch.css`              |
| 3912-3969                   | `src/styles/components/virtual-keyboard.css`      |
| 3970-4233                   | `src/styles/screens/season-calendar-trophies.css` |
| 4234-4246                   | `src/styles/screens/match-subs-tactic.css`        |
| 4247-4553                   | `src/styles/screens/transfers-market.css`         |
| 4554-4574                   | `src/styles/components/brand.css`                 |
| 4575-4886                   | `src/styles/screens/transfers-negotiations.css`   |
| 4887-4946                   | `src/styles/components/tactic-slider.css`         |
| 5075-5105                   | `src/styles/components/active-states.css`         |
| 5106-5125                   | `src/styles/components/edit-mode.css`             |
| 5126-5301                   | `src/styles/screens/squad-shirts-positions.css`   |
| 5302-5345                   | `src/styles/components/heatmap.css`               |
| 5529-5751                   | `src/styles/components/portrait-camera.css`       |
| 5752-5803                   | `src/styles/screens/squad-mini-cards.css`         |
| 5804-5848                   | `src/styles/screens/squad-player-list.css`        |
| 5849-6034                   | `src/styles/screens/squad-player-sheet.css`       |
| 6035-6209                   | `src/styles/components/fifa-cards.css`            |
| 6210-6287                   | `src/styles/screens/squad-roster.css`             |
| 6288-6302                   | `src/styles/components/living-panels.css`         |
