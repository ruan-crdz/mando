# Tela: Criar manager (nova carreira em 3 passos)

## Resumo
Fluxo de criação da carreira em **3 passos** — **MANAGER** (identidade e retrato), **CLUBE** (escolha do time na Série A ou B) e **DESAFIO** (modificador de carreira + dificuldade) — exibido em `screen === 'create'` depois de escolher o mundo. Ao final, "Assumir o clube" cria a carreira e abre a CENTRAL.

## Como se chega / como se sai
**Entrada**: modal Nova carreira › "Brasileirão 2026" ou "Experimentar a demonstração" (`setWorld(...)`, `setScreen('create')`). Sempre começa no passo 0 com valores padrão (o estado não é guardado entre visitas).

**Saída**
- "Voltar" no passo 0 (ou ○/B / L1 no passo 0) → `onBack()` → `setScreen('menu')` (o mundo carregado é mantido em memória, sem efeito visível).
- Passo 2 › "Assumir o clube" → valida o manager → `onStart(manager, club.id, difficulty, challenge)` → `createCareer(world, …)`, `setScreen('career')`, aba 0 (CENTRAL). Erro de criação vira toast.

## Arquivos-fonte
- `src/screens/CreateManager.tsx` — `CreateManager({ world, onStart, onBack, onError, onPortrait })`, constantes `challengeDescriptions`, `difficultyDescriptions`, `nationalities`, `tileColors`.
- `src/App.tsx` — renderização em `screen === 'create'`, `portrait()` (→ `requestPortrait`), `fail` (toast de erro).
- `src/components/PortraitCamera.tsx` — modal da webcam.
- `src/components/controls.tsx` — `OptionCycler`, `NumberStepper`, `ChipGroup`.
- `src/components/ui.tsx` — `Badge`, `ManagerPortrait`, `money`.
- `src/game/types.ts` — `managerSchema`, `challenges`, `difficulties`, tipos `Manager`, `Career['challenge' | 'difficulty']`.
- `src/services/supabase.ts` — `requestPortrait(manager, photo?)` (Edge Function `ai-manager-avatar`, retorna URL).
- Ícones lucide: `ArrowLeft`, `ArrowRight`, `Camera`, `Check`, `Dices`, `Flag`, `LoaderCircle`; na câmera `Camera`, `RefreshCw`, `Sparkles`, `UserRound`.

## Wireframe atual

### Passo 0 — MANAGER
```
┌ header: [logo] MANDO ............................................ (🎮) ┐
│ [①MANAGER]>[2 CLUBE]>[3 DESAFIO]   QUEM ASSUME O MANDO?   [DEMONSTRAÇÃO]│ .creation-top
│ ┌──────────── .panel.manager-form (borda lima) ─────┐ ┌─ .portrait-card ─┐│
│ │ NOME                 SOBRENOME                    │ │   (gradiente     ││
│ │ [Seu nome        ]   [Seu sobrenome     ]         │ │   azul→roxo)     ││
│ │ NACIONALIDADE        IDADE                        │ │  ┌───────────┐   ││
│ │ [‹  Brasil  ›]       [ − ][  38  ][ + ]           │ │  │ retrato / │   ││
│ │  ▬ ▪ ▪ ▪ ▪ ▪ ▪ …                                  │ │  │ silhueta  │   ││
│ │ ROUPA                                             │ │  └───────────┘   ││
│ │ [TERNO AZUL] [AGASALHO] [CAMISA SOCIAL]           │ │ MANAGER          ││
│ │ APARÊNCIA (PARA O RETRATO)                        │ │ NOME SOBRENOME   ││
│ │ [Cabelo curto escuro, barba curta, olhos…      ]  │ │ Brasil · 38 anos ││
│ └───────────────────────────────────────────────────┘ │[📷 CRIAR RETRATO]││
│                                                       └──────────────────┘│
│ [← VOLTAR]            [escudo] SÃO PAULO / 01 JAN 2026      [CONTINUAR →] │ .creation-footer
└ footer: (✕) SELECIONAR (○) VOLTAR ─────────────────────────────────────────┘
```

