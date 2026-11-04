# Tela: Temporada

## Resumo

Quinta aba principal do modo carreira (`TEMPORADA`, índice 4 em `tabs` do `App.tsx`). Reúne tudo que é "competição" e "histórico": tabela/chaves das competições, calendário mensal do clube, artilharia e outros rankings, sala de troféus, prêmios mensais/anuais e o legado do técnico (linha do tempo, hall da fama, maiores negócios).

A tela tem **7 sub-abas** num seletor segmentado (`.segmented`), trocadas com clique ou LT/RT (L2/R2):

| id | Rótulo | Ícone lucide |
|---|---|---|
| `table` | `Classificação` (se a competição escolhida é Série A/B) ou `Chaves e grupos` (copas) | `Trophy` |
| `calendar` | `Calendário` | `CalendarDays` |
| `stats` | `Estatísticas` | `Medal` |
| `trophies` | `Troféus` | `Trophy` |
| `awards` | `Prêmios` | `Award` |
| `legacy` | `Legado` | `Medal` |
| `national` | `Seleção` | `Flag` |

Sub-aba inicial ao entrar: `table`, exceto quando há jogo da Seleção pendente, quando abre `national`. O estado (`view`, `comp`, `month`, `day`) é local do componente e se perde ao sair da aba (o `<main>` é remontado com `key` por aba).

## Como se chega / como se sai

**Entrar**
- Clique em `TEMPORADA` na barra de navegação do cabeçalho (`.main-nav`), ou LB/RB (L1/R1) ciclando as 5 abas (`switchTab`, circular). Teclado: `[` e `]`.
- Na Central (`CareerCentral`): o tile "PRÓXIMO JOGO" chama `onMatch`; se **não** há pendência importante e **não** é dia de jogo, `App` faz `setTab(4)` → abre a Temporada. Se não existe próximo jogo (fim de temporada), o tile chama `onTab(4)` diretamente.
- LB/RB são bloqueados se houver partida ativa, popup, detalhe de jogador aberto ou `busy`.

**Sair**
- Outra aba no cabeçalho / LB / RB.
- B (○) / Esc sem modal aberto → abre o popup de **Pausa** (`setPopup('pause')`), não volta de aba.
- START/☰/Options → Pausa (fora da Central).
- Y (△) → vai para Escritório (tab 3).
- X (□) → avança o dia/até evento (`advance()`), mesmo estando nesta aba.

## Arquivos-fonte

- `src\screens\Season.tsx` — tela inteira (componentes `Season`, `StandingsTable`, `switcher`, constantes `cupRules`, `shortCompetition`, `weekDays`, `monthName`, `shiftMonth`).
- `src\components\TrophyArt.tsx` — troféus em SVG (formas `classic`, `globe`, `flag`, `ball`, `tall`; metais `gold`/`silver`).
- `src\components\LivingPanels.tsx` → `LegacyPanel` (sub-aba Legado).
- `src\components\NationalPanel.tsx`, `src\game\national.ts` e `src\game\international.ts` — convocação, amistosos e desfalques da Seleção.
- `src\components\PlayerFace.tsx` — foto/rosto do atleta (stats, prêmios).
- `src\components\ui.tsx` → `Badge`, `dateLabel`, `SectionTitle`, `money`.
- `src\game\competitions.ts` → `cupGroups(c, cup)`, `cupTies(c, cup)`, `tieWinner`.
- `src\game\calendar.ts` → `competitionName`, `fixtureCompetition`, `fixtureLabel`, `milestones`, `stateCupNames`.
- `src\game\engine.ts` → `standings(c, world, 'A'|'B')`.
- `src\game\npc.ts` → `clubById`.
- `src\controller\GamepadProvider.tsx` → `useGamepad` (`input`, `hints`), `useStickX`, `cycleView` (LT/RT).
- `src\App.tsx` → montagem `{tab === 4 && <Season career={career} world={live!} />}`.
- `src\styles.css` → classes listadas abaixo.

## Wireframe atual (ASCII)

Cabeçalho e rodapé do app são comuns a todas as abas (logo MANDO, nav com LB/RB, escudo + data + caixa; rodapé com dicas A Selecionar · B Voltar · X Avançar dia · RT Sub-menu · ☰ Pausa e status SALVO).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TEMPORADA / 2026                                                             │
│ CADA RODADA CONTA.                                                           │
│ [🏆 Classificação][📅 Calendário][🏅 Estatísticas][🏆 Troféus][🎖 Prêmios][🏅 Legado] │
├──────────────────────────────────────────────────────────────────────────────┤
│  (conteúdo da sub-aba ativa — ver seções abaixo)                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Cabeçalho comum da tela

### Elementos
1. **SectionTitle** (`.section-title`)
   - Kicker (`.eyebrow`, ciano, 12px, caixa alta): `TEMPORADA / {c.season}` (ex.: `TEMPORADA / 2026`).
   - Título `<h1>`: `Cada rodada conta.` (já termina em ponto, então o componente **não** adiciona o `.title-dot` colorido).
2. **Seletor de sub-abas** (`.segmented`): 6 `<button>` com ícone lucide 16px + rótulo (tabela acima). Botão ativo recebe `.active` (fundo gradiente branco→azul-claro, texto azul-marinho `#082062`). Rótulo da 1ª aba muda dinamicamente: `Classificação` quando `comp` é `A` ou `B`; `Chaves e grupos` quando é copa.

