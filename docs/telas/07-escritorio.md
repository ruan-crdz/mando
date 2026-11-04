# Tela: Escritório

## Resumo

O Escritório é a **quarta aba** do modo carreira (`tab === 3`, rótulo `ESCRITÓRIO`). Reúne tudo "além das quatro linhas": caixa de entrada com decisões e **voz (caixa postal)**, finanças com gráficos, diretoria (confiança, ultimato, propostas de emprego, objetivos e copas), comissão técnica e perfil do manager (com **retrato por IA via câmera**), rede de olheiros e captação na base, e o painel "Clube vivo" (mundo vivo: diretoria por eixos, torcida, treino, analista, vestiário, imprensa e técnicos rivais).

A tela tem um cabeçalho (`SectionTitle`) e uma barra de **6 sub-abas** (`.segmented`) trocadas por clique ou por **L2/R2 (LT/RT)**.

## Como se chega / como se sai

**Entradas**
- Clique em `ESCRITÓRIO` no menu superior, L1/R1 (LB/RB) ou `[`/`]`.
- **△ / Y** em qualquer aba fora de partida e sem popup.
- Da Central: tile do manager, linhas de mensagens, tile de avanço em "decisão pendente" ou "cargo encerrado", tile do jogo com decisão pendente.
- Automático: quando o avanço contínuo para por `decision`, `message` ou `sacked` (App faz `setTab(3)`).
- O ponto laranja `.nav-dot` em `ESCRITÓRIO` indica decisões pendentes.

**Sub-aba inicial**: `board` (Diretoria) se `career.sacked`; senão `inbox` (Mensagens). A sub-aba e a mensagem selecionada **não são lembradas**: a `main` é remontada a cada troca de aba (chave `screen-tab`), voltando ao padrão.

**Mensagem inicialmente selecionada**: a primeira `important && !resolved`; senão a primeira da lista (mais recente).

**Saídas**: trocar de aba (L1/R1, clique no menu), ○/B → Pausa (sem modal aberto), START → Pausa (fora da Central START abre a pausa).

## Arquivos-fonte

- `src\screens\Office.tsx` — componente `Office` (todas as sub-abas; `scoutingPanel` é uma constante interna).
- `src\components\LivingPanels.tsx` — `ClubPanel` (sub-aba "Clube vivo") e `Bar`.
- `src\components\voice.ts` — reprodutor global de voz (`playVoice`, `stopVoice`, `skipVoice`, `useVoice`, `voiceAvailable`, `speakable`).
- `src\components\PortraitCamera.tsx` — modal da câmera do retrato.
- `src\components\ui.tsx` — `SectionTitle`, `Metric`, `ManagerPortrait`, `Modal`, `money`, `dateLabel`.
- `src\App.tsx` — props/callbacks do `Office`, barra global de voz (`.voice-bar`), efeito que marca recado ouvido como lido, toasts, `busy`.
- `src\game\engine.ts` — `respondMessage`, `applyStaffPlan`, `hireScout`, `fireScout`, `signProspect`, `acceptJobOffer`, `standings`; geração de mensagens (`message()` insere no início da lista).
- `src\game\living.ts` — `upgradeAnalyst`, `analystCost` (R$ 400 mil × nível).
- `src\game\scouting.ts` — relatório do auxiliar (mensagem com `tactic` = plano sugerido).
- `src\services\supabase.ts` — `requestPortrait` (função `ai-manager-avatar`).
- `src\controller\GamepadProvider.tsx` — `cycleView` (L2/R2 nas `.segmented`), foco, "voltar".
- `src\styles.css` — `.office-inbox`/`.message-*`/`.voice-*` (~l. 1960–2127), finanças (~l. 2128–2265), diretoria/staff (~l. 2266–2345), caixa postal/voice-bar (~l. 5346–5415), câmera (~l. 5529–5616), `.living-*` (~l. 6289–6300), `.segmented` (~l. 579–605), `.section-title` (~l. 557).

## Wireframe atual (ASCII)

Cabeçalho + sub-abas (comum a todas):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ESCRITÓRIO / ALÉM DAS QUATRO LINHAS                              [ 2 AÇÕES NECESSÁRIAS ] │
│ UM CLUBE INTEIRO AO SEU REDOR.                                                    │
│ [✉ Mensagens][📈 Finanças][🏛 Diretoria][👥 Comissão e perfil][📍 Olheiros e base][🏛 Clube vivo] │
├──────────────────────────────────────────────────────────────────────────────────┤
│                         (conteúdo da sub-aba)                                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Mensagens (`inbox`):

```
┌─ lista (260–380px) ──────────┐ ┌─ leitor ─────────────────────────────────────────┐
│[📼 OUVIR CAIXA POSTAL       ]│ │ (PR) Presidência                       [BOARD]   │
│[   3 recados novos          ]│ │      04 de novembro de 2026                      │
│▌• Presidência · 04 nov.    > │ │ TÍTULO DA MENSAGEM                               │
│▌  Título da mensagem         │ │ [🔊 ||||| OUVIR MENSAGEM]                        │
│ • Auxiliar técnico · 03 …  > │ │ Corpo da mensagem (aiText ou body, com quebras)  │
│   Relatório: Palmeiras       │ │ [APLICAR PLANO DO AUXILIAR]   (se houver tática) │
│   Diretor de futebol …     ✓ │ │ SUA DECISÃO                                      │
│   …                          │ │ [Ouvir e oferecer apoio] [Cobrar dedicação]      │
│                              │ │ MEMÓRIAS RECENTES (se ligada a jogador)          │
└──────────────────────────────┘ └──────────────────────────────────────────────────┘
```

Finanças (`finances`):

