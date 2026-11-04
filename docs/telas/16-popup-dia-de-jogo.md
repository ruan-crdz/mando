# Tela: Popup "Dia de jogo" (pré-jogo)

## Resumo

Modal curto exibido quando há partida do clube do usuário **na data atual**. É a antessala da partida: mostra a data, a formação e mentalidade escolhidas, um lembrete para conferir o elenco, a **previsão do jogo** (`MatchOdds`: probabilidades de Vitória/Empate/Derrota, xG esperado, aviso de que o rival estudou o time e notas de condições como viagem, calor, altitude, clássico e torcida) e três botões: **Coletiva pré-jogo**, **Revisar escalação** e **Começar partida →**. É a única porta de entrada para a tela de Partida (doc 15).

## Como se chega / como se sai

**Chegar**
1. **Central → bloco/tile de partida** (`CareerCentral` `onMatch`): se houver mensagem importante não resolvida → vai para aba 3 (Escritório) em vez do popup; senão, se `nextFixture(career).date <= career.date` → abre `popup = 'prematch'`; senão → aba 4 (Temporada).
2. **Avanço do calendário** (botão Avançar / X □ nos modos "até o próximo evento" e "automático"): quando `advanceStep` para com `stop === 'match'` → toast `Dia de jogo! O avanço parou.` (some sozinho), vibração `whistle` e abre o popup.
- No modo de avanço "dia a dia" o popup **não** abre sozinho: o usuário chega pela Central.

**Sair**
- `Começar partida →` → valida que a próxima partida é **hoje** (`fixture.date === career.date`; senão toast de erro `Não há partida hoje.`), cria `career.activeMatch` (`beginMatch`), fecha o popup, vibra `whistle` → tela de Partida.
- `Coletiva pré-jogo` → monta `buildPreMatchPress`; se falhar, toast `Não foi possível iniciar a coletiva pré-jogo.`; senão fecha o popup e abre a **Sala de imprensa** (doc 17) no modo pré-jogo. Ao terminar/pular a coletiva o usuário volta à aba em que estava (normalmente Central) — **o popup não reabre**; é preciso acionar a partida de novo.
- `Revisar escalação` → fecha e vai para a aba 1 (Elenco/Escalação).
- `‹ Voltar` (cabeçalho do Modal) / B (○) / Esc → fecha (`setPopup(null)`), fica na aba atual.
- START/☰ com popup aberto: o handler de menu alterna para o popup de Pausa (substitui este popup).

## Arquivos-fonte

- `src\App.tsx` — bloco `{popup === 'prematch' && …}` (≈L1078–1130); `onMatch` da Central (≈L573); loop de avanço com `stopNotes.match` (≈L365–385).
- `src\components\LivingPanels.tsx` → `MatchOdds` (≈L178).
- `src\game\tactics.ts` → `winProbability` (Poisson sobre xG ajustado por força, mando, condições e "rival estudou").
- `src\game\context.ts` → notas de condições (viagem, calor, altitude, clássico, casa cheia, torcida impaciente).
- `src\game\calendar.ts` → `nextFixture`, `dateLabel`.
- `src\game\press.ts` → `buildPreMatchPress`. `src\game\matches.ts` → `beginMatch`.
- `src\components\ui.tsx` → `Modal`.

## Wireframe atual (ASCII)

```
┌ .dialog (máx. 600px, gradiente azul, borda superior lima 4px) ─────┐
│ DIA DE JOGO                                          ‹ Voltar       │ ← .dialog-heading
├─────────────────────────────────────────────────────────────────────┤
│ QUARTA-FEIRA, 15 DE ABRIL DE 2026                (eyebrow)          │
│ 4-3-3 · Equilibrada                              (h2)               │
│ Confira lesões, suspensões e condição física antes de entrar em     │
│ campo.                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                              │
│ │ VITÓRIA  │ │ EMPATE   │ │ DERROTA  │   ← .living-odds             │
│ │   48%    │ │   27%    │ │   25%    │                              │
│ └──────────┘ └──────────┘ └──────────┘                              │
│ xG esperado 1.6 × 1.1 · o técnico rival estudou seus últimos jogos   │
│ Viagem de 2.300 km desgasta o visitante                             │
│ Altitude de 2.850 m: fôlego cai para quem vem de fora               │
│                                                                     │
│ [Coletiva pré-jogo] [Revisar escalação] [Começar partida →]         │ ← .button-row
└─────────────────────────────────────────────────────────────────────┘
```