### Passo 1 — CLUBE
```
│ [✓MANAGER]>[②CLUBE]>[3 DESAFIO]   ESCOLHA O SEU CLUBE                    │
│ [SÉRIE A | SÉRIE B]   [🎲 ALEATÓRIO]                                      │ .club-step-bar
│ ┌azul───┐┌verde──┐┌laranja┐┌roxo───┐┌rosa───┐┌ciano──┐ →                  │ .club-grid.carousel
│ │  ✓    ││       ││       ││       ││       ││       │                    │
│ │[ESCUDO]││[ESCUDO]│ …                                                    │
│ │SÃO    ││PALMEI-│                                                        │
│ │PAULO  ││RAS    │                                                        │
│ │★★★★☆  ││★★★★★  │                                                        │
│ │R$ 90mi││       │                                                        │
│ │orçam. ││       │                                                        │
│ │32 atl.││       │                                                        │
│ │· SP   ││       │                                                        │
│ └───────┘└───────┘                                                        │
│ [← VOLTAR]            [escudo] SÃO PAULO / 01 JAN 2026      [CONTINUAR →] │
```

### Passo 2 — DESAFIO
```
│ [✓MANAGER]>[✓CLUBE]>[③DESAFIO]   TODA HISTÓRIA TEM UM DESAFIO           │
│ ┌azul────┐┌verde───┐┌laranja─┐┌roxo────┐┌rosa────┐┌ciano───┐┌azul───┐ →  │ .challenge-grid.carousel
│ │ ⚑   ✓  ││ ⚑      ││ ⚑      ││ ⚑      ││ ⚑      ││ ⚑      ││ ⚑     │    │
│ │REALISTA││DO ZERO ││CRISE   ││SÓ A    ││VENDA   ││PRESSÃO ││RECONS-│    │
│ │descr.  ││descr.  ││FINANC. ││BASE    ││NECESS. ││MÁXIMA  ││TRUÇÃO │    │
│ └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘└───────┘    │
│ ┌ INICIANTE ───────┐┌ AMADOR (branco) ─┐┌ PROFISSIONAL ─────┐             │ .difficulty-row
│ │ descrição        ││ descrição        ││ descrição         │             │
│ └──────────────────┘└──────────────────┘└───────────────────┘             │
│ [← VOLTAR]            [escudo] SÃO PAULO / 01 JAN 2026  [ASSUMIR O CLUBE →]│
```

## Elementos

### Topo (`.creation-top`, sempre)
| Elemento | Detalhe |
|---|---|
| `.step-track` | 3 chips em seta (`clip-path`): **MANAGER**, **CLUBE**, **DESAFIO**. Cada um com bolinha `b` (número 1/2/3 ou `Check` 14px se concluído). Ativo: gradiente ciano→azul, texto branco; concluído: texto lima; futuro: cinza `--ink-3`. Não é clicável |
| `h1.screen-title` | Por passo: **"Quem assume o Mando?"** / **"Escolha o seu clube"** / **"Toda história tem um desafio"** (itálico 800 caixa alta `clamp(26px,3vw,44px)`) |
| `.demo-chip` | "DEMONSTRAÇÃO" amarelo, só se `world.mode === 'demo'` |

