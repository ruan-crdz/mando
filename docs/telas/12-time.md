# Tela: Time

## Resumo

A tela **TIME** é a segunda aba principal da carreira (índice `1` em `tabs = ['CENTRAL', 'TIME', 'TRANSFERÊNCIAS', 'ESCRITÓRIO', 'TEMPORADA']`, em `src\App.tsx`). É o "Squad Hub" do Mando: tudo o que diz respeito aos jogadores do clube do treinador acontece aqui, sem modais próprios.

Ela é composta por:

1. **Cabeçalho da seção** (`SectionTitle`): kicker `TIME / GESTÃO DO ELENCO`, título `Onze nomes. Uma ideia.` e o botão **Autoescalar**.
2. **Barra de sub-abas** (`.segmented`) com 4 abas internas, nesta ordem e com estes textos exatos:
   | # | Texto | Ícone lucide | `view` interno |
   |---|-------|--------------|----------------|
   | 1 | **Escalação** | `Shield` (16 px) | `'lineup'` (padrão ao montar) |
   | 2 | **Tática** | `SlidersHorizontal` (16 px) | `'tactics'` |
   | 3 | **Responsabilidades** | `ClipboardList` (16 px) | `'roles'` |
   | 4 | **Jogadores** | `Users` (16 px) | `'kit'` |
3. **Layout de duas colunas** (`.squad-layout`, grid `minmax(300px, 0.9fr) | minmax(0, 1.3fr)`, gap 8 px):
   - **Coluna esquerda**: nas abas Escalação/Tática/Responsabilidades é sempre o **campinho** (`section.panel.pitch-panel`, `data-focus-region="pitch"`); na aba Jogadores é substituída pelo **painel de stats do jogador focado** (`section.panel.player-stats`).
   - **Coluna direita** (`section.panel.squad-controls`, `data-focus-region="panel"`): conteúdo muda conforme a aba e conforme o "modo de escolha" (`picking`) ativo.

O estado `view` é **local** do componente (volta a `'lineup'` sempre que a tela é remontada, ex.: ao trocar de aba principal e voltar). O jogador "aberto" (`detail`) é **estado do App** (`useState<Player | null>` em `App.tsx`), passado como `detail`/`setDetail`.

## Como se chega / como se sai

**Entradas:**
- Barra de navegação principal (header): clique em `TIME`, ou L1/R1 (PS) · LB/RB (Xbox) · teclas `[` e `]` no teclado (função `switchTab`, circular entre as 5 abas).
- **Central** (`src\screens\CareerCentral.tsx`, linha ~200): tile `tile tile-orange squad-preview` chama `onTab(1)`.
- Popup **pré-jogo** (`App.tsx`, ~linha 1107): botão **"Revisar escalação"** fecha o popup e faz `setTab(1)`.
- Sempre que entra, a tela abre na sub-aba **Escalação** (estado local).

**Saídas:**
- L1/R1 · LB/RB · `[`/`]` para a aba anterior/seguinte (**bloqueado enquanto `detail` estiver aberto**, i.e. com uma linha expandida na aba Jogadores, e também com popup, partida ativa ou simulação rodando).
- △ (PS) / Y (Xbox) vai direto para **ESCRITÓRIO** (`info` → `setTab(3)`).
- Options/☰ abre a **Pausa**.
- □ (PS) / X (Xbox) = **Avançar dia** (ação global `secondary` do App), exceto quando o foco está num controle com modo edição (`data-toggle-edit`), onde □/X entra/sai da edição.
- Clicar em outro item do menu do header (mouse) — funciona mesmo com `detail` aberto (o `detail` não é limpo; ver Problemas).
- Ir ao menu principal limpa `detail` (`menu()` → `setDetail(null)`).

**Rodapé global** (sempre visível na carreira, `App.tsx`): dicas `✕/A Selecionar`, `○/B Voltar`, `□/X Avançar dia`, `R2/RT Sub-menu`, `Options/☰ Pausa` + indicador de salvamento.

## Arquivos-fonte

| Arquivo | Papel |
|---|---|
| `src\screens\Squad.tsx` | Tela inteira: estado, 4 sub-abas, campinho, seletor de jogadores, lista "Jogadores", linha expansível, painel de ações, editor "Posições e treino", painel de stats. |
| `src\App.tsx` (linhas ~592–645) | Renderiza `<Squad>` com todas as props/handlers; estado `detail`; navegação L1/R1, B fecha `detail`; rodapé de dicas. |
| `src\components\PlayerCard.tsx` | `PlayerCard` (card quadrado FIFA), `PlayerPicker` (grade "Recomendados" + "Elenco por posição"), `byPosition`, `roleFits`, `shortName`, `positionOrder`. |
| `src\components\PlayerFace.tsx` | Foto real (`/assets/jogadores/{id}.webp`, lista em `src\game\data\player-faces.json`) ou bonequinho SVG neutro. |
| `src\components\cardTier.ts` | Nível do card por overall (bronze/prata/ouro/ouro brilhante). |
| `src\components\HeatMap.tsx` | Mapa de calor SVG do jogador numa função. |
| `src\components\controls.tsx` | `ChipGroup`, `TacticSlider`, `OptionCycler`, `NumberStepper`, `ShirtNumberDial` (controles "de console"). |
| `src\components\ui.tsx` | `SectionTitle`, `money()`, `dateLabel()` e `thresholdPercent()` para exibir percentuais sem arredondar acima dos limites. |
| `src\controller\GamepadProvider.tsx`, `FocusManager.ts`, `dualsenseMapping.ts`, `xboxMapping.ts` | Navegação espacial, L2/R2 nas sub-abas, analógico direito (`useStickX`), passos ←/→ (`useStepper`), modo edição. |
| `src\game\*` | `squad`, `available`, `bestLineup` (matches.ts); `overall` (ratings.ts); `ageAt` (random.ts); `pitchCoordinates` (pitch.ts); `shirtNumbers`, `setShirtNumber` (numbers.ts); `marketValue`, `releaseCost`, `renewalOptions`, `renewalTerms` (transfers.ts); `familiarity`, `familiarityLabel`, `knownPositions`, `positionNames`, `setMainPosition`, `setTraining`, `LEARNED=85`, `TRAIN_CAP=92` (positions.ts); `formations`, `positions`, `roleNames` (types.ts). |
| `src\styles\index.css`, `src\styles\legacy\08-squad.css` | Ordem de importação e acabamento grafite/ardósia do Plantel; os estilos básicos ficam em `src\styles\screens\squad*.css` e os tiers em `src\styles\components\fifa-cards.css`. |

> `LivePitch.tsx` **não** é usado nesta tela.

---

## Elementos comuns a todas as abas

### Cabeçalho (`SectionTitle`)
- `p.eyebrow`: **`TIME / GESTÃO DO ELENCO`**.
- `h1` em caixa alta: **`Onze nomes. Uma ideia.`** — como termina em ponto, o `title-dot` não é acrescentado.
- Botão à direita: ícone `Sparkles` (17 px) + **`Autoescalar`**. Ação: `bestLineup(c, world)`; se não retornar 11 atletas → erro `"Não há onze atletas disponíveis."`; senão `onChange({...c, lineup})`. Não mexe em formação nem tática. Disponível em todas as sub-abas.

### Barra de sub-abas (`.segmented`)
- 4 botões (ver tabela acima). Ativo: classe `active`, fundo petróleo e filete ciano. Inativos: transparentes, texto `--ink-2`.
- Clicar em qualquer sub-aba: `setView(...)` + `setPicking(null)` (cancela qualquer escolha de posição/função em andamento). Em **Jogadores** também `setKitId(null)` (fecha o editor "Posições e treino").
- **Não** limpa `detail` (linha expandida da aba Jogadores continua aberta ao voltar para ela).
- Controle: **L2/R2 (PS) · LT/RT (Xbox)** ciclam as sub-abas (função `cycleView` do GamepadProvider: procura `.segmented:not(.compact)` dentro de `main`, clica e foca o próximo/anterior, circular). Teclado: **`q`** (anterior) e **`e`** (próxima). O rodapé mostra "R2/RT Sub-menu".