```
┌ CAIXA ATUAL ┐┌ TRANSFERÊNCIAS ┐┌ FOLHA MENSAL ┐┌ DÍVIDA ┐
└─────────────┘└────────────────┘└──────────────┘└────────┘
┌ DISTRIBUIÇÃO… ─────────┐┌ EVOLUÇÃO DO CAIXA ─────┐┌ ÚLTIMOS LANÇAMENTOS ┐
│ (donut)   ■ Salários % ││ ~~~~ linha lime ~~~~   ││ data  +rec  −desp  saldo │
│ R$ X      ■ Operação % ││ Receitas [=====]       ││ … (15 linhas)       │
│ POR MÊS   ■ Juros %    ││ Despesas [===]         ││                     │
└────────────────────────┘└────────────────────────┘└─────────────────────┘
```

Diretoria (`board`):

```
┌ (🏛) CONFIANÇA DA DIRETORIA ──┐ ┌ O QUE ESPERAM DE VOCÊ ─────────────────┐
│  72%                          │ │ 🎯 OBJETIVOS DE 2026                    │
│  ▓▓▓▓▓▓▓░░░                   │ │ Brasileirão Série A — Terminar no G6    │
│  SEU TRABALHO TEM RESPALDO.   │ │ Atual: 4º colocado · 58 pontos [meter]  │
│  texto explicativo            │ │ Saúde financeira — Manter caixa positivo│
│  [CARGO ENCERRADO]/Ultimato…  │ │ Desafio da carreira — Realista          │
│  ┌ proposta de emprego ┐      │ │ Copa do Brasil — Em disputa             │
│  │ [Aceitar] [Recusar] │      │ │ Última fase disputada: Oitavas          │
└───────────────────────────────┘ └─────────────────────────────────────────┘
```

Comissão e perfil (`staff`), Olheiros e base (`scouts`), Clube vivo (`club`): grid de 2 colunas (`.staff-layout`, `1fr 1.3fr`); o Clube vivo tem 3 painéis (o 3º cai para a linha de baixo).

## Elementos comuns (cabeçalho e sub-abas)

- `SectionTitle`: eyebrow ciano "ESCRITÓRIO / ALÉM DAS QUATRO LINHAS"; `h1` "Um clube inteiro ao seu redor." (itálico, caixa alta; termina com ponto, então não recebe o `.title-dot` lime).
- `span.status-pill` (laranja): "{n} AÇÕES NECESSÁRIAS", n = mensagens `important && !resolved` (mostra "0 AÇÕES NECESSÁRIAS" quando zero).
- `.segmented` com 6 botões (ícone lucide 16 + texto), ativo com fundo branco:
  1. `inbox` — `MessageSquare` "Mensagens"
  2. `finances` — `TrendingUp` "Finanças"
  3. `board` — `Landmark` "Diretoria"
  4. `staff` — `Users` "Comissão e perfil"
  5. `scouts` — `MapPinned` "Olheiros e base"
  6. `club` — `Landmark` "Clube vivo" (mesmo ícone da Diretoria)

### Interações comuns
- Mouse: clique na sub-aba.
- Controle: **L2/R2 (LT/RT)** = sub-aba anterior/próxima (circular; `cycleView` clica e foca o botão). D-pad para cima até a barra e ✕/A também funciona.
- Teclado: `q`/`e` = sub-aba anterior/próxima; setas + Enter.
- Demais botões globais: ✕/A confirma o foco; ○/B abre a Pausa (ou fecha o modal da câmera); □/X avança o calendário (mesmo estando no Escritório); △/Y já está no Escritório (sem efeito visível); L1/R1 troca de aba principal; START/Options/☰ abre/fecha a Pausa; analógico direito rola a área rolável mais próxima (lista de mensagens, leitor, painéis).

---

## Sub-aba 1 — Mensagens (Caixa de entrada, `view === 'inbox'`)

### Elementos

**Lista (`section.panel.message-list`)**

- **Botão Caixa postal** (`button.mailbox-button`, só se `voiceAvailable()` = navegador com `speechSynthesis`):
  - Parado: ícone `Voicemail` (18), "Ouvir caixa postal", subtítulo "{n} recado(s) novo(s)" (n = `!read`) ou "Todas as {total} mensagens" se nenhuma não lida.
  - Tocando (`voice.mailbox`): ícone `Square` (16), "Parar caixa postal", subtítulo "Recado {position} de {total}" (+ " · preparando voz…" se `voice.loading`), classe `speaking` (degradê rosa→laranja pulsando `mailbox-glow`).
  - `aria-label`: "Ouvir todas as mensagens da caixa postal" / "Parar caixa postal".
  - Ação `listenAll`: se já tocando → `stopVoice()`; senão `playVoice(itens, true)` com as **não lidas** (na ordem da lista: mais recente primeiro) ou, se não houver, **todas**.
- **Itens de mensagem** (um `button` por `career.messages`, ordem mais recente primeiro):
  - Classes: `selected` (fundo branco, texto azul), `unread` (borda esquerda ciano + fundo ciano 10%), `playing` (borda/contorno lime quando é o recado em reprodução).
  - `.message-indicator`: bolinha laranja com brilho se `important && !resolved`.
  - `small`: "{from} · {data curta}"; `strong`: `title`.
  - Ícone à direita: `Check` (15) se `resolved`, senão `ChevronRight` (15).
  - Clique: se há uma fala avulsa (não caixa postal) tocando, para; seleciona; marca como lida (`onRead` → `read: true`).

**Leitor (`article.panel.message-reader`)**

