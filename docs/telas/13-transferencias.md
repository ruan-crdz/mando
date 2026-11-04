# Tela: Transferências

## Resumo

Terceira aba principal do modo carreira (`TRANSFERÊNCIAS`, índice 2 do menu superior `CENTRAL · TIME · TRANSFERÊNCIAS · ESCRITÓRIO · TEMPORADA`). É onde o técnico procura reforços em clubes brasileiros, acompanha alvos observados e conduz todas as negociações por chat — tanto **compras** (proposta → acordo com o clube → contrato com o agente do atleta) quanto **vendas** (propostas recebidas de clubes nacionais e do exterior pelos atletas do usuário, com aceitar / pedir mais / recusar).

A tela tem **4 subvistas** (botões segmentados, alternáveis com LT/RT) e **1 modal grande** com subetapas:

| # | Subvista / modal | Estado interno (`Transfers.tsx`) | Conteúdo |
|---|---|---|---|
| A | Cabeçalho comum | sempre | Título, pílula da janela + orçamento, abas segmentadas |
| B | **Mercado** | `view === 'market'` | Painel de filtros (14 critérios) + tabela paginada (20/página) |
| C | **Observados** | `view === 'shortlist'` | Grade de cards FIFA dos atletas marcados com ★ |
| D | **Negociações** | `view === 'negotiations'` | Lista de conversas + painel de chat (compra e venda), modo "dentro da conversa" |
| D1 | **Contas** | `view === 'accounts'` | Opções de compra, cláusulas de futura venda e histórico de repasses |
| E | **Modal "Sala de negociação"** | `deal !== null` | 3 colunas: alvo (card FIFA + fatos + atalhos), mesa (etapas), resumo financeiro |
| E1 | ↳ Coluna do alvo + atalhos (pré-contrato, multa, empréstimo, observar) | sempre no modal | |
| E2 | ↳ Etapa 1 "Acordo com o clube" | `step === 'club'` | Fala do clube, taxa, chips rápidos, troca, medidor |
| E3 | ↳ Seletor "Jogador na troca" | `step === 'club' && pickExchange` | Grade de cards do próprio elenco |
| E4 | ↳ Etapa 1 já acordada | `step === 'club' && clubAgreed` | Fala "Acordo fechado…" + botão para etapa 2 |
| E5 | ↳ Etapa 2 "Contrato do jogador" | `step === 'player'` | Fala do agente, salário, duração, luvas, medidor |
| E6 | ↳ Resumo financeiro | sempre no modal | Orçamento, caixa, custos, medidores, botão Enviar |
| F | Avisos (toasts) globais | App | Sucesso/erro das ações desta tela |

## Ato 5 implementado

- **Mercado em três colunas** (filtros | lista | `ScoutReportPanel` "Relatório do olheiro"). A linha focada (foco ou mouse) fica petróleo com borda ciano (`focused`, `data-market-player`, `aria-current`); sem foco, o relatório mostra o primeiro da página. Clique/A na linha continua abrindo a mesa. O relatório traz card com tier, clube, idade/nacionalidade/pé, a linha de `scoutReport()` (faixa de OVR no Profissional, sem atributos inventados), valor, salário, contrato, divisão, flags (Observado, Emprestado, Pré-contrato liberado, Multa) e ações Negociar/Observar.
- **Observados** com grade de slots + painel lateral "Alvo observado" (mesmo `ScoutReportPanel`) com "Remover dos observados"; ao remover, o foco vai ao alvo seguinte/anterior. Estado vazio tem "Ir ao Mercado".
- **Contador de Negociações** destaca as que exigem resposta: `"{pendentes} · {n} !"` com classe `count attention`.
- **Medidor de chance em 5 níveis** (≥85, ≥60, ≥35, ≥15, resto), cinco barras, `role="meter"`, tons bom/médio/ruim.
- **Mesa de negociação** (modal `deal-desk`, "Mesa de negociação · {nome}"): três colunas grafite, bolhas violeta (eles) e ciano (eu), saldo negativo marcado com "· negativo".
- **Mobile somente landscape:** até 1100px, três colunas compactas; até 700px, filtros à esquerda e lista à direita (o relatório do Mercado é ocultado; a mesa mostra os mesmos dados) e a mesa passa a duas colunas com o resumo abaixo.
- CSS em `src/styles/legacy/09-transfers.css`, escopado em `.transfers-screen`/`.deal-desk` (`.market-row` também é usado no elenco do Time).

**Não existem nesta tela** (descrito para evitar suposições do redesign): lista de venda dos próprios atletas (fica na ficha do jogador da aba TIME — "Atleta à venda. As propostas chegam em Transferências › Negociações."), histórico de transferências concluídas (só aparece como conversas com status "Concluída"), aviso visual de *transfer ban* (só aparece como toast de erro ao enviar proposta), busca de agentes livres e de jogadores de clubes do exterior.

## Como se chega / como se sai

**Chegar**
- Clique/toque em `TRANSFERÊNCIAS` no menu superior (`nav.main-nav` em `App.tsx`).
- Controle: **LB/RB** (Xbox) ou **L1/R1** (PS5) percorrem as 5 abas principais em ciclo (teclado: `[` e `]`).
- Mensagens do Escritório do tipo `market` dizem "Responda na aba Negociações das transferências" (não há link direto; o usuário navega manualmente).
- A tela sempre abre na subvista **Mercado** (estado local `useState('market')`; trocar de aba principal desmonta o componente e perde filtros, página e modal).

**Sair**
- LB/RB / L1/R1 ou clique em outra aba principal (inclusive com o modal aberto — ver Problemas).
- **Y / △** (ação `info`) vai direto para ESCRITÓRIO.
- **Menu/Options** abre a pausa.
- **B / ○** sem modal e sem conversa ativa abre a pausa (comportamento global do App).

## Arquivos-fonte

| Arquivo | Papel |
|---|---|
| `src/screens/Transfers.tsx` (1138 linhas) | Tela inteira: `Transfers`, `ChatPanel`, `LikelihoodMeter`, `Figures`, filtros, modal de negociação |
| `src/App.tsx` (linhas ~648–707) | Renderiza `<Transfers>` quando `tab === 2`; implementa os handlers e os toasts |
| `src/components/PlayerCard.tsx` | Card quadrado estilo Ultimate Team (Observados e seletor de troca); `byPosition` para ordenar |
| `src/components/PlayerFace.tsx` | Foto real `assets/jogadores/{id}.webp` ou silhueta SVG neutra |
| `src/components/cardTier.ts` | OVR → `card-bronze` (<65) / `card-silver` (65–74) / `card-gold` (75–82) / `card-rare` (≥83, "ouro brilhante") |
| `src/components/controls.tsx` | `OptionCycler`, `ChipGroup`, `NumberStepper` (controles de filtro e de valores) |
| `src/components/ui.tsx` | `money`, `dateLabel`, `Badge` (escudo), `Modal`, `SectionTitle` |
| `src/game/transfers.ts` | Regras: valor de mercado, preço pedido oculto, chances, respostas do clube/agente, propostas recebidas |
| `src/game/calendar.ts` | `transferWindow(date)`: janela aberta de **05/jan a 03/mar** e de **20/jul a 11/set** |
| `src/controller/GamepadProvider.tsx`, `FocusManager.ts`, `xboxMapping.ts`, `dualsenseMapping.ts` | Navegação por controle, foco espacial, teclado virtual |
| `src/styles.css` | Seções "Transferências" (~1823–1915), "mercado, observados e sala de negociação" (~4247–4575), "Negociações (chat)" (~4576–4890), "Conversa ativa" (~5076–5092), cards FIFA (~6035–6210) |

### Props de `<Transfers>` (App.tsx)

| Prop | Assinatura | O que o App faz | Toast de sucesso |
|---|---|---|---|
| `career` / `world` | estado atual | — | — |
| `onOffer` | `(id, fee, wage, exchange?, {years, bonus}) => boolean` | `createOffer(...)`; retorna `true` se não lançou erro | "Proposta enviada. A resposta chega amanhã." |
| `onShortlist` | `(id) => void` | alterna o id em `career.shortlist` | (nenhum) |
| `onLoan` | `(id, termos) => boolean` | `createLoanOffer(...)`; envia uma negociação de empréstimo | "Pedido de empréstimo enviado. A resposta chega amanhã." |
| `onExerciseOption` | `(id) => void` | `exerciseLoanOption(...)` | "Opção de compra exercida. O atleta é definitivamente do clube." |
| `onPrecontract` | `(id, wage) => void` | `signPreContract(...)` | "Pré-contrato assinado. O reforço chega ao fim do vínculo atual." |
| `onClause` | `(id) => void` | `exerciseReleaseClause(...)` | "Multa rescisória paga e transferência concluída." |
| `onAnswer` | `(id, accept) => void` | `answerIncoming` (proposta recebida) + recalcula escalação ideal | (nenhum) |
| `onRespond` | `(id, accept) => void` | `respondCounter` (contraproposta do clube/agente na compra) | (nenhum) |
| `onAsk` | `(id, fee) => void` | `counterIncoming` (pedir mais numa venda) + recalcula escalação | (nenhum) |

Todos passam por `act()`: qualquer `throw` vira **toast vermelho** com a mensagem (some sozinho em 4 s; sucesso some em 2,6 s; sem botão de fechar).

### Formatação de dados (vale para toda a tela)