### Painel esquerdo = Campinho (abas Escalação, Tática, Responsabilidades)
Descrito em detalhe na aba **Escalação**. Nas abas Tática e Responsabilidades ele aparece idêntico e continua interativo: clicar num jogador do campinho **leva para a aba Escalação** (`setView('lineup')`) e seleciona a posição.

### Dados usados
- `players = squad(c, world)` — atletas cujo `career.players[id].clubId === c.clubId`.
- `numbers = shirtNumbers(c, world)` — mapa id → número da camisa (1–99).
- `rolePositions = formations[c.tactic.formation]` — 11 funções da formação (índice 0 é sempre `GK`).
- `coordinates = pitchCoordinates(formation)` — `{x, y}` em % para cada slot.
- `overall(p, função, estado)` — overall do atleta **na função** (cai fora de posição).
- `available(c, id)` = sem lesão (`injuryDays === 0`), sem suspensão e `fitness >= 30`.
- `familiarity(p, função, estado)` 0–100; rótulos (`familiarityLabel`): `≥100 Natural`, `≥85 Apto`, `≥65 Adaptável`, `≥40 Improvisado`, abaixo `Fora de posição`.
- `cardTier(ovr)`: `≥83 card-rare` (ouro brilhante, com brilho animado), `75–82 card-gold`, `65–74 card-silver`, `<65 card-bronze`.
- `shortName(name)`: se o nome tem mais de 2 palavras, retorna só a última; senão o nome inteiro.
- `money(v)`: `Intl` pt-BR BRL compacto, 1 casa (ex.: `R$ 1,2 mi`, `R$ 350 mil`).
- `dateLabel(d)`: pt-BR `dd de mmm. de aaaa` (ex.: `31 de dez. de 2027`).

### Componente `PlayerFace`
- Com foto: `<span class="player-face {sm|md|lg} ...">` + `<img loading="lazy">` de `assets/jogadores/{id}.webp`. Se a imagem falhar (`onError`), cai para o bonequinho.
- Sem foto: `<span class="player-face generated ...">` com SVG 64×64 (círculo = cabeça, path = tronco), `fill` branco translúcido (0.55–0.6), **sem sigla/iniciais** e **sem fundo** (`background: none !important`). Corresponde à preferência do usuário.
- Tamanhos base: `sm` 30 px, `md` 48 px, `lg` 120 px (redimensionados por contexto).

### Componente `PlayerCard` (card quadrado FIFA)
Usado nos seletores de posição e de responsáveis; o campinho usa camisas vetoriais, não cards fotográficos.
- `<button class="player-card {gk|def|mid|att} {tier} [active] [out]" data-player=id>`; `aspect-ratio: 1`; `border-radius: 6px`.
- Conteúdo (de cima para baixo):
  - `.pc-top` (absoluto, topo-esquerda, empilhado em coluna): `.pc-ovr` = overall (na função `role` se informada, senão na posição natural), fonte display 800 `clamp(24px, 3.6vh, 36px)`; `.pc-pos` = posição (mostra a função `role` se for diferente da posição natural, senão a posição natural), 13 px.
  - `.pc-face` = foto **grande, ocupando o card inteiro** (`inset: 6% 0 0 0`, `object-fit: contain`, `object-position: 50% 100%` → **base colada embaixo**, centralizada).
  - `.pc-badge` (opcional, topo-direita) — não usado nesta tela.
  - `.pc-name` = `shortName` em CAIXA ALTA, faixa inferior absoluta com gradiente `transparent → var(--card-name)`, 800 `clamp(13px,1.8vh,17px)`.
  - `.pc-meta` existe no componente compartilhado; nos seletores do Plantel é ocultada para não cobrir a foto. A disponibilidade é mostrada abaixo do card; o card ganha `out` quando há lesão ou suspensão.
- **Não mostra número da camisa** nem a `note` — as props `number` e `note` são aceitas mas **ignoradas** pelo componente (há CSS `.pc-number`/`.pc-fitness` órfão). Isso está de acordo com a preferência "só nome, posição e overall".
- Fundo: `var(--card-bg)` do tier (as cores por setor `gk/def/mid/att` são sobrescritas pelo tier). Texto **branco** com `text-shadow 0 1px 3px rgba(0,0,0,.8)`.
- `active`: borda limão + halo. Foco: `scale(1.05)`, `z-index: 2`. `disabled` quando indisponível no seletor de posição.
- `aria-label` inclui nome, posição, eventual função diferente, overall e estado; no Plantel também informa titular/reserva, condição, disponibilidade e familiaridade ou índice da responsabilidade.

### `PlayerPicker`
- Dentro de `.card-scroll` (rolagem vertical). Divisor `.grid-divider` **{recommendedLabel}**, depois `.card-grid` com `extra` + recomendados; outro divisor **{othersLabel}** e `.card-grid` com os demais. No Plantel são quatro colunas no desktop e três no celular deitado. Se não houver recomendados, o primeiro bloco some e `extra` vai para a segunda grade.

---

# Aba 1 — Escalação (`view = 'lineup'`)

## Resumo
Campinho com os 11 titulares em minicamisas à esquerda e, à direita, um **resumo contextual do onze inicial**. Selecionar uma posição no campinho troca o painel direito por um **seletor** com recomendados para aquela função. É possível trocar titulares entre si, colocar reservas, arrastar e soltar (mouse) e abrir a ficha de um titular ou o elenco completo na aba Jogadores.