- Sem seleção: `.empty-state` "Selecione uma mensagem.".
- `.message-byline`: `span.message-avatar` (círculo roxo→rosa com as 2 primeiras letras de `from` em maiúsculas), `strong` `from`, `p` data longa ("04 de novembro de 2026"), `span.pill` com `kind` em maiúsculas — valores crus: `BOARD`, `PLAYER`, `STAFF`, `MARKET`, `NEWS`, `FINANCE`.
- `h2`: `title`.
- **Botão de voz** (`button.voice-button`, só se `voiceAvailable()`): ícone `Volume2` (18) + onda `.voice-wave` (5 barrinhas) + "Ouvir mensagem"; tocando esta mensagem (fala avulsa): ícone `Square` (16), classe `speaking` (degradê rosa→laranja, barras animadas), texto "Parar" ou "Preparando voz…" (se `loading`). `aria-label` "Ouvir mensagem"/"Parar áudio". Clique: alterna `playVoice([item])`/`stopVoice()`.
- `p.message-body`: `aiText || body` (respeita quebras de linha, 17 px).
- **Plano do auxiliar** (se `m.tactic`, vem do "Relatório: {adversário}" enviado pelo Auxiliar técnico até 2 dias antes do jogo quando a sugestão melhora o saldo esperado): `button.primary` "Aplicar plano do auxiliar" → `onApplyPlan(id)` → `applyStaffPlan` (troca tática; se mudar a formação, refaz a escalação) + toast "Plano do auxiliar aplicado na tática e na escalação."; desabilitado com texto "Plano do auxiliar em uso" quando `JSON(m.tactic) === JSON(career.tactic)`.
- **Área de decisão** (`.response-area`, se `important && !resolved`):
  - eyebrow "SUA DECISÃO".
  - `kind === 'player'`: `button.primary` "Ouvir e oferecer apoio" (`support`: moral +5×sens., relação +4, memória "O manager ouviu minha preocupação…") e `button` "Cobrar dedicação" (`firm`: moral −5×sens., relação −3).
  - Demais tipos: `button.primary` "Ciente. Continuar o trabalho." (`support`).
  - `kind === 'market'`: nota "Aceite ou recuse propostas na aba Transferências. Esta ação confirma apenas a leitura.".
- Sem decisão pendente: nota muted "Sua resposta foi registrada na memória da carreira." (se `m.choice`) ou "Mensagem informativa. Nenhuma decisão necessária.".
- **Memórias** (`.memory-list`, se `m.playerId`): eyebrow "MEMÓRIAS RECENTES" + até 5 últimas `career.memories` do jogador: "{data curta} · {texto}".

**Voz (`voice.ts`) — como funciona**
- Item falado: `{ id, title, text: "{from}. {title}. {aiText||body}", voice: papel }`; papel por tipo: `board`/`finance` → `president`, `staff`/`market` → `staff`, `player` → `player`, `news` → `narrator`. Hoje o papel **não muda a voz**: usa sempre a voz do sistema (Web Speech API) escolhida por `pickVoice` (pt-BR, prefere masculina "Natural/Online"), `pitch 0.85`, `rate 1`.
- `speakable()` adapta o texto: "2 x 1" → "2 a 1", " x " → " contra ", "R$ 3 mi" → "3 milhões de reais", "OVR" → "overall", remove emojis, corta em 1500 caracteres.
- Efeitos de secretária eletrônica: **clique de telefone** (2 bipes quadrados) antes de cada recado, fala começa 260 ms depois, **chiado de linha** (ruído filtrado baixo) enquanto toca, pausa de 450 ms entre recados.
- Reprodutor **global**: continua tocando ao trocar de aba ou avançar dias. App mostra a **barra de voz** (`.voice-bar`, canto inferior direito, roxo→rosa com borda lime): ícone `Radio` pulsando, "Caixa postal · {pos}/{total}" ou "Recado", título do recado, botão `SkipForward` "Pular recado" (se `total > 1`) e botão `Square` "Parar".
- Um recado tocado pela voz é marcado como **lido** automaticamente (efeito em `App.tsx`), mesmo fora do Escritório.
- A voz é parada ao sair para o menu, na Pausa ("Parar caixa postal") e ao fim da coletiva.

### Estados e variações
- Sem `speechSynthesis`: sem botão de caixa postal nem botão "Ouvir mensagem".
- Caixa postal tocando / fala avulsa tocando / parada (classes `speaking`, `playing`).
- Mensagem selecionada lida/não lida, resolvida (✓) ou pendente (bolinha laranja + área de decisão).
- Mensagem com plano tático (aplicável / "em uso"), com jogador (memórias), de mercado (nota de Transferências).
- Lista vazia: o leitor mostra "Selecione uma mensagem.".

### Interações
- Mouse: clique em itens, caixa postal, ouvir/parar, aplicar plano, decisões.
- Controle: D-pad navega na lista (foco espacial; → vai ao leitor), ✕/A abre/aciona; analógico direito rola lista/leitor; ○/B → Pausa. Não há atalho dedicado para "ouvir" ou "pular recado" (o botão "Pular" da barra de voz fica fora da `main`, no rodapé, alcançável por foco espacial).
- Teclado: setas/Enter.

---

## Sub-aba 2 — Finanças (`view === 'finances'`)

### Elementos
- **Faixa de métricas** (`.metrics-strip`, 4 `Metric` com borda esquerda colorida lime/ciano/laranja/rosa):
  - "CAIXA ATUAL" — `money(finance.cash)`.
  - "TRANSFERÊNCIAS" — `money(finance.transferBudget)`.
  - "FOLHA MENSAL" — soma de `players[id].wage` do elenco (`squad`).
  - "DÍVIDA" — `money(finance.debt)`.