### Componente reutilizado: seletor com analógico (`switcher`)
Usado nas sub-abas **Tabela** (competição) e **Calendário** (mês). Estrutura `.stick-switcher` (grid de 4 colunas):
- Botão `‹` (`ChevronLeft` 20px, `aria-label="Anterior"`, `tabIndex=-1` → **não recebe foco do controle**, só mouse).
- Centro: `<strong>` com o rótulo (itálico 800 22px, caixa alta, reticências se longo) e, opcionalmente, `.switcher-dots` (um `<i>` por competição disponível; o atual tem `.on`: 14px de largura e cor lima; os demais 6px brancos 25%). Dots só aparecem no seletor de competição.
- Botão `›` (`ChevronRight`, `aria-label="Próximo"`, `tabIndex=-1`).
- `<small>` de dica: com controle → `<kbd>RS</kbd>` (Xbox) ou `<kbd>R3</kbd>` (PlayStation) + ` ◄ ► trocar`; sem controle → `, .` + ` ◄ ► trocar`.
- `aria-live="polite"`.

### Comportamento do analógico direito horizontal (`useStickX`)
- `view === 'calendar'` → troca de **mês** (`cycleMonth(±1)`).
- `view` = `table` ou `stats` → troca de **competição** (`cycleComp(±1)`).
- `trophies`, `awards`, `legacy` → nada acontece (mas o evento é consumido — ver Problemas).
- Teclado: `,` = anterior, `.` = próximo. Ignorado quando um modal está aberto.
- Repetição limitada a 1 passo a cada 360 ms, com vibração `tab` e beep (se sons do menu ligados).

---

## Aba 1 — Tabela (`table`): "Classificação" / "Chaves e grupos"

### Resumo
Classificação da Série A ou B (pontos corridos) ou, para copas, tabelas de grupos + confrontos de mata-mata. Coluna lateral com últimos resultados da competição e o regulamento.

### Wireframe atual
```
┌───────────────── .season-layout (1.7fr | 1fr) ──────────────────────────────┐
│ ┌ .panel.standings-panel (borda topo ciano) ───────┐ ┌ aside ─────────────┐ │
│ │ ‹ BRASILEIRÃO SÉRIE A ›  RS ◄ ► trocar  [ 2026 ] │ │ ÚLTIMOS RESULTADOS │ │
│ │    ▬ • • • •   (dots)                             │ │ FLA  2 : 1  PAL    │ │
│ │ # │ CLUBE            │ P │ J │ V │ E │ D │GP│GC│SG│ │ COR  0 : 0  SAO    │ │
│ │▌1 │ [esc] Flamengo   │ 40│ 18│ 12│ 4 │ 2 │30│12│18│ │ ... (até 10)       │ │
│ │▌2 │ ...                                          │ ├────────────────────┤ │
│ │ ...(linha do seu clube destacada lima)           │ │ REGULAMENTO DA     │ │
│ │▌17│ ... (borda vermelha = rebaixamento)          │ │ SIMULAÇÃO          │ │
│ │ ● Libertadores (G6) ● Rebaixamento  RS ▲▼ rolar  │ │ 38 rodadas. Ida e  │ │
│ └──────────────────────────────────────────────────┘ │ volta.  (texto)    │ │
│                                                      └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```
Modo copa (painel esquerdo):
```
│ ‹ COPA LIBERTADORES ›  RS ◄ ► trocar   [ CAMPEÃO: FLA ] │
│ GRUPO A                                                   │
│  # │ CLUBE │ P │ J │ V │ E │ D │ GP │ GC │ SG  (2 primeiros com borda lima) │
│ GRUPO B ...                                               │
│ OITAVAS DE FINAL                                          │
│  Flamengo        2:1 / 0:0           Racing   (vencedor em lima) │
│  Palmeiras   1:1 / 05 de ago. de 2026  Boca                      │
│ FINAL · CAMPO NEUTRO                                      │
```