### Passo 0 — Manager (`.creation-grid`: formulário 1.5fr + retrato ≥280px)
**Formulário** (`section.panel.manager-form`, borda superior lima; `.form-grid` 2 colunas):
| Campo | Componente | Valor padrão | Regras |
|---|---|---|---|
| **Nome** | `<input>` placeholder "Seu nome", `data-autofocus` | `''` | `maxLength 35`; schema: mínimo 2 letras após `trim` → erro "Informe um nome com pelo menos duas letras." |
| **Sobrenome** | `<input>` placeholder "Seu sobrenome" | `''` | `maxLength 45`; mínimo 2 → "Informe um sobrenome com pelo menos duas letras." |
| **Nacionalidade** | `OptionCycler` | "Brasil" | 12 opções: Brasil, Argentina, Portugal, Uruguai, Chile, Colômbia, Espanha, Itália, França, Alemanha, Japão, Angola (com pontinhos indicadores) |
| **Idade** | `NumberStepper` (min 18, max 85, step 1) | 38 | Vazio vira 18; schema: "O manager deve ter entre 18 e 85 anos." |
| **Roupa** (linha inteira) | `ChipGroup` | "Terno azul" | Terno azul / Agasalho / Camisa social. Muda a cor da silhueta e entra no prompt do retrato |
| **Aparência (para o retrato)** (linha inteira) | `<textarea rows=2>` | "Cabelo curto escuro, barba curta, olhos castanhos" | `maxLength 400`; usada pela IA |

**Cartão de retrato** (`section.portrait-card`, gradiente `#31b5ff → #6a35f0 → #3a128f` com brilho radial):
| Elemento | Detalhe |
|---|---|
| `.portrait-frame` | `ManagerPortrait manager large`: foto IA (`manager.avatar`) ou silhueta SVG com iniciais e cor da roupa |
| `.portrait-loading` (`role=status`) | Durante a geração: overlay escurecido com `LoaderCircle` 42px girando e "Produzindo seu retrato…"; a silhueta pulsa |
| `.portrait-caption` | `span` "MANAGER" (lima, 12px); `h2` **"{firstName \|\| 'Seu nome'} {lastName}"** (itálico 26px); `p` **"{nationality} · {age} anos"** |
| `button.ai-portrait-button` | Faixa inteira rosa→laranja, 18px, ícone `Camera`. Texto: "Criar retrato com sua foto" (sem avatar) / "Gerar outro retrato" (com avatar) / "Gerando…" (desabilitado durante a geração) |

### Modal da câmera (`PortraitCamera`, `Modal title="Retrato do manager" wide`)
Aberto pelo botão de retrato ou △/Y — **só se Nome e Sobrenome estiverem preenchidos** (senão toast "Preencha nome e sobrenome antes de gerar o retrato.").
| Elemento | Detalhe |
|---|---|
| `.camera-frame.{loading\|live\|denied}` | Quadrado `min(50vh,52vw,520px)`, borda ciano 3px. Vídeo da webcam espelhado (`facingMode: 'user'`, ideal 1280×720) ou a foto capturada. `.face-guide`: oval tracejado lima para posicionar o rosto (só ao vivo e sem foto). Mensagens: "Abrindo a câmera…" (loading) / `UserRound` 40 + "Câmera indisponível ou bloqueada. Libere a câmera no navegador ou gere pela descrição." (denied) |
| `.camera-side` | `.eyebrow` "COMO FUNCIONA"; `h3` "Seu rosto no jogo"; texto "Tiramos uma foto sua e a IA transforma você em um manager com visual de jogo de futebol, usando a roupa escolhida: **{style}**."; nota "A foto só é usada para gerar o retrato e não fica salva." |
| `.camera-actions` (coluna, botões 46px) | Sem foto: `primary` "📷 Tirar foto" (`data-autofocus`, desabilitado se a câmera não está ao vivo). Com foto: `primary` "✨ Gerar com esta foto" (`data-autofocus`) + "↻ Tirar outra". Sempre: "👤 Gerar pela descrição" |
- Captura: recorte quadrado central 640×640, espelhado, JPEG 0.86 (data URL).
- "Gerar…" fecha o modal e chama `generate(photo?)` → `onPortrait(manager, photo)` → `requestPortrait` (sessão anônima + Edge Function `ai-manager-avatar`) → `manager.avatar = url` + vibração `confirm`. Erro → toast vermelho.
- Fechar ("Voltar"/○/B) cancela e desliga a câmera.