- **Donut** (`section.panel`): eyebrow "DISTRIBUIÇÃO MENSAL PREVISTA", `h2` "Para onde vai o dinheiro". `div.donut` com `conic-gradient`: Salários `#00b4ff` (folha), Operação `#ff8a00` (`reputação × 30.000`), Juros `#c6ff00` (`dívida × 0,002`). Centro: `money(despesa mensal)` + "POR MÊS". Legenda `.chart-legend`: "Salários {x}%", "Operação {y}%", "Juros {z}%". `aria-label` com os percentuais.
- **Evolução do caixa** (`section.panel`): eyebrow "EVOLUÇÃO DO CAIXA", `h2` "O equilíbrio do projeto". Se `history.length > 1`: SVG 560×170 com 3 linhas-guia e `polyline` lime dos saldos (`history[].balance`, escala min(0,…)–max(1,…)), sem eixos/valores; `aria-label` "Caixa de {primeiro} para {último}". Senão: "O gráfico aparece após os primeiros lançamentos financeiros.". Abaixo `.cash-flow`: "Receitas {total}" com barra lime e "Despesas {total}" com barra laranja (largura proporcional ao maior).
- **Últimos lançamentos** (`section.panel.ledger`, coluna direita): `h2` "Últimos lançamentos"; até 15 entradas mais recentes de `history`, cada linha em 4 colunas: data curta | "+ {receita}" | "− {despesa}" | **saldo**. Vazio: "Nenhum lançamento. As finanças são processadas mensalmente e em partidas, contratos e transferências.".
- Formatação de dinheiro: `money()` compacto pt-BR (ex. "R$ 12,3 mi", "R$ 850 mil").

### Estados e variações
- Sem histórico / com 1 lançamento (sem gráfico) / com vários.
- Caixa negativo aparece como valor negativo (sem cor de alerta).

### Interações
- Somente leitura; nenhum elemento focável dentro dos painéis (o controle só alcança a barra de sub-abas). Rolagem com analógico direito.

---

## Sub-aba 3 — Diretoria (`view === 'board'`)

### Elementos
**Painel de confiança (`section.panel.confidence-panel`)**
- Ícone `Landmark` (35); eyebrow "CONFIANÇA DA DIRETORIA".
- `strong.huge-number`: `round(confidence)` + "%" (lime, itálico enorme).
- `<meter 0–100>`.
- `h2` por faixa: ≥ 70 "Seu trabalho tem respaldo."; ≥ 40 "É hora de mostrar uma resposta."; < 40 "A pressão está no limite.".
- Texto fixo: "Resultados, dificuldade e desafio determinam a reação da diretoria. A confiança não aumenta o overall dos adversários.".
- Se `sacked`: `strong.status-pill` "CARGO ENCERRADO".
- **Ultimato** (não demitido e `living.ultimatum`): `p.living-headline` "Ultimato: {points}/{target} pontos · {games − played} jogos restantes".
- **Período de adaptação** (não demitido, sem ultimato, `living.hiredAt` há menos de 45 dias): muted "Período de adaptação: a diretoria ainda não ameaça o cargo.".
- **Propostas de emprego** (`career.jobOffers`, cada uma `article.panel` dentro do painel):
  - `h3` nome do clube.
  - `p`: "Série {league} · reputação {reputation} · " + ("Aguardando sua resposta" se demitido, senão "Proposta válida até {data curta}") + " · {money(salary)}/mês".
  - `button.primary` "Aceitar desafio" → `acceptJobOffer` (troca de clube, confiança 60, reinicia diretoria/torcida, `hiredAt` = hoje, mensagem "Novo desafio: {clube}") + toast "Novo clube aceito. A carreira continua em um novo desafio.".
  - `button` "Recusar" (só se não demitido) → remove a proposta, sem toast.

**Objetivos (`section.panel.objectives`)**
- eyebrow "O QUE ESPERAM DE VOCÊ"; `h2` com `Target` (23) "Objetivos de {season}".
- Liga: `h3.objective-line` "Brasileirão Série {A|B} — {Terminar no G6 | Disputar o acesso (G6)}"; "Atual: {rank}º colocado · {points} pontos"; `<meter 0–20 value=21−rank>`.
- "Saúde financeira — Manter o caixa positivo"; "{caixa} em caixa".
- "Desafio da carreira — {challenge}" (`Realista`, `Do zero`, `Crise financeira`, `Só a base`, `Venda necessária`, `Pressão máxima`, `Reconstrução`); se `Venda necessária`: "{money(sales)} de R$ 10 milhões em vendas".
- **Copas** (uma linha por copa em que o clube tem jogos na temporada, nome por `competitionName`: Copa do Brasil, Libertadores, Sul-Americana, Supercopa, estaduais como "Paulistão"…): "{copa} — {Campeão | Em disputa | Eliminado}"; "Última fase disputada: {stage}".
- O destaque (`strong`) é sempre amarelo; não há indicador de cumprido/falhando.

### Estados e variações
- Confiança alta/média/baixa (3 frases).
- Demitido (pílula "CARGO ENCERRADO", propostas sem "Recusar" e sem validade; a aba abre direto aqui).
- Com ultimato; em período de adaptação; sem propostas; com várias propostas.
- Série A × Série B (texto do objetivo); desafio "Venda necessária"; sem copas.

### Interações
- Botões "Aceitar desafio"/"Recusar" focáveis por D-pad; ✕/A confirma. Sem confirmação extra ao aceitar.
- Restante somente leitura; analógico direito rola.

---

## Sub-aba 4 — Comissão e perfil (`view === 'staff'`)