### Elementos
1. **Painel de classificação** (`section.panel.standings-panel`).
   - **Cabeçalho** (`.panel-heading`):
     - `switcher(competitionName(comp), …, available)`: rótulo é o nome completo da competição: `Brasileirão Série A`, `Brasileirão Série B`, nome do estadual (`Paulistão`, `Carioca`, `Mineiro`, `Gaúcho`, `Paranaense`, `Catarinense`, `Baiano`, `Pernambucano`, `Cearense`, `Goiano`, `Mato-Grossense`, `Alagoano`, `Paraense` ou `Estadual XX`), `Copa do Brasil`, `Supercopa do Brasil`, `Copa Libertadores`, `Copa Sul-Americana`.
     - **Competições disponíveis** (`available`): ordem fixa `A`, `B`, `EST-{UF do clube}`, `CDB`, `SUP`, `LIB`, `SUL`; A e B sempre aparecem; as outras só se existir algum `fixture.cup` com aquele id na temporada (o clube não precisa participar — é o calendário global).
     - **Competição inicial**: `c.leagues[c.clubId]` ou `club.league` (divisão atual do clube).
     - **Pill** (`.pill`, cápsula 12px caixa alta): se `c.honours` tem campeão desta competição na temporada atual → `CAMPEÃO: {sigla curta do clube}`; senão o ano (`2026`).
   - **Liga (A/B)** → `StandingsTable` com `standings(c, world, comp)`:
     - Cabeçalhos: `#`, `CLUBE`, `P`, `J`, `V`, `E`, `D`, `GP`, `GC`, `SG` (cabeçalho fixo/sticky azul `#0a2172`).
     - Linha: posição (fonte display 800, borda esquerda de 4px colorida por zona), `Badge` pequeno + nome completo do clube, **pontos em `<strong>`** (lima, 16px), jogos, vitórias, empates, derrotas, gols pró, gols contra, saldo (`gf - ga`, sem sinal `+`).
     - Linha do clube do usuário: `.your-club` (fundo lima 20%).
     - **Zonas**: Série A → posições 1–6 `qualification` (borda lima), 17–20 `relegation` (borda vermelha). Série B → 1–2 `qualification` (lima), 3–6 `playoff-zone` (ciano).
     - **Legenda** (`.table-legend`): Série A → `● Libertadores (G6)` (lima) e `● Rebaixamento` (vermelho). Série B → `● Acesso direto` (lima) e `● Playoffs (3º–6º)` (ciano). À direita (`.muted`): com controle `<kbd>RS|R3</kbd> ▲▼ rolar`, sem controle `Roda do mouse ▲▼ rolar`.
   - **Copa** → `div.table-scroll.cup-scroll` contendo:
     - **Grupos** (`cupGroups(c, comp)`): para cada grupo (ordenado alfabeticamente), `.cup-group` com eyebrow `FASE DE CLASSIFICAÇÃO` (quando grupo = `Único`, caso dos estaduais) ou `GRUPO {letra}`, seguido de `StandingsTable`. Zona `qualification` (borda lima) para os 4 primeiros nos estaduais e os 2 primeiros nos demais. Sem legenda.
     - **Fases de mata-mata** (`cupTies(c, comp)` agrupados por `stage`, na ordem em que aparecem): eyebrow com o nome da fase em caixa alta. Nomes possíveis: Copa do Brasil `Primeira fase`, `Segunda fase`, `Oitavas de final`, `Quartas de final`, `Semifinal`, `Final`; Libertadores/Sul-Americana `Oitavas de final`, `Quartas de final`, `Semifinal`, `Final · campo neutro`; Estadual `Semifinal`, `Final`; Supercopa `Final · jogo único`.
     - Cada confronto é uma `.result-row.tie-row` (grid 1fr auto 1fr): nome completo do mandante do 1º jogo | placares | nome completo do visitante do 1º jogo. Placares: cada jogo vira `h:a` (ex.: `2:1`), com pênaltis `2:1 (4-3 pên.)`; jogo não disputado mostra a data curta (`dateLabel`, ex. `05 de ago. de 2026`); jogos separados por ` / `. O nome do vencedor do confronto ganha `.winner` (lima, negrito). Se o clube do usuário está no confronto → `.your-club` (fundo lima 14%).
     - Vazio: `Nenhuma partida desta competição na temporada.` (`.muted`).
2. **Coluna lateral** (`aside`, rolável):
   - **Últimos resultados** (`section.panel`): eyebrow `ÚLTIMOS RESULTADOS`; até 10 últimos jogos **com resultado** da competição selecionada (`compFixtures.filter(result).slice(-10)`, ordem cronológica crescente — o mais recente embaixo). Cada linha `.result-row`: sigla do mandante | `h : a` em `<strong>` (caixa com fundo branco 12%) | sigla do visitante. Vazio: `A bola ainda não rolou.`
   - **Regulamento** (`section.panel.rules-panel`): eyebrow `REGULAMENTO DA SIMULAÇÃO`; `<h3>` e `<p>`:
     - Série A: h3 `38 rodadas. Ida e volta.` / p `20 clubes e 380 partidas. Quatro últimos rebaixados. G6 e campeão da Copa do Brasil vão à Libertadores; os seis seguintes à Sul-Americana.`
     - Série B: h3 `Um acesso disputado até o fim.` / p `Os dois primeiros sobem. 3º × 6º e 4º × 5º disputam ida e volta por mais duas vagas. Empate no agregado favorece a melhor campanha. A Série C não é simulada, então ninguém cai da Série B.`
     - Copas: h3 = nome completo; p = `cupRules[família]`:
       - EST: `Turno único entre clubes do estado (principais e convidados). Os quatro primeiros fazem semifinal e final em jogo único na casa do melhor; empate vai para os pênaltis.`
       - CDB: `64 clubes: 40 das Séries A/B e 24 convidados nacionais. Fases iniciais em jogo único, a partir das oitavas ida e volta. Empate no agregado vai para os pênaltis.`
       - SUP: `Campeão brasileiro × campeão da Copa do Brasil (ou vice) em jogo único.`
       - LIB e SUL: `32 clubes em 8 grupos de 4, ida e volta. Dois primeiros avançam; mata-mata ida e volta até a final em jogo único.`

### Estados e variações
- Liga A × Liga B (zonas, legenda e regulamento diferentes).
- Copa só com grupos (fase de grupos em andamento), grupos + mata-mata, só mata-mata (CDB, SUP), ou vazia.
- Campeão definido → pill `CAMPEÃO: XXX`.
- Início de temporada: tabela com zeros; "A bola ainda não rolou.".
- Clubes NPC convidados (estaduais/CDB) aparecem com escudo genérico (`Badge` sem logo: sigla + `• • •` na cor do clube).

### Interações
- **Mouse**: setas `‹ ›` trocam competição; roda do mouse rola tabela e aside; clique nas sub-abas.
- **Teclado**: `,` / `.` trocam competição; `Q`/`E` trocam sub-aba; setas movem foco; `[`/`]` trocam aba principal; Esc = Pausa.
- **Controle**:
  - RS ◄ ► (ou R3 no PS) → competição anterior/próxima (circular).
  - RS ▲▼ → rola a área rolável mais próxima do foco ou a maior visível (normalmente a tabela).
  - LT/RT (L2/R2) → sub-aba anterior/próxima (circular, clica o botão e foca).
  - D-pad/LS → foco espacial; os únicos focáveis da sub-aba são os 6 botões do `.segmented` (as linhas da tabela e as setas do switcher não são focáveis).
  - A (✕) → ativa o botão em foco. B (○) → Pausa. X (□) → Avançar. Y (△) → Escritório. LB/RB → aba principal. START → Pausa.