## Elementos

### 1. Cabeçalho do Modal
- `<h2>` `Dia de jogo` (itálico 800, 28px, caixa alta via CSS).
- Botão `‹ Voltar` (`ChevronLeft` 16, `data-dialog-close`) — é o que B aciona.

### 2. Data (`p.eyebrow`)
- `dateLabel(career.date, true)` — data por extenso com dia da semana (formato longo pt-BR), caixa alta.

### 3. Plano tático (`h2` dentro de `.prematch-info`)
- `{career.tactic.formation} · {career.tactic.mentality}` — ex. `4-3-3 · Equilibrada`, `3-5-2 · Ofensiva`. Apenas texto, não editável aqui.

### 4. Lembrete
- `<p>` fixo: `Confira lesões, suspensões e condição física antes de entrar em campo.` (não lista quem está lesionado/suspenso).

### 5. Previsão (`MatchOdds`, `.living-odds`)
- Renderiza só se existe `nextFixture` e se `winProbability` retorna dados (retorna `null` se a escalação tem menos de 11 titulares → o bloco inteiro some, sem aviso).
- 3 caixas (grid de 3 colunas, fundo branco 12%, cantos 8px, centralizadas): rótulo `Vitória` / `Empate` / `Derrota` (0,75rem, caixa alta, opacidade .8) + valor inteiro `NN%` (1,4rem). Somam ~100%. Ponto de vista do usuário (não do mandante).
- `p.muted`: `xG esperado {xgFor} × {xgAgainst}` (número com ponto decimal, uma casa) + sufixo ` · o técnico rival estudou seus últimos jogos` quando `studied` (rival adaptou o plano ao estilo do usuário).
- Uma `p.muted` por nota de condição (ordem de `context.ts`):
  - `Viagem de {N} km desgasta o visitante` (distância entre cidades)
  - `Calor forte: o visitante sente mais o desgaste`
  - `Altitude de {N} m: fôlego cai para quem vem de fora`
  - `{Nome do clássico}: clássico com peso dobrado na torcida e na diretoria`
  - `Casa cheia empurra o time`
  - `Torcida impaciente: vaias pesam no time da casa`
- Sem ícones, sem cores por resultado (verde/amarelo/vermelho não existem), sem barra.

### 6. Botões (`.button-row`, flex wrap, gap 10)
| Ordem | Texto | Ícone | Estilo | Ação |
|---|---|---|---|---|
| 1 | `Coletiva pré-jogo` | — | padrão | abre Sala de imprensa (pré) |
| 2 | `Revisar escalação` | — | padrão | aba 1 |
| 3 | `Começar partida` | `ArrowRight` 17 (depois do texto) | `.primary` | inicia a partida |

### O que NÃO aparece hoje
- Adversário (nome/escudo), mandante/visitante, competição/rodada, estádio, clima, horário.
- Escalação/titulares, lesionados/suspensos, forma recente, retrospecto, jogadores-chave do rival.
- Odds/condições só em texto.

## Estados e variações

- **Normal**: tudo visível como no wireframe.
- **Sem previsão**: escalação incompleta (< 11) → somente data, plano, lembrete e botões.
- **Sem notas de condições**: só a linha de xG.
- **Sem "estudou"**: linha de xG sem sufixo.
- **Partida atrasada** (`fixture.date < career.date`, raro): o popup abre pela Central, mas `Começar partida` falha com `Não há partida hoje.` e a coletiva usa a mesma partida.
- O `main` fica `inert` enquanto o popup está aberto (fundo escurecido com blur).

## Interações

| Entrada | Ação |
|---|---|
| Mouse | Clique nos 3 botões ou em `‹ Voltar`; clique fora não fecha (só o botão). |
| Teclado | Setas movem foco (escopo do modal); Enter/Espaço ativa; Esc fecha. |
| D-pad / LS | Foco espacial: `‹ Voltar` ↔ linha de botões; ◄ ► entre Coletiva / Revisar / Começar. |
| A (✕) | Ativa o botão focado. |
| B (○) | Clica em `‹ Voltar` → fecha o popup. |
| START / ☰ | Troca para o popup de Pausa. |
| X (□), Y (△), LB/RB, LT/RT | Sem efeito (bloqueados com popup aberto). |
| RS ▲▼ | Rola o corpo do modal se houver overflow. |