### Elementos
**Perfil (`section.panel.profile-panel`)**
- `ManagerPortrait` (foto IA `manager.avatar` ou silhueta SVG com iniciais e cor do traje).
- eyebrow "MANAGER DO {NOME DO CLUBE}"; `h2` "{firstName} {lastName}"; "{nationality} · {age} anos · {difficulty}" (`Iniciante`/`Amador`/`Profissional`); `p` `manager.appearance` (descrição livre).
- `button.primary` (degradê rosa→laranja) com `Camera` (16): "Novo retrato com sua foto" (se já tem avatar) / "Criar retrato com sua foto". Desabilitado se `!aiAvailable` (sem Supabase ou offline) ou `busy`. Abre o modal da câmera.

**Modal "Retrato do manager" (`PortraitCamera`, `Modal wide`)**
- Esquerda `.camera-frame` (quadrado, borda ciano): `<video>` espelhado da webcam (`facingMode: user`, ideal 1280×720) ou a foto tirada; guia oval tracejada lime `.face-guide` quando ao vivo.
  - Estados: `loading` "Abrindo a câmera…"; `live`; `denied` (ícone `UserRound` 40 + "Câmera indisponível ou bloqueada. Libere a câmera no navegador ou gere pela descrição.").
- Direita `.camera-side`: eyebrow "COMO FUNCIONA"; `h3` "Seu rosto no jogo"; texto "Tiramos uma foto sua e a IA transforma você em um manager com visual de jogo de futebol, usando a roupa escolhida: **{style}**." (`Terno azul`/`Agasalho`/`Camisa social`); nota "A foto só é usada para gerar o retrato e não fica salva.".
- Ações `.camera-actions`:
  - Sem foto: `button.primary` `Camera` "Tirar foto" (autofocus; desabilitado se não `live`) → recorte quadrado central 640×640 espelhado, JPEG 0,86.
  - Com foto: `button.primary` `Sparkles` "Gerar com esta foto" (autofocus) e `button` `RefreshCw` "Tirar outra".
  - Sempre: `button` `UserRound` "Gerar pela descrição" (sem foto).
- Gerar → fecha o modal e chama `onAvatar(photo)` → App `run`: `requestPortrait` (Supabase `ai-manager-avatar` com nome, idade, nacionalidade, estilo, aparência e foto) → `manager.avatar = url` + toast "Novo retrato pronto."; durante, `busy` ("Processando…", tela inerte); erro → toast vermelho.
- Fechar: "Voltar" no cabeçalho do modal ou ○/B/Esc. A câmera é desligada ao fechar.

**Sua comissão (`section.panel.staff-reports`)** — `h2` `BriefcaseBusiness` (22) "Sua comissão"; 4 blocos (rótulo ciano em caixa alta + `strong` + `p`):
- "AUXILIAR TÉCNICO": "{formation} · {mentality}"; texto: se `tactic.pressure > 3` "Pressão alta exige rotação. Observe as condições antes de escalar." senão "Um bloco equilibrado ajuda a controlar o ritmo e preservar energia.". (Os **planos do auxiliar** em si chegam como mensagens "Relatório: {adversário}" na Caixa de entrada, com o botão "Aplicar plano do auxiliar".)
- "PREPARADOR FÍSICO": "{n} atletas precisam de descanso" (`fitness < 70`); "Condição média: {x}%".
- "DEPARTAMENTO MÉDICO": "{n} atletas em recuperação"; lista "{nome}: {dias} dias · …" ou "Todos os atletas estão liberados clinicamente.".
- "SCOUT": "Recrutamento nacional"; texto fixo "Combine os filtros do mercado. O potencial tem incerteza e o valor da transferência depende também de contrato, clube e interesse.".

### Estados e variações
- Com/sem retrato; IA disponível/indisponível (botão desabilitado sem explicação); modal da câmera aberto (loading/live/denied, com/sem foto).
- Pressão > 3 ou não; lesionados ou não.

### Interações
- Controle: D-pad até o botão de retrato, ✕/A abre a câmera; no modal, o foco vai para "Tirar foto"/"Gerar com esta foto"; ✕/A aciona; ○/B fecha (clica "Voltar" do modal). Atenção: o modal da câmera é local do Office (não é `popup` do App), então L1/R1 continuam trocando de aba, △/Y e □/X continuam ativos (□ avança o calendário) com o modal aberto.
- Mouse: clique normal.

---

## Sub-aba 5 — Olheiros e base (`view === 'scouts'`)

(Tela citada pelo usuário como uma das que ele **gostou**.)

### Elementos
**Rede de olheiros (`section.panel.staff-reports`)**
- `h2` `MapPinned` (22) "Rede de olheiros".
- Texto muted fixo: "Cada olheiro encontra um jovem talento a cada sete dias. A qualidade da rede reduz a incerteza do potencial.".
- Um bloco por olheiro (`career.scouts`, máx. 3):
  - Rótulo ciano "{REGIÃO} · NÍVEL {skill}" (1–5; nível = min(5, 2 + reputação do clube ÷ 35)).
  - `strong` nome (sorteado entre "Marcos Vieira", "Renata Campos", "Paulo Nogueira").
  - "Progresso da próxima observação: {progress}/7 dias" + `<meter 0–7>`.
  - `button.danger` "Demitir {primeiro nome}" → `fireScout` + toast "Olheiro demitido." (sem confirmação, sem reembolso).
- Se menos de 3 olheiros: `.button-row` com 3 botões "Contratar olheiro · {Brasil | América do Sul | Europa} · {custo}" — custo = R$ 500 mil + R$ 250 mil × olheiros atuais (debitado do caixa e lançado no histórico). Toast "Olheiro contratado para {região}."; erro "Caixa insuficiente para contratar um olheiro." A mesma região pode ser contratada mais de uma vez.