---

## Aba 2 — Calendário (`calendar`)

### Resumo
Calendário mensal (domingo a sábado) só com os jogos do clube do usuário, colorido por resultado, e painel lateral com o dia selecionado e a agenda nacional.

### Wireframe atual
```
┌ .season-layout.calendar-layout (2.2fr | 0.8fr) ─────────────────────────────┐
│ ┌ .panel.month-panel ───────────────────────────────┐ ┌ aside.day-panel ───┐ │
│ │ ‹ FEVEREIRO DE 2026 ›  RS ◄ ► trocar   [ 6 jogos ]│ │ 04 DE FEVEREIRO DE │ │
│ │ DOM  SEG  TER  QUA  QUI  SEX  SÁB                  │ │ 2026               │ │
│ │ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                       │ │ BRASILEIRÃO SÉRIE A│ │
│ │ │1 ││2 ││3 ││4 CASA│5 ││6 ││7 │                    │ │ · RODADA 2         │ │
│ │ │  ││  ││  ││[esc] ││  ││  ││  │                   │ │ [ESC] FLA  2 : 1 [ESC] PAL│
│ │ │  ││  ││  ││2–1   ││  ││  ││  │ (verde=vitória)   │ │ AGENDA NACIONAL    │ │
│ │ └──┘└──┘└──┘└──┘└──┘└──┘└──┘                       │ │ 📅 Estaduais        │ │
│ │ ... 4 a 6 semanas                                  │ │    11 de jan. — 08 de mar. │
│ └────────────────────────────────────────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Elementos
1. **Painel do mês** (`section.panel.month-panel`):
   - `switcher(monthName(month))`: rótulo `Intl` pt-BR mês longo + ano (ex.: `fevereiro de 2026`, exibido em caixa alta via CSS). Sem dots.
   - **Pill**: `{n} jogos` = quantidade de jogos do clube no mês.
   - **Grade** (`.month-grid`, 7 colunas, linhas que ocupam a altura disponível):
     - Cabeçalho de dias (`.weekday`): `DOM SEG TER QUA QUI SEX SÁB`.
     - Células vazias antes do dia 1 e depois do último dia (`.day-cell.blank`, transparente) para completar semanas.
     - Cada dia é um `<button class="day-cell">` com:
       - `.day-number` (canto superior esquerdo): número do dia.
       - Se há jogo do clube: `.day-side` (canto superior direito, 9px) `CASA` ou `FORA`; `Badge` pequeno do **adversário**; `.day-comp`: placar `h–a` (mandante–visitante, travessão) se já jogado, senão nome curto da competição (`Série A`, `Série B`, `Copa do Brasil`, `Supercopa`, `Libertadores`, `Sul-Americana`, nome do estadual).
     - Classes de estado: `.match` (fundo gradiente azul), `.win` (verde), `.loss` (vermelho), `.draw` (amarelo) — resultado do ponto de vista do usuário; `.today` (contorno interno lima 2px) = `c.date`; `.selected` (outline branco 2px) = dia escolhido; `.past` (opacidade 0,6) = datas anteriores a hoje.
     - `aria-label`: data longa + `: {adversário}, {competição curta}` quando há jogo.
2. **Painel do dia** (`aside.panel.day-panel`, borda superior amarela):
   - Eyebrow: data longa do dia selecionado em caixa alta (`04 DE FEVEREIRO DE 2026`).
   - Se há jogo: `.day-fixture` com eyebrow `{competição completa} · {fase}` (fase = `Rodada N`, `Playoff de acesso`, `Grupo X · 1º jogo`, `Oitavas de final · 2º jogo` etc.) e `.day-versus`: escudo grande + sigla do mandante | placar `h : a` (28px) ou `×` | escudo grande + sigla do visitante.
   - Sem jogo: `<h3>Dia sem jogo · treino e recuperação.</h3>`.
   - Eyebrow `AGENDA NACIONAL` + lista `.milestone` (ícone `CalendarDays` 17px ciano, título em `<strong>`, datas `dd de mmm. de aaaa — dd de mmm. de aaaa`). Mostra os marcos que cobrem o dia selecionado; se nenhum, todos os marcos que **começam** no mês. Marcos (`milestones(season)`): Primeira janela de transferências (05/01–03/03), Estaduais (11/01–08/03), Brasileirão Série A (28/01–02/12), Supercopa do Brasil (01/02), Copa do Brasil (18/02–06/12), Brasileirão Série B · fase regular (21/03–14/11), Copa Sul-Americana (01/04–21/11), Copa Libertadores (08/04–28/11), Segunda janela de transferências (20/07–11/09), Playoffs de acesso · Série B (21/11–28/11).

### Estados e variações
- Mês inicial = mês de `c.date`; dia selecionado inicial = `c.date`.
- Ao trocar de mês, o dia selecionado vira o dia 1 daquele mês.
- Navegação de mês limitada ao ano da temporada (janeiro–dezembro de `c.season`); tentar passar disso não faz nada (sem feedback).
- Mês sem jogos: pill `0 jogos`, todas as células neutras.
- Só aparecem jogos **do clube do usuário** (se houver dois no mesmo dia, o último sobrescreve no mapa).

### Interações
- **Mouse**: clicar num dia seleciona (`setDay`); setas do switcher trocam o mês.
- **Teclado**: `,`/`.` mês; setas movem o foco entre dias (focar já seleciona — `onFocus`).
- **Controle**: D-pad/LS percorre as células (foco = seleção imediata, painel lateral atualiza); A (✕) também seleciona; RS ◄ ► troca mês; LT/RT troca sub-aba; demais botões globais como na aba Tabela.

---

## Aba 3 — Estatísticas (`stats`)

### Resumo
Quatro rankings top 10 dos jogadores dos clubes de uma divisão, somando todas as competições.

### Wireframe atual
```
┌ .stats-grid (carrossel horizontal, cards 280–360px) ───────────────────────────┐
│ ┌ panel ─────────────┐ ┌ panel (lima) ──────┐ ┌ panel (amarelo) ─┐ ┌ (rosa) ─┐ │
│ │CLUBES DA SÉRIE A · │ │ ...                │ │ ...              │ │ ...     │ │
│ │TODAS AS COMPETIÇÕES│ │ ASSISTÊNCIAS       │ │ CARTÕES AMARELOS │ │ MINUTOS │ │
│ │ARTILHARIA          │ │                    │ │                  │ │ EM CAMPO│ │
│ │1 (foto) Pedro   12 │ │                    │ │                  │ │         │ │
│ │       Flamengo     │ │                    │ │                  │ │         │ │
│ │2 ...               │ │                    │ │                  │ │         │ │
│ └────────────────────┘ └────────────────────┘ └──────────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Elementos
- 4 `section.panel` (bordas superiores: 1º ciano padrão, 2º lima, 3º amarelo, 4º rosa):
  - Eyebrow: `CLUBES DA SÉRIE {A|B} · TODAS AS COMPETIÇÕES`.
  - `<h2>`: `Artilharia` (chave `goals`), `Assistências` (`assists`), `Cartões amarelos` (`yellow`), `Minutos em campo` (`minutes`).
  - 10 linhas `.stat-leader` (grid 26px | 30px | 1fr | auto): posição (display 800, cinza), `PlayerFace` tamanho `sm`, nome completo `<strong>` + nome do clube atual `<small>`, valor `<b>` (no CSS o seletor é `> strong` lima 20px, mas o markup usa `<b>` — o valor sai sem o estilo lima).