- **Dinheiro** — `money(v)`: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })`. Exemplos: `R$ 12,5 mi`, `R$ 850 mil`, `R$ 1,2 bi`, `R$ 0`. Sempre compacto nesta tela.
- **Datas** — `dateLabel(d)`: `pt-BR`, dia 2 dígitos + mês abreviado + ano → `04 de nov. de 2026`.
- **Posições** — códigos em inglês, sem tradução: `GK, CB, LB, RB, DM, CM, AM, LW, RW, ST`.
- **OVR** — `overall(player, player.position, state)` (inteiro 1–99).
- **Scouting** — `scoutReport()`: normal/iniciante `OVR 74 · potencial 78–84`; dificuldade **Profissional** `OVR estimado 70–78 · potencial 78–84` (faixa ±4 e incerteza do potencial).
- **Valor de mercado** — `marketValue()`: valor base × crescimento × idade (<23 anos ×1,1; >32 anos ×0,8). **Não é o preço pedido** (o pedido é oculto, ~1,08–1,9× o valor).

### Mapa de botões do controle (global, válido em toda a tela)

| Ação | Xbox | PS5 | Teclado | Efeito |
|---|---|---|---|---|
| confirm | A | ✕ | Enter / clique | Ativa o elemento focado; em campo de texto/numérico abre o **teclado virtual** |
| back | B | ○ | Esc | Sai do modo edição → fecha modal (`[data-dialog-close]`) → sai da conversa (`[data-trap-exit]`) → senão abre a pausa |
| secondary | X | □ | — | Em `NumberStepper`/`OptionCycler`: liga/desliga modo ajuste. **Fora deles: "Avançar dia"** |
| info | Y | △ | — | Vai para a aba ESCRITÓRIO |
| previousTab / nextTab | LB / RB | L1 / R1 | `[` / `]` | Aba principal anterior/seguinte |
| previousView / nextView | LT / RT | L2 / R2 | `q` / `e` | Cicla **Mercado ↔ Observados ↔ Negociações** (primeiro `.segmented` do `main`; dentro do modal não faz nada) |
| menu | ☰ | Options | — | Pausa |
| D-pad / analógico esq. | | | setas | Foco espacial (`FocusManager.move`) ou ←/→ ajusta o controle em modo edição |
| analógico dir. vertical | | | — | Rola a área rolável mais próxima do foco |
| analógico dir. horizontal | | | `,` / `.` | Rola carrosséis horizontalmente (não usado aqui) |

Dicas fixas no rodapé do App: `A Selecionar · B Voltar · X Avançar dia · RT Sub-menu · ☰ Pausa` (ícones conforme controle).

---

# A. Cabeçalho comum

## Resumo
Faixa de topo presente nas quatro subvistas: título editorial, pílula de status da janela com orçamento e a barra segmentada de subvistas.

## Wireframe atual (ASCII)
```
TRANSFERÊNCIAS / O MERCADO SE MOVE                         ┌──────────────────────────────────────────┐
A PRÓXIMA PEÇA DO SEU PLANO.                               │ JANELA ABERTA · R$ 25,3 mi disponíveis   │
                                                           └──────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ [🔍 Mercado] [☆ Observados (3)] [💬 Negociações (2)]              │
└──────────────────────────────────────────────────────────────────┘
```

## Elementos
1. **Kicker** (`p.eyebrow`): texto fixo `TRANSFERÊNCIAS / O MERCADO SE MOVE`.
2. **Título** (`h1`): `A próxima peça do seu plano.` (termina com ponto, então não recebe o `.title-dot` decorativo; exibido em caixa alta itálica pelo CSS).
3. **Pílula de janela** (`span.status-pill`, à direita do título):
   - Aberta: `JANELA ABERTA · {money(transferBudget)} disponíveis` — fundo **lima** (`.open`), texto azul-escuro.
   - Fechada: `JANELA FECHADA · {money(transferBudget)} disponíveis` — fundo **laranja**, texto branco.
   - Dado: `career.finances[clubId].transferBudget` (orçamento de transferências, não o caixa).
4. **Barra segmentada** (`div.segmented`, 3 botões):
   - `Search` (lucide, 16px) + `Mercado`.
   - `Star` (16px) + `Observados` + contador `span.count` = nº de atletas na shortlist que **não** estão no clube do usuário.
   - `MessageSquare` (16px) + `Negociações` + contador `span.count` = nº de ofertas que precisam de ação **ou** estão pendentes (inclui as suas aguardando resposta). Contador aparece mesmo quando é 0.
   - Botão ativo: fundo branco→azul-claro, texto azul-escuro.

## Estados e variações
- Janela aberta/fechada muda cor e texto da pílula (datas: 05/01–03/03 e 20/07–11/09).
- Orçamento negativo ou zero é exibido como está (`R$ 0`, `-R$ 1,2 mi`).
- **Transfer ban** (`career.living.transferBan`) **não** é exibido aqui (só como erro ao enviar proposta).
- Desafio "Venda necessária"/"Só a base" também não aparecem — só como toasts de erro.

## Interações
- Clique nos botões da barra troca a subvista. Clicar em "Negociações" também zera o modo "dentro da conversa".
- Controle: **LT/RT (L2/R2)** ciclam as 4 subvistas (o provider clica o próximo botão e foca nele). D-pad até a barra + A também funciona.
- Pílula não é interativa.

## Classes CSS e visual atual
- `.section-title`, `.eyebrow`, `h1` itálico 800 caixa alta (`clamp(26px,3vw,44px)`).
- `.status-pill` (13px, `padding 6px 12px`, raio 20px, laranja) / `.status-pill.open` (lima `var(--lime)`, texto `#06204d`).
- `.segmented` (flex, gap 4px, fundo `rgba(0,8,46,.5)`, raio 4px, rolagem horizontal oculta); `.segmented > button.active` (gradiente `#fff→#d8e6ff`, texto `#082062`, sombra).
- `.count` (círculo laranja 22px, fonte display 800 12px).
- `.transfers-screen` não tem regras próprias; o contêiner é `.screen-enter` (animação de entrada).

## Regras que o redesign deve preservar
- Indicar claramente janela aberta x fechada e o orçamento de transferências disponível.
- Três subvistas com contadores; ciclo por LT/RT (gatilhos) como sub-menus do FIFA.
- Contador de Negociações destacando o que exige resposta.

## Problemas atuais e oportunidades
- Título genérico, pouco "FIFA"; poderia virar um header de "Transfer Hub" com orçamento, caixa e folha salarial.
- Não mostra **datas da janela** (quando abre/fecha) nem dias restantes.
- Transfer ban e restrições de desafio são invisíveis até o erro — deveriam ser banners.
- Contador "0" laranja chama atenção sem motivo.
- Faltam hints visuais LT/RT na própria barra segmentada.

---

# B. Subvista Mercado (busca com filtros)

## Resumo
Busca de atletas de **clubes brasileiros** (exclui o próprio clube, agentes livres e clubes do exterior). Layout em 2 colunas: painel de filtros ("Foco de recrutamento") à esquerda e tabela de resultados paginada à direita. Clicar numa linha abre o **modal Sala de negociação** (E).

## Wireframe atual (ASCII)
```
┌─ FOCO DE RECRUTAMENTO ──────┐ ┌─ 412 JOGADORES ENCONTRADOS ──── Valor de mercado ≠ preço pedido · ★ observado ┐
│ NOME                        │ │ JOGADOR                         SCOUTING                 VALOR       SALÁRIO/MÊS │
│ [Quem você procura?      ]  │ │┌──────────────────────────────────────────────────────────────────────────────┐ │
│ CLUBE                       │ ││[ST][foto56] ★ Pedro Silva       OVR 78 · potencial 80–86  R$ 45 mi    R$ 420 mil ││
│ [<  Todos os clubes      >] │ ││           Flamengo · 27 anos · OVR 78                                         ││
│ DIVISÃO                     │ │└──────────────────────────────────────────────────────────────────────────────┘ │
│ (Todas)(Série A)(Série B)   │ │ [GK][foto] Fulano  ...  (linhas alternadas, 20 por página)                     │
│ POSIÇÃO                     │ │ ...                                                                            │
│ [< Todas as posições  >]    │ │                                                                                 │
│   ▬ · · · · · · · · · ·     │ │                                                     [Anterior]  1 / 21  [Próxima]│
│ IDADE MÍN.   IDADE MÁX.     │ └─────────────────────────────────────────────────────────────────────────────────┘
│ [-][Qualquer][+] [-][   ][+]│
│ OVR MÍN.     OVR MÁX.       │
│ POTENCIAL MÍN. VALOR MÁX.   │
│ SALÁRIO MÁX.                │
│ PÉ  (Todos)(Direito)(Esquerdo)(Ambos)
│ CONTRATO TERMINA ATÉ        │
│ [< Qualquer data      >]    │
│ NACIONALIDADE               │
│ [Ex.: Argentina          ]  │
│ (rolagem interna)           │
│ Limpar filtros              │
└─────────────────────────────┘
```

## Elementos

### Painel de filtros (`aside.panel.filter-panel`)
- **Título** `h2`: `Foco de recrutamento` (caixa alta via CSS).
- Área rolável `div.filter-scroll` com, nesta ordem:

| # | Rótulo | Componente | Opções / limites | Regra de filtro |
|---|---|---|---|---|
| 1 | `Nome` | `<input>` texto, placeholder `Quem você procura?` | livre | nome contém (case-insensitive, `pt-BR`) |
| 2 | `Clube` | `OptionCycler` | `Todos os clubes` + todos os clubes do mundo exceto o seu, ordem alfabética (Série A e B) | `clubId === valor` |
| 3 | `Divisão` | `ChipGroup` | `Todas` · `Série A` · `Série B` | liga do clube |
| 4 | `Posição` | `OptionCycler` (com bolinhas: 11 opções) | `Todas as posições` + `GK CB LB RB DM CM AM LW RW ST` | posição natural |
| 5 | `Idade mín.` / `Idade máx.` | `NumberStepper` opcional (vazio = `Qualquer`) | 15–45, passo 1 | idade na data do jogo |
| 6 | `OVR mín.` / `OVR máx.` | `NumberStepper` opcional | 1–99, passo 1 | OVR atual |
| 7 | `Potencial mín.` | `NumberStepper` opcional | 1–99, passo 1 | potencial real (não a faixa do scout) |
| 8 | `Valor máx.` | `NumberStepper` opcional, mostra `money()` embaixo em lima | ≥0, passo R$ 500 mil | valor de mercado ≤ |
| 9 | `Salário máx.` | `NumberStepper` opcional, mostra `money()` | ≥0, passo R$ 10 mil | salário mensal atual ≤ |
| 10 | `Pé` | `ChipGroup` | `Todos` · `Direito` · `Esquerdo` · `Ambos` | `foot` D/E/A |
| 11 | `Contrato termina até` | `OptionCycler` (bolinhas: 7 opções) | `Qualquer data`, `Dez/{temporada}` … `Dez/{temporada+5}` | `contractEnd ≤ AAAA-12-31` |
| 12 | `Nacionalidade` | `<input>` texto, placeholder `Ex.: Argentina` | livre | nacionalidade contém |

  Itens 5–9 ficam numa grade de 2 colunas (`div.filter-pairs`). Qualquer alteração volta a lista para a página 1.
- **Botão** `Limpar filtros` (`button.text-button`, fora da área rolável, no rodapé do painel): restaura todos os filtros e a página.

Detalhes dos controles:
- `OptionCycler`: botão largo com `ChevronLeft` / valor central / `ChevronRight` (lucide 18px, lima, opacas 35% fora do modo edição) e bolinhas de posição se ≤12 opções (Clube não tem bolinhas). Em edição: borda e brilho lima, valor em lima.
- `ChipGroup`: rótulo + chips; chip ativo branco→azul-claro.
- `NumberStepper`: rótulo; linha `[−][valor][+]` (`Minus`/`Plus` 15px); placeholder `Qualquer`; abaixo, valor formatado em lima (só Valor/Salário); em modo ajuste aparece a dica `← → ajustar · □/B sair` e a linha fica lima. Aceita só dígitos, sem zeros à esquerda; apagar tudo = sem filtro.

### Painel de resultados (`section.panel.market-results`)
- **Cabeçalho** (`div.panel-heading`): `h2` `{N} jogadores encontrados` + `small` `Valor de mercado ≠ preço pedido · ★ observado`.
- **Cabeçalho da tabela** (sticky): `JOGADOR` · `SCOUTING` · `VALOR` · `SALÁRIO/MÊS`.
- **Linha** (`button.market-row`, uma por atleta, ordenadas por OVR base decrescente, 20 por página):
  1. Coluna JOGADOR:
     - `span.position-tag` com a posição (caixa ciano, texto azul-escuro, min 40px).
     - `PlayerFace size="sm"` com classe `face-tier card-…` → **quadrado 56×56 px, raio 8px**, fundo no gradiente do nível (bronze/prata/ouro/ouro brilhante com brilho animado). Foto `object-fit: contain`, alinhada embaixo. Sem foto: silhueta SVG branca 60% **sem fundo** (`background: none !important` sobrepõe o fundo do nível).
     - Nome em `strong`, precedido de `Star` 13px preenchida amarela (`.star-on`) se estiver na shortlist.
     - `small`: `{Clube} · {idade} anos · OVR {ovr}` (reticências se não couber).
  2. SCOUTING: `scoutReport()` em ciano (`.scouting-label`).
  3. VALOR: `strong` `money(marketValue)`.
  4. SALÁRIO/MÊS: `money(salário atual)`.
- **Estado vazio**: `p.empty-state` `Nenhum atleta atende a todos os critérios. Ajuste os filtros.` (aparece abaixo da tabela, cujo cabeçalho continua visível).
- **Paginação** (`div.pagination`, alinhada à direita): botão `Anterior` (desabilitado na página 1), texto `{página} / {total}` (mínimo `1 / 1`), botão `Próxima` (desabilitado na última).

## Estados e variações
- **Janela fechada**: a lista funciona normalmente; o modal abre, mas o envio fica desabilitado ("Janela fechada").
- **Sem orçamento**: lista inalterada; restrições aparecem só no modal.
- **Lista vazia**: mensagem acima + paginação `1 / 1` com os dois botões desabilitados.
- **Atleta observado**: estrela amarela antes do nome.
- **Responsivo (≤ ~900px)**: layout vira 1 coluna; a tabela mostra só JOGADOR e SCOUTING (VALOR e SALÁRIO somem).
- Dificuldade Profissional: coluna SCOUTING mostra faixas estimadas, mas o `small` da linha mostra o **OVR exato** (inconsistência).

## Interações
- **Mouse**: digitar nos campos; clicar nas setas do cycler (troca direto) ou no centro (entra/sai do modo edição); clicar chips; `−`/`+` dos steppers; clicar linha → abre modal; Anterior/Próxima.
- **Controle**:
  - D-pad navega espacialmente entre filtros, linhas e paginação (→ numa linha tende a ir para o painel vizinho alinhado).
  - Campo texto (Nome/Nacionalidade): **A** abre teclado virtual QWERTY (Start confirma, B cancela, □ apaga, △ espaço, RT maiúsculas, R3 especiais/acentos).
  - `OptionCycler`: **A** ou **□** entra no modo edição; **←/→** trocam; **A/□/B** saem (sair do foco também sai).
  - `ChipGroup`: navegar até o chip + **A**.
  - `NumberStepper`: **A** abre teclado numérico virtual; **□** entra no modo ajuste (←/→ somam/subtraem o passo); **□/B** saem.
  - Linha + **A** → abre a Sala de negociação.
  - Analógico direito rola a tabela ou a coluna de filtros.
  - **□ fora de um campo editável avança o dia** (ação global).

## Classes CSS e visual atual
- `.market-layout`: grid `minmax(260px,320px) | 1fr`, gap 16px.
- `.filter-panel` / `.market-results`: `.panel` (vidro azul, borda superior 3px) com borda superior **laranja**; `overflow: hidden`.
- `.filter-scroll` (coluna rolável gap 10px), `.filter-pairs` (grid 2 colunas gap 8px).
- `.market-table` (coluna rolável gap 3px); `.market-table-head` (sticky, fundo `#0a2172`, 12px 800 tracking 1.5px, `--ink-3`); `.market-row` (grid `2.2fr 1fr .8fr .8fr`, fundo branco 6%, linhas pares 10%, padding 7×10).
- `.market-row .player-face.sm` → 56×56px raio 8px, fundo `#3d8bff→#0b2f8f` sobrescrito por `.face-tier.card-*` (`var(--card-bg)`); `.card-rare::after` brilho animado `card-shine 3.2s`.
- `.position-tag` (ciano), `.scouting-label` (ciano 600), `.star-on` (amarelo), `.pagination` (700 15px display), `.empty-state` (centralizado, `--ink-2`).
- Gradientes de nível: bronze `#e7b083→#b06b35→#5e3313`; prata `#f1f5f8→#a9b4bc→#56636c`; ouro `#ffe590→#d4a537→#7a5512`; rare `#fff6c4→#ffcf2e→#e09a00→#6b3f00` + contorno dourado e brilho.

## Regras que o redesign deve preservar
- Todos os 14 critérios de filtro e suas faixas/passos; filtros opcionais "Qualquer"; reset volta à página 1.
- Escopo: só clubes brasileiros, nunca o próprio clube, nem livres/exterior.
- Ordenação por OVR decrescente e paginação de 20 (ou rolagem infinita equivalente navegável).
- Aviso "Valor de mercado ≠ preço pedido".
- Indicação de observado (★) e de nível de card pela cor.
- Silhueta padrão para quem não tem foto: **sem sigla e sem fundo escuro**.
- Tudo operável por controle sem mouse (cycler/stepper com modo edição, teclado virtual).

## Problemas atuais e oportunidades
- **Foto pequena** (56 px) — o usuário quer **maior**; sugere-se linha estilo FIFA com mini-card (OVR + posição + foto grande) ou alternar lista ↔ grade de cards.
- Escudo do clube não aparece na linha (só o nome em texto pequeno).
- Faltam colunas de nacionalidade (bandeira), contrato, potencial e ordenação clicável por coluna.
- Painel de filtros longo, exige rolagem; ideal: filtros em abas/gaveta ("Busca de jogadores" do FIFA com Posição/Liga/Clube/Nacionalidade em cards).
- Dois filtros de texto exigem teclado virtual no controle — considerar listas.
- OVR exato vaza no `small` em dificuldade Profissional.
- `position-tag` em inglês; poderia ser traduzido (GOL/ZAG/LE/LD/VOL/MC/MEI/PE/PD/ATA) se o restante do jogo seguir.
- Paginação no canto direito é distante do foco; LB/RB de página não existem.

---

# C. Subvista Observados (shortlist)