**Captação na base (`section.panel.staff-reports`)**
- `h2` `Users` (22) "Captação na base".
- Vazio: "Sem relatórios novos. Contrate um olheiro para iniciar a busca.".
- Um bloco por prospecto (`career.prospects`, máx. 5 — com 5, os olheiros param de progredir):
  - Rótulo "{posição (código, ex. ST)} · {nacionalidade}".
  - `strong` nome + " ({Região})".
  - "{potential} de potencial · {uncertainty} de incerteza · {money(value)} de valor estimado".
  - `button.primary` "Promover à base do clube" → `signProspect` (vai para `career.youth`, contrato até {season+3}-12-31, salário R$ 5 mil) + toast "Jovem talento integrado às categorias de base.".
- Cada novo prospecto gera mensagem do olheiro "Novo talento encontrado" (o texto diz "Confira em Comissão e perfil", mas a lista está nesta sub-aba).

### Estados e variações
- 0–3 olheiros (botões de contratar somem com 3); 0–5 prospectos; caixa insuficiente (erro em toast).

### Interações
- D-pad entre botões "Demitir", "Contratar…" e "Promover…"; ✕/A aciona. Mouse: clique.

---

## Sub-aba 6 — Clube vivo (`view === 'club'`, `ClubPanel`)

### Elementos
Layout `.staff-layout` com 3 `section.panel`:

**Diretoria e torcida**
- `h2` "Diretoria e torcida".
- 6 barras `Bar` (rótulo | `meter` 0–100 com faixas low 35 / high 65 / optimum 90 | número): "Resultados" (`board.results`), "Finanças", "Base", "Estilo", "Clássicos" (`board.derbies`), "Torcida" (`living.fans`).
- "Gestão: **{Associação | SAF}**" + pílulas vermelhas "Salários atrasados" (`wagesLate`) e "Transfer ban até {data}" (se `transferBan >= hoje`).
- Eleição (`living.election`): "Eleição em {data}: oposição de {rival} ({threat}% de chance de vencer e te demitir).".
- `h3` "Exigências": cada exigência aberta "{texto} · prazo {data}" ou "Nenhuma exigência em aberto.".
- Se `nationalInvite`: `p.living-headline` "A CBF quer você no comando da Seleção!".

**Comissão e preparação**
- `h2` "Comissão e preparação".
- `label.living-row` "Treino semanal" + `<select>` com `Equilibrado`, `Físico`, `Tático`, `Finalização`, `Recuperação` → `onLiving({training})` (sem toast).
- `label.living-row` "Marcação individual no craque rival" + botão "Ligada"/"Desligada" → alterna `marking`.
- "Analista de desempenho: nível **{analyst}**/5"; se < 5: botão "Contratar nível {n+1} · {money(400 mil × (n+1))}" → `upgradeAnalyst` + toast "Novo analista de desempenho contratado." (erro se caixa insuficiente). O nível do analista define a precisão do relatório do auxiliar e mostra probabilidades a partir do nível 3.
- `h3` "Vestiário": relações "🤝/⚡ {jogador A} e {jogador B} · {amizade|rixa}" ou "Sem grupos marcantes no elenco.".
- `h3` "Imprensa" (se houver) + uma `Bar` por jornalista (simpatia 0–100).

**Técnicos rivais**
- `h2` "Técnicos rivais"; até 20 linhas dos clubes da mesma divisão: "**{clube}** · {nome do técnico} ({estilo: Ofensivo/Retranqueiro/Pressão/Posse/Contra-ataque}, nível {1–5}[, {n} sem vencer se ≥ 3])".

### Estados e variações
- Owner Associação/SAF; salários atrasados; transfer ban; eleição; exigências; convite da Seleção; analista no máximo (sem botão); sem relações; sem jornalistas.

### Interações
- `select` de treino: com controle, **←/→** muda a opção e ✕/A avança ciclicamente; teclado/mouse: select nativo.
- Botões de marcação e analista: ✕/A ou clique.
- Painéis de texto não são focáveis; analógico direito rola.

---

## Classes CSS e visual atual

- Cabeçalho: `.section-title` (h1 itálico `clamp(24px,2.6vw,38px)`), `.eyebrow` (ciano 12 px, espaçado), `.status-pill` (laranja arredondado).
- Sub-abas: `.segmented` (fundo azul escuro 50%, padding 4) e `.segmented > button.active` (degradê branco, texto `#082062`).
- Painéis: `.panel` (vidro `--glass` com blur, borda superior colorida 3 px, cantos 4 px, `overflow: auto`). Cores da borda: `.message-list`/`.message-reader` roxo, `.finance-charts .panel` lime, `.ledger` laranja, `.confidence-panel` lime, `.objectives` amarelo, `.profile-panel` rosa, `.staff-reports` ciano.
- Mensagens: `.office-inbox` (grid `minmax(260px,380px) 1fr`), `.message-list > button` (`.unread`, `.selected`, `.playing`), `.mailbox-button(.speaking)` (degradê roxo→rosa / rosa→laranja + `mailbox-glow`), `.message-byline`, `.message-avatar`, `.pill`, `.message-body`, `.voice-button(.speaking)`, `.voice-wave i` (animação `voice-bar`), `.response-area`, `.memory-list`, `.empty-state`.
- Finanças: `.finance-layout` (grid `2fr 1fr`), `.metrics-strip`/`.metric`, `.finance-charts`, `.donut-container`, `.donut` (conic + furo `#0a2172`), `.chart-legend`, `.line-chart`, `.cash-flow` (`i.expense`), `.ledger`.
- Diretoria: `.board-layout` (grid `1fr 1.3fr`), `.confidence-panel`, `.huge-number` (lime, itálico `clamp(64px,12vh,120px)`), `.objectives`, `.objective-line` (span cinza, `strong` amarelo), `.living-headline`.
- Staff/olheiros/clube: `.staff-layout`, `.profile-panel` (grid retrato + texto, fundo radial azul→roxo), `.staff-reports > div > span` (rótulo ciano), `button.danger` (vermelho), `button.primary` (degradê lime→verde, texto azul escuro), `.living-bar`, `.living-row`, `.pill.danger`.
- Câmera: `.portrait-camera`, `.camera-frame(.loading|.live|.denied)`, `.face-guide`, `.camera-side`, `.camera-actions`; `.dialog.wide` (980 px).
- Voz global: `.voice-bar` (fixa, `right: 104px; bottom: 3px`, roxo→rosa, borda lime), `.pulse`.
- Em ≤ 760 px todos os grids viram 1 coluna.