- Universo: `world.players` cujo clube atual (`c.players[id].clubId`) está na divisão `statsLeague`. `statsLeague` = competição selecionada se for A/B; senão, a divisão do clube do usuário.
- Ordenação descendente pelo valor da temporada (`c.players[id][key]`); empates sem critério secundário.

### Estados e variações
- Início de temporada: lista com 10 jogadores com valor 0 (ordem arbitrária).
- Não há seletor visível nesta aba, mas o RS ◄ ► continua trocando a competição (estado invisível — afeta a divisão listada apenas quando cai em A ou B).

### Interações
- **Mouse**: rolagem horizontal do carrossel (barra oculta), roda rola vertical dentro do painel.
- **Controle**: nenhum elemento focável no conteúdo; LT/RT troca sub-aba; RS ▲▼ rola; RS ◄ ► troca competição silenciosamente (não rola o carrossel). Em telas estreitas os cards 3/4 podem ficar inacessíveis no controle.

---

## Aba 4 — Troféus (`trophies`)

### Resumo
"Sala de troféus": prateleira horizontal com as 7 taças, contagem de títulos do usuário em cada uma e rodapé com resumo da gestão.

### Wireframe atual
```
┌ .trophy-hall (fundo radial dourado + gradiente azul escuro) ──────────────────┐
│ ┌ .trophy-shelf.carousel ───────────────────────────────────────────────────┐ │
│ │ ┌stand──────┐ ┌stand──────┐ ┌stand──────┐ ┌──────────┐ ┌────┐ ┌────┐ ┌────┐│ │
│ │ │  (luz)    │ │           │ │           │ │          │ │    │ │    │ │    ││ │
│ │ │  [SVG     │ │  [SVG]    │ │ [SVG]     │ │  [SVG]   │ │    │ │    │ │    ││ │
│ │ │  taça]    │ │           │ │           │ │          │ │    │ │    │ │    ││ │
│ │ │ ▓ 1 TÍTULO│ │ ▓ 0 TÍTULOS│ │           │ │          │ │    │ │    │ │    ││ │
│ │ │ SÉRIE A   │ │ SÉRIE B   │ │ PAULISTÃO │ │COPA DO BR│ │SUP │ │LIB │ │SUL ││ │
│ │ │ 2026      │ │Em disputa │ │2026: PAL  │ │          │ │    │ │    │ │    ││ │
│ │ └───────────┘ └───────────┘ └───────────┘ └──────────┘ └────┘ └────┘ └────┘│ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│ 1 título na sua gestão   2025 — 4º na Série A   2026 — 1º na Série A   Acesso — X, Y │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Elementos
1. **Prateleira** (`.trophy-shelf.carousel`): sempre 7 `button.trophy-stand` na ordem `A`, `B`, `EST-{UF}`, `CDB`, `SUP`, `LIB`, `SUL` (mesmo que o clube nunca dispute).
   - `.trophy-light` (brilho radial no topo).
   - `TrophyArt id={id}` (SVG 200×300):
     - A → forma `flag` (bandeiras onduladas em mastro), prata com detalhes dourados.
     - B → `tall` (taça alta), prata.
     - CDB → `classic` (taça com alças), ouro.
     - SUP → `ball` (bola sobre haste), prata/ouro.
     - LIB → `globe` (globo sobre base de madeira com plaquinhas), prata.
     - SUL → `tall`, ouro com detalhes prata.
     - Estadual (`EST-xx`) → padrão `classic` prata com detalhes ouro.
     - `classic`, `ball`, `flag` e `tall` ganham base de madeira com sombra; `globe` tem base própria.
     - Sem título: SVG dessaturado e escurecido (`saturate(.55) brightness(.62)`); com título (`.won`): brilho dourado; em foco: brilho branco + `scale(1.04)`.
   - `.trophy-plate` (plaqueta dourada): número de títulos (`<strong>` 30px) + `TÍTULO`/`TÍTULOS`.
   - `.trophy-name`: nome curto (`Série A`, `Série B`, `Paulistão`…, `Copa do Brasil`, `Supercopa`, `Libertadores`, `Sul-Americana`) em itálico caixa alta.
   - `.trophy-years`: se o usuário tem títulos → anos separados por ` · `; senão, se há campeão nesta temporada → `{ano}: {sigla do campeão}`; senão `Em disputa`.
   - `aria-label`: `{nome completo}: {n} títulos`.
   - `.won` no stand com título: contorno dourado + glow.
2. **Rodapé** (`.trophy-footer`):
   - `<strong>{total}</strong> título(s) do clube atual no save` (número amarelo 22px); os títulos registrados do manager aparecem em Legado.
   - Últimas 3 temporadas de `c.history`: `{season} — {position}º na Série {league}`.
   - Se `c.seasonEnded`: `Acesso — {siglas de c.promoted separadas por vírgula}`.

### Estados e variações
- Nenhum título: todos dessaturados, "0 TÍTULOS", "Em disputa".
- Título conquistado: stand dourado iluminado.
- Primeira temporada: sem linhas de histórico.

### Interações
- **Mouse**: os stands são botões sem ação (só foco/hover); rolagem horizontal da prateleira.
- **Controle**: D-pad ◄ ► percorre os stands (o FocusManager centraliza o item no carrossel com `scrollIntoView inline:center`); A não faz nada; RS ◄ ► não faz nada nesta aba; LT/RT troca sub-aba.

---

## Aba 5 — Prêmios (`awards`)

### Resumo
Galeria de prêmios mensais e de temporada (`c.awards`), do mais recente ao mais antigo.

### Elementos
- Container `.stats-grid` (carrossel horizontal de cards).
- Vazio: um `section.panel` com `<h2>Prêmios da temporada</h2>` e `Os destaques mensais e os prêmios do ano aparecem aqui.` (`.muted`).
- Cada prêmio (`[...c.awards].reverse()`): `section.panel` com:
  - Eyebrow: `{season} · {mês por extenso em minúsculas}` (ex.: `2026 · março`) ou `{season} · Temporada` quando `month` = 0.
  - `<h2>` com ícone `Award` 20px + categoria: `Jogador do mês`, `Time do mês`, `Melhor jogador`, `Artilheiro`, `Revelação`, `Goleiro`.
  - Se há atleta: `PlayerFace` tamanho `lg` com `.award-face` (150×150, cantos 16px, fundo gradiente azul).
  - `<strong>`: nome do atleta, ou nome do clube (Time do mês), ou `Sem vencedor definido`.
  - Se há atleta e clube: nome do clube em `.muted`.

### Estados e variações
- Lista vazia; 1+ prêmios; prêmio de clube (sem foto) vs. de atleta (com foto).

### Interações
- Nenhum elemento focável no conteúdo. Mouse: rolar horizontal. Controle: só LT/RT e RS ▲▼; **não há como rolar horizontalmente** (RS ◄ ► é consumido pelo `useStickX` sem ação).

---

## Aba 6 — Legado (`legacy`) — `LegacyPanel`

### Resumo
Painel de memória da carreira vindo do sistema "mundo vivo" (`career.living`).

### Wireframe atual
```
┌ .staff-layout (grid 1fr | 1.3fr; 3º painel quebra linha) ───────────────────┐
│ ┌ panel: LINHA DO TEMPO ──────┐ ┌ panel: HALL DA FAMA ─────────────────────┐ │
│ │ Convidado para treinar a    │ │ Pedro  120 jogos · 60 gols · 12 assist.  │ │
│ │ Seleção Brasileira (laranja)│ │ ... (top 10)                             │ │
│ │ 🏆 12 de dez. de 2026 Campeão│ └──────────────────────────────────────────┘ │
│ │ 💰 ... (até 40)             │ ┌ panel: MAIORES NEGÓCIOS ────────────────┐ │
│ └─────────────────────────────┘ │ VENDAS  Fulano → Clube · R$ 12 mi       │ │
│                                 │ CONTRATAÇÕES Ciclano ← Clube · R$ 5 mi  │ │
│                                 └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Elementos
1. **Trajetória**: temporadas encerradas, títulos registrados e vitórias/empates/derrotas em clubes desde o início do registro. Se houver trabalho na Seleção, mostra vitórias e jogos internacionais. Saves antigos não recuperam resultados que não foram registrados.
2. **Linha do tempo** (`section.panel`, `<h2>Linha do tempo</h2>`):
   - Se `living.nationalInvite` e o convite ainda não foi aceito: `Convidado para treinar a Seleção Brasileira`.
   - Eventos de `living.timeline`, do mais novo para o mais antigo, em páginas de 40 acessíveis por "Ver eventos anteriores". Ícones (emoji) por `kind`: `titulo` 🏆, `venda` 💰, `contratacao` ✍️, `derrota` 💥, `vitoria` ⚽, `marco` ⭐, `base` 🌱, `cargo` 💼.
   - Vazio: `A história ainda está sendo escrita.`