## Resumo
Grade de cards FIFA dos atletas marcados com "Observar" no modal. Mostra apenas quem **ainda não** pertence ao clube do usuário. Clicar num card abre a Sala de negociação.

## Wireframe atual (ASCII)
```
┌─ LISTA DE OBSERVAÇÃO ─────────────── Abra um atleta no mercado e marque ★ para acompanhar. ┐
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                        │
│ │78 [⛨]│ │81 [⛨]│ │70 [⛨]│ │66 [⛨]│ │85 [⛨]│ │62 [⛨]│   (6 por linha; 4 em telas ≤1100px)    │
│ │ST    │ │CB    │ │CM    │ │GK    │ │LW ✦  │ │RB    │                                        │
│ │ foto │ │ foto │ │ 👤   │ │ foto │ │ foto │ │ foto │                                        │
│ │SILVA │ │SOUZA │ │LIMA  │ │ ...  │ │ ...  │ │ ...  │                                        │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
Vazio:
│                         ☆ (34px)                                    │
│                  NENHUM ALVO MARCADO.                               │
│        Use o mercado para encontrar e observar jogadores.           │
```

## Elementos
- **Cabeçalho**: `h2` `Lista de observação` + `small` `Abra um atleta no mercado e marque ★ para acompanhar.`
- **Grade** (`div.card-scroll > div.card-grid`, 6 colunas) de `PlayerCard`:
  - Card quadrado (`aspect-ratio: 1`), fundo pelo nível (bronze/prata/ouro/rare com brilho animado e contorno dourado).
  - Topo esquerdo: **OVR** grande (`pc-ovr`, 22–32px) + **posição** (`pc-pos`).
  - Topo direito: **escudo do clube atual** (`Badge size="small"` dentro de `pc-badge`).
  - Foto ocupando o card (contain, alinhada embaixo); sem foto → silhueta branca 55% sem fundo.
  - Rodapé: nome curto (`shortName`: se o nome tem >2 palavras, só o último) sobre degradê da cor do nível.
  - Se lesionado/suspenso: texto `Lesão {n}d` / `Suspenso {n}` e card acinzentado (`.out`).
  - O primeiro card recebe `data-autofocus`.
  - A prop `note={money(marketValue)}` é passada **mas o `PlayerCard` não a renderiza** — o valor de mercado não aparece.
- **Estado vazio** (`div.empty-state`): ícone `Star` 34px, `h2` `Nenhum alvo marcado.`, `p` `Use o mercado para encontrar e observar jogadores.`

## Estados e variações
- Lista vazia → estado vazio.
- Atleta contratado sai da lista automaticamente (filtro por clube ≠ seu), mas o id continua em `career.shortlist`.
- Janela fechada: sem diferença visual.
- ≤1100px: 4 colunas.

## Interações
- Mouse: clique no card → Sala de negociação.
- Controle: D-pad entre cards (o card focado escala 1,05); **A** abre a sala; LT/RT troca de subvista. Foco inicial no primeiro card.
- Não há como remover da lista aqui (só pelo botão "Observado" dentro do modal).

## Classes CSS e visual atual
- `.shortlist-panel` (`.panel` com borda superior **amarela**, coluna, `overflow: hidden`), `.shortlist-panel .card-grid { repeat(6, 1fr) }`.
- `.player-card` (raio 6px, borda 2px, sombra; `:focus` scale 1.05), `.pc-top`, `.pc-ovr`, `.pc-pos`, `.pc-badge`, `.pc-name` (degradê `var(--card-name)`), `.player-card .pc-face` (absoluta, ocupa o card).
- `.card-bronze/.card-silver/.card-gold/.card-rare` definem `--card-bg` e `--card-name`.

## Regras que o redesign deve preservar
- Cards FIFA por nível (bronze < 65, prata 65–74, ouro 75–82, ouro brilhante ≥ 83).
- Escudo do clube atual no card; atalho direto para negociar.
- Silhueta neutra sem sigla/fundo escuro.
- Estado vazio orientando a ir ao Mercado.

## Problemas atuais e oportunidades
- Valor de mercado/salário/contrato/status da negociação não aparecem no card (prop `note` ignorada).
- Sem ação rápida de "remover da lista" (ex.: □/X no card — hoje □ avança o dia).
- Sem indicação de que já existe conversa aberta com o atleta.
- Poderia ter ordenação (OVR, valor, posição) e filtros rápidos.

---

# D. Subvista Negociações (conversas e propostas recebidas)

## Resumo
"Mensageiro" de negociações: à esquerda, lista de **todas** as conversas (compras e vendas, ativas e encerradas); à direita, o **painel de chat** da conversa selecionada com histórico em balões e ações no rodapé. Cobre:
- **Compra** (`incoming: false`): sua proposta → clube responde (aceita / contraproposta / recusa / encerra) → etapa contrato com o **agente** → concluída.
- **Venda** (`incoming: true`): clube nacional **ou do exterior** faz proposta por atleta seu → você **aceita**, **pede mais** (contraproposta com valor) ou **recusa**.

Ao clicar numa conversa o painel entra em **modo "dentro da conversa"** (focus trap com contorno amarelo) até apertar B.

## Wireframe atual (ASCII)
```
┌─ CONVERSAS ─────────────────────────┐ ┌──────────────────────────────────────────────────────────────────────────┐
│┃[⛨][👤] Pedro Silva     [RESPONDER] │ │[⛨ grande][👤] PEDRO SILVA              ‹ Sair da conversa   (①Clube › 2 Contrato)│
│┃       VENDA · Benfica              │ │           ST · OVR 78 · Benfica                                            │
│┃       Olá! Benfica quer contratar… │ ├──────────────────────────────────────────────────────────────────────────┤
│ [⛨][👤] Lucas Mota  [CONTRAPROPOSTA]│ │                         ( 04 de nov. de 2026 )                           │
│        COMPRA · Palmeiras           │ │ ┌───────────────────────────────┐                                        │
│        Estamos perto. Com este…     │ │ │[⛨] Benfica           PROPOSTA │                                        │
│ [⛨][👤] Rafa Dias      [AGUARDANDO] │ │ │Olá! Benfica quer contratar…   │                                        │
│ [⛨][👤] João Reis      [CONCLUÍDA]  │ │ │[TAXA R$ 38 mi]                │                                        │
│ [⛨][👤] Davi Luz       [RECUSADA]   │ │ └───────────────────────────────┘                                        │
│ [⛨][👤] Caio Bento     [ENCERRADA]  │ │                                   ┌──────────────────────────────────┐ │
│   (rolagem)                         │ │                                   │[⛨] Meu Clube      CONTRAPROPOSTA │ │
│                                     │ │                                   │Por Pedro Silva, só negociamos…   │ │
│                                     │ │                                   │[TAXA R$ 45 mi]                   │ │
│                                     │ │                                   └──────────────────────────────────┘ │
│                                     │ │          [ Negociação reaberta. ]  (mensagem de sistema, amarela)        │
│                                     │ │ ┌──────────┐                                                             │
│                                     │ │ │Palmeiras │ • • •   (digitando, quando aguardando resposta)             │
│                                     │ │ └──────────┘                                                             │
│                                     │ ├──────────────────────────────────────────────────────────────────────────┤
│                                     │ │[✓ Aceitar R$ 38 mi]  PEDIR [-][45000000][+] R$ 45 mi [🤝 Contraproposta] [✕ Recusar]│
└─────────────────────────────────────┘ └──────────────────────────────────────────────────────────────────────────┘
Vazio (sem nenhuma oferta):
┌──────────────────────────────────────────────┐
│                 ⇄ (35px)                      │
│      O MERCADO AINDA ESTÁ EM SILÊNCIO.        │
│ Faça uma proposta ou avance os dias durante a janela. │
└──────────────────────────────────────────────┘
```

## Elementos

### Lista de conversas (`aside.panel.thread-list`)
- `h2` `Conversas`.
- `div.thread-scroll` com um `button.thread-item` por oferta. **Ordenação**: primeiro as que exigem ação (recebida pendente ou contraproposta na compra), depois pela data da última mensagem (mais recente primeiro), depois a mais nova criada.
- Cada item (grid de 4 colunas):
  1. `Badge` pequeno do **outro clube** (comprador na venda, vendedor na compra). Clubes do exterior sem logo mostram sigla sobre a cor do clube + `• • •`.
  2. `PlayerFace size="sm"` (30px redondo; silhueta se sem foto).
  3. Texto: `strong` nome do atleta; `small` `VENDA · {clube}` ou `COMPRA · {clube}`; `em` texto da última mensagem (1 linha com reticências).
  4. Pílula `thread-status s-{status}` com `statusLabel`:

| Status interno | Compra (sua proposta) | Venda (recebida) | Cor |
|---|---|---|---|
| `pending` | `Aguardando` | `Responder` | ciano translúcido (venda pendente fica **lima** por "atenção") |
| `countered` | `Contraproposta` | — | lima |
| `rejected` | `Recusada` | `Recusada` | vermelho 60% |
| `accepted` / `completed` | `Concluída` | `Concluída` | verde |
| `declined` | `Encerrada` | `Encerrada` | branco 12% (padrão) |

- Item selecionado: `.active` (degradê rosa + borda esquerda rosa 4px). Precisa de ação: `.attention` (borda esquerda **lima** e pílula lima).
- O primeiro item tem `data-autofocus`. Sem seleção explícita, a conversa exibida é a primeira da lista.