## Wireframe atual (ASCII)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TIME / GESTÃO DO ELENCO                                                      │
│ ONZE NOMES. UMA IDEIA.                                       [✨ AUTOESCALAR] │
│ [🛡 Escalação] [⎚ Tática] [📋 Responsabilidades] [# Jogadores]               │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ 4-2-3-1           (Equilibrada)│ ONZE INICIAL           [Ver elenco completo]│
│ ┌───────────────────────────┐ │ Formação · condição média · indisponíveis   │
│ │          camisa ST        │ │ reservas                                    │
│ │   LW      AM      RW      │ │ TITULARES             OVR NA FUNÇÃO · COND. │
│ │       DM      DM          │ │ [GK] Nome do goleiro             77 · 100%  │
│ │   LB   CB   CB   RB       │ │ [LB] Nome do lateral             80 ·  90%  │
│ │          camisa GK        │ │ ... 11 titulares, com rolagem ...           │
│ └───────────────────────────┘ │                                             │
│ Selecione uma posição: ...    │                                             │
└───────────────────────────────┴──────────────────────────────────────────────┘
 Minicamisa: número, OVR na função, nome, condição e alertas.
 Seleção: [‹ Cancelar] TROCAR ST · NOME · OVR na função
          RECOMENDADOS PARA ST [cards fotográficos] + condição/familiaridade abaixo
          ELENCO POR POSIÇÃO   [demais cards fotográficos]
```

## Elementos

### Painel do campinho (`section.panel.pitch-panel`)
- `.panel-heading`: `h2` = **formação** (`c.tactic.formation`, ex. `4-2-3-1`); `span.pill` = **mentalidade** (`Defensiva` | `Equilibrada` | `Ofensiva`).
- `.football-pitch`: gramado verde escuro listrado, com círculo central, meio-campo e áreas; ataque em cima e goleiro embaixo.
- **11 minicamisas** (`button.pitch-player`), uma por slot `i` de `c.lineup` (array de 11 ids, ordem = `formations[...]`):
  - Posição absoluta `left: x%`, `top: y%` (`pitchCoordinates`), centralizado com `translate(-50%, -50%)`. No 3-5-2, os laterais ficam nas pontas do meio-campo, à frente dos três zagueiros.
  - `data-slot={i}`; `draggable`.
  - Classes: `unavailable` (lesão/suspensão/fitness < 30), `selected`, `swap-target` e `out-of-position` (familiaridade < 85).
  - Conteúdo:
    1. Camisa SVG autoral na cor do clube, com número contrastante; o goleiro usa cor distinta.
    2. `span.pitch-ovr`: overall e função do slot.
    3. `strong` = `shortName`; alerta para improvisação e alerta separado para indisponibilidade.
    4. Barra de condição proporcional ao `fitness`; indisponíveis usam cor de alerta.
  - `aria-label` informa função, nome, número, overall, condição, disponibilidade e familiaridade.
- Texto de ajuda (`p.muted.small`) abaixo do campo:
  - Sem seleção: **`Selecione uma posição: o painel ao lado mostra as opções recomendadas.`**
  - Com slot selecionado: **`Escolha outro titular para trocar de posição com {shortName}, ou vá → para as recomendações.`**

### Painel direito — estado padrão: "Onze inicial"
- Cabeçalho **`Onze inicial`** com botão **`Ver elenco completo`**, que abre a aba Jogadores.
- Métricas: formação, condição média, quantidade de titulares indisponíveis e reservas.
- Lista rolável com os 11 titulares na ordem da formação, função, nome, disponibilidade, aviso de improvisação, overall na função e condição física.
- Clique em um titular → `openDetail(p)` (abre sua linha na aba **Jogadores**).

### Painel direito — estado "escolhendo posição" (`picking = {kind:'slot', index}`)
- `.panel-heading.picker-heading`:
  - Botão `text-button` com `data-back-action`: ícone `ChevronLeft` 16 + **`Cancelar`** (devolve foco ao slot e limpa `picking`).
  - `h2`: **`Trocar {função} · {shortName do atual}`** (ex. `Trocar ST · Hulk`).
  - `span.pill`: **`OVR na função`**.
- `PlayerPicker`:
  - **`Recomendados para {função}`** — até 5 atletas: primeiro os disponíveis cuja posição natural é a 1ª de `roleFits[função]` ou com familiaridade ≥ 85 na função, ordenados pelo overall na função; se faltarem, completa com disponíveis cuja posição natural está em `roleFits[função]`. Exclui o atual do slot; no slot 0 só goleiros.
  - **`Elenco por posição`** — todo o resto do pool, ordenado por `byPosition`.
  - Cada card: `PlayerCard` com `role={função}` (OVR e posição na função). Abaixo ficam titular/reserva, disponibilidade, condição e familiaridade; substituições inválidas são desabilitadas.
  - Se não houver candidato selecionável, uma mensagem explica que não há atleta disponível para a troca.
  - Clique → `changeSlot(index, id)`.
- `roleFits` (quem serve para cada função): `GK[GK]`, `CB[CB,DM]`, `LB[LB,LW,CB]`, `RB[RB,RW,CB]`, `DM[DM,CM,CB]`, `CM[CM,DM,AM]`, `AM[AM,CM,LW,RW]`, `LM[LW,CM,LB,AM]`, `RM[RW,CM,RB,AM]`, `LW[LW,RW,AM,ST]`, `RW[RW,LW,AM,ST]`, `ST[ST,AM,LW,RW]`.

## Estados e variações
- Formações disponíveis: `4-2-3-1` (`GK LB CB CB RB DM DM LW AM RW ST`), `4-3-3` (`GK LB CB CB RB DM CM CM LW RW ST`), `4-4-2` (`GK LB CB CB RB LM CM CM RM ST ST`), `3-5-2` (`GK CB CB CB LB DM CM AM RB ST ST`).
- Camisa selecionada recebe contorno ciano; improvisação e indisponibilidade têm alertas próprios.
- A barra de condição varia de 0–100%; o percentual exato também aparece na lista e no seletor.
- Nos cards fotográficos, jogador sem foto ou com foto quebrada recebe silhueta neutra.
- Painel direito alterna entre "Onze inicial" e "Seletor de posição".
- Erros (toast via `onError`): atleta indisponível, exigência de goleiro ou tentativa de deslocar um titular indisponível em vez de substituí-lo por reserva disponível.

## Interações

**Mouse / teclado**
- Clique numa camisa sem seleção → seleciona o slot (`picking = slot i`); painel direito vira o seletor.
- Clique na mesma camisa selecionada → desseleciona.
- Clique em **outra** camisa com um slot selecionado → `swapSlots(origem, destino)`: troca titulares disponíveis (falha se o slot 0 deixar de ter `GK`). Foco vai para o slot de destino.
- Clique num card do seletor → `changeSlot(i, id)`: se o escolhido já é titular em outro slot, os dois trocam; senão o reserva entra e o atual sai. Bloqueia indisponíveis e qualquer troca que deixe um não-goleiro no slot 0; o goleiro titular aparece desabilitado quando não pode deixar o gol. Foco volta ao slot.
- **Arrastar e soltar** (só mouse, só entre camisas do campinho): soltar um titular sobre outro → `changeSlot(destino, arrastado)` (equivale à troca). Cards do painel direito **não** são arrastáveis.
- Clique em titular do "Onze inicial" → abre o jogador na aba Jogadores.
- Setas do teclado = navegação espacial (mesmo comportamento do D-pad); `Enter`/`Espaço` = clique; **`Esc` = Voltar** (mesma ação do ○/B: clica em `Cancelar` quando há posição selecionada); `[`/`]` = aba principal; `q`/`e` = sub-aba.

**Controle (PS5 / Xbox)**
- **D-pad / analógico esquerdo**: foco espacial entre camisas (algoritmo `FocusManager.move`: prioriza mesma região `data-focus-region` e alinhamento). → a partir do campinho alcança o painel direito (região `panel`).
- **✕ / A** sobre uma camisa: seleciona a posição. **O foco permanece no campinho** (só no modo responsabilidades o foco salta para o painel).
  - Com posição selecionada: **✕/A noutra camisa** = trocar os dois de posição; **✕/A na mesma** = cancelar; **→** = ir aos recomendados; **✕/A num card** = escalar; **○ / B** = clica no botão `[data-back-action]` **Cancelar** (foco volta ao slot).
- **✕/A** num titular da lista = abre a ficha (aba Jogadores).
- **L2/R2 · LT/RT**: muda de sub-aba. **L1/R1 · LB/RB**: muda de aba principal. **Analógico direito vertical**: rola a área rolável mais próxima (grade de cards). **R-stick horizontal**: sem uso nesta aba (rola carrossel horizontal se existir).
- **□ / X**: avança o dia (global). **△ / Y**: Escritório. **Options/☰**: pausa.
- Feedback: vibração (`rumble`) e bipe a cada movimento/confirmação.

## Classes CSS e visual atual
- `.squad-layout` usa duas colunas também no celular deitado, com rolagem vertical do conteúdo; em retrato o aviso global pede para girar o aparelho.
- Em landscape até 700 px, as colunas têm a mesma largura, as camisas acompanham o campo e o editor empilha o painel de posições abaixo da camisa e do mapa de calor.
- `.pitch-panel` usa superfície grafite; `.football-pitch` preenche o espaço. `.pitch-player` contém a camisa vetorial, OVR, nome e condição, sem fundo metálico.
- Tiers (`--card-bg`): bronze `#e7b083 → #b06b35 → #5e3313`; prata `#f1f5f8 → #a9b4bc → #56636c`; ouro `#ffe590 → #d4a537 → #7a5512`; ouro brilhante `#fff6c4 → #ffcf2e → #e09a00 → #6b3f00` + anel/glow dourado + faixa de brilho animada (`::after`). `--card-name` (faixa do nome) em tons escuros do próprio metal.
- `.player-card` (ver comum): quadrado, padding 0, foto `inset 6% 0 0 0`, nome em faixa inferior gradiente, OVR/posição brancos no topo-esquerda.
- `.card-grid` tem 4 colunas no desktop e 3 no celular deitado; `.card-scroll` usa `overflow-y: auto`.
- `.grid-divider` texto limão + linha gradiente.
- Painéis usam grafite/ardósia e borda ciano discreta, com acabamento específico em `legacy/08-squad.css`.
- `.squad-controls` flex coluna, `overflow: hidden`; `.picker-heading` não encolhe.
- Animações respeitam `prefers-reduced-motion`.

## Regras que o redesign deve preservar
- 11 slots na ordem de `formations[formação]`; slot 0 **sempre goleiro** (validado em toda troca).
- OVR exibido no campinho e no seletor é o **overall na função do slot**, não o natural.
- Indicação de **fora de posição** (familiaridade < 85) e de **condição física** (fitness %) em cada titular.
- Indisponíveis (lesão, suspensão, fitness < 30) não podem entrar: desabilitados no seletor. Um titular indisponível pode sair por um reserva disponível, mas não ser deslocado para outro slot titular.
- Fluxo de troca: selecionar slot → (a) outro slot = trocar posições, (b) card = substituir/trocar; cancelar devolve o foco ao slot.
- Recomendados (até 5) primeiro, depois elenco por posição.
- **Preferência do usuário — "o card é a foto"**: nos cards dos seletores, foto grande e centralizada, com a **base colada embaixo**; mostrar **só nome, posição e overall (sem número)** sobre ela. Fundo pelo nível **bronze (<65) / prata (65–74) / ouro (75–82) / ouro brilhante (≥83)**; fonte branca; sem foto = silhueta neutra. O campo usa minicamisas, não cards.
- Autoescalar sempre acessível.
- Navegação 100% por controle, com foco visível e retorno de foco ao ponto de origem.

## Problemas atuais e oportunidades
- Drag-and-drop só entre titulares; não dá para arrastar do banco.
- Não existe visão de **banco/reservas** separada no campinho; o elenco completo fica na aba Jogadores e no seletor.

---

# Aba 2 — Tática (`view = 'tactics'`)

## Resumo
Campinho à esquerda (igual à Escalação, reflete a formação em tempo real) e, à direita, o formulário "Como vamos jogar?": formação, mentalidade e 4 sliders de 1 a 5. Toda mudança é aplicada imediatamente em `c.tactic` (sem botão salvar).

## Wireframe atual (ASCII)

```
├───────────────────────────────┬──────────────────────────────────────────────┤
│ 4-3-3            (Ofensiva)    │ IDENTIDADE EM CAMPO                          │
│ ┌───────────────────────────┐ │ COMO VAMOS JOGAR?                            │
│ │   (campinho igual à aba   │ │ FORMAÇÃO                                     │
│ │    Escalação)             │ │ [4-2-3-1] [■4-3-3■] [4-4-2] [3-5-2]          │
│ │                           │ │ MENTALIDADE                                  │
│ │                           │ │ [Defensiva] [Equilibrada] [■Ofensiva■]       │
│ │                           │ │ ┌───────────────────────────────────┐        │
│ │                           │ │ │PRESSÃO                      3 / 5 │        │
│ │                           │ │ │▮▮▮▯▯                              │        │
│ │                           │ │ │EDITAR                              │        │
│ │                           │ │ └───────────────────────────────────┘        │
│ │                           │ │ (Largura · Velocidade de construção ·        │
│ └───────────────────────────┘ │  Linha defensiva — mesmo formato)            │
│ Selecione uma posição: ...    │ Pressão alta gasta mais energia e aumenta... │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

## Elementos
- `p.eyebrow` **`IDENTIDADE EM CAMPO`**; `h2` **`Como vamos jogar?`**.
- `div.tactic-form` em grade contendo:
  1. `ChipGroup` **Formação**: chips `4-2-3-1`, `4-3-3`, `4-4-2`, `3-5-2` (`role="radiogroup"`). Há aviso de que escolher uma formação diferente **recalcula a escalação inteira com `bestLineup`**. Selecionar a formação já ativa não altera o onze. Se não houver 11 aptos → erro `Não há atletas disponíveis para esta formação.` e nada muda.
  2. `ChipGroup` **Mentalidade**: `Defensiva`, `Equilibrada`, `Ofensiva`.
  3. Quatro `TacticSlider` (1–5): **`Pressão`** (`pressure`), **`Largura`** (`width`), **`Velocidade de construção`** (`tempo`), **`Linha defensiva`** (`line`). Cada um mostra rótulo, valor, cinco segmentos e dica **Editar** ou **Ajustar / Concluir / Sair**, com glifos apropriados quando há controle conectado.
- `p.muted.small`: **`Pressão alta gasta mais energia e aumenta o risco de cartões. Linha e mentalidade alteram o equilíbrio entre ataque e defesa.`**
- Campinho à esquerda: `h2` formação e `pill` mentalidade atualizam na hora; posições das camisas mudam com a formação.

## Estados e variações
- Chip ativo vs. inativo.
- Slider normal vs. **modo edição** (`.tactic-slider.editing`: borda ciano e fundo petróleo).
- Formação trocada → nova escalação automática visível no campinho.

## Interações
**Mouse**: clique no chip aplica. No slider, o primeiro clique no corpo ou num segmento entra em edição sem alterar o valor; com edição ativa, clicar num segmento aplica o novo valor.
**Teclado**: setas navegam; `Enter` liga/desliga a edição do slider; com a edição ligada o elemento recebe `data-stepper` e ←/→ passam a ajustar o valor (evento `mando:step`) em vez de navegar; `Esc` sai da edição.
**Controle**:
- D-pad navega entre chips e sliders sem alterar nada.
- **✕/A** num chip = seleciona.
- No slider: **✕/A** ou **□/X** entram no modo edição; **←/→** (D-pad/analógico esquerdo) ajustam 1 passo (limitado 1–5, aplica na hora); **✕/A** ou **□/X** saem; **○/B** sai da edição (com `aria-pressed=true`, o B é consumido pelo slider). Perder o foco também sai.
- L2/R2 troca sub-aba; o campinho à esquerda continua focável (clicar nele leva à Escalação).

## Classes CSS e visual atual
- `.tactic-form` grid; `.chip-group` / `.chips` em flex com opções focáveis e estado ativo.
- `.control-label` 13 px 700 caixa alta `--ink-2`.
- `.tactic-slider` usa superfície elevada, borda ciano em edição, `.ts-head`, `.ts-value`, `.ts-track` e `.ts-hint`. O componente também é usado na partida e segue o mesmo modo de edição.

## Regras que o redesign deve preservar
- 4 formações, 3 mentalidades, 4 parâmetros inteiros 1–5 (`tacticSchema`).
- Trocar formação **refaz a escalação** (`bestLineup`) e pode falhar com erro.
- Controles não podem mudar valor só por navegar: entrar em edição é explícito (padrão "modo edição" do FIFA).
- Aplicação imediata, sem botão salvar.

## Problemas atuais e oportunidades
- Não há pré-visualização/explicação por slider (efeito numérico, descrição curta de 1 e 5).
- Sem instruções individuais nem "táticas personalizadas" salvas (FIFA tem 4 slots de tática).
- O campinho não mostra setas/linhas indicando largura, linha defensiva etc.

---

# Aba 3 — Responsabilidades (`view = 'roles'`)

## Resumo
Define capitão, vice e cobradores de bola parada. Painel direito com uma grade de 9 cards de função; escolher uma abre um seletor de jogadores com os 5 melhores para a função. Campinho continua à esquerda.

## Wireframe atual (ASCII)

```
├───────────────────────────────┬──────────────────────────────────────────────┤
│ 4-2-3-1        (Equilibrada)   │ QUEM CHAMA A RESPONSABILIDADE?               │
│ ┌───────────────────────────┐ │                     Liderança e bola parada  │
│ │                           │ │ ┌──────────────┐┌──────────────┐┌──────────┐ │
│ │   (campinho)              │ │ │👑 CAPITÃO  10││👑 VICE-CAP. 7││👕 PÊNALTIS│ │
│ │                           │ │ │              ││              ││        ? │ │
│ │                           │ │ │ Sobrenome    ││ Sobrenome    ││Não defin.│ │
│ │                           │ │ │ CM · OVR 80  ││ CB · OVR 76  ││Escolher..│ │
│ │                           │ │ └──────────────┘└──────────────┘└──────────┘ │
│ │                           │ │ [Faltas curtas] [Faltas longas] [Esc. esq.]  │
│ │                           │ │ [Esc. direito ] [Lateral esq. ] [Lat. dir.]  │
│ └───────────────────────────┘ │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘
 Escolhendo:  [‹ Cancelar]  PÊNALTIS   (Escolha o responsável)
              MELHORES PARA A FUNÇÃO ─────────
              [Ninguém/Remover][card][card][card][card][card]
              ELENCO POR POSIÇÃO ─────────────
              [card][card]...
```

## Elementos
- `.panel-heading`: `h2` **`Quem chama a responsabilidade?`**; `span` **`Liderança e bola parada`**.
- `.role-grid` (3 colunas, gap 10, rolável) com **9** `button.role-card` (`data-role={nome}`), na ordem de `roleNames`: **Capitão**, **Vice-capitão**, **Pênaltis**, **Faltas curtas**, **Faltas longas**, **Escanteio esquerdo**, **Escanteio direito**, **Lateral esquerdo**, **Lateral direito**.
  - `span.role-name` (13 px 800 caixa alta): ícone lucide **`Crown`** (16) para Capitão/Vice-capitão, **`Shirt`** (16) para os demais + nome da função.
  - Com responsável válido (existe e ainda é do clube): número da camisa, nome, posição, overall, índice da função, disponibilidade e condição.
  - Sem responsável (ou saiu do clube): classe `empty`, `?`, **`Não definido`** e **`Escolher atleta`**.
  - Cards usam superfícies ardósia/grafite. Um goleiro já atribuído por um save antigo a uma função que não permite goleiro recebe aviso para regularização, sem alterar o save silenciosamente.
- **Seletor de responsável** (`picking = {kind:'role', role}`) no painel direito:
  - Cabeçalho: `Cancelar` (`ChevronLeft`, `data-back-action`) · `h2` **{nome da função}** · `pill` **`Escolha o responsável`**.
  - `PlayerPicker`: **`Melhores para a função`** = top 5 por `roleScore`; **`Elenco por posição`** = demais, por `byPosition`. Goleiros só aparecem nas duas listas de Capitão/Vice.
  - Card extra **Ninguém** (só se a função já tem responsável): `button.player-card.empty` (borda tracejada) com ícone **`UserX`** (30) + **`Ninguém`** + **`Remover`** → remove a função.
  - Cards `PlayerCard` com `active` = responsável atual. Titular/reserva, índice da função, disponibilidade e condição aparecem abaixo da foto e no rótulo acessível. Indisponíveis continuam selecionáveis aqui.
- `roleScore` (critério dos recomendados):
  - Capitão / Vice: `overall + min(34, idade)×0,8 + relação×0,2`.
  - Pênaltis: `finalização + compostura`.
  - Faltas curtas: `passe curto + visão + finalização×0,5`.
  - Faltas longas: `passe longo + visão`.
  - Escanteio esquerdo/direito: `passe longo + visão (+8 se pé E/D ou ambidestro)`.
  - Lateral esquerdo/direito: `força + passe longo (+12 se posição LB/RB)`.

## Estados e variações
- Card de função definido vs. `empty`.
- Painel direito: grade de funções ↔ seletor.
- Mesmo jogador pode ocupar várias funções (inclusive capitão e vice ao mesmo tempo — não há validação).

## Interações
**Mouse**: clique num card de função → abre seletor; clique num jogador → `setRole(função, id)` (atualiza `c.roles`), volta à grade com foco no card da função; **Ninguém** → remove; **Cancelar** → volta.
**Controle**:
- D-pad entre os 9 cards; **✕/A** abre o seletor e **o foco salta automaticamente** para o primeiro card do painel (`.player-card:not(:disabled), .role-card`).
- No seletor: D-pad entre cards; **✕/A** escolhe; **○/B** = `Cancelar` (`data-back-action`), foco volta ao card da função (`[data-role="…"]`).
- L2/R2 troca sub-aba (cancela o seletor).

## Classes CSS e visual atual
- `.role-grid` com 3 colunas; `.role-card` e `.role-card.empty` em ardósia/grafite, com `.role-name`, `.role-number` e `.role-condition`.
- Seletor reutiliza `.picker-heading`, `.card-scroll`, `.grid-divider`, `.card-grid`, `.player-card`, `.player-card.empty`.

## Regras que o redesign deve preservar
- As 9 funções e seus nomes exatos (`roleNames`), armazenadas em `c.roles[nome] = playerId`.
- Responsável que saiu do clube é tratado como "Não definido".
- Opção de remover (Ninguém) quando já existe responsável.
- Recomendações pelos critérios de `roleScore`; goleiros só podem ser escolhidos para capitão/vice.
- Foco vai ao seletor ao abrir e volta ao card da função ao fechar.

## Problemas atuais e oportunidades
- Card de função não mostra foto do responsável (FIFA mostra o mini-card do jogador).
- Não há "auto-definir" responsabilidades nem validação de capitão = vice.
- Número da camisa aparece aqui (em contraste com os cards) — avaliar consistência.

---

# Aba 4 — Jogadores (`view = 'kit'`)

## Resumo
Lista completa do elenco em linhas, **ordenável por botão do controle**. À esquerda, no lugar do campinho, um **painel de stats** do jogador focado (foto em card de tier, nome, número, posição, overall, potencial, idade, estilo/função, personalidade, todos os atributos, mapa de calor) que **atualiza ao rolar/focar** a lista. Clicar numa linha **expande a linha** (sem modal) e mostra uma barra de ações (Trocar, Número da camisa, Renovar contrato, Lista de transferências, Lista de empréstimos, Conversar, Evolução e função, Dispensar, Posições e treino); todas as ações, inclusive o editor de posições com número e mapa de calor, aparecem **dentro da linha**.

## Wireframe atual (ASCII)

```
├─────────────────────────────────────┬────────────────────────────────────────┤
│ PAINEL DE STATS (player-stats)      │ JOGADORES      [◀ ▶ Ordenando por OVERALL]│
│ ┌────────┐  NOME COMPLETO            │┌──────────────────────────────────────┐│
│ │84      │  CM · LW · Armador ·      ││[CM](foto) Nome Completo   84 R$12mi Titular││
│ │CM      │  Líder                    ││          29 anos · R$ 300 mil/mês ·  ││
│ │ (foto) │  ┌──────┬──────┬──────┐   ││          até 2028 · À VENDA          ││
│ │        │  │CAMISA│IDADE │OVERALL│  │├──────────────────────────────────────┤│
│ │SOBRENOM│  │ 10   │ 29   │ 84   │   ││▌[ST](foto) Nome ... (linha ABERTA azul)││
│ └────────┘  ├──────┼──────┼──────┤   ││ ┌ roster-expand ───────────────────┐ ││
│             │POTENC│MORAL │RITMO │   ││ │[Trocar][Número da camisa][Renovar│ ││
│             │84–90 │ 72   │ 64%  │   ││ │ contrato][Lista de transferências│ ││
│             ├──────┼──────┼──────┤   ││ │][Lista de empréstimos][Conversar]│ ││
│             │VALOR │SALÁR.│CONTR.│   ││ │[Evolução e função][Dispensar]    │ ││
│             │R$12mi│R$300m│dez/28│   ││ │[🏋 Posições e treino]             │ ││
│             ├──────┴──────┴──────┤   ││ │ (painel da ação escolhida aqui)  │ ││
│             │TEMPORADA 7 gols·900│   ││ └──────────────────────────────────┘ ││
│             [À VENDA · R$ 15 mi]     ││[GK](foto) Nome ...        78 R$4mi Reserva││
│ ┌ atributos (2 col.) ──────┐ ┌mapa┐  ││ ...                        (rolagem) ││
│ │Velocidade: 82 ▬▬▬▬▬▬▬▬   │ │calor│ │└──────────────────────────────────────┘│
│ │Aceleração: 80 ▬▬▬▬▬▬▬    │ │ CM ·│ │                                        │
│ │... 19 atributos ...      │ │Natur│ │                                        │
│ └──────────────────────────┘ └─────┘ │                                        │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

Editor "Posições e treino" (dentro da linha expandida no painel direito):
```
[POSIÇÕES E TREINO] NOME COMPLETO                        [‹ Fechar editor]
┌ kit-side ────────┐  ESCOLHA UMA POSIÇÃO PARA VER O MAPA DE CALOR
│   ╱‾‾\__/‾‾╲     │  [GK 45][CB 60][LB 58][RB 57][DM 78]
│   │  10    │     │  [CM 84][AM 80][LW 79][RW 75][ST 70]   ← OVR + barra de familiaridade
│   │ (camisa)│    │  ┌ MEIA CENTRAL ──────────────────────┐
│ X/✕ EDITAR NÚMERO│  │ Natural · 100% · OVR 84            │
│ ┌ mapa de calor ┐│  │ Treinando ponta esquerda · 70% ... │
│ │               ││  └────────────────────────────────────┘
│ └ CM · Natural ─┘│  [🏋 Treinar como LW] [👑 Tornar posição principal]
└──────────────────┘  O treino evolui um pouco por dia (mais rápido em jovens)...
```

## Elementos

### Cabeçalho da lista
- `h2` **`Jogadores`**.
- `button.sort-pill` (12 px, letter-spacing 1): texto **`◀ ▶ Ordenando por {MODO}`** com `{MODO}` em `strong` limão. `aria-label`: `Ordenando por {modo}. Trocar ordenação`. Clique → próximo modo.
- **Modos de ordenação** (ordem do ciclo; inicial = OVERALL; o modo persiste enquanto a tela estiver montada):
  1. **OVERALL** — overall na posição natural, desc.
  2. **POSIÇÃO** — `byPosition` (GK, CB, LB, RB, DM, CM, AM, LW, RW, ST; empate por overall desc).
  3. **IDADE** — mais novo primeiro.
  4. **VALOR** — `marketValue` desc.
  5. **CONTRATO** — `contractEnd` asc (vence antes primeiro).

### Linha do elenco (`div.roster-item` > `button.market-row.roster-row`)
- Atributos: `data-player={id}`, `aria-expanded={aberta}`; classes `starter` (titular → filete limão de 3 px à esquerda), `focused` (jogador cujo stats aparece à esquerda → contorno limão 55%).
- Colunas (grid `2.6fr | 54px | 1fr | 0.7fr`):
  1. Bloco identidade: `span.position-tag` (fundo ciano, texto `#04204a`, 800 13 px) com **posição** (`state.position ?? player.position`); `PlayerFace md` (56 × 56 px, raio 8, fundo azul gradiente — sem fundo se bonequinho); nome completo em `strong`; `small` = **`{idade} anos · {salário}/mês · até {ano do fim do contrato}[ · À VENDA][ · Lesionado]`**.
  2. `b.roster-ovr` — **overall** (800 22 px, centralizado).
  3. `strong` — **valor de mercado** (`money`).
  4. `span` — **`Titular`** ou **`Reserva`**.
- Linhas usam fundo ardósia. Não há cabeçalho de colunas.
- Linha aberta (`roster-item.open`): fundo petróleo, texto branco.

### Área expandida (`div.roster-expand`, só na linha aberta)
- Fundo grafite, borda esquerda ciano, animação `roster-open` (fade + desce 4 px, 0,18 s).
- `div.roster-actions` (`role="toolbar"`, `aria-label="Ações de {nome}"`), botões `.roster-action` (6×12 px, 13 px), na ordem:
  **Trocar** · **Número da camisa** · **Renovar contrato** · **Lista de transferências** · **Lista de empréstimos** · **Conversar** · **Evolução e função** · **Dispensar** (classe `danger-text`, vermelho `#c62828` quando inativo) · **Posições e treino** (ícone `Dumbbell` 14).
  - Botão ativo: `active` + `aria-pressed`, fundo petróleo. Clicar no ativo de novo fecha o painel (volta a `summary`). Trocar de ação reseta a confirmação de dispensa.
  - "Posições e treino" mantém a linha aberta e insere o editor nela (ver abaixo).
- Abaixo, quando há ação escolhida, `div.hub-panel` (sem limite de altura dentro da linha) com o conteúdo da ação:

#### Ação **Trocar**
- `p.eyebrow`: **`TROCAR {SOBRENOME} · TITULAR NA POSIÇÃO {função}`** ou **`… · RESERVA`**.
- `p.muted.small`: titular → **`Escolha um titular para trocar de posição ou um reserva para entrar no lugar dele.`**; reserva → **`Escolha o titular que vai sair para ele entrar.`**
- `div.hub-list` de botões: se o aberto é titular, todos os outros jogadores; se é reserva, só os titulares. Ordenados titulares primeiro, depois overall desc. Cada botão: função no slot ou `RES`, foto, nome, posição e overall. Trocas inválidas por indisponibilidade ficam desabilitadas.
- Clique → `swapPlayers(aberto, outro)` (titular↔titular troca posições; titular↔reserva substitui); valida indisponível e goleiro no slot 0; fecha o painel (volta a `summary`) e devolve foco à linha.

#### Ação **Número da camisa**
- `p.eyebrow`: **`NÚMERO DA CAMISA · ATUAL {n|—}`**; `p.muted.small`: **`Escolha um número livre ou um ocupado para trocar com o companheiro.`**
- `div.number-grid` (`role="listbox"`, `aria-label="Números da camisa"`, células `auto-fill minmax(62px,1fr)`): 99 botões `number-cell` (1–99), `role="option"`:
  - `mine` (número atual; fundo dourado `#ffe082→#c99a2e`, `aria-selected`), `taken` (ocupado; opacidade 0,6 + `small` com `shortName` do dono), livre (normal).
  - `title`: `Trocar com {nome}` ou `Usar a {n}`. Clique → `setShirtNumber` (troca com o dono se ocupado). Clique no próprio número não faz nada.

#### Ação **Lista de transferências**
- `p.eyebrow`: **`LISTA DE TRANSFERÊNCIAS`** + (se listado) **` · À VENDA POR {preço}`**.
- `p.muted.small`: **`Valor de mercado estimado: {valor}. Com o atleta listado, clubes da IA enviam propostas que você negocia em Transferências › Negociações.`**
- `NumberStepper` **Preço pedido** (mín. 50.000, passo 250.000, exibe `money`); valor inicial = preço listado ou valor de mercado arredondado a 50 mil.
- `.button-row`: **`Colocar à venda`** / **`Atualizar preço`** (primary) → `onListForSale(id, preço)`; **`Tirar da lista`** (só se listado) → `onListForSale(id, null)`.
- `p.eyebrow` **`MULTA RESCISÓRIA`**; `NumberStepper` **Valor da multa** (mín. 0, passo 100.000; inicial = multa atual ou `valor × 2,5`); botão **`Definir multa`** → `onSetClause`.

#### Ação **Lista de empréstimos**
- Para atletas próprios, permite escolher duração, taxa, divisão salarial e opção ou obrigação de compra antes de selecionar um dos três clubes sugeridos. O clube da IA avalia e aceita ou recusa na hora.
- Para atleta recebido por empréstimo, mostra o clube dono e a data de término; se houver opção de compra, oferece o botão para exercê-la.

#### Ação **Renovar contrato**
- `p.eyebrow` **`RENOVAR CONTRATO · ESTENDER POR`**.
- `ChipGroup` com `renewalOptions` (6, 12, 24, 36, 48, 60 meses) rotulados **`6 meses`**, **`1 ano`**, **`2 anos`**, **`3 anos`**, **`4 anos`**, **`5 anos`**; padrão **3 anos** (reset a cada abertura).
- `div.renewal-terms` (valores em limão): **`Novo salário {money}/mês`** · **`Luvas {money}`** · **`Até {data}`** (de `renewalTerms`).
- Botão primary **`Renovar contrato`** → `onRenew(id, meses)`.

#### Ação **Conversar**
- `p.eyebrow` **`CONVERSA · {PERSONALIDADE} · RELAÇÃO {n}`** (personalidades: Profissional, Ambicioso, Temperamental, Leal, Disciplinado, Líder).
- `div.hub-list` com 3 botões: **Elogiar** — `Reconhece o bom momento e aumenta a moral.`; **Cobrar** — `Exige mais rendimento; a reação depende da personalidade.`; **Prometer minutos** — `Garante oportunidades nos próximos 30 dias.` → `onConversation(id, 'praise'|'challenge'|'promise')`.

#### Ação **Evolução e função**
- `p.eyebrow` **`PLANO DE EVOLUÇÃO`**; `ChipGroup`: `Equilibrado`, `Ataque`, `Criação`, `Defesa`, `Físico` → `onDevelopment`.
- `OptionCycler` **Função em campo**: `Padrão`, `Finalizador`, `Armador`, `Pivô`, `Volante`, `Zagueiro construtor`, `Lateral ofensivo` (setas `ChevronLeft/Right` 18, valor central, pontinhos indicadores) → `onRole`.
- `p.muted.small`: **`O plano acelera a evolução individual. Ritmo de jogo, moral e minutos também influenciam o rendimento e o potencial.`**
- Botão `Dumbbell` **`Posições e treino de posição`** → abre o mesmo editor inline, mantendo a linha expandida.

#### Ação **Dispensar**
- `p.eyebrow` **`DISPENSAR JOGADOR`**; `p.muted.small` **`A rescisão custa metade dos salários restantes do contrato (mínimo de 3 salários). O atleta sai do elenco imediatamente.`**
- Passo 1: botão `danger` (fundo vermelho 75%) `UserX` **`Dispensar · multa {custo}`**.
- Passo 2 (confirmação): **`Confirmar rescisão · {custo}`** (danger) → `onRelease(id)` + **`Cancelar`**.
- No App: `releasePlayer` (erro "Caixa insuficiente para pagar a rescisão." possível), reescala com `bestLineup` se possível, fecha `detail`, aviso `Contrato rescindido. O atleta deixou o clube.`

### Painel de stats (coluna esquerda, `section.panel.player-stats`)
- Jogador exibido (`fp`), por prioridade: jogador do editor "Posições e treino" → jogador **focado** (`focusId`, atualizado por `onFocus` e `onMouseEnter` de cada linha) → jogador aberto (`detail`) → primeiro da lista ordenada.
- `.stats-head` (grid `180px | 1fr`, compacto em celular deitado):
  - **Card do jogador** `div.hub-card.{tier}` (proporção 3:4, raio 10, fundo do tier, texto branco): `hub-card-top` = **overall** (44 px) + **posição** (`state.position ?? position`, 20 px); `PlayerFace` grande (`hub-card-face`, ocupa do topo 8% até a base, `contain`, base embaixo; bonequinho sem fundo se não houver foto); `hub-card-name` = sobrenome caixa alta 22 px numa faixa gradiente `var(--card-name)`. **Sem número no card.**
  - `div.stats-info`: `h2` **nome completo**; `p.eyebrow` **`{posições conhecidas (principal primeiro) separadas por " · "} · {função em campo} · {personalidade}`**; `div.hub-facts` (grid `auto-fill minmax(110px,1fr)`), cada fato = rótulo caixa alta 12 px + `strong` 15 px:
    **Camisa** `{n|—}` · **Idade** · **Overall** · **Potencial** `{mín}–{máx}` (= `potential + potentialDelta ∓ uncertainty`, limitado 1–99) · **Moral** · **Ritmo** `{sharpness}%` · **Valor** · **Salário** · **Contrato** `{dateLabel}` · **Temporada** `{gols} gols · {minutos} min`.
  - Se listado: `p.pill.hub-flag` **`À VENDA · {preço}`**.
- `.hub-summary` (grid `1fr | 180px`; uma coluna no celular deitado):
  - `.attribute-grid` com os **19 atributos** (na ordem do objeto `attributes`), rótulos: Velocidade, Aceleração, Finalização, Passe curto, Passe longo, Visão, Drible, Controle, Força, Resistência, Posicionamento, Marcação, Desarme, Interceptação, Cabeceio, Compostura, Reflexos, Segurança, Elasticidade. Cada item: **`{Rótulo}: {valor}`** + barra `.attr-bar` (largura = valor%); classe `high` (≥80), `mid` (65–79), `low` (<65) colore a barra.
  - `HeatMap compact` na posição atual (ver abaixo).

### Componente `HeatMap`
- `figure.heat-map[.compact].{good|mid|bad}` com SVG 100×140: gramado `#0d6b34`, linhas brancas 55% (borda, meio-campo, círculo, áreas e pequenas áreas), 9 manchas elípticas com gradiente radial vermelho→amarelo→limão→ciano transparente, desfocadas, `mix-blend-mode: screen`; ponto branco = posição da função. Concentradas quando a familiaridade é alta; espalhadas e "puxadas" para a posição de origem quando improvisado.
- `figcaption`: **`{função} · {rótulo de familiaridade} · {n}%`**, `strong` colorido (limão ≥85, âmbar ≥60, vermelho <60).
- Tamanho: normal máx. 200 px de largura/32vh; compacto máx. 130 px/24vh.

### Editor "Posições e treino" (dentro da linha aberta, quando `kitId` definido)
- Cabeçalho `picker-heading`: nome completo e botão **`Fechar editor`** (`ChevronLeft`, `data-back-action`) → fecha apenas o editor e devolve foco à linha do jogador.
- `div.kit-editor` em duas colunas, com dimensões compactas no celular deitado:
  - `kit-side`: `ShirtNumberDial` — botão em forma de **camisa** (`clip-path`), número 54 px; dica **`X/✕ editar número`** / em edição **`← → trocar · X/✕ salvar · B cancelar`** com setas `ChevronLeft/Right` 26 limão; nota dourada **`Em uso por {nome}: os dois trocam`** quando o rascunho coincide com número de outro. Abaixo, `HeatMap` (tamanho normal) na posição selecionada.
  - `kit-main`: eyebrow **`ESCOLHA UMA POSIÇÃO PARA VER O MAPA DE CALOR`**; `div.position-grid` com os 10 `position-chip` (`GK CB LB RB DM CM AM LW RW ST`): sigla, overall na posição, barra de familiaridade e ícone de treino. A posição selecionada usa fundo petróleo; o rótulo acessível informa nome, familiaridade e overall.
  - `div.kit-status` (borda esquerda ciano): `strong` **nome da posição** (ex. `Meia central`); `span` **`{rótulo} · {n}% · OVR {ovr}`**; se treinando, `small` âmbar **`Treinando {posição} · {n}% (apto a partir de 85%)`**.
  - `div.kit-actions`: **`Treinar como {POS}`** (`Dumbbell`; desabilitado se é a posição principal, se familiaridade ≥ 92, ou se mistura goleiro com linha) **ou** **`Parar treino`** se já treina a selecionada; **`Tornar posição principal`** (primary, `Crown`; desabilitado se já é a principal ou familiaridade < 85).
  - `p.muted.small`: **`O treino evolui um pouco por dia (mais rápido em jovens). Fora de posição o OVR cai e o mapa de calor se espalha.`**
- O painel de stats à esquerda mostra o jogador do editor.

## Estados e variações
- Lista fechada / uma linha aberta (só uma por vez — `detail`) / linha aberta com uma ação ativa.
- Linha titular (filete limão), focada (contorno), aberta (azul).
- Sub-estados de ações: dispensa com/sem confirmação; jogador listado/não listado (rótulo do botão, botão "Tirar da lista", flag no painel de stats, "À VENDA" no subtítulo da linha); lesionado ("Lesionado" no subtítulo).
- Editor "Posições e treino" aberto dentro da linha ou fechado; a lista continua presente.
- ShirtNumberDial em repouso/edição/conflito.
- Painel de stats: tier do card muda conforme overall; mapa de calor bom/médio/ruim.
- Sem jogadores: painel de stats não aparece (cai para o campinho).
- Erros possíveis (toast): `Atleta indisponível.`, `A posição exige um goleiro.`, `Escolha um número entre 1 e 99.`, erros de `setTraining`/`setMainPosition`/`releasePlayer`/renovação/venda vindos do motor.
- Avisos (App, `setNotice`): `Contrato renovado. Luvas debitadas do caixa.`, `Conversa registrada na memória do jogador.`, `Multa rescisória atualizada.`, `Empréstimo concluído por {meses} meses.`, `Atleta à venda. As propostas chegam em Transferências › Negociações.` / `Atleta retirado da lista de venda.`, `Contrato rescindido. O atleta deixou o clube.`

## Interações

**Mouse**
- Passar o mouse numa linha → painel de stats mostra o jogador.
- Clique na linha fechada → `openDetail`: abre a linha (fecha outra aberta), reseta meses=36, multa, preço de venda, confirmação, ação=`summary`.
- Clique na linha aberta → fecha.
- Clique numa ação → abre/fecha o painel da ação na linha.
- Clique no `sort-pill` → próximo modo de ordenação.
- Teclas `,` e `.` → modo anterior/próximo (mesmo evento do analógico direito).
- `Esc` = Voltar (recolhe a linha aberta / fecha o editor de posições).

**Controle (PS5 / Xbox)**
- **D-pad / analógico esquerdo ↑↓**: percorre as linhas; cada foco atualiza o painel de stats (via `onFocus`). Ao abrir/fechar uma linha, ela recebe foco e `scrollIntoView({block:'nearest'})`.
- **Analógico direito ←/→** (`useStickX`, intervalo 360 ms): **troca a ordenação** (anterior/próxima) e o pill mostra **"Ordenando por OVERALL/POSIÇÃO/IDADE/VALOR/CONTRATO"**. Ativo **somente** com a lista visível, **sem linha aberta** e **sem editor de posições**.
- **Analógico direito ↑/↓**: rola a lista.
- **✕ / A** na linha: expande; de novo: recolhe.
- Com linha aberta: **↓** entra na barra de ações; **←/→** entre botões; **✕/A** ativa a ação (ou fecha se já ativa); **↓** desce para o conteúdo da ação.
- **○ / B** com linha aberta: o App fecha `detail` (linha recolhe; foco volta à linha). Com editor de posições aberto: **○/B** = **Fechar editor**; outro **○/B** recolhe a linha.
- Com linha aberta, **L1/R1 ficam bloqueados** (não muda de aba principal); **L2/R2** ainda mudam sub-aba (a linha continua aberta no estado).
- `NumberStepper` (preço/multa): **✕/A** abre o teclado numérico virtual; **□/X** liga o modo ajuste (←/→ mudam pelo passo; □ ou ○ saem); fora do modo as setas navegam.
- `ChipGroup`: D-pad + ✕/A. `OptionCycler`: ✕/A entra em edição, ←/→ trocam, ✕/A ou ○/B saem.
- `ShirtNumberDial`: ✕/A ou □/X entra em edição; ←/→ percorrem 1–99 (circular); ✕/A salva; ○/B (ou `Esc`) cancela o rascunho.
- Grade de números (ação Número da camisa): D-pad navega por 99 células; ✕/A escolhe.
- **□ / X** fora de controles editáveis = avançar dia (global!).

## Classes CSS e visual atual
- `.player-stats` (flex coluna, gap 14, rolável), `.stats-head`, `.stats-info`, `.stats-info .hub-facts`, `.hub-card` (+ `.hub-card-top`, `.hub-card-face`, `.hub-card-name`), `.hub-facts span` (fundo azul 8%, raio 6, rótulo 12 px caixa alta, `strong` 15 px), `.hub-flag`, `.hub-summary`, `.attribute-grid` (+ `.attr-bar`, `.mid`, `.high`), `.heat-map`.
- `.panel-heading`, `.sort-pill` (fundo branco 12%, `strong` limão).
- `.roster-list` (flex coluna, gap 2, rolável), `.roster-item`, `.roster-row` (base `.market-row`: grid, padding 7×10, sem caixa alta, peso 500), `.roster-row.starter`, `.roster-row.focused`, `.roster-item.open .roster-row`, `.roster-ovr`, `.position-tag`, `.market-row .player-face.md` (56 px, raio 8), `.market-row small` (`--ink-3`, reticências).
- `.roster-expand`, `.roster-actions`, `.roster-action[.active][.danger-text]`, `.roster-expand .hub-panel`, `@keyframes roster-open`.
- `.hub-panel`, `.hub-list` (+ botões flex), `.number-grid`, `.number-cell[.taken][.mine]`, `.renewal-terms`, `.button-row`, `button.primary`, `button.danger`, `.number-stepper`, `.stepper-row`, `.stepper-format`, `.stepper-hint`, `.option-cycler`, `.cycler-*`, `.chip-group`, `.chips`.
- `.kit-editor`, `.kit-side`, `.kit-main`, `.shirt-dial` (+ `.dial-number`, `.dial-arrow`, `.dial-hint`, `.dial-note`), `.position-grid`, `.position-chip[.main|.known|.ok|.bad|.active|.training]`, `.chip-train`, `.kit-status`, `.kit-actions`.
- Responsivo: no celular deitado o Plantel mantém duas colunas e rolagem; o editor de posições reduz sua grade. Em retrato é exibido o aviso global de orientação.

## Regras que o redesign deve preservar
- **Nada de modal**: clicar expande a linha com as ações (trocar, dispensar, colocar à venda, mudar numeração, emprestar, renovar — e também conversar, evolução/função, posições e treino); o conteúdo da ação aparece inline.
- **Painel esquerdo de stats do jogador focado** (foto em card, nome, número, posição, overall, potencial, idade, estilo/função, personalidade, todos os atributos, mapa de calor) **atualizando ao rolar** a lista com o controle ou o mouse.
- Ordenação por **botão/analógico do controle** com indicador visível **"Ordenando por …"** e os 5 modos (OVERALL, POSIÇÃO, IDADE, VALOR, CONTRATO); bloqueada com linha aberta.
- Uma linha aberta por vez; B fecha; foco retorna à linha.
- Dispensa em dois passos com custo exibido; venda exige preço; empréstimo tem condições configuráveis para três clubes sugeridos; renovação mostra salário/luvas/término antes de confirmar.
- Troca de número com permuta automática com o dono atual.
- Regras de treino de posição (apto ≥85%, teto 92%, GK ↔ linha proibido) e "tornar principal" só com ≥85%.
- Card de stats segue tiers e **fonte branca**; sem foto = bonequinho sem sigla/fundo.
- Tudo 100% FIFA-like e navegável no controle.

## Problemas atuais e oportunidades
- **Sem cabeçalho de colunas** na lista (OVR, valor, status não são rotulados); também não há colunas para idade/contrato quando se ordena por elas (ficam no subtítulo).
- Sem indicação de direção da ordenação nem dica do botão do controle no pill (texto fixo "◀ ▶").
- A ordenação fica indisponível com linha aberta, sem feedback.
- Barra de ações com 9 botões quebra em várias linhas; o painel da ação empurra a lista (longas, como a grade de 99 números, deslocam muito o conteúdo).
- Painel de stats não mostra **pé preferido**, altura/nacionalidade, condição física, lesão/suspensão detalhadas nem histórico; potencial é faixa.
- Atributos sem agrupamento (Ritmo/Finalização/Passe/Drible/Defesa/Físico/Goleiro como no FIFA) — 19 itens lineares, inclusive atributos de goleiro para jogadores de linha.
- Painel de stats tem rolagem própria; em telas baixas o mapa de calor some da vista.
- □/X fora de campos editáveis avança o dia — risco de avançar sem querer durante a gestão.
- Mouse: clicar no menu do header com linha aberta troca de aba mas mantém `detail` setado (L1/R1 ficam bloqueados ao voltar até fechar com B).
- Sem multi-seleção, sem filtro (posição, titular/reserva, à venda), sem busca.
- Não há confirmação antes de colocar à venda/emprestar (ações imediatas).

## Ajustes pós-Ato 7: aba Jogadores

- O ícone da aba Jogadores (e do link "Ver elenco completo") trocou de `Hash` (#) para `Users`.
- A ficha do jogador (`.player-stats`) tem `data-stick-scroll`: o **RS rola apenas a ficha**, enquanto LS/D-pad continuam percorrendo a lista de jogadores à direita. Com controle conectado aparece a dica "RS Rolar ficha".
- O `GamepadProvider` passou a priorizar qualquer área visível e rolável marcada com `data-stick-scroll` no rolar vertical do RS.

## Fase 2: staff e vestiário

- Na ficha do jogador, ação **Evolução e função**, aparece o bloco **Mentoria**: jovens até 21 anos sem mentor listam até 4 veteranos livres (28+, priorizando Líder/Profissional/Disciplinado e mesma posição) com o multiplicador de crescimento; jogadores em dupla mostram o parceiro, os efeitos e o botão "Encerrar mentoria". O contador respeita o limite de 3 duplas. Regras completas em `07-escritorio.md`.