3. **Hall da fama** (`<h2>Hall da fama</h2>`): top 10 de `living.clubStats` ordenado por `jogos + gols×3`; cada linha `<strong>Nome</strong> <muted>{games} jogos · {goals} gols · {assists} assist.</muted>`. Vazio: `Jogue partidas para formar ídolos.`
4. **Maiores negócios** (`<h2>Maiores negócios</h2>`):
   - `<h3>Vendas</h3>`: até 5 transferências com `from` = clube do usuário, por valor desc.: `Nome → Clube destino · R$ X mi` (`money` compacto pt-BR).
   - `<h3>Contratações</h3>`: até 5 com `to` = clube do usuário: `Nome ← Clube origem · R$ X mi`.
   - Sem mensagem de vazio (os títulos ficam sozinhos).
5. **Temporadas e conquistas**: títulos registrados durante a gestão e histórico de posição e troféus por temporada.

### Estados e variações
- Carreira nova: textos de vazio; "Maiores negócios" só com subtítulos.
- Convite da Seleção ativo: manchete laranja no topo.

### Interações
- Controle: LT/RT, RS ▲▼ e botão "Ver eventos anteriores". Mouse: rolagem e clique.

---

## Aba 7 — Seleção (`national`)

- Um convite pode chegar ao fim da temporada após título nacional/continental relevante ou quatro títulos registrados, com confiança mínima de 60. O cargo é exercido em paralelo ao clube.
- A convocação é editável, limitada a 23 atletas elegíveis, com recomendação automática e troca entre titulares e reservas. Lesionados e suspensos pela Seleção não podem começar uma partida. Convocações não podem agravar a falta de atletas ou deixar um clube principal sem goleiro.
- Há cinco janelas e amistosos por ano, em datas **fictícias**. Os adversários são seleções NPC e os atletas disponíveis dependem do snapshot, cujas nacionalidades podem ser estimadas. Não há Copa do Mundo nem eliminatórias.
- Convocados desfalcam seus clubes durante a janela. A disponibilidade é revista após lesões e transferências; se a lista precisar ser reduzida para preservar o elenco de um clube, chega uma mensagem explicando a mudança.
- O jogo da Seleção usa a tela e a engine de partidas, sem mudar os contratos ou as suspensões domésticas. Lesões e desgaste retornam ao clube; suspensões internacionais são separadas. A agenda, o andamento e os resultados persistem no save.