### Painel de chat (`section.panel.chat-panel`, componente `ChatPanel`)
**Cabeçalho** (`header.chat-head`, degradê azul→roxo):
- `Badge` (tamanho normal) do outro clube.
- `PlayerFace size="sm"`.
- `strong` nome (22px) + `small` `{POS} · OVR {ovr} · {clube}`.
- Botão `‹ Sair da conversa` (`ChevronLeft` 15px, `text-button chat-exit`, `data-trap-exit`) — **só no modo dentro**.
- Indicador de etapas (só em **compras**): `[1 Clube] › [2 Contrato]`. Na etapa do clube: "1 Clube" ciano (ativo). Após acordo entre clubes (`stage === 'player'`): "✓ Clube" verde (`Check` 13px) e "2 Contrato" ciano.

**Histórico** (`div.chat-scroll`, rola automaticamente para o fim quando chega mensagem):
- **Separador de data** (`chat-date`): pílula centralizada com `dateLabel` sempre que a data muda.
- **Mensagem de sistema** (`chat-system`): centralizada, fundo amarelo 16%, texto amarelo. Textos possíveis: `Negociação reaberta.`, `Transferência concluída. {Nome} é o novo reforço do clube!`, `Venda concluída. {Nome} deixou o clube.`, `A transferência não pôde ser concluída: {motivo}`, `A janela de transferências fechou. Negociação encerrada.`, `O prazo da proposta expirou sem resposta.` (venda não respondida no prazo), `O atleta foi dispensado. Negociação encerrada.`
- **Balão** (`bubble from-me|from-them kind-{kind}`):
  - Seus (`from-me`): à direita, degradê azul→ciano, canto superior direito reto.
  - Do outro lado/agente (`from-them`): à esquerda, branco 13%, canto superior esquerdo reto.
  - Autor: escudo pequeno (seu clube ou o outro) ou avatar circular `AG` (degradê roxo→rosa) para o agente; nome = nome do clube ou `Agente de {Nome}`.
  - Tag à direita (`bubble-tag`): `PROPOSTA` (escura), `CONTRAPROPOSTA` (laranja), `ACEITA` (verde), `RECUSADA` (vermelha); `info` sem tag.
  - Texto `p` (frases do motor, ex.: "Gostamos do interesse, mas…", "Esta é a nossa última proposta por X.", "Com todo respeito, isso está muito abaixo…", "Chega. Não vamos mais negociar X nesta janela.", "Temos acordo! X assina por 3 anos.").
  - **Números** (`Figures`, caixas escuras com rótulo pequeno + valor 16px): `Taxa` (money), `Troca` (nome do atleta), `Salário/mês` (money), `Contrato` (`N ano(s)`), `Luvas` (money). Só os presentes.
- **"Digitando…"**: balão do outro lado com três bolinhas animadas (`typing-dots`), autor = clube vendedor ou `Agente de {Nome}` conforme a etapa — exibido em **compras com status `pending`** (resposta chega no dia seguinte).

**Rodapé de ações** (`footer.chat-actions`) — varia por caso:

| Caso | Conteúdo |
|---|---|
| Compra · `countered` (clube ou agente fez contraproposta) | `[✓ Aceitar]` (primário; desabilitado com janela fechada) · `[🤝 Contraproposta]` (desabilitado com janela fechada; abre a Sala de negociação já preenchida) · `[✕ Recusar]` (vermelho; encerra a conversa) |
| Compra · `declined` e travada (`lockedUntil` > hoje) | Texto ciano `Conversas encerradas até {data}.` |
| Compra · `declined` sem trava | `[🤝 Reabrir negociação]` (desabilitado se janela fechada ou o atleta já mudou de clube) → abre a Sala |
| Compra · `pending` | (vazio — só o "digitando…") |
| Compra · `rejected` (recusa simples, ainda negociável) | (vazio — para reenviar é preciso abrir o atleta pelo Mercado/Observados) |
| Venda · `pending` | `[✓ Aceitar {money(fee)}]` (primário) · bloco `Pedir` com `NumberStepper` (valor inicial = oferta × 1,2 arredondado a 50 mil; mínimo = oferta + R$ 50 mil; passo R$ 250 mil; mostra money) + `[🤝 Contraproposta]` · `[✕ Recusar]` (vermelho) |
| Venda · `declined` | Texto `Conversa encerrada.` |
| Qualquer · `accepted`/`completed` | Texto verde `✓ Negócio concluído.` |

Ícones lucide: `Check` 16, `Handshake` 16, `X` 16.

### Estado vazio (nenhuma oferta na carreira)
`section.panel.empty-state`: `ArrowLeftRight` 35px, `h2` `O mercado ainda está em silêncio.`, `p` `Faça uma proposta ou avance os dias durante a janela.`

## Estados e variações
- **Modo fora × dentro**: fora, o painel é só leitura e a lista recebe o foco; dentro (`.inside`), contorno amarelo 3px + brilho, o foco fica preso no painel (`data-focus-trap`), aparece "Sair da conversa" e o foco vai para o primeiro botão/campo de ação (ou para "Sair").
- **Janela fechada**: Aceitar/Contraproposta (compra) e Reabrir ficam desabilitados; Recusar continua ativo. Na venda os botões não são desabilitados, mas aceitar fora da janela gera erro "Transferência fora da janela." (toast). Ao fechar a janela, todas as conversas pendentes/contrapropostas viram `Encerrada` com mensagem de sistema.
- **Negociação recusada com trava**: após paciência esgotada, o clube/agente encerra por **30 dias** (`Conversas encerradas até …`).
- **Propostas do exterior**: chegam com mais chance para atletas OVR ≥ 70 (25% da chance; 45% a partir de julho), pagam 1,2–1,8× o valor de mercado; badge com sigla do país/clube. **Recusar** uma proposta do exterior por atleta "Ambicioso" ou de ≥ R$ 30 mi derruba moral (−15) e relação (−12), coloca o atleta à venda e gera mensagem "Quero jogar na Europa" — **nada disso é avisado na tela antes do clique**.
- **Atletas à venda** (lista de venda definida na aba TIME) recebem propostas frequentes (30%/dia), entre 60% e 95% do preço pedido.
- **Pedir mais (venda)**: clube aceita (venda concluída), devolve contraproposta melhor (status continua `pending`, nova resposta) ou desiste ("Muito acima do que podemos pagar…").
- **Sem orçamento** na compra: Aceitar contraproposta gera toast "Proposta acima do orçamento disponível."
- Venda que deixaria o elenco com <18 atletas, <2 goleiros ou sem 11 disponíveis: toast de erro.
- Contraproposta "final": textos "Esta é a nossa última proposta…" / "Esta é a última posição do meu cliente. Pegar ou largar." (sem indicador visual de paciência).
- **Possível bug**: ofertas criadas por "Acionar multa" são salvas com `messages: []`; `threadOf` devolve lista vazia e a lista de conversas acessa `thread[thread.length - 1]` (ordenar/mostrar última mensagem) — pode quebrar a subvista após pagar uma multa. Verificar na reimplementação.

## Interações
- **Mouse**: clique num item → seleciona e entra no modo dentro; botões do rodapé; `−`/`+`/digitar no stepper "Pedir"; "Sair da conversa".
- **Controle**:
  - Foco inicial no primeiro item da lista; **↑/↓** percorrem as conversas; **A** entra na conversa (foco preso no painel).
  - Dentro: **←/→** entre Aceitar / Pedir / Contraproposta / Recusar; no "Pedir": **A** abre teclado numérico, **□** entra no modo ajuste (←/→ ±R$ 250 mil), **□/B** saem do ajuste.
  - **B** (fora de modo edição) → "Sair da conversa" (volta o foco ao item da lista). B na lista → pausa.
  - Analógico direito rola o histórico.
  - **Contraproposta / Reabrir** abre o modal Sala de negociação (E).
  - LT/RT troca de subvista (sai do modo dentro).
  - Após aceitar/recusar, o rodapé muda e o foco é recolocado no primeiro botão disponível ou em "Sair".

## Classes CSS e visual atual
- `.negotiations-layout` grid `minmax(250px,320px) | 1fr`, gap 16px.
- `.thread-list` (`.panel` borda superior **rosa**), `.thread-scroll`, `.thread-item` (grid `auto auto 1fr auto`, fundo branco 7%, borda esquerda 4px), `.thread-item.active` (degradê rosa), `.thread-item.attention` (borda lima), `.thread-text strong` (800 16px), `small` (700 11px tracking 1px), `em` (12px), `.thread-status` + `.s-pending/.s-countered/.s-completed/.s-accepted/.s-rejected`.
- `.chat-panel` (`.panel` sem padding, borda superior rosa), `.chat-panel.inside` (outline amarelo + glow), `.chat-head` (degradê `rgba(10,141,255,.35)→rgba(139,69,255,.25)`), `.chat-stages span(.active ciano/.done verde)`, `.chat-exit`.
- `.chat-scroll` (fundo azul-escuro com brilho radial), `.chat-date span`, `.chat-system` (amarelo), `.bubble` (raio 14px, máx. 72%/560px), `.bubble.from-me/.from-them`, `.bubble-author`, `.agent-avatar` (34px; 22px no balão), `.bubble-tag` + `.kind-counter/.kind-accept/.kind-reject`, `.bubble-figures`, `.typing-dots` (`@keyframes typing`).
- `.chat-actions` (fundo `rgba(3,12,50,.7)`, borda superior), `.chat-ask` (stepper min 220px), `.chat-wait` (ciano) / `.chat-wait.done` (verde), `button.primary`, `button.danger` (vermelho 75%).

