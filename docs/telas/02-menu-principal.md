# Tela: Menu principal

## Resumo
Primeira tela do jogo (`screen === 'menu'`). Apresenta a marca e o slogan e oferece, em uma faixa horizontal de tiles grandes no estilo hub do FIFA, as ações de **continuar a carreira mais recente**, **criar nova carreira** e **carregar/excluir outras carreiras salvas** no navegador. Não há tela de login: a conta Supabase é anônima e criada em silêncio.

## Como se chega / como se sai
**Entrada**
- Ao abrir o jogo (estado inicial de `screen`).
- Pela Pausa da carreira › "Salvar e sair para o menu" (`menu()`: espera a fila de save, salva, recarrega a lista `listLocal()`, para a voz, fecha popups e o detalhe de jogador).

**Saída**
- Tile "CONTINUAR CARREIRA" ou um tile "CARREGAR" → `continueCareer(record)`: valida (`validateCareerForWorld`), carrega `career` e `world`, `screen='career'`, aba 0 (CENTRAL).
- Tile "NOVA CARREIRA" → abre o modal **Nova carreira** (`popup='world'`, ver `03-popup-nova-carreira.md`).
- Lixeira de um save → modal **Excluir carreira?** (`deleting`, ver `05-popup-excluir-carreira.md`).

## Arquivos-fonte
- `src/screens/MainMenu.tsx` — `MainMenu({ saves, onContinue, onNew, onDelete })`.
- `src/App.tsx` — estado `saves`, `continueCareer`, `setPopup('world')`, `setDeleting`, carregamento inicial `listLocal()` e sessão `ensureSession()`.
- `src/services/storage.ts` — `SavedCareer = { career, world, savedAt, cloudRevision }`; `listLocal()` (IndexedDB `mando-careers`/`careers`), ordenado por `savedAt` decrescente.
- `src/components/ui.tsx` — `Badge`, `dateLabel`, `ManagerPortrait`.
- Ícones lucide: `ArrowRight`, `Plus`, `Trash2`.

## Wireframe atual
```
┌ header: [logo] MANDO ........................................ (⌁)(🎮) ┐
│                                                                       │
│  [LOGO MANDO grande]                                                  │
│  CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026        (eyebrow ciano) │
│  O CLUBE É SEU.                                       (h1 gigante)    │
│  A HISTÓRIA TAMBÉM.                                   (lima)          │
│                                                                       │
│  ┌──────────── tile azul ────────────┐┌─ tile verde ─┐┌laranja┐┌roxo┐→│ .menu-row.carousel
│  │CONTINUAR CARREIRA                 ││NOVA CARREIRA ││🗑     ││🗑   │ │ (rolagem horizontal)
│  │ [ESCUDO]          ┌──────────┐    ││   ( + )      ││CARREG.││    │ │
│  │ SÃO PAULO         │ retrato  │    ││ NOVA CARREIRA││[escudo]│    │ │
│  │ Nome Sobrenome    │ manager  │    ││ DE MANAGER   ││CLUBE  ││    │ │
│  │ 01 DE JAN. 2026   │          │    ││              ││Nome·  ││    │ │
│  │ [JOGAR →]         └──────────┘    ││ [COMEÇAR →]  ││data   ││    │ │
│  └───────────────────────────────────┘└──────────────┘└───────┘└────┘ │
│                                                                       │
└ footer: (✕) SELECIONAR  (○) VOLTAR ──────────────────────────────────┘
```
Sem saves: só o tile NOVA CARREIRA (azul, com foco inicial).

## Elementos
| # | Elemento | Classe | Conteúdo / dados | Observações |
|---|---|---|---|---|
| 1 | Logo grande | `img.menu-logo` | `/logo-mando.png`, alt "Mando", largura `clamp(90px,15vh,150px)` | Sombra; duplica a marca do header |
| 2 | Eyebrow | `p.eyebrow` | Texto fixo **"CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026"** | Ciano 12px, letter-spacing 2px |
| 3 | Título | `.menu-heading h1` | **"O clube é seu."** + `span` **"A história também."** | `italic 800 clamp(40px,6.4vw,92px)/0.9`, caixa alta; a 2ª linha em lima com glow |
| 4 | Faixa de tiles | `.menu-row.carousel` | Altura `clamp(260px,50vh,470px)`; rolagem horizontal com snap; sem scrollbar | |
| 5 | Tile continuar | `button.tile.tile-blue.continue-tile` (`data-autofocus`) | Primeiro save (`saves[0]`, o mais recente). `.tile-label` "CONTINUAR CARREIRA"; `.continue-body`: `Badge` large do clube (`world.clubs` do próprio save, por `career.clubId`) + `.continue-text` com `strong` **nome do clube** (itálico `clamp(26px,2.8vw,40px)`), `span` **"{manager.firstName} {manager.lastName}"** (18px), `em` **`dateLabel(career.date)`** (lima, caixa alta); `.tile-cta` "JOGAR →"; `ManagerPortrait` do manager absoluto à direita (42% largura, 92% altura, colado embaixo) | Largura `clamp(380px,44vw,640px)`, `padding-right: 38%`. Só existe se há pelo menos 1 save |
| 6 | Tile nova carreira | `button.tile.new-career-tile` | `.tile-label` "NOVA CARREIRA"; `.tile-icon` com `Plus` 64px (círculo 110px); `.tile-title` "Nova carreira de manager"; `.tile-cta` "COMEÇAR →" | Verde (`tile-green`) se há save; **azul** e com `data-autofocus` se não há. Largura `clamp(260px,26vw,380px)` |
| 7 | Slots de outros saves | `.save-slot` > `button.tile.slot-tile` | Para cada save além do 1º (`others`), cores alternadas `tile-orange`, `tile-purple`, `tile-pink`. Conteúdo centralizado: `.tile-label` "CARREGAR"; `Badge` large; `.tile-title` **nome do clube**; `.slot-meta` **"{firstName} · {dateLabel(date)}"** | Largura `clamp(200px,18vw,260px)` |
| 8 | Excluir save | `button.slot-delete` | Ícone `Trash2` 18px, `aria-label="Excluir carreira {firstName}"` | Círculo preto 30% no canto superior direito do slot; hover vermelho. É um botão focável separado do tile |