---

## Classes CSS e visual atual (src\styles.css)

- **Tema global**: fundo azul escuro com feixes de luz (`.bg-stage .beam`), painéis "vidro" (`.panel`: `var(--glass)`, borda 1px `var(--line)`, **borda superior 3px colorida** — ciano por padrão, `blur(10px)`, sombra). Fonte de destaque `--display` = `Saira Condensed` (itálico 800 caixa alta nos títulos). Paleta: `--blue #0a8dff`, `--cyan #00d2ff`, `--lime #c6ff00`, `--orange #ff8a00`, `--pink #ff2e88`, `--yellow #ffd400`, `--red #ff3b4e`.
- `.screen-enter` (animação de entrada; último filho ocupa o resto da altura).
- `.section-title`, `.eyebrow` (12px, 700, espaçamento 2px, ciano).
- `.segmented` (L578–601): barra com fundo `rgba(0,8,46,.5)`, botões transparentes 15px; `.active` branco/azul.
- `.season-layout` (L2337): grid `1.7fr | minmax(260px,1fr)`; aside rolável com gap 14px. `.calendar-layout` (L4005): `2.2fr | minmax(250px,.8fr)`.
- `.standings-panel` (flex coluna, borda ciano), `.table-scroll` (overflow auto; `th` sticky `#0a2172`; `td` 5×8px; 1ª coluna com `border-left 4px` por zona: `.qualification` lima, `.playoff-zone` ciano, `.relegation` vermelho; `.your-club td` lima 20%; `strong` lima 16px).
- `.table-legend` (13px; `.legend-up` lima, `.legend-playoff` ciano, `.legend-down` vermelho).
- `.cup-scroll`, `.cup-group`, `.cup-stage` (margem 14px), `.result-row` (grid `1fr auto 1fr`, `strong` em caixa translúcida), `.result-row.your-club`, `.winner` (lima 700).
- `.rules-panel` (h3 e p 14px `--ink-2`).
- `.stick-switcher` (L3968), `.switcher-dots` (L3400–3417).
- `.pill` (cápsula 12px display, fundo branco 14%).
- `.month-panel`, `.month-grid` (7 colunas, linhas flexíveis), `.weekday`, `.day-cell` (+ `.blank`, `.past`, `.match`, `.win`, `.loss`, `.draw`, `.today`, `.selected`), `.day-number`, `.day-side`, `.day-comp`, `.day-panel` (borda amarela), `.day-fixture`, `.day-versus` (`b` 28px), `.milestone` (ícone ciano).
- `.stats-grid` (L2524: flex horizontal com scroll-snap, barra oculta; cards `clamp(280px,27vw,360px)`; bordas 2–4 lima/amarelo/rosa), `.stat-leader`.
- `.trophy-hall`, `.trophy-shelf`, `.trophy-stand` (+ `.won`, `:focus`), `.trophy-art`, `.trophy-light`, `.trophy-plate` (gradiente `#ffe066→#c99700`), `.trophy-name`, `.trophy-years`, `.trophy-footer`.
- `.award-face` (L3756).
- `.staff-layout` (L2264: grid `1fr | 1.3fr`), `.living-headline`.
- Responsivo: `≤760px` → `.season-layout`, `.staff-layout` viram 1 coluna.

## Regras que o redesign deve preservar