## Regras que o redesign deve preservar
- Uma conversa por alvo de compra; histórico completo com datas, autores (clube/agente/você/sistema), tipo da mensagem e números.
- Duas etapas na compra (clube → contrato com agente) com indicador.
- Ordenação "precisa de ação" primeiro e destaque visual dessas conversas.
- Ações por estado exatamente como na tabela; botões dependentes da janela desabilitados quando fechada.
- Venda: aceitar o valor, pedir um valor maior (mínimo oferta + 50 mil) ou recusar.
- Trava de 30 dias exibida com data.
- Modo "entrar na conversa" com saída por B (sem X), foco preso e retorno ao item da lista.
- Resposta da IA só no dia seguinte (indicador "digitando").

## Problemas atuais e oportunidades
- Separar visualmente **Compras** × **Vendas** × **Encerradas** (filtros/abas) — hoje tudo misturado.
- Status `rejected` em compra não oferece ação (usuário não sabe que pode reabrir pelo Mercado).
- Sem indicador de paciência/rodadas restantes, nem de prazo de resposta (vendas expiram em 7 dias).
- Consequências de recusar proposta do exterior não são avisadas; poderia haver selo "EXTERIOR"/bandeira e alerta de moral.
- Foto 30px na lista e no cabeçalho é pequena; o cabeçalho poderia usar o card FIFA do atleta.
- "Pedir" exige valor bruto em reais no teclado numérico; chips rápidos (+10%, +25%, valor de mercado) ajudariam no controle.
- Histórico de transferências concluídas inexistente fora deste chat.

---

# E. Modal "Sala de negociação"

## Resumo
Modal largo (até 980 px) aberto ao clicar em um atleta (Mercado/Observados) ou em "Contraproposta"/"Reabrir negociação" no chat. Três colunas: **alvo** (card FIFA + fatos + atalhos), **mesa de negociação** (etapas 1 e 2) e **resumo financeiro** com envio. Valores iniciais: taxa = última proposta da conversa ou valor de mercado; salário = salário atual × 1,15 (arredondado a mil); contrato 3 anos; luvas 0; troca vazia. Se a conversa já está na etapa do contrato, abre direto na etapa 2.

## Wireframe atual (ASCII)
```
┌─ SALA DE NEGOCIAÇÃO ──────────────────────────────────────────────────────────────── ‹ Voltar ┐
│┌─ ALVO ──────────────┐┌─ MESA ─────────────────────────────────────────┐┌─ RESUMO FINANCEIRO ─┐│
││┌───────────────────┐││ [① Acordo com o clube] › [② Contrato do jogador]││ Orçamento  R$ 25 mi ││
│││78                 │││ ┌────────────────────────────────────────────┐ ││ Caixa      R$ 40 mi ││
│││ST       [escudo]  │││ │[⛨] "Por menos de R$ 52 mi não liberamos X."│ ││ Taxa       R$ 45 mi ││
│││    (foto 150px)   │││ └────────────────────────────────────────────┘ ││ Luvas      R$ 0     ││
│││   PEDRO SILVA     │││ TAXA DE TRANSFERÊNCIA                          ││ Salários(3a)R$ 15 mi││
│││ 27 anos · Brasil  │││ [-][     45000000     ][+]                      ││ CUSTO TOTAL R$ 60 mi││ (lima)
││└───────────────────┘││ R$ 45 mi                                       ││ Saldo p/ contratar  ││
││ Clube     Flamengo  ││ (Valor de mercado)(−10%)(+10%)(Orçamento total) ││          -R$ 20 mi  ││ (vermelho)
││ Valor     R$ 45 mi  ││ JOGADOR NA TROCA                               ││ CLUBE  Provável     ││
││ Salário   R$ 420 mil││ [⇄ Incluir atleta do elenco]  [👤✕ Remover]     ││ ▮▮▮▮▮▮▯▯▯▯          ││
││ Contrato  31 de dez.││ CLUBE                         Possível         ││ JOGADOR Improvável  ││
││ Scouting  OVR 78 ·… ││ ▮▮▮▮▯▯▯▯▯▯                                     ││ ▮▮▯▯▯▯▯▯▯▯          ││
││ [☆ Observar]        ││                 [Próximo: contrato do jogador ›]││ [➤ Enviar proposta] ││
││ [Assinar pré-contrato · R$ 440 mil/mês]   ││                          ││ Resposta amanhã.    ││
││ [Acionar multa · R$ 80 mi]               ││                          ││ B fecha a sala.     ││
││                                         ││ [Compra | Empréstimo]    │└─────────────────────┘│
│└─────────────────────┘└────────────────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Elementos (moldura do modal)
- Fundo escurecido com blur (`modal-backdrop`), caixa `dialog wide` (degradê azul `#0d3bb0→#071a66→#050f3f`, borda superior lima 4px).
- Cabeçalho: `h2` `Sala de negociação` (itálico 800 28px caixa alta) + botão `‹ Voltar` (`ChevronLeft` 16, `text-button`, `data-dialog-close`).
- Foco inicial: primeiro botão do corpo (o botão "Observar"), ou o elemento com `data-autofocus` (no seletor de troca, o card "Sem troca"). Ao fechar, o foco volta ao elemento anterior (linha/card/botão do chat).

## Estados e variações (gerais)
- **Janela fechada**: botão de envio desabilitado com texto `Janela fechada`; o atalho "Acionar multa" some; "Assinar pré-contrato" continua (não depende da janela).
- **Transfer ban / desafios / proposta já pendente / conversa travada / sem orçamento / elenco do vendedor curto**: o envio é permitido na UI e o motor responde com toast de erro (ex.: `Transfer ban da FIFA até 15/01/2027: o clube não pode contratar.`, `Esta proposta já está com o outro lado. Aguarde a resposta.`, `Palmeiras encerrou as conversas por X até 04/12.`, `Proposta acima do orçamento disponível.`, `Venda R$ 10 milhões em atletas antes de contratar.`, `Este desafio permite contratar apenas jogadores de até 23 anos.`, `A transferência deixaria o clube com menos de 18 atletas ou dois goleiros.`). O modal **não fecha** em caso de erro.
- Responsivo ≤1100px: 2 colunas (alvo | mesa) e o resumo ocupa a linha inteira embaixo.

## Interações (gerais)
- **B / Esc** (fora de modo edição) ou "Voltar" fecham o modal sem enviar.
- **Tab / Shift+Tab** circulam o foco dentro do modal; D-pad navega espacialmente apenas dentro dele.
- LT/RT não fazem nada dentro do modal.
- ⚠ **LB/RB continuam trocando a aba principal** com o modal aberto (o modal é local da tela, não um popup do App) e **□/X fora de um campo avança o dia** — ambos fecham/alteram a negociação sem aviso.

---

## E1. Coluna do alvo (`aside.deal-target`)

### Resumo
Identidade do atleta no estilo card FIFA (**o card que o usuário adorou — preservar**), fatos de contrato/valor e atalhos de contratação alternativa.

### Wireframe atual (ASCII)
```
┌───────────────────────┐
│78                     │  ← OVR 38px
│ST      [  escudo  ]   │  ← posição 15px | escudo 64×74
│      ╭─────────╮      │
│      │  foto   │      │  ← 150×150, sem fundo, sombra, fade embaixo
│      ╰─────────╯      │
│     PEDRO SILVA       │  ← itálico 800 20px caixa alta
│   27 anos · Brasil    │
└───────────────────────┘
 Clube ............ Flamengo
 Valor de mercado . R$ 45 mi
 Salário atual .... R$ 420 mil
 Contrato até ..... 31 de dez. de 2027
 Scouting ......... OVR 78 · potencial 80–86
 [☆ Observar]
 [Assinar pré-contrato · R$ 441 mil/mês] [Acionar multa · R$ 80 mi]
```

### Elementos
- **Card** (`div.deal-card pos-{POS} card-{nível}`): fundo do nível (bronze/prata/ouro/rare + reflexo diagonal branco 25%; rare com brilho animado e contorno dourado), texto branco com sombra.
  - `span.deal-ovr` OVR (absoluto, topo-esquerda, 38px).
  - `span.deal-pos` posição (abaixo do OVR, 15px).
  - `Badge` do clube atual (64×74 px, centralizado).
  - `PlayerFace size="lg"` com `.deal-face` (150×150, sem raio, sem fundo, `drop-shadow`, máscara que some nos 25% inferiores); sem foto → silhueta neutra.
  - `strong` nome completo (itálico 800 20px caixa alta).
  - `small` `{idade} anos · {nacionalidade}`.
- **Fatos** (`dl.deal-facts`, linhas rótulo ↔ valor, separador fino): `Clube`, `Valor de mercado` (money), `Salário atual` (money), `Contrato até` (dateLabel), `Scouting` (scoutReport).
- **Botão observar**: `Star` 16 + `Observar` / `Observado` (ativo: fundo amarelo, texto marrom). Alterna a shortlist imediatamente, sem toast.
- **Atalhos** (`div.button-row`, quebram linha), cada um executa e **fecha o modal**:
  - `Assinar pré-contrato · {money(salário pedido)}/mês` — só se o contrato termina nos **próximos 6 meses** (e ainda não terminou). Salário pedido = salário atual × 1,05 (×1,15 no Profissional). Sem custo de transferência; o atleta chega ao fim do vínculo.
  - `Acionar multa · {money(cláusula)}` — só com **janela aberta**, atleta com cláusula definida e que **não** está emprestado. Paga a multa, contrata na hora (salário pedido, 3 anos).
  - O seletor **Empréstimo** abre uma proposta com duração, taxa, parcela salarial e cláusula opcional; o atleta só muda de clube depois da negociação.