### Passo 1 — Clube (`.club-step`)
| Elemento | Detalhe |
|---|---|
| `.segmented` | Botões **"SÉRIE A"** / **"SÉRIE B"** (estado `league`, padrão A). Filtra `world.clubs` por `club.league` |
| `button.ghost-button` "🎲 Aleatório" | Sorteia um clube da série visível (`crypto.getRandomValues`) |
| `.club-grid.carousel` | Um `button.club-option` por clube da série, cores ciclando `tile-blue, tile-green, tile-orange, tile-purple, tile-pink, tile-cyan`, largura `clamp(190px,16vw,240px)`, opacidade .86 |
| Conteúdo do cartão | `Badge` large (escudo `clamp(76px,12vh,120px)`); `h3` **`club.name`** (itálico 22px); `.stars` = `★` × `max(1, round(club.reputation/20))` em amarelo + restantes até 5 em branco 30%; `p` **`money(club.budget)`** + "orçamento"; `small` **"{nº de atletas do clube em world.players} atletas · {club.state}"** |
| Selecionado | `.selected` (opacidade 1, contorno branco 4px interno), `aria-pressed`, ícone `Check` em círculo branco no canto superior direito (`.selected-check`) |
- Ao entrar no passo ou trocar de série, o cartão selecionado é rolado para o centro.
- Foco apenas navega pelos cartões; a seleção exige clique, toque ou confirmação ✕/A. O botão Aleatório também confirma uma escolha.

### Passo 2 — Desafio (`.challenge-layout`)
**Desafios** (`.challenge-grid.carousel`, `button.choice-card`, cores ciclando, largura `clamp(220px,21vw,300px)`, texto embaixo; ícone `Flag` 24; `h3` itálico 28px; `p` 14px):
| Desafio | Descrição exibida |
|---|---|
| **Realista** (padrão) | As condições iniciais do snapshot, sem modificadores. |
| **Do zero** | Orçamento inicial de transferências zerado. Venda para reconstruir. |
| **Crise financeira** | Dívida 60% maior e metade do caixa inicial. |
| **Só a base** | Contrate apenas atletas até 23 anos. Três jovens devem começar cada partida. |
| **Venda necessária** | Venda R$ 10 milhões em atletas antes de contratar. |
| **Pressão máxima** | Confiança inicial menor. Derrotas pesam duas vezes mais. |
| **Reconstrução** | Veteranos começam com menor condição física e orçamento 40% menor. |
Selecionado: `.selected` (contorno branco, opacidade 1) + `Check`.

**Dificuldade** (`section.difficulty-row`, 3 `button.difficulty-card` lado a lado, fundo branco 8% e borda esquerda 4px):
| Dificuldade | Descrição |
|---|---|
| **Iniciante** | Informações claras, negociação tolerante, diretoria paciente e recomendações completas. |
| **Amador** (padrão) | Negociação equilibrada, cobrança normal e adversários que reagem ao placar. |
| **Profissional** | Scouting com incerteza, salários mais exigentes, moral sensível e ajustes táticos frequentes. |
Selecionada: fundo branco, texto azul, borda esquerda lima.

### Rodapé da criação (`.creation-footer`, sempre)
| Elemento | Detalhe |
|---|---|
| `button.ghost-button` | `ArrowLeft` + "Voltar" (passo anterior ou menu) |
| `.selected-club` | Sem escolha: **"Clube não selecionado"**, sem escudo. Após escolher: `Badge` small + **nome do clube selecionado** + data fixa **"01 JAN 2026"** |
| `button.primary.big` | "Continuar →" (passos 0–1) / **"Assumir o clube →"** (passo 2) |

Valores padrão: nenhum clube selecionado, série A, desafio Realista, dificuldade Amador. Não há clube de fallback.

