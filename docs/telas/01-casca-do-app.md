# Tela: Casca do app (moldura do jogo)

## Resumo

A casca (`Game` em `src/App.tsx`) é a moldura persistente de todo o jogo: fundo animado, **header** (marca, abas principais, clube/data/caixa, status de conexão e controle), **área de palco** (`main.stage`) onde as telas são trocadas com animação, **footer** com dicas de controle e status do save, e uma camada de **overlays globais** (toasts, barra de voz, conquistas, "Processando…", overlay de simulação contínua, aviso de atualização PWA e orientação de tela) e **modais globais** (Nova carreira, Pausa, Preferências de avanço, Conquistas, Dia de jogo, Sala de imprensa, Excluir carreira). Também concentra os atalhos globais do controle e todo o estado da carreira (salvamento local e na nuvem). Em celulares, o jogo só funciona na horizontal: o manifesto PWA solicita orientação landscape e uma tela de instrução cobre o jogo em retrato.

## Como se chega / como se sai

- É montada uma vez em `App()` dentro de `<GamepadProvider>`; nunca sai.
- `screen` (estado) define o conteúdo do palco: `'menu'` (inicial) → `MainMenu`; `'create'` → `CreateManager`; `'career'` → partida (`MatchScreen`) se `career.activeMatch`, senão uma das 5 abas.
- Transições: menu → (popup Nova carreira) → create → career; career → (Pausa › "Salvar e sair para o menu") → menu; menu → "Continuar/Carregar" → career (aba 0).

## Arquivos-fonte

- `src/App.tsx` — `Game`, `PressConference`, constantes `tabs`, `advanceModes`, `stopNotes`.
- `src/controller/GamepadProvider.tsx` (`useGamepad`, `useControllerActions`), `ControllerButtonHint.tsx`.
- `src/components/ui.tsx` (`Badge`, `dateLabel`, `money`, `Modal`), `voice.ts` (`useVoice`, `stopVoice`, `skipVoice`), `LivingPanels.tsx` (`MatchOdds`).
- `src/audio/music.ts`, `src/audio/crowd.ts`; `src/game/achievements.ts`; `src/game/press.ts`; `src/services/storage.ts`, `src/services/supabase.ts`; `virtual:pwa-register`.
- Telas filhas: `screens/MainMenu.tsx`, `CreateManager.tsx`, `CareerCentral.tsx`, `Squad.tsx`, `Transfers.tsx`, `Office.tsx`, `Season.tsx`, `Match.tsx`.

## Wireframe atual

```
┌───────────────────────────────────────────────────────────────────────────────┐ .game-shell (100dvh, grid 3 linhas)
│ [logo] MANDO   [L1] CENTRAL  TIME  TRANSFERÊNCIAS  ESCRITÓRIO•  TEMPORADA [R1]  │ .app-header
│                                              ┌──────────────────┐  (⌁) (🎮)    │   .club-header  .header-status
│                                              │[escudo] 01 jan.  │              │
│                                              │         R$ 12 mi │              │
├───────────────────────────────────────────────────────────────────────────────┤
│ [DEMONSTRAÇÃO · Atletas e finanças sintéticos]   (só em mundo demo)            │ main.stage
│                                                                               │  (conteúdo da tela/aba,
│                         CONTEÚDO DA TELA ATUAL                                │   entra deslizando da direita)
│                                                                               │
│                ┌───────── toast (topo central, some sozinho) ─────────┐       │
│                                                                               │
│                ┌─ calendário modal (só simulando) ───────────┐              │
│                │ data · 5 dias · contadores · próximo evento│ ┌conquista┐ │
│                │                                   [Parar]  │ └────────┘ │
│                └────────────────────────────────────────────┘             │
├───────────────────────────────────────────────────────────────────────────────┤
│ (✕) SELECIONAR (○) VOLTAR (□) AVANÇAR DIA (R2) SUB-MENU (Options) PAUSA  ✓SALVO│ .app-footer
│                                                  [voice-bar: Caixa postal 1/3 ⏭ ■] [Processando…] │
└───────────────────────────────────────────────────────────────────────────────┘
```

No menu e na criação o header tem só marca + status (sem abas e sem clube); na partida as abas somem mas o bloco do clube continua.

## Elementos

### Fundo

| Elemento               | Detalhe                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.game-shell`          | Classes dinâmicas: `input-{mouse\|keyboard\|xbox\|playstation}`, `on-{menu\|create\|career}`, `in-match` durante a partida                             |
| `.bg-stage`            | Grade 64px + 3 feixes `.beam.b1/b2/b3` (ciano, lima, rosa) animados (ver design system)                                                                |
| `.orientation-warning` | Em celular estreito na vertical, cobre o jogo com "Vire o celular"; desaparece ao girar para landscape. O PWA também solicita `orientation: landscape` |

### Header (`header.app-header`, grid `auto 1fr auto auto`, min-height 64px)

| Elemento                                       | O que mostra                                                                                                                                                                                                                                                                                                   | Quando                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `.brand`                                       | `picture` com a nova marca horizontal `/logo-mando.png` (150×42, object-fit contain); até 1000px usa o símbolo `/logo-mando-160.png` (46×42). Sem repetir "MANDO" como texto                                                                                                                                   | Sempre                                                           |
| `nav.main-nav` (`aria-label="Áreas do clube"`) | `.nav-shoulder` com dica `previousTab` (L1/LB, sem texto) · 5 botões `tabs = ['CENTRAL','TIME','TRANSFERÊNCIAS','ESCRITÓRIO','TEMPORADA']` · `.nav-shoulder` com dica `nextTab` (R1/RB). Ativa: branca com brilho ciano e sublinhado ciano→lima de 4px (`::after`); inativas: `--ink-3`; `aria-current="page"` | `screen==='career'` e fora de partida                            |
| `b.nav-dot`                                    | Bolinha laranja com glow no canto da aba **ESCRITÓRIO** (índice 3)                                                                                                                                                                                                                                             | Quando `career.messages` tem alguma com `important && !resolved` |
| `.club-header`                                 | `Badge` small do clube + `strong` data `dateLabel(career.date)` (ex.: "01 de jan. de 2026", caixa alta 17px) + `small` caixa `money(career.finances[career.clubId].cash)` em lima. Fundo branco 10%, borda esquerda lima 4px                                                                                   | `screen==='career'` (inclusive na partida)                       |
| `.header-status`                               | `WifiOff` 18px (title "Offline") quando `offline` (`!navigator.onLine`); ícone `Gamepad2` 20px `.controller-status` — fica **lima com glow** quando há controle conectado; `title` = id do controle ou "Conecte um controle e pressione um botão"                                                              | Sempre (oculto ≤1100px)                                          |

### Palco (`main.stage`)

- `key = "{screen}-{tab|match}"` → a cada troca de tela, aba ou entrada/saída de partida o conteúdo é remontado e roda `stage-in` (0.32s, desliza 46px da direita + fade).
- `inert` enquanto há `popup`, `press`, `deleting`, `busy` ou `running` (bloqueia foco e clique por baixo dos modais). Durante `running`, o header também fica `inert`.
- `.demo-strip` "DEMONSTRAÇÃO · Atletas e finanças sintéticos" (amarelo) no topo das abas quando `career.mode === 'demo'`.
- Abas: 0 `CareerCentral`, 1 `Squad`, 2 `Transfers`, 3 `Office`, 4 `Season`; partida: `MatchScreen` (recebe `paused = Boolean(popup) || busy`).

### Footer (`footer.app-footer`, gradiente escuro de baixo para cima)

| Elemento                       | Detalhe                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.hints`                       | Sempre: `confirm` "Selecionar", `back` "Voltar". Na carreira fora de partida: `secondary` "Avançar dia", `nextView` "Sub-menu", `menu` "Pausa". Os `kbd` coloridos só aparecem com controle; com mouse/teclado só o texto |
| `.save-status` (`role=status`) | Só na carreira: `LoaderCircle` girando + "SALVANDO" (cinza) / `CheckCircle2` + "SALVO" (lima) / `X` + "ERRO NO SAVE" (vermelho)                                                                                           |

### Overlays globais (fora do palco)

| Elemento                                         | Conteúdo                                                                                                                                                                           | Posição / duração                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `.compatibility-note`                            | "Controle detectado sem mapeamento padrão. Ative o modo XInput do controle."                                                                                                       | Inferior central, enquanto `controller.unsupported`                                    |
| `.toast.success` / `.toast.error`                | Texto de `notice` ou `error` (`role=status`/`alert`)                                                                                                                               | Topo central (`top:76px`). **Some sozinho**: notice 2,6s, erro 4s. Sem botão de fechar |
| `.voice-bar`                                     | Ícone `Radio` pulsando; `small` "Caixa postal · {position}/{total}" ou "Recado"; `b` título do recado; botão `SkipForward` "Pular recado" (se `total > 1`); botão `Square` "Parar" | Inferior direita (`right:104px; bottom:3px`), enquanto `voice.current`                 |
| `.achievement-toast.tier-{bronze\|silver\|gold}` | `Award` 30px; "Conquista desbloqueada"; título; descrição                                                                                                                          | Inferior direita, 4,2s cada (fila `unlocked`), vibra `goal`                            |
| `.busy-indicator`                                | `LoaderCircle` + "Processando…"                                                                                                                                                    | Inferior direita enquanto `busy`                                                       |
| `.simulation-dialog`                             | ver "Simulação contínua" abaixo                                                                                                                                                    | Modal central, com calendário horizontal                                               |
| `.pwa-update`                                    | "Nova versão do Mando disponível." + `primary` "Atualizar jogo" (desabilitado enquanto salva; aguarda a fila de save e recarrega) + "Depois"                                       | Inferior central; **não** some sozinho                                                 |

### Simulação contínua (`running`)

- Disparada por `advance()` quando `career.prefs.advance` é `'event'` ou `'auto'` (no modo `'day'` só avança um dia, sem overlay). Se `career.sacked`, em vez de avançar vai para a aba ESCRITÓRIO.
- A cada **110ms** chama `advanceStep(career, world, mode)`; conta jogos simulados em `played`.
- `AdvanceOverlay`, em `src/components/CareerCalendar.tsx`: painel `.hub-modal.simulation-dialog`, data ao vivo, cinco células (duas passadas, hoje e duas futuras), marcadores reais, dias desde `advanceStartedAt`, partidas simuladas, próximo compromisso e botão Parar com `data-autofocus`/`data-stop-run`. Substitui a cápsula antiga; ver [simulação contínua](11-overlay-simulacao-continua.md).
- Durante `running`, header e palco ficam bloqueados; troca de abas e atalho para Escritório são desativados. `advance()` evita duplo início.
- **Como parar**: clicar em Parar; ou **✕/A, ○/B, □/X ou START/Options** no controle (o `GamepadProvider` intercepta qualquer um desses enquanto existir `[data-stop-run]`); `Esc` também (back).
- Paradas automáticas (`result.stop`) → toast + vibração `whistle`:
  | stop       | Toast                                                    | Efeito extra               |
  | ---------- | -------------------------------------------------------- | -------------------------- |
  | `match`    | "Dia de jogo! O avanço parou."                           | Abre modal **Dia de jogo** |
  | `decision` | "Uma decisão espera por você no escritório."             | Vai para ESCRITÓRIO        |
  | `message`  | "Nova mensagem no escritório."                           | Vai para ESCRITÓRIO        |
  | `season`   | "Temporada encerrada."                                   | —                          |
  | `sacked`   | "Você foi demitido. Escolha um novo clube na Diretoria." | Vai para ESCRITÓRIO        |
- Erro na simulação para e mostra toast de erro.

### Modais globais (todos via `Modal`, com "‹ Voltar" no cabeçalho)

| Modal (`popup`)             | Título                                 | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'world'`                   | "Nova carreira" (wide)                 | Ver `03-popup-nova-carreira.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `deleting`                  | "Excluir carreira?"                    | Ver `05-popup-excluir-carreira.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `'pause'`                   | "Pausa" ou "Jogo pausado" (em partida) | Lista vertical `.pause-options` (botões 18px alinhados à esquerda): `primary` "← Continuar"; "Vibração: Ligada/Desligada" (`Vibrate`/`VibrateOff`); "Testar vibração" (vibra `goal` e escreve diagnóstico em `.haptic-note`: vibração desligada / DualSense direto / sugerir conectar DualSense / nenhum controle / navegador não suporta); "Conectar DualSense (vibração)" (só se WebHID suportado e não conectado; mensagens de sucesso/erro, inclusive "O navegador exige um clique…"); "Sons do menu: Ligados/Desligados" (`Volume2`/`VolumeX`); "Música: Ligada/Desligada" (`Music`/`VolumeX`); "■ Parar caixa postal" (se há voz); "Avanço do calendário: {título do modo}" (`CalendarClock`, fora de partida → abre Preferências); "Conquistas (x/total)" (`Award`); "Instalar Mando" (se o navegador ofereceu `beforeinstallprompt`); "Salvar e sair para o menu" |
| `'prefs'`                   | "Preferências de avanço" (wide)        | Três cards: **Um dia por vez**, **Parar em eventos**, **Nunca parar**, com explicação e estado ativo. Escolha petróleo/ciano, foco no modo persistido e glifos do dispositivo. Selecionar grava `career.prefs.advance`, fecha para o jogo e confirma por toast; cancelar volta à Pausa quando aberto por ela.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `'achievements'`            | "Conquistas" (wide)                    | Resumo X/22 com medidor e 22 placas carvão/ardósia, tier textual BRONZE/PRATA/OURO, Award ou cadeado, título, descrição e data/bloqueio. O corpo rola; "Voltar" retorna à **Pausa**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `'prematch'`                | "Dia de jogo"                          | `.eyebrow` data longa; `h2` "{formação} · {mentalidade}"; texto "Confira lesões, suspensões e condição física antes de entrar em campo."; `MatchOdds` do próximo jogo; botões "Coletiva pré-jogo", "Revisar escalação" (vai à aba TIME), `primary` "Começar partida →" (valida que há jogo hoje, cria `activeMatch`, vibra `whistle`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `press` (`PressConference`) | "Sala de imprensa" (wide)              | Manchete (`.eyebrow`), barra de progresso `.press-progress` (um traço por pergunta: feito/ativo), pergunta com 🎙, repórter, veículo e texto (lido em voz pelo `playVoice`, voz `reporter`), respostas `.press-answer` (tom em negrito + texto; a 1ª com autofocus), nota "Suas respostas mexem com a confiança da diretoria e o moral do elenco.". Ao responder a última: aplica e toast "Coletiva encerrada. A repercussão está no Escritório.". "Voltar" pula (aplica respostas já dadas). Aparece após `finishMatch` (pós-jogo) ou pelo botão "Coletiva pré-jogo"                                                                                                                                                                                                                                                                                                      |

## Estados e variações

- **Menu/criação**: header com marca e status apenas; footer só "Selecionar/Voltar"; sem save-status.
- **Carreira (abas)**: header completo; footer com 5 dicas + save-status.
- **Partida** (`in-match`): sem abas, clube visível, footer só "Selecionar/Voltar"; música suspensa e torcida (`startCrowd`) ligada se a música estiver ativa.
- **Mundo demo**: faixa DEMONSTRAÇÃO.
- **Busy** (`run()` em andamento): `lock` impede operações paralelas, `busy-indicator` aparece, `main` fica `inert`, atalhos de tela do controle desativados (`useControllerActions({})`), troca de aba bloqueada.
- **Offline**: ícone `WifiOff`; Escritório recebe `aiAvailable = supabase && !offline`.
- **Erro**: toast vermelho 4s + vibração `error`. Falha de save local: `saveState='error'` + toast "Save local não gravado: …".
- **Sem Supabase configurado**: sem sessão; nuvem/IA indisponíveis (sem tela de login).
- **Controle sem mapeamento padrão**: nota de compatibilidade.
- **Saída com save pendente**: `beforeunload` pede confirmação do navegador.
- **Erro fatal de React**: `main.fatal-error` (de `main.tsx`): "O jogo encontrou um problema.", mensagem, "Seu último save persistido continua no navegador. Recarregar não apaga a carreira." e botão "Reabrir Mando".

### Persistência (invisível, mas afeta o status)

- Toda mudança de `career` grava no IndexedDB (`saveLocal`, fila serial) → "SALVANDO" → "SALVO".
- Backup na nuvem 6s após a última mudança, se há usuário (sessão anônima criada em silêncio por `ensureSession`) e o `worldId` é UUID (mundo oficial publicado). Falhas só no console.
- Abrir mensagem/recado ouvido na caixa postal marca como lida.
- Conquistas são checadas a cada mudança de carreira (`unlockAchievements`).

## Interações

### Mouse / toque

Clique nas abas troca a aba; clique nos botões dos overlays (Parar, Pular recado, Atualizar jogo…). Não há clique para abrir a Pausa — só pelo controle/teclado (`Esc`).

### Controle — atalhos globais registrados pelo App (`useControllerActions`)

Ativos em menu e carreira; **desativados** na criação (`screen==='create'`, que registra os próprios) e enquanto `busy`.

| Botão (PS / Xbox)                   | Ação                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ○ / B (`back`)                      | Prioridade: (antes, o provider já fecha modal via "Voltar" e para a simulação) → se `running` para → se `detail` (jogador aberto no Elenco) fecha → se `deleting` cancela → se `popup` fecha → se na carreira **abre a Pausa** |
| L1 / R1 (`previousTab`/`nextTab`)   | `switchTab(±1)` circular entre as 5 abas — bloqueado fora da carreira, na partida, com popup, detalhe de jogador aberto ou busy                                                                                                |
| □ / X (`secondary`)                 | Se simulando: para. Senão, na carreira fora de partida e sem popup: **Avançar** (`advance()`)                                                                                                                                  |
| △ / Y (`info`)                      | Na carreira fora de partida e sem popup: vai para **ESCRITÓRIO**                                                                                                                                                               |
| Options / ☰ (`menu`)               | Só na carreira. Se simulando: para. Na **CENTRAL** (aba 0) fora de partida e sem popup: abre **Preferências de avanço**. Nas outras abas/partida: alterna a **Pausa** (fecha se Pausa/Preferências já estiverem abertas)       |
| L2 / R2 (`previousView`/`nextView`) | Sem ação do App: o provider troca a sub-aba (`.segmented`) da tela atual (dica "Sub-menu")                                                                                                                                     |
| ✕ / A                               | Confirma o elemento focado; durante a simulação, para                                                                                                                                                                          |
| D-pad / analógico esq.              | Move o foco; analógico direito rola                                                                                                                                                                                            |

Teclado: `Esc` = ○/B, `[`/`]` = L1/R1, `q`/`e` = L2/R2, setas = foco.

### Vibração

`error` em falhas; `whistle` ao parar a simulação e ao começar partida; `goal` ao desbloquear conquista e no teste; `confirm` ao responder coletiva; `move`/`confirm`/`back`/`tab` automáticos do provider.

### Áudio

Música começa com o primeiro gesto ou ao detectar controle; em partida é suspensa e entra a torcida; ao sair para o menu a voz é interrompida (`stopVoice`).

## Classes CSS e visual atual

- `.game-shell`, `.bg-stage`, `.beam.b1/.b2/.b3` — fundo azul com feixes.
- `.app-header` (padding `12px var(--pad-x) 6px`), `.brand`, `.brand-logo`, `.brand-word`, `.main-nav` (abas `clamp(15px,1.45vw,22px)` 800), `.nav-shoulder`, `.nav-dot`, `.club-header`, `.club-header-text`, `.header-status`, `.status-icon` (círculo 34px), `.controller-status.connected` (lima).
- `.on-menu .app-header`, `.on-create .app-header` → 3 colunas.
- `main.stage` (`stage-in`), `.screen`, `.screen-enter`, `.demo-strip`.
- `.app-footer`, `.hints`, `.control-hint`, `kbd.pad-*`, `.save-status.saved/.error`.
- `.toast.success/.error`, `.voice-bar`, `.achievement-toast.tier-*`, `.busy-indicator`, `.compatibility-note`, `.pwa-update`, `.simulation-dialog`.
- `.modal-backdrop`, `.dialog(.wide)`, `.dialog-heading`, `.dialog-body`, `.pause-options`, `.haptic-note`, `.prefs-options`, `.pref-card(.active)`, `.achievement-grid`, `.achievement-card(.unlocked)`, `.prematch-info`, `.button-row`, `.press-room`, `.press-progress`, `.press-question`, `.press-mic`, `.press-answers`, `.press-answer(.active)`.
- z-index: modal 50, overlays 60 (busy/PWA/compat), voz 68, toast 70, conquista 80.

## Regras que o redesign deve preservar

1. Cinco áreas fixas na ordem CENTRAL, TIME, TRANSFERÊNCIAS, ESCRITÓRIO, TEMPORADA, trocáveis com L1/R1 (circular) e clique; indicador de pendência no ESCRITÓRIO.
2. Data atual e caixa do clube sempre visíveis na carreira (inclusive na partida), com escudo.
3. Indicadores de offline e de controle conectado.
4. Rodapé com dicas de botão contextuais e glifos do controle real; status do save (salvando/salvo/erro).
5. Atalhos: ○ abre Pausa / fecha camadas na ordem correta; □ Avançar; △ Escritório; Options = Preferências na Central e Pausa nas demais; L2/R2 sub-abas.
6. Overlay de simulação contínua com data viva, contador de jogos e parada por ✕/○/□/START e clique; paradas automáticas com aviso e redirecionamento.
7. Toasts e avisos que somem sozinhos (2,6s/4s), sem X; conquistas como toast próprio (4,2s).
8. Barra da caixa postal com pular/parar, que persiste entre abas.
9. Bloqueio de interação (`inert`) por baixo de modais e durante `busy`, com indicador "Processando…".
10. Todo o conteúdo da Pausa (vibração, teste, DualSense, sons, música, parar caixa postal, avanço, conquistas, instalar, salvar e sair).
11. Animação de entrada a cada troca de tela/aba.
12. Faixa de DEMONSTRAÇÃO em mundo demo; aviso de nova versão PWA; aviso de controle incompatível; tela de erro fatal.

## Problemas atuais e oportunidades

- **Header pesado e genérico**: logo + "MANDO" competem com as abas. No FIFA 14 o topo é uma barra fina com abas grandes em caixa alta e o perfil/clube discreto à direita. Sugestão: abas maiores e centralizadas, com os ícones de L1/R1 colados; bloco do clube como "cartão de perfil" (escudo, nome do clube, nome do manager, data, caixa).
- **Nome do clube não aparece** no header (só escudo pequeno, data e caixa). Nem o nome do manager ou a temporada.
- A dica do footer diz "Avançar dia" mesmo quando o modo é "Parar em eventos"/"Nunca parar"; e diz "Pausa" para Options, mas na CENTRAL Options abre Preferências. Os rótulos deveriam refletir a ação real.
- Com mouse/teclado não há como abrir a Pausa por clique (sem botão de menu visível) — falta um botão de engrenagem/menu no header.
- `.header-status` some abaixo de 1100px, e no mobile o bloco do clube também.
- Toast no topo central (`top:76px`) pode cobrir as abas; vários overlays disputam o canto inferior direito (voz, busy, conquista). Definir zonas fixas: notificações em um canto com barra de tempo; status de sistema em outro.
- Transição sempre da direita, mesmo ao voltar uma aba (L1). Direção deveria acompanhar o sentido.
- A Pausa é uma lista longa de botões de mesma hierarquia; poderia virar um menu em tiles/abas (Jogo, Áudio, Controle, Conquistas, Sair).
- Modais usam o mesmo componente genérico; falta variação de hierarquia (confirmação curta vs. hub).