## Regras que o redesign deve preservar

1. As 6 sub-abas e seus conteúdos/dados; troca por **L2/R2 (LT/RT)** e `q`/`e`; abertura direta na Diretoria quando demitido.
2. Caixa de entrada: indicação de não lida, pendente (laranja), resolvida (✓), selecionada e "tocando"; leitor com remetente, data, tipo, título, corpo, decisões e memórias.
3. **Caixa postal e voz** (o usuário gosta): botão "Ouvir caixa postal" com contagem, fila de não lidas, clique de telefone + chiado, barra global com pular/parar, recado ouvido = lido, continuar tocando entre abas.
4. Decisões: "Ouvir e oferecer apoio"/"Cobrar dedicação" (jogador) e "Ciente. Continuar o trabalho." (demais), com a nota de mercado.
5. Botão "Aplicar plano do auxiliar" / "Plano do auxiliar em uso".
6. Finanças: 4 métricas, distribuição de despesas, evolução do caixa, receitas × despesas, últimos 15 lançamentos.
7. Diretoria: confiança %, frase por faixa, CARGO ENCERRADO, ultimato, período de adaptação, propostas (aceitar/recusar; sem recusar quando demitido), objetivos de liga/finanças/desafio/copas.
8. Perfil do manager com retrato IA e fluxo de câmera (tirar foto, tirar outra, gerar com foto, gerar pela descrição, câmera negada).
9. **Olheiros e base** (o usuário gosta): limite 3 olheiros, custo crescente, progresso X/7, demitir, contratar por região, até 5 prospectos com potencial/incerteza/valor e "Promover à base".
10. Clube vivo: eixos da diretoria, torcida, gestão/SAF, alertas, eleição, exigências, Seleção, treino, marcação, analista, vestiário, imprensa, técnicos rivais.
11. Tudo navegável por controle; toasts que somem sozinhos.

## Problemas atuais e oportunidades

1. **Pouco FIFA**: o Escritório é uma grade de painéis de texto. Oportunidade: hub de tiles próprio (como "Office/Email" do FIFA 14) com e-mails em cards, sub-abas com ícones grandes e L2/R2 visíveis na barra.
2. A barra de sub-abas não mostra as dicas L2/R2 (o footer só diz "Sub-menu").
3. Sub-aba e mensagem selecionada se perdem ao trocar de aba (remontagem).
4. Pílula do tipo mostra códigos crus em inglês (`BOARD`, `PLAYER`, `STAFF`, `MARKET`, `NEWS`, `FINANCE`); traduzir/usar ícones e cores por remetente.
5. "0 AÇÕES NECESSÁRIAS" aparece em laranja mesmo sem pendências.
6. Ícone `Landmark` repetido em "Diretoria" e "Clube vivo".
7. Inconsistências de texto do jogo: mensagem do olheiro manda conferir "Comissão e perfil" (os prospectos estão em "Olheiros e base"); relatório do auxiliar manda contratar analista "na Comissão" (está em "Clube vivo").
8. Voz: o papel (`president`/`staff`/`player`/`narrator`) não muda a voz; o estado `loading` nunca fica verdadeiro com a voz do sistema. Não há atalho de controle para ouvir/pular/parar (ex.: △ = ouvir, R3 = pular).
9. Finanças sem interação nem detalhes: gráfico sem eixos/valores/datas, sem receitas por fonte, sem alerta de caixa negativo; nada focável para o controle.
10. Objetivos sem status visual (cumprido/em risco/falhando) e sem prazo; tudo em amarelo.
11. Aceitar proposta de emprego e demitir olheiro não pedem confirmação.
12. O modal da câmera não bloqueia L1/R1 e □/X (o calendário pode avançar com ele aberto).
13. Botão do retrato desabilitado sem explicar o motivo (offline/sem IA).
14. Clube vivo: 3 painéis num grid de 2 colunas (o terceiro cai sozinho); `select` nativo pouco "console"; listas de técnicos/imprensa em texto corrido — poderiam ser cards com escudo, estrelas de nível e medidores.
15. `.living-headline` em âmbar escuro com baixo contraste (ultimato, Seleção).
16. Olheiros: permitir mesma região repetida sem aviso; prospectos sem foto/card de jogador (poderiam usar o card FIFA com tier usado no resto do jogo).

## Ato 6 implementado