## Estados e variações
- **Validação**: "Continuar"/"Assumir" valida `managerSchema` em **todos** os passos; falha → toast vermelho 4s com a primeira mensagem e o passo não muda (não há destaque no campo).
- **Clube obrigatório**: na etapa CLUBE, continuar sem seleção exibe "Escolha um clube antes de continuar." e não avança. A mesma proteção existe ao assumir.
- **Retrato**: sem avatar (silhueta), gerando (overlay + botão desabilitado "Gerando…"), com avatar (foto + "Gerar outro retrato"), erro (toast; mantém o anterior).
- **Câmera**: carregando, ao vivo (guia oval), negada/indisponível (mensagem + só "Gerar pela descrição"), foto capturada (prévia + gerar/tirar outra).
- **Sem IA / Supabase não configurado / offline**: o botão de retrato continua ativo; ao gerar, toast de erro (ex.: "Supabase não configurado. Consulte a conexão no menu." ou "Não foi possível gerar o retrato…"). O manager segue com a silhueta — o retrato é opcional.
- **Mundo demo**: chip DEMONSTRAÇÃO; clubes com nomes/escudos reais e atletas fictícios.
- **Troca de série**: troca a lista e limpa a escolha anterior; exige confirmar um clube da série visível.
- Data no rodapé é fixa "01 JAN 2026" (não vem do mundo).

## Interações

### Mouse / toque
Digitar nos campos; setas do `OptionCycler`; botões −/+ da idade; chips; clicar cartões de clube/desafio/dificuldade; Voltar/Continuar/Assumir; botão de retrato e botões da câmera.

### Controle (ações registradas pela própria tela; o App não registra atalhos em `create`)
| Botão (PS / Xbox) | Ação |
|---|---|
| ✕ / A | Confirma o foco. Em **Nome/Sobrenome/Aparência** abre o **teclado virtual** (ver design system). No **OptionCycler** entra/sai do modo edição. Na **Idade** abre o **teclado numérico** |
| ○ / B | Se a câmera estiver aberta: fecha o modal (via "Voltar" do modal). Se um controle estiver em edição: sai da edição. Senão: **passo anterior** (no passo 0 volta ao menu) |
| L1 / LB | Passo anterior (mesmo que ○) |
| R1 / RB | Avança (`next()`, com validação) — só nos passos 0 e 1 e com a câmera fechada. No passo 2 **não** confirma (é preciso apertar "Assumir o clube") |
| △ / Y | No passo 0, sem câmera e sem gerar: abre a câmera do retrato |
| □ / X | Em controles com `data-toggle-edit` (Nacionalidade, Idade): entra/sai do modo ajuste |
| ←/→ em modo edição | Nacionalidade: troca a opção (circular). Idade: ±1 (limitado 18–85) |
| L2 / R2 | No passo 1 alterna **SÉRIE A/SÉRIE B** (o provider cicla o `.segmented` do `main`) |
| D-pad / analógico esq. | Navegação espacial; no passo 1 mover pelos cartões **já seleciona o clube**; carrosséis centralizam o item focado |
| Analógico direito | Horizontal rola os carrosséis; vertical rola o painel |
| Options / ☰ | Sem efeito (fora do teclado virtual, onde salva) |

Teclado: `Esc` = ○; `[`/`]` = L1/R1; `q`/`e` = L2/R2 (troca série); setas navegam fora de campos.

Vibração: `confirm` quando o retrato fica pronto; `error` nos toasts de erro (via `fail`).

## Classes CSS e visual atual
- `.screen.creation`, `.creation-top`, `.step-track` (`span.active/.done`, `b`), `.screen-title`, `.demo-chip`.
- `.creation-grid` (grid 1.5fr / ≥280px, gap 18px), `.panel.manager-form` (borda superior lima), `.form-grid` (2 colunas; `.full` ocupa a linha), `label`, `input`, `textarea`, `.option-cycler`, `.number-stepper`, `.chip-group`.
- `.portrait-card(.generating)`, `.portrait-frame`, `.portrait-loading`, `.portrait-caption`, `.ai-portrait-button`, `.manager-portrait(.large)`.
- `.portrait-camera` (grid vídeo | lado), `.camera-frame(.loading/.live/.denied)`, `.face-guide`, `.camera-side`, `.camera-actions`.
- `.club-step`, `.club-step-bar`, `.segmented`, `.ghost-button`, `.club-grid.carousel`, `.club-option(.selected)` + `.tile-*`, `.stars` (amarelo; `i` apagadas), `.selected-check`.
- `.challenge-layout`, `.challenge-grid.carousel`, `.choice-card(.selected)`, `.difficulty-row`, `.difficulty-card(.selected)`.
- `.creation-footer`, `.selected-club`, `button.primary.big`.
- Mobile (≤760px): grades em 1 coluna, cartão de retrato ≥420px, carrosséis ≥300px, dificuldades empilhadas; câmera empilhada em telas baixas/estreitas.