### Estados e variações
- Atleta emprestado (`loanFrom`): sem multa e sem empréstimo.
- Sem cláusula: sem botão de multa.
- Erros (ex.: "Já existe um pré-contrato para este jogador.", "Proposta acima do orçamento disponível.", "Este jogador não tem multa rescisória disponível.") viram toast — mas o modal **já foi fechado** antes.
- Nível do card muda a paleta: bronze < 65, prata 65–74, ouro 75–82, ouro brilhante ≥ 83.

### Interações
- Mouse: clique nos botões.
- Controle: D-pad até o botão + **A**. O foco abre em "Observar".

### Classes CSS e visual atual
`.deal-room` (grid `minmax(200px,.8fr) | 1.6fr | minmax(220px,.9fr)`, gap 16, altura mín. `min(560px,70vh)`), `.deal-target` (coluna gap 10), `.deal-card` (raio 8, padding 14/10/12, sombra `0 12px 30px`), `.deal-card.card-*` (fundo `var(--card-bg)` + reflexo), `.deal-ovr`, `.deal-pos`, `.deal-card .club-badge` (64×74), `.deal-face`, `.deal-card strong/small`, `.deal-facts` (linhas 14px, `dt` `--ink-3`, `dd` 700 à direita), `.deal-target > button.active` (amarelo), `.button-row`.

### Regras que o redesign deve preservar
- **O card do detalhe exatamente nesse espírito** (OVR + posição no canto, escudo, foto grande sem fundo com fade, nome itálico caixa alta, idade/nacionalidade, cores por nível).
- Condições de exibição de pré-contrato (últimos 6 meses), multa (janela + cláusula + não emprestado) e empréstimo (janela + não emprestado), com valores nos rótulos.
- Alternância Observar/Observado.

### Problemas atuais e oportunidades
- Acionar a multa ainda é imediato; um pedido de empréstimo passa por negociação.
- Modal fecha antes de saber se deu erro.
- Faltam atributos (PAC/SHO/PAS/DRI/DEF/PHY) e potencial no card, como no FIFA.
- O pedido de empréstimo mostra duração, divisão salarial, custo e eventual opção ou obrigação de compra.

---

## E2. Etapa 1 — "Acordo com o clube"

### Resumo
Define a taxa de transferência e, opcionalmente, um atleta do elenco como troca; mostra a fala do clube vendedor e a chance de aceite.

### Wireframe atual (ASCII)
```
[① ACORDO COM O CLUBE] › [② CONTRATO DO JOGADOR]
┌──────────────────────────────────────────────────────────┐
│[⛨] "Por menos de R$ 52 mi (somando a troca) não liberamos Pedro Silva." │ (itálico)
└──────────────────────────────────────────────────────────┘
TAXA DE TRANSFERÊNCIA
[-][        45000000        ][+]
R$ 45 mi
(Valor de mercado) (−10%) (+10%) (Orçamento total)
JOGADOR NA TROCA
[⇄ Lucas Mota · R$ 8 mi]  [👤✕ Remover]
CLUBE                                   POSSÍVEL
▮▮▮▮▯▯▯▯▯▯
                               [Próximo: contrato do jogador ›]
```

### Elementos
- **Abas de etapa** (`div.deal-steps role="tablist"`): `[1] Acordo com o clube` › (`ChevronRight` 18) › `[2] Contrato do jogador`. Ativa: degradê ciano→azul, número em círculo branco.
- **Fala do clube** (`div.call-bubble`, itálico, canto superior-esquerdo reto) com escudo pequeno do vendedor. Texto:
  - Se houve contraproposta do clube: `"Nosso pedido continua: {money(pedido)}. Melhore e conversamos."`
  - Dificuldade Profissional: `"{Nome} é peça importante aqui. Traga um número sério."` (sem revelar o mínimo)
  - Demais: `"Por menos de {money(mínimo estimado)}[ (somando a troca)] não liberamos {Nome}."`
- **Taxa de transferência** (`NumberStepper`, min 0, **máx = orçamento de transferências**, passo proporcional `niceStep`, money embaixo).
- **Chips rápidos** (`div.quick-chips`): `Valor de mercado`, `−10%`, `+10%`, `Orçamento total` — cada um define a taxa (arredondada a R$ 10 mil e limitada ao orçamento).
- **Jogador na troca** (`div.exchange-slot`): rótulo `JOGADOR NA TROCA`; botão `ArrowLeftRight` 16 + `Incluir atleta do elenco` ou `{Nome} · {money(valor)}` → abre E3; se houver troca, `text-button` `UserRoundX` 15 + `Remover`. A troca vale 80% do valor de mercado na avaliação do clube.
- **Medidor** `LikelihoodMeter "Clube"`: rótulo + texto `Muito provável` (≥85) / `Provável` (≥60) / `Possível` (≥35) / `Improvável` (≥15) / `Muito improvável`; barra de 10 segmentos; cor verde-lima (≥60), amarelo (≥35), vermelho (<35). Recalcula a cada mudança.
- **Botão** primário `Próximo: contrato do jogador` + `ChevronRight` 17 (alinhado à direita, no fim).

### Estados e variações
- Primeira proposta × conversa existente (taxa preenchida com a última proposta).
- Orçamento menor que o valor padrão: o campo pode iniciar acima do máximo; "Saldo p/ contratar" fica vermelho.
- Profissional: o mínimo do clube tem ruído de ±7% e não é dito na fala.

### Interações
- Mouse: −/+/digitação, chips, botões.
- Controle: D-pad entre controles; taxa → **A** teclado numérico / **□** modo ajuste (←/→); chips + **A**; "Incluir atleta" + **A** abre o seletor; abas de etapa com **A**.

### Classes CSS e visual atual
`.deal-table` (painel com textura de linhas ciano e borda ciano 35%, raio 6), `.deal-steps`/`> button(.active)`/`span`, `.deal-step` (coluna gap 12; `> .primary` à direita no fim), `.call-bubble`, `.quick-chips > button` (5×10, 13px), `.exchange-slot`, `.likelihood`, `.likelihood-bar i(.on)`, `.likelihood.good/.mid/.bad`.

### Regras que o redesign deve preservar
- Fala do clube com o mínimo (ou vaga no Profissional); taxa limitada ao orçamento; atalhos de valor; troca opcional; medidor de 5 níveis.

### Problemas atuais e oportunidades
- Digitar valores grandes (milhões) no teclado numérico é lento; os chips poderiam ser mais (±R$ 1 mi, +25%) e mapeados a gatilhos.
- Medidor duplicado (aqui e no resumo).

---

## E3. Seletor "Jogador na troca"

### Resumo
Substitui o conteúdo da etapa 1 por uma grade de cards do **próprio elenco** para escolher quem entra na troca.

### Wireframe atual (ASCII)
```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  👤✕ │ │72  ⛨ │ │68    │ │81 ✦  │   (4 colunas, rolagem)
│ SEM  │ │GK    │ │CB    │ │ST    │
│ TROCA│ │ foto │ │ foto │ │ foto │
└──────┘ │NOME  │ │NOME  │ │NOME  │
         └──────┘ └──────┘ └──────┘
```

### Elementos
- Primeiro "card" `player-card empty` (tracejado, fundo branco 8%): `UserRoundX` 28 + `Sem troca` (`data-autofocus`).
- `PlayerCard` de todos do elenco, ordenados por posição (GK, CB, LB, RB, DM, CM, AM, LW, RW, ST) e OVR; o selecionado tem borda lima (`.active`). A prop `note` (valor de mercado) **não é exibida**. Lesionados/suspensos aparecem acinzentados com status, mas podem ser escolhidos.

### Estados e variações
- Ao escolher, volta à etapa 1 com o nome e valor no botão. Atletas emprestados ao clube podem ser escolhidos, mas o motor recusa ("Um atleta emprestado não pode ser transferido novamente.").

### Interações
- Mouse: clique. Controle: foco inicia em "Sem troca"; D-pad + **A**. Não há botão de cancelar próprio: clicar na aba "1 Acordo com o clube" ou "2 Contrato" fecha o seletor; **B fecha o modal inteiro**.

### Classes CSS e visual atual
`.exchange-picker .card-grid { repeat(4, 1fr) }`, `.card-scroll`, `.player-card.empty`, `.player-card.active`.

### Regras que o redesign deve preservar
- Opção "Sem troca"; cards por nível; marcação do escolhido; ordenação por posição.

### Problemas atuais e oportunidades
- Mostrar o valor de troca (80% do valor) em cada card.
- B deveria voltar só para a etapa 1, não fechar a sala.

---

## E4. Etapa 1 já acordada

### Resumo
Quando o clube já aceitou a taxa e a conversa está na etapa do agente (com contraproposta ou recusa do agente), a etapa 1 vira apenas confirmação.

### Wireframe atual (ASCII)
```
┌──────────────────────────────────────────────────────────────┐
│[⛨] "Acordo fechado em R$ 48 mi. Agora é com o agente de X." │
└──────────────────────────────────────────────────────────────┘
                                         [Contrato do jogador ›]
```

### Elementos
- `call-bubble` com escudo: `"Acordo fechado em {money(taxa)}. Agora é com o agente de {Nome}."`
- Botão primário `Contrato do jogador` + `ChevronRight` 17.

### Estados e variações / Interações
- A taxa e a troca ficam congeladas (o motor reaproveita as acordadas). A sala abre direto na etapa 2 nesse caso. A + botão vai para etapa 2.

### Classes CSS e visual atual
Mesmas de E2.

### Regras que o redesign deve preservar
- Não permitir renegociar a taxa depois do acordo entre clubes.

### Problemas atuais e oportunidades
- O resumo financeiro continua mostrando a taxa do estado local; deveria indicar "acordado".

---

## E5. Etapa 2 — "Contrato do jogador"

### Resumo
Termos com o agente: salário mensal, duração e luvas.

### Wireframe atual (ASCII)
```
┌──────────────────────────────────────────────────────────────────┐
│(AG) "Para sair, ele quer pelo menos R$ 441 mil por mês — luvas ajudam."│ (roxo)
└──────────────────────────────────────────────────────────────────┘
SALÁRIO MENSAL
[-][     483000     ][+]
R$ 483 mil
DURAÇÃO DO CONTRATO
(1 ano)(2 anos)(3 anos)(4 anos)(5 anos)
LUVAS (BÔNUS DE ASSINATURA)
[-][        0        ][+]
R$ 0
JOGADOR                                  PROVÁVEL
▮▮▮▮▮▮▮▯▯▯
```

### Elementos
- `call-bubble agent` (fundo roxo 25%) com avatar `AG`. Texto:
  - Após contraproposta do agente: `"Fechamos com {money(salário)} por mês. Luvas também contam."`
  - Profissional: `"Meu cliente quer ser valorizado. Salário e luvas contam."`
  - Demais: `"Para sair, ele quer pelo menos {money(salário pedido)} por mês — luvas ajudam."`
- `NumberStepper` `Salário mensal` (mín. R$ 1.000, passo proporcional, money).
- `ChipGroup` `Duração do contrato`: `1 ano`, `2 anos`, `3 anos`, `4 anos`, `5 anos`.
- `NumberStepper` `Luvas (bônus de assinatura)` (0 até caixa − taxa).
- `LikelihoodMeter "Jogador"` — considera o salário efetivo (salário + luvas diluídas pelos meses do contrato) vs. o pedido.

### Estados e variações
- Sem botão "Próximo"; o envio é pelo resumo. Agente recusa abaixo de 65% do pedido; após paciência esgotada encerra por 30 dias.

### Interações
- Idênticas aos steppers/chips descritos; abas de etapa trocam entre 1 e 2.

### Classes CSS e visual atual
`.call-bubble.agent`, `.agent-avatar` (34px, degradê roxo→rosa), `.chip-group`, `.number-stepper`.

### Regras que o redesign deve preservar
- Três termos (salário, 1–5 anos, luvas) e a lógica de luvas diluídas mostrada no medidor; fala do agente.

### Problemas atuais e oportunidades
- Mostrar "salário pedido" e "salário efetivo" explicitamente; impacto na folha salarial do clube.

---

## E6. Resumo financeiro (`aside.deal-summary`)

### Resumo
Coluna de conferência e envio.

### Elementos
- `p.eyebrow` `RESUMO FINANCEIRO`.
- `dl` com linhas: `Orçamento` (orçamento de transferências), `Caixa`, `Taxa`, `Luvas`, `Salários ({anos}a)` = salário × 12 × anos, **`Custo total`** = taxa + luvas + salários (linha com borda lima 2px e valor lima, 16px), `Saldo p/ contratar` = orçamento − taxa (valor **vermelho** se negativo).
- Dois medidores: `Clube` e `Jogador`.
- Botão primário grande `Send` 17 + texto: `Enviar proposta` (sem conversa) / `Enviar contraproposta` (conversa existente, inclusive reabrir) / `Janela fechada` (desabilitado).
- `small.muted`: `Resposta amanhã. B fecha a sala.`

### Estados e variações
- Sucesso: fecha o modal, seleciona a conversa e muda para **Negociações** + toast verde "Proposta enviada. A resposta chega amanhã."
- Erro: toast vermelho; modal permanece.

### Interações
- Mouse: clique em Enviar. Controle: D-pad até o botão + **A**. B fecha.

### Classes CSS e visual atual
`.deal-summary` (coluna gap 10), `.deal-summary dl > div` (linhas 14px), `.total` (lima), `.negative dd` (vermelho), `.send-offer` (`margin-top:auto`, padding 12, 17px).

### Regras que o redesign deve preservar
- Todas as linhas do resumo e fórmulas; aviso de saldo negativo; texto do botão por estado; resposta no dia seguinte.

### Problemas atuais e oportunidades
- Resumo não reflete a troca (valor do atleta cedido) nem o impacto na folha mensal.
- Botão de envio fica longe da mesa; no FIFA o "Enviar" fica no rodapé com hint de botão (ex.: A Enviar / B Cancelar).

---

# F. Avisos (toasts) gerados por esta tela

## Resumo
Faixa fixa no topo central (`div.toast`), **some sozinha** (sucesso 2,6 s / erro 4 s), sem botão de fechar; erro também vibra o controle.

## Wireframe atual (ASCII)
```
                ┌──────────────────────────────────────────────┐
                │ Proposta enviada. A resposta chega amanhã.   │  (verde)
                └──────────────────────────────────────────────┘
```

## Elementos
- Sucesso (degradê verde `#8be22a→#34b51f`): "Proposta enviada. A resposta chega amanhã." · "Pedido de empréstimo enviado. A resposta chega amanhã." · "Pré-contrato assinado. O reforço chega ao fim do vínculo atual." · "Multa rescisória paga e transferência concluída."
- Erro (degradê vermelho `#ff5a6a→#d61b3a`): mensagens do motor listadas em E e D.
- Aceitar/recusar/pedir mais **não** geram toast (o resultado aparece no chat).

## Estados e variações / Interações
- Não interativo. Um novo aviso substitui o anterior.

## Classes CSS e visual atual
`.toast` (fixo, `top: 76px`, centralizado, máx. 640px, raio 3, sombra, animação `toast-in`), `.toast.success`, `.toast.error`.

## Regras que o redesign deve preservar
- Popups/avisos **fecham sozinhos, sem X**; erro distinto do sucesso.

## Problemas atuais e oportunidades
- Ações sem toast (aceitar venda, recusar) poderiam ter feedback curto ("Venda concluída: +R$ 38 mi").
- Validar antes de mostrar o botão (transfer ban, desafio, proposta pendente) evitaria toasts de erro.

---

# Regras de negócio exibidas/implícitas (resumo para o redesign)

| Regra | Valor |
|---|---|
| Janela de transferências | 05/jan–03/mar e 20/jul–11/set |
| Fora da janela | não envia proposta, não aceita contraproposta, sem multa/empréstimo; conversas abertas são encerradas no fechamento |
| Pré-contrato | só nos últimos 6 meses de contrato do atleta; não depende da janela |
| Resposta da IA | no dia seguinte para compras e pedidos de empréstimo; vendas expiram em 7 dias, contraproposta do comprador dá +5 dias |
| Paciência | Iniciante 5 / Normal 4 / Profissional 3 rodadas; proposta < 60% do mínimo gasta 2 |
| Trava | 30 dias após o clube/agente encerrar |
| Preço pedido (oculto) | 1,08 + 0,1/ano de contrato (máx. 4) + diferença de reputação − moral; limitado a 0,8–1,9× o valor |
| Troca | vale 80% do valor de mercado |
| Elenco mínimo | 18 atletas e 2 goleiros (vendedor); 11 disponíveis se sair titular |
| Transfer ban | `career.living.transferBan`: impede contratar até a data (só mensagem de erro) |
| Exterior | só propõe por atletas do usuário; paga 1,2–1,8× valor; recusar pode frustrar o atleta |

## Fase 3: mercado brasileiro

- **Empréstimo recebido:** a proposta fica pendente até o dia seguinte e aparece em Negociações. O clube dono pode recusar ou contrapor taxa, duração, salário e cláusula; após acordo, o atleta e seu empresário também decidem. O jogador só muda de clube após os dois aceites. A janela, a disponibilidade, o contrato e o transfer ban são conferidos novamente ao concluir.
- **Termos:** 3, 6 ou 12 meses na interface; divisão salarial, taxa, opção de compra ou obrigação sujeita a jogos. A folha mensal de cada clube considera sua parcela. Opções podem ser exercidas durante o empréstimo ou até dez dias após seu fim, em Contas.
- **Direitos econômicos:** o comprador escolhe 50% a 100% e pode oferecer até 30% de futura venda. Na revenda, o valor é distribuído proporcionalmente entre os titulares e a cláusula incide sobre a parte do clube vendedor após a solidariedade. O saldo dos direitos permanece com os titulares anteriores.
- **Solidariedade:** o modelo simplificado repassa 5% ao clube formador quando ele não é comprador nem vendedor. Para atletas do snapshot, o formador é uma estimativa simulada, não um dado histórico verificado; jovens gerados usam seu clube de origem.
- **Empresários:** nomes, influência e comissões de 5% a 10% são simulados de forma determinística. A comissão aparece no resumo e é paga pelo comprador. Há sugestões mensais de atletas.
- **Contas:** lista cláusulas a receber ou repassar, opções de compra e histórico dos repasses do clube. Os novos campos são opcionais ou têm valores padrão para saves antigos.