- As seis sub-abas permanecem na ordem e usam uma barra horizontal de console, com estado ativo petróleo/ciano e atributos de seleção para acessibilidade.
- Mensagens adotam a leitura em duas colunas (lista e reading pane); pendências recebem marcador coral, seleção petróleo, tipos em português e caixa postal/botões de voz permanecem no fluxo. A contagem sem pendências fica neutra.
- Finanças mantêm as quatro métricas, distribuição, histórico, receitas/despesas e até 15 lançamentos; o gráfico usa cores semânticas mais contidas.
- Diretoria, perfil, comissão, olheiros/base e Clube vivo receberam superfícies grafite/ardósia, hierarquia consistente e foco ciano, preservando ações existentes.
- Olheiros/base ganhou mapa esquemático do Brasil como elemento editorial, explicitamente sem indicar localização de atletas ou olheiros. Destinos e progresso exibidos continuam vindo dos scouts do save.
- O painel contextual de Clube vivo acompanha o foco entre Diretoria e torcida, Comissão e preparação e Técnicos rivais, resumindo os valores reais do save.
- CSS isolado em `src/styles/legacy/10-office-season.css`; o layout móvel continua restrito a landscape. As oportunidades restantes acima não foram alteradas nem implicam novas regras de jogo.

## Ajustes pós-Ato 7: olheiros e Clube vivo

- **Olheiros**: cada profissional virou um card com iniciais, região, nível em 5 marcadores, progresso e prazo do próximo relatório (com aviso quando a observação pausa porque a caixa tem 5 relatórios). A vaga livre aparece como card de contratação com os três destinos e o custo.
- **Gerenciar olheiro** substitui o antigo botão vermelho "Demitir": abre um modal para **mudar o destino** (`reassignScout`, sem custo, reinicia a observação) ou **dispensar**. A dispensa pede confirmação listando as consequências reais (dias perdidos, sem reembolso, relatórios mantidos, custo da próxima contratação); o foco do controle vai para "Manter".
- **Clube vivo** foi repaginado: 4 indicadores no topo (cargo, torcida, treino, analista) e sub-abas Diretoria, Preparação, Analista, Vestiário e imprensa, Técnicos rivais. Cada área explica o efeito real na engine.
- **Analista**: escada de níveis 1–5 com erro da força do rival (±6, ±4, ±2, exato, exato), pontos fracos no relatório (1 a 5) e previsão de resultado a partir do nível 3. Só o próximo nível pode ser contratado (pagamento único de 400 mil × nível).
- **Treino** virou cards de escolha com o efeito diário e no jogo; **marcação individual** mostra o ganho (−55% na chance de gol do marcado) e o custo (−1,5% no meio-campo).
- Ícone do Clube vivo passou a ser `HeartPulse` (antes repetia o `Landmark` da Diretoria).

## Fase 1: estádio e receitas

- **Finanças** ganhou sub-abas compactas (`segmented compact`): Visão geral (o painel anterior, agora com a manutenção das instalações somada à "Operação"), Estádio e torcida, Patrocínio e Instalações. A engine fica em `src/game/economy.ts` e o estado salvo em `living.economy` (opcional, saves antigos recriam na hora).
- **Estádio**: capacidade de ~15 mil (reputação 60) a ~70 mil (reputação 87), com variação fixa por clube; cada nível de estádio acima do original soma 8%. Ingresso de referência R$ 30–62 pela reputação; o usuário escolhe Popular (0,7×), Médio ou Caro (1,4×) ou ajusta de R$ 5 em R$ 5 (0,4× a 3×). Público = sócios presentes + demanda × lugares restantes; a demanda sobe com humor da torcida, fase (últimos 5 jogos), clássico (+15%), copa (+6%) e adversário grande e cai com o preço (elasticidade −0,8). Bilheteria = pagantes × ingresso, menos custo de operação (3 por torcedor + R$ 40 mil). Ingresso 35% acima da referência tira 2 de humor por mês; 20% abaixo dá +1.
- **Fator casa**: estádio ≥ 92% cheio dá +1,5% de força (como torcida ≥ 78); abaixo de 40%, −0,5%. O público esperado aparece nas condições da partida e o público/bilheteria na notícia do jogo.
- **Sócio-torcedor**: base de 2 mil a ~52 mil pela reputação; mensalidade de referência R$ 20–47 (planos Básico 0,75×, Padrão, Premium 1,4×). O quadro anda 12% por mês rumo à meta (humor e preço); crise (humor < 25 ou salários atrasados) tira 3%/mês; cada título +6%, acesso +5%, rebaixamento −8%. Sócios ocupam 55% (70% em clássicos) até 60% da capacidade e pagam a mensalidade todo dia 1º.
- **Patrocínio master**: contrato inicial de 5–12 meses com marca fictícia. Dez dias antes do fim chegam três propostas (Fixo 1,15× do valor com bônus 0,4× e 36 meses; Equilibrado 1× e 24 meses; Desempenho 0,8× com bônus 2,5× e 12 meses) numa mensagem importante com botões de escolha, também em Finanças → Patrocínio. A mensagem não trava o calendário: sem escolha em 10 dias (ou no modo automático) a primeira é assinada. Bônus de título, acesso e G4 são pagos na virada da temporada.
- **Instalações** (níveis 1–5, nível inicial pela reputação): Estádio (12/25/45/80 mi, 120–300 dias, +8% de capacidade e +4 de humor ao concluir), CT (6/12/22/38 mi, 60–180 dias; +5% de evolução, −0,02 de perda diária de ritmo e −4% de chance/duração de lesão por nível) e Base (4/8/15/26 mi, 60–150 dias; +1,5 de potencial por nível nos jovens revelados). Obra paga à vista, uma por área; a diretoria (finanças) reage ao tamanho do gasto. Manutenção mensal de 40/30/20 mil por nível.
- O fechamento mensal do clube do usuário continua com um lançamento único (TV + patrocínio + sócios × salários + operação + manutenção + juros); cada jogo em casa gera um lançamento de bilheteria. Clubes da IA mantêm as fórmulas anteriores.