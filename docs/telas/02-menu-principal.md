# Tela: Menu principal

## Resumo
Primeira tela do jogo (`screen === 'menu'`). Sem saves, mostra somente Nova carreira. Com exatamente um save, mostra Continuar carreira com seus dados. Com dois ou mais, esse card vira Carregar jogo e abre a [seleção de saves](./22-popup-carregar-jogo.md); não exibe as carreiras individualmente no menu. Não há tela de login.

## Como se chega / como se sai
**Entrada**
- Ao abrir o jogo (estado inicial de `screen`).
- Pela Pausa da carreira › "Salvar e sair para o menu" (`menu()`: espera a fila de save, salva, recarrega a lista `listLocal()`, fecha popups e o detalhe de jogador).

**Saída**
- Tile "CONTINUAR CARREIRA" → `continueCareer(record)`: valida, carrega a única carreira e abre a CENTRAL.
- Tile "CARREGAR JOGO" → modal de seleção (`popup='load'`); escolher um save abre a carreira.
- Tile "NOVA CARREIRA" → abre o modal **Nova carreira** (`popup='world'`, ver `03-popup-nova-carreira.md`).
- Lixeira de um save no seletor → modal **Excluir carreira?** (`deleting`, ver `05-popup-excluir-carreira.md`).

## Arquivos-fonte
- `src/screens/MainMenu.tsx` — `MainMenu({ saves, onContinue, onNew, onLoad })` e `SavedGameList`.
- `src/App.tsx` — estado `saves`, `continueCareer`, `setPopup('world')`, `setDeleting`, carregamento inicial `listLocal()` e sessão `ensureSession()`.
- `src/services/storage.ts` — `SavedCareer = { career, world, savedAt, cloudRevision }`; `listLocal()` (IndexedDB `mando-careers`/`careers`), ordenado por `savedAt` decrescente.
- `src/components/ui.tsx` — `Badge`, `dateLabel`, `ManagerPortrait`.
- Ícones lucide: `ArrowRight`, `Plus`, `Trash2`.

## Composição atual

- **0 saves:** Nova carreira.
- **1 save:** Continuar carreira (clube, manager, data e retrato) + Nova carreira.
- **2+ saves:** Carregar jogo (quantidade de carreiras) + Nova carreira.
- Nenhum slot individual ou lixeira aparece no menu; esses elementos ficam no seletor.

## Referência visual do card de continuar (1 save)
```
┌ header: [logo] MANDO ........................................ (⌁)(🎮) ┐
│                                                                       │
│  [LOGO MANDO grande]                                                  │
│  CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026        (eyebrow ciano) │
│  O CLUBE É SEU.                                       (h1 gigante)    │
│  A HISTÓRIA TAMBÉM.                                   (lima)          │
│                                                                       │
│  ┌──────────── tile azul ────────────┐┌─ tile verde ─┐                │
│  │CONTINUAR CARREIRA                 ││NOVA CARREIRA │                │
│  │ [ESCUDO]          ┌──────────┐    ││   ( + )      │                │
│  │ SÃO PAULO         │ retrato  │    ││ NOVA CARREIRA│                │
│  │ Nome Sobrenome    │ manager  │    ││ DE MANAGER   │                │
│  │ 01 DE JAN. 2026   │          │    ││              │                │
│  │ [JOGAR →]         └──────────┘    ││ [COMEÇAR →]  │                │
│  └───────────────────────────────────┘└──────────────┘                │
│                                                                       │
└ footer: (✕) SELECIONAR  (○) VOLTAR ──────────────────────────────────┘
```
Sem saves: só o tile NOVA CARREIRA (azul, com foco inicial).

## Elementos
| # | Elemento | Classe | Conteúdo / dados | Observações |
|---|---|---|---|---|
| 1 | Logo grande | `img.menu-logo` | Nova marca horizontal `/logo-mando.png`, alt "Mando", largura `clamp(170px,24vw,340px)` e altura automática | Arte ciano/roxo, sem fundo; texto de apresentação agrupado ao lado |
| 2 | Eyebrow | `p.eyebrow` | Texto fixo **"CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026"** | Ciano 12px, letter-spacing 2px |
| 3 | Título | `.menu-heading h1` | **"O clube é seu."** + `span` **"A história também."** | `italic 800 clamp(40px,6.4vw,92px)/0.9`, caixa alta; a 2ª linha em lima com glow |
| 4 | Faixa de tiles | `.menu-row.carousel` | Altura `clamp(260px,50vh,470px)`; rolagem horizontal com snap; sem scrollbar | |
| 5 | Tile continuar | `button.tile.tile-blue.continue-tile` (`data-autofocus`) | Único save, com clube, manager, data e retrato; ação JOGAR | Só existe com exatamente 1 save |
| 6 | Tile nova carreira | `button.tile.new-career-tile` | `.tile-label` "NOVA CARREIRA"; `.tile-icon` com `Plus` 64px (círculo 110px); `.tile-title` "Nova carreira de manager"; `.tile-cta` "COMEÇAR →" | Verde (`tile-green`) se há save; **azul** e com `data-autofocus` se não há. Largura `clamp(260px,26vw,380px)` |
| 7 | Tile carregar | `button.tile.tile-blue.load-game-tile` (`data-autofocus`) | CARREGAR JOGO, ícone de pasta, quantidade de carreiras | Só existe com 2+ saves; abre o seletor |

Dados de cada save vêm de `SavedCareer.career` (`manager.firstName`, `manager.lastName`, `manager.avatar`, `manager.style`, `clubId`, `date`) e `SavedCareer.world.clubs` (`name`, `short`, `color`, `id` para escudo).

Header nesta tela: só marca + status (sem abas/clube). Footer: só "Selecionar" e "Voltar"; sem status de save.