Dados de cada save vêm de `SavedCareer.career` (`manager.firstName`, `manager.lastName`, `manager.avatar`, `manager.style`, `clubId`, `date`) e `SavedCareer.world.clubs` (`name`, `short`, `color`, `id` para escudo).

Header nesta tela: só marca + status (sem abas/clube). Footer: só "Selecionar" e "Voltar"; sem status de save.

## Estados e variações
- **Primeira vez / sem saves**: só o tile NOVA CARREIRA (azul, foco inicial). Não há texto de boas-vindas extra.
- **1 save**: CONTINUAR (foco inicial) + NOVA CARREIRA (verde). **Sem botão de excluir** para esse save.
- **2+ saves**: os demais aparecem como slots coloridos com lixeira; a faixa rola horizontalmente.
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
| Clique / ✕ / A em um slot CARREGAR | `onContinue(save)` |
| Clique / ✕ / A na lixeira | `onDelete(save)` → modal Excluir carreira? |
| D-pad/analógico esq. ←/→ | Move o foco entre tiles (e lixeiras); o carrossel centraliza o item focado |
| D-pad ↑/↓ | Sobe/desce para a lixeira do slot / volta ao tile (navegação espacial) |
| Analógico direito horizontal | Rola a faixa de tiles |
| ○ / B / Esc | Fecha modal aberto; sem modal, nada acontece no menu |
| □, △, L1/R1, L2/R2, Options | Sem efeito no menu |
| Foco inicial | CONTINUAR (se houver save) ou NOVA CARREIRA (`data-autofocus`) |

Ao focar um tile com controle/teclado: escala 1.025, contorno branco 4px e halo lima.

## Classes CSS e visual atual
- `.screen.menu-screen` (centralizado verticalmente, `gap clamp(14px,3vh,34px)`), `.menu-heading`, `.menu-logo`, `.eyebrow`, `.menu-row.carousel`.
- `.tile` + cores `tile-blue` (`#22a6ff→#0b5ce6→#0a3fb8`), `tile-green`, `tile-orange`, `tile-purple`, `tile-pink`; `::before` com brilho e listras diagonais.
- `.continue-tile`, `.continue-body`, `.continue-text` (`strong`, `span`, `em`), `.tile-label`, `.tile-cta`, `.tile-icon`, `.tile-title`, `.new-career-tile`, `.save-slot`, `.slot-tile`, `.slot-meta`, `.slot-delete`.
- `.manager-portrait(.photo|.silhouette)`, `.club-badge.large(.has-logo)`.
- Mobile (≤760px): faixa com altura 320px, CONTINUAR 84vw, NOVA CARREIRA 70vw.

## Regras que o redesign deve preservar
1. O save mais recente (por `savedAt`) em destaque, com escudo, nome do clube, nome do manager, data do jogo e retrato do manager, recebendo o foco inicial.
2. Nova carreira sempre disponível e com foco inicial quando não há saves.
3. Todos os demais saves acessíveis para carregar, com nome do clube, manager e data.
4. Excluir carreira com confirmação (modal), acessível por controle.
5. Slogan/identidade da marca ("O clube é seu. A história também.") e contexto "Carreira de manager · Futebol brasileiro 2026".
6. Navegação horizontal por controle com o item focado centralizado.
7. Sem tela de login obrigatória.

## Problemas atuais e oportunidades
- **O save mais recente não pode ser excluído** (só os "outros" têm lixeira) — inconsistente. Oferecer excluir para todos (ex.: botão △/Y "Excluir" no item focado, com dica no footer).
- A lixeira é um alvo pequeno separado do tile; no controle exige navegar ↑ até ela. Melhor: ação de botão (△ ou □) sobre o tile focado, com dica no rodapé.
- **Logo duplicado** (header + menu-logo) e título enorme ocupam metade da tela; no FIFA 14 o menu inicial é dominado pelos tiles.
- Slots de save não mostram retrato, temporada, divisão, posição na tabela, modo (oficial/demo), dificuldade/desafio ou "salvo há X" — dados existem em `career`/`savedAt`.
- Nenhuma indicação de save demo vs. oficial.
- Faltam tiles secundários típicos de menu FIFA (Configurações/Áudio/Controle, Conquistas, Créditos/Como jogar); hoje essas opções só existem dentro da Pausa da carreira.
- Footer mostra só "Selecionar/Voltar"; "Voltar" não faz nada no menu.
- Sem estado "carregando saves"; a tela pode piscar de 1 para 2+ tiles.
- Sem indicação de backup em nuvem (sessão anônima existe, mas o jogador não sabe se está salvo na nuvem).
- Cores dos slots são aleatórias por índice (laranja/roxo/rosa) e não ligadas ao clube; usar a cor do clube daria identidade.