1. As 6 sub-abas, nesta ordem, e o rótulo dinâmico da 1ª (`Classificação` × `Chaves e grupos`).
2. LT/RT (L2/R2) trocam sub-aba; RS ◄ ► troca competição (Tabela) e mês (Calendário); `,`/`.` no teclado; o restante dos botões globais (A, B=Pausa, X=Avançar, Y=Escritório, LB/RB, START) não pode quebrar.
3. Lista de competições disponíveis (A e B sempre; outras só se existirem jogos) e competição inicial = divisão do clube.
4. Zonas e cores da tabela: Série A G6 (Libertadores) e Z4; Série B acesso direto 1–2 e playoffs 3–6; grupos de copa 2 classificados (4 no estadual); destaque da linha do usuário.
5. Colunas da classificação P J V E D GP GC SG; ordenação vem de `standings()`/`cupGroups()` (não recalcular).
6. Confrontos de mata-mata com todas as pernas, pênaltis e vencedor destacado; datas para jogos futuros.
7. Regulamentos textuais por competição.
8. Calendário restrito ao ano da temporada, começando no domingo, com hoje/selecionado/passado e cor por resultado; focar uma célula seleciona o dia; agenda nacional.
9. Rankings top 10 (gols, assistências, amarelos, minutos) por divisão.
10. 7 troféus fixos com contagem, anos ou campeão atual, e arte distinta por competição (dourado se ganho).
11. Prêmios do mais recente para o mais antigo; categorias e "Temporada" para mês 0.
12. Legado: linha do tempo (40), hall da fama (10), maiores vendas/contratações (5 cada).
13. Todo conteúdo alcançável só com controle.

## Problemas atuais e oportunidades

1. **Estatísticas, Prêmios e Legado sem navegação horizontal no controle**: os cards ficam num carrossel com scroll horizontal, mas nada é focável e o RS ◄ ► é consumido pelo `useStickX` (sempre chama `preventDefault`), então não rola. Redesign: tornar cada card/linha focável (como "tiles" do FIFA) ou usar paginação com LB/RB internos.
2. **RS ◄ ► na aba Estatísticas troca competição invisivelmente** (não há switcher na tela). Oportunidade: um seletor de divisão/competição visível nas Estatísticas (e estatísticas por competição de fato, inclusive copas).
3. **Setas do switcher têm `tabIndex=-1`** — no controle só o analógico funciona; não há affordance de botão. FIFA mostra `◄ RS ►` ao lado do nome da competição; manter mas com ícone do botão real (glifo de stick).
4. **Linhas da tabela não são focáveis**: não dá para "entrar" num clube (ver elenco, forma recente). FIFA 14 permite selecionar a linha. Oportunidade: linha focável + coluna "Forma" (últimos 5 V/E/D como bolinhas) — hoje inexistente.
5. Legenda da Série A não marca a zona da Sul-Americana (7º–12º) nem a vaga extra do campeão da Copa do Brasil, apesar de o regulamento citar.
6. Saldo de gols sem sinal (`5`, `-3`); usar `+5`.
7. `ÚLTIMOS RESULTADOS` usa siglas e ordem crescente (mais recente embaixo, sem data/rodada). FIFA mostra "Resultados/Próximos" com rodada e escudos.
8. Confrontos de copa usam texto corrido; não há chaveamento gráfico (bracket). Um bracket estilo FIFA (árvore oitavas→final com escudos) seria muito mais legível; "1º jogo/2º jogo" e agregado não aparecem explicitamente.
9. Calendário: navegação de mês silenciosa no limite do ano; dois jogos no mesmo dia são sobrescritos; jogos de outros clubes nunca aparecem. Mostrar escudo de competição no dia, não só texto.
10. Estatísticas: o valor usa `<b>` mas o CSS estiliza `> strong` → número sem cor lima. Sem filtro "só meu clube", sem média/nota, sem empate secundário.
11. Troféus: stands são `<button>` sem ação; poderia abrir detalhe (anos, campanha, final). O seletor `.trophy-footer .muted` não tem elemento correspondente. Estadual usa arte genérica.
12. Prêmios: card de "Time do mês" sem escudo (só texto); sem agrupamento por mês/temporada.
13. Legado: textos simples sem hierarquia visual; emoji em vez de ícones; "Maiores negócios" sem estado vazio; Hall da fama sem foto/card.
14. **100% FIFA-like**: usar cards com foto e fundo de tier (bronze/prata/ouro/ouro brilhante — classes `card-bronze`, `card-silver`, `card-gold`, `card-rare` já existem) nos rankings, prêmios e hall da fama; cabeçalho de competição com logo; barra de sub-abas com glifos LT/RT nas extremidades (como a nav principal já faz com LB/RB).

## Ato 6 implementado

- As seis sub-abas preservam a ordem, o rótulo dinâmico da primeira aba e navegação por clique/LT/RT; a barra horizontal mantém as seis acessíveis em telas estreitas.
- Classificação, chaves, regulamentos, calendário, competições e resultados continuam usando os dados atuais da engine, agora em painéis grafite/ardósia com seleção ciano/petróleo e cores de zona mais sóbrias.
- Os quatro rankings continuam limitados às mesmas categorias e top 10; cada linha é focável e tem uma barra proporcional ao maior valor daquele ranking, sem criar métricas.
- Troféus preservam os sete itens e os anos/contagens existentes; conquistados recebem destaque ouro e os demais ficam em cinza.
- Prêmios continuam em ordem cronológica inversa e agora aparecem em uma lista editorial compacta com foto/fallback e os dados reais do premiado.
- Legado e painéis de contexto seguem os dados atuais, com a mesma hierarquia de superfícies. CSS em `src/styles/legacy/10-office-season.css`; em mobile, somente landscape.