- **Foco inicial**: não há `data-autofocus`; o `Modal` foca o primeiro botão do `.dialog-body` → **`Coletiva pré-jogo`** (não o botão primário). Para começar o jogo no controle é preciso ► ► + A.
- Vibração: `whistle` ao abrir via avanço e ao clicar em Começar partida; `move`/`confirm`/`back` padrão nos botões.

## Classes CSS e visual atual (src\styles.css)

- `.modal-backdrop` — fundo `rgba(2,6,30,.72)` + `backdrop-filter: blur(6px)`.
- `.dialog` — largura máx. 600px, gradiente azul, **borda superior 4px lima**, sombra; `.dialog-heading` (título itálico 800 28px + botão Voltar); `.dialog-body` rolável.
- `.prematch-info` (L3082) — flex coluna, gap 8px.
- `.eyebrow` — texto pequeno caixa alta, espaçado.
- `.living-odds` (L6296–6300) — grid 3 colunas, gap 8, margem topo 12, centralizado; `div` fundo branco 12% cantos 8 padding 8; `span` 0,75rem caixa alta; `strong` 1,4rem; `p` ocupa a linha inteira.
- `.muted` — cor `--ink-3`.
- `.button-row` (L713) — flex, gap 10, wrap, margem topo 12.
- `button.primary` — gradiente lima/ciano do tema (botão de destaque), foco com contorno amarelo.

## Regras que o redesign deve preservar

1. Só abre com jogo do usuário hoje; `Começar partida` revalida a data e mostra erro se não houver.
2. Três saídas: coletiva pré-jogo (opcional), revisar escalação, começar partida; B fecha sem efeito.
3. Exibir V/E/D %, xG esperado, aviso "rival estudou" e **todas** as notas de condições (são as mesmas que explicam o resultado na MatchAnalysis pós-jogo).
4. Esconder a previsão (ou trocar por alerta) quando a escalação está incompleta.
5. Vibração `whistle` ao iniciar a partida.
6. Navegável 100% no controle; START leva à Pausa.

## Problemas atuais e oportunidades

1. **Falta o essencial de um "Match Day" FIFA**: escudos e nomes dos dois times frente a frente, competição/rodada (`fixtureLabel`), estádio, mando, forma recente (V/E/D dos últimos 5), posição na tabela, jogadores-chave e escalação provável do rival.
2. **Lembrete sem dados**: diz "confira lesões, suspensões e condição física" mas não mostra quem está lesionado/suspenso/cansado nem se há titular indisponível — deveria listar alertas (cards com foto e tier bronze/prata/ouro/ouro brilhante, selo de lesão/suspensão, barra de fôlego).
3. **Foco inicial no botão errado** (`Coletiva pré-jogo`); o primário `Começar partida` deveria receber `data-autofocus`, ou mapear atalhos (A = começar, X = coletiva, Y = escalação), estilo FIFA.
4. **Previsão sem visual**: sem barra tripla colorida (verde/cinza/vermelho), sem destaque do favorito; xG com ponto decimal; condições sem ícones (avião, termômetro, montanha, chama de clássico, torcida).
5. O popup **não reabre** após a coletiva pré-jogo — o usuário volta à Central e precisa achar a partida de novo. Ideal: voltar ao Dia de jogo com a coletiva marcada como feita.
6. Formação/mentalidade só como texto; poderia mostrar um mini-campinho com a escalação e permitir trocar formação rápido.
7. Preferência do usuário: popups sem X / que se resolvam sozinhos — aqui o modal depende de `‹ Voltar`; manter B como fechamento e considerar visual de "tela cheia" de pré-jogo em vez de modal pequeno de 600px.
8. Sem som/ambiente de entrada (hino, torcida chegando) — oportunidade de ambientação FIFA.

## Entrega do Ato 7

- O Dia de jogo apresenta mandante e visitante com escudos, competição/etapa, estádio, data, plano tático e desfalques reais por lesão ou suspensão.
- O painel continua exibindo a previsão e as condições da engine; se a escalação não tiver onze titulares válidos, explica por que as probabilidades não aparecem.
- `Começar partida` recebe o foco inicial. Após responder ou pular a coletiva pré-jogo, o fluxo retorna a este Dia de jogo para revisar o time ou iniciar a partida.
- Revisar escalação, revalidar a data, vibração ao iniciar e fechamento pelo botão B continuam preservados.