## Estados e variações
- **Primeira vez / sem saves**: só o tile NOVA CARREIRA (azul, foco inicial). Não há texto de boas-vindas extra.
- **1 save**: CONTINUAR (foco inicial) + NOVA CARREIRA (verde). **Sem botão de excluir** para esse save.
- **2+ saves**: CARREGAR JOGO (foco inicial) + NOVA CARREIRA. Todos os saves, inclusive o mais recente, ficam no seletor.
- **Retrato**: com `manager.avatar` mostra a foto gerada por IA; sem, a silhueta SVG com iniciais e roupa.
- **Escudo**: real se houver logo; senão brasão genérico com sigla.
- **Carregando lista**: não há indicador; a lista aparece quando `listLocal()` resolve (tela inicial mostra só NOVA CARREIRA até lá).
- **Erro ao ler saves** (IndexedDB indisponível ou save inválido): toast vermelho 4s com a mensagem (ex.: "Não foi possível abrir o armazenamento local. Verifique as permissões do navegador.").
- **Erro ao continuar** (save incompatível com o mundo): toast vermelho via `act()`.
- **Busy** (ex.: excluindo): `main` inert + "Processando…".
- **Login/usuário**: não existe UI. Se o Supabase estiver configurado, `ensureSession()` cria uma sessão anônima em silêncio (usada para backup em nuvem e IA). Sem Supabase, nada muda na tela. Saves listados são **apenas locais** (IndexedDB); não há lista de saves em nuvem nem importar/exportar nesta tela (existem `exportSave/importSave` em `storage.ts`, sem UI aqui).
- **Offline**: só o ícone no header.
- **Nova versão PWA**: barra "Nova versão do Mando disponível" pode aparecer sobre o menu.

## Interações
| Entrada | Ação |
|---|---|
| Clique / ✕ / A no tile CONTINUAR | `onContinue(recent)` → carreira, aba CENTRAL |
| Clique / ✕ / A em NOVA CARREIRA | `onNew()` → modal Nova carreira |
| Clique / ✕ / A em CARREGAR JOGO | `onLoad()` → seletor de saves |
| D-pad/analógico esq. ←/→ | Move o foco entre tiles (e lixeiras); o carrossel centraliza o item focado |
| D-pad ↑/↓ | Navegação espacial; as lixeiras só existem no seletor |
| Analógico direito horizontal | Rola a faixa de tiles |
| ○ / B / Esc | Fecha modal aberto; sem modal, nada acontece no menu |
| □, △, L1/R1, L2/R2, Options | Sem efeito no menu |
| Foco inicial | NOVA CARREIRA (0 saves), CONTINUAR (1) ou CARREGAR JOGO (2+) |

Ao focar um tile com controle/teclado: escala 1.025, contorno branco 4px e halo lima.

## Classes CSS e visual atual
- `.screen.menu-screen` (centralizado verticalmente, `gap clamp(14px,3vh,34px)`), `.menu-heading`, `.menu-logo`, `.eyebrow`, `.menu-row.carousel`.
- `.tile` + cores `tile-blue` (`#22a6ff→#0b5ce6→#0a3fb8`), `tile-green`, `tile-orange`, `tile-purple`, `tile-pink`; `::before` com brilho e listras diagonais.
- `.continue-tile`, `.continue-body`, `.continue-text` (`strong`, `span`, `em`), `.tile-label`, `.tile-cta`, `.tile-icon`, `.tile-title`, `.new-career-tile`, `.save-slot`, `.slot-tile`, `.slot-meta`, `.slot-delete`.
- `.manager-portrait(.photo|.silhouette)`, `.club-badge.large(.has-logo)`.
- Mobile (≤760px): faixa com altura 320px, CONTINUAR 84vw, NOVA CARREIRA 70vw.

## Regras que o redesign deve preservar
1. Mostrar dados de uma carreira no menu somente quando existir exatamente um save; com vários, mostrar Carregar jogo.
2. Nova carreira sempre disponível e com foco inicial quando não há saves.
3. Todos os saves acessíveis no seletor, com nome do clube, manager e data, ordenados por `savedAt`.
4. Excluir carreira com confirmação (modal), acessível por controle.
5. Slogan/identidade da marca ("O clube é seu. A história também.") e contexto "Carreira de manager · Futebol brasileiro 2026".
6. Navegação horizontal por controle com o item focado centralizado.
7. Sem tela de login obrigatória.

## Problemas atuais e oportunidades
- Com exatamente um save, o menu oferece continuar diretamente, sem lixeira. No seletor, todos os saves podem ser excluídos com confirmação.
- **Logo duplicado** (header + menu-logo) e título enorme ocupam metade da tela; no FIFA 14 o menu inicial é dominado pelos tiles.
- Slots de save não mostram temporada, divisão, posição na tabela, dificuldade/desafio ou "salvo há X" — dados existem em `career`/`savedAt`.
- Footer mostra só "Selecionar/Voltar"; "Voltar" não faz nada no menu.
- Sem estado "carregando saves"; a tela pode piscar de 1 para 2+ tiles.
- Sem indicação de backup em nuvem (sessão anônima existe, mas o jogador não sabe se está salvo na nuvem).
- Cores dos slots são aleatórias por índice (laranja/roxo/rosa) e não ligadas ao clube; usar a cor do clube daria identidade.

## Estado do redesign MANDO 27 LEGACY
- **Lote 2 implementado:** cards de save com superfícies escuras, acentos semânticos, título/call-to-action mais contidos e carrossel horizontal com snap.
- O card inicial distingue 0, 1 e 2+ saves; carregar e excluir várias carreiras acontece no seletor.
- Verifiquei visualmente Menu em desktop e o fluxo de criação em viewport móvel; os demais estados ainda precisam da revisão por lote.