## Regras que o redesign deve preservar
1. Três passos com indicador de progresso (MANAGER › CLUBE › DESAFIO) e título por passo.
2. Campos: nome (2–35), sobrenome (2–45), nacionalidade (12 opções), idade (18–85, padrão 38), roupa (3 opções), aparência (até 400). Todos operáveis no controle (teclado virtual, cycler, stepper, chips).
3. Validação com mensagens do schema exibidas em toast que some sozinho.
4. Pré-visualização ao vivo do manager (nome, nacionalidade, idade, roupa refletida na silhueta).
5. Retrato por IA opcional: com foto da webcam (guia de rosto, tirar/tirar outra/gerar) ou só pela descrição; estado "Produzindo seu retrato…"; aviso de privacidade; exige nome e sobrenome.
6. Escolha explícita de clube por série (A/B), botão Aleatório, cartões com escudo, nome, estrelas de reputação, orçamento, nº de atletas e estado. Foco e seleção são estados separados; não pré-selecionar um clube.
7. Sete desafios e três dificuldades com descrições completas e padrões Realista/Amador.
8. Resumo persistente do clube escolhido e botões Voltar / Continuar / Assumir o clube.
9. Atalhos: ○/L1 voltar passo, R1 avançar (passos 0–1), △ câmera.

## Problemas atuais e oportunidades
- **Validação só por toast**: o campo com erro não é destacado e o toast some; no passo 1/2 um erro do passo 0 aparece sem levar o jogador de volta.
- O `step-track` não é clicável (nem por mouse) para voltar a um passo concluído.
- No passo 2, R1 não confirma — inconsistente com os outros passos (intencional para evitar criar sem querer; o redesign pode exigir "segurar ✕" ou um popup de confirmação).
- Data "01 JAN 2026" fixa no rodapé; deveria vir do mundo e mostrar também a série/divisão.
- Cartões de clube com cores aleatórias por índice (não pela cor do clube) — no FIFA a seleção de time usa a identidade do clube. Faltam: estádio (`club.stadium` existe no mundo), força/overall médio, principais jogadores (cards com foto), objetivo da diretoria, dívida.
- Estrelas derivadas de `reputation/20` arredondado: muitos clubes empatam em 4★; usar meia estrela como no FIFA.
- Desafio e dificuldade estão na mesma tela com hierarquias diferentes (carrossel colorido vs. linha branca); o FIFA separaria em "Configurações da carreira" com OptionCyclers.
- Formulário do passo 0 parece "formulário web"; poderia ser uma tela de "editor de manager" estilo FIFA, com o retrato grande central e opções em lista à esquerda (cada linha = OptionCycler).
- O retrato sem IA mostra **iniciais** na silhueta (contraria a regra "silhueta sem sigla").
- O botão de retrato fica ativo mesmo sem IA disponível (offline/sem Supabase) e só falha depois; poderia ser desabilitado com explicação.
- Não há resumo final antes de "Assumir o clube" (manager + clube + desafio + dificuldade num cartão de confirmação).

## Estado do redesign MANDO 27 LEGACY
- **Lote 2 implementado:** trilha dos três passos, editor/retrato, seleção de clube e desafio agora usam a paleta escura e estados selecionados/foco separados.
- Mantidos campos, validações, opções, ordem dos passos, atalhos, seleções e estado do save; não houve mudança na engine.
- Revisei visualmente as três etapas em desktop e os estados de manager/clube no viewport móvel; a etapa de desafio em mobile ainda requer revisão por lote.
