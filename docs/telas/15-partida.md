# Tela: Partida

## Resumo

Tela de jogo ao vivo do modo carreira (`MatchScreen` em `src\screens\Match.tsx`). Substitui todo o conteúdo do `<main>` enquanto `career.activeMatch` existir. Mostra placar estilo transmissão de TV, um **campinho 2D animado** (`LivePitch`) ilustrativo, linha do tempo de 0' a 90', controles de reprodução (Jogar/Pausar, velocidade 1×/2×/4×, Substituir, Tática), painel de números (posse, finalizações, xG, passes), notas ao vivo dos atletas e a narração em texto. Ao fim, troca a narração pelas **notas da partida** com o **Craque do jogo**, mostra a **análise pós-jogo** (`MatchAnalysis`: gráfico de xG acumulado e "por que vencemos/perdemos/empatamos") e o botão **Confirmar resultado e voltar à central**.

A engine (`stepMatch`) avança **1 minuto por tick**; o campinho é só ilustração. Durante o jogo surgem **momentos de decisão** (modal com fala do jogador e opções). Há **som de estádio sintetizado** (torcida, "uuuh", gol com narrador TTS, apito) e **vibração** do controle em gol, gol sofrido, apito e momento.

## Como se chega / como se sai

**Entrar**
- Somente pelo popup **Dia de jogo** (`popup === 'prematch'`, ver doc 16) → botão `Começar partida` → `beginMatch(career, live, fixture)` grava `career.activeMatch`; vibração `whistle`. O jogo abre **parado no minuto 0**.
- Carregar um save salvo no meio da partida também reabre esta tela no minuto salvo.

**Durante**
- O cabeçalho do app esconde a navegação de abas (`.main-nav` não renderiza com `inMatch`); continuam logo, escudo + data + caixa e o ícone do controle. O shell recebe a classe `in-match`.
- Rodapé mostra apenas `A Selecionar` e `B Voltar` (as dicas X/RT/☰ somem).
- A música é suspensa e começa o som de torcida (`startCrowd`, só se "Música" estiver ligada na Pausa).

**Sair**
- Só no minuto 90: botão `Confirmar resultado e voltar à central` → `onFinish`: monta a coletiva pós-jogo (`buildPress`), aplica `finishMatch` (resultado, estatísticas, moral etc.), volta para a aba **Central** (`setTab(0)`) e abre o modal **Sala de imprensa** (doc 17). A torcida para e a música volta.
- `Salvar e sair para o menu` no popup de Pausa (salva com a partida em andamento).
- Não existe "abandonar/simular o resto".

## Arquivos-fonte

- `src\screens\Match.tsx` — `MatchScreen`, `MomentDialog`, `momentMeta`, `fits`.
- `src\components\LivePitch.tsx` — campinho 2D (simulação visual com `requestAnimationFrame`).
- `src\components\LivingPanels.tsx` → `MatchAnalysis`.
- `src\components\PlayerCard.tsx` → `PlayerCard`, `PlayerPicker`, `byPosition`, `roleFits`.
- `src\components\PlayerFace.tsx`, `src\components\cardTier.ts` (tiers do card).
- `src\components\controls.tsx` → `ChipGroup`, `TacticSlider`.
- `src\components\ui.tsx` → `Badge`, `Modal`.
- `src\game\matches.ts` → `stepMatch`, `substitute`, `resolveMoment`, `swapTarget`, `sideFormation`, `available`, `humanMoments`, `openMoment` (textos dos momentos).
- `src\game\matchRatings.ts` → `matchRatings`, `manOfTheMatch`, `ratingTone`.
- `src\game\calendar.ts` → `fixtureLabel`. `src\game\numbers.ts` → `shirtNumbers`.
- `src\audio\crowd.ts` → `startCrowd`, `stopCrowd`, `crowdGoal`, `crowdChance`, `crowdWhistle`, `narrateGoal`.
- `src\controller\GamepadProvider.tsx` → `rumble` e padrões de vibração.
- `src\App.tsx` → montagem do `MatchScreen` (props `onChange`, `onFinish`, `onSubstitute`, `onMoment`, `onError`, `paused`), popup de Pausa, efeito `matchOn` (torcida/música).

## Wireframe atual (ASCII)

Desktop (> 1100px): 3 colunas `1.6fr | 0.8fr | 1fr`.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BRASILEIRÃO SÉRIE A · RODADA 12                                   Maracanã        │ ← .match-strip
├──────────────────────────────────────────────────────────────────────────────────┤
│▓▓azul▓▓ [ESCUDO] FLAMENGO      ● AO VIVO       PALMEIRAS [ESCUDO] ▓▓rosa▓▓        │ ← .scoreboard
│                              ┌───────────┐                                         │
│                              │  2  :  1  │ (caixa branca)                          │
│                              └───────────┘                                         │
│                                 67:00 (lima)                                       │
├───────────────────────────────────────┬────────────────────┬─────────────────────┤
│ ┌ .live-field (gramado listrado) ───┐ │ 〰 O JOGO EM NÚMEROS│ 🔊 DIRETO DO CAMPO   │
│ │ ▯|   ⑤    ⑧  |  ⑨   ④     |▯     │ │ 58%  Posse  42%     │ 67' ⚽ GOL! Pedro... │
│ │ ▯| ①   ③   ⑩ ◯ ⑪ ⑥    ② ① |▯     │ │ ▬▬▬▬▬▬▬▬▬▬▬▬        │ 63' 💬 Fulano: "..." │
│ │ ▯|   ②    ⑦  |  ⑦   ⑤     |▯     │ │ 9  Finalizações  5  │ 60' Substituição...  │
│ │       (bola branca • )            │ │ 1.42  xG  0.61      │ 55' 🟨 Cartão...     │
│ └───────────────────────────────────┘ │ 310  Passes  220    │ ...(até 30)          │
│ ▬▬▬▬▬▬▬▬▬▬▬●▬▬▬▬▬▬▬●▬▬░░░░░░░░░░░░    │ Seed 12345 · A engine│                     │
│ 0'                45'             90' │ decide. A narração  │                     │
│ [▶ Pausar][1×][2×][4×][⇄ Substituir]  │ descreve.           │                     │
│ [⚙ Tática]                            │ NOTAS AO VIVO       │                     │
│                                       │ Pedro         [8.1] │                     │
│                                       │ ... (top 4)         │                     │
└───────────────────────────────────────┴────────────────────┴─────────────────────┘
```

Fim de jogo (minuto 90): a 3ª coluna vira **Notas da partida**, a 2ª ganha **MatchAnalysis**, e abaixo dos controles aparece o botão grande:
```
│ [✔ CONFIRMAR RESULTADO E VOLTAR À CENTRAL]  │ POR QUE VENCEMOS      │ ★ NOTAS DA PARTIDA          │
│                                              │ ╱‾‾‾ (linha verde)    │ CRAQUE DO JOGO (foto) Pedro [8.7]│
│                                              │ ___╱ (linha vermelha) │ [esc] FLA     │ [esc] PAL    │
│                                              │ xG acumulado: nós ... │ ST (foto) Pedro ⚽⚽ [8.7] │ ...│
│                                              │ Vitória construída... │ CM (foto) X 🅰 63' [7.0]  │    │
│                                              │ MELHORES EM CAMPO     │ ...                         │
```

---

## Elementos (comuns a todos os estados)

### 1. Faixa da competição (`.match-strip`)
- Esquerda: `{NOME DA COMPETIÇÃO} · {FASE}` em caixa alta (de `fixtureLabel`): ex. `BRASILEIRÃO SÉRIE A · RODADA 12`, `COPA DO BRASIL · OITAVAS DE FINAL · 1º JOGO`, `COPA LIBERTADORES · GRUPO B`, `BRASILEIRÃO SÉRIE B · PLAYOFF DE ACESSO`.
- Direita: `home.stadium` (estádio do **mandante**, mesmo em final de campo neutro).
- Fonte display 700 14px, espaçamento 1.5px, cor `--ink-2`.

### 2. Placar (`section.scoreboard`)
- Grid `1fr auto 1fr`, fundo gradiente horizontal **azul (`#0a8dff`) → azul-marinho → rosa (`#ff2e88`)** (não usa as cores dos clubes), sombra.
- Esquerda: `Badge` grande do mandante + `<h2>` nome completo (itálico 800, caixa alta, 20–32px).
- Direita: idem visitante (ordem invertida `row-reverse`, alinhado à direita).
- Centro (`.score-center`):
  - Eyebrow branco: `<span class="live-dot">` + fase. Fase = `FIM DE JOGO` (minuto 90), `INTERVALO` (minuto 45), `AO VIVO` (rodando), `PAUSADO` (parado em qualquer outro minuto, inclusive 0). `live-dot` lima pulsante quando rodando; `.paused` laranja estático quando não.
  - `<strong>`: `{homeGoals}` `<span>:</span>` `{awayGoals}` — caixa branca, números azul-marinho 44–72px, dois-pontos azul.
  - `<time>`: `MM:00` com zero à esquerda (`00:00`, `07:00`, `45:00`, `90:00`) em lima 20px. Não há acréscimos nem segundos reais.

### 3. Campinho ao vivo (`LivePitch` em `section.panel.live-field-panel`)
- Div `.live-field` (`role="img"`, `aria-label="Simulação 2D ilustrativa da partida; os lances oficiais aparecem na narração"`), gramado com listras verticais `#2c9b3a/#34ad43`, linhas brancas 55%: meio-campo, círculo central, grandes áreas, pequenas áreas, gols (rede tracejada). Campo **horizontal**: mandante ataca para a direita (lado 0), visitante para a esquerda.
- **Jogadores** (`span.field-dot`, 26px círculo): cor de fundo = `club.color` de cada clube (variável `--dot`), texto branco = número da camisa (`shirtNumbers`; fallback índice+1), borda branca (mandante) ou azul-marinho `#0b1a4a` (visitante), goleiro com borda dupla. `title` = nome do atleta. Posições base vêm de `horizontalCoordinates(formação)`; formação de cada lado = `sideFormation` (o usuário usa `c.tactic.formation`).
- **Portador da bola** ganha `.with-ball` (escala 1.22 + anel lima).
- **Bola** (`span.ball-dot`, 11px, branca com brilho).
- **Simulação visual** (não afeta o resultado): atletas correm com inércia (velocidade máx. 16%/s), o mais próximo pressiona o portador; portador conduz 0,45–1,35 s e passa para o companheiro mais avançado a < 42 unidades; chance de interceptação `12% + (50−posse)/380`; no terço final (>76%) chuta com 45% de chance e a bola vai para o goleiro adversário. A posse visual segue `match.home.possession`.
- **Gol**: quando chega um novo evento `goal`, a bola voa para a rede do lado que marcou em 0,45 s, espera 1,1 s e reinicia no meio com quem sofreu.
- Animação só avança quando `playing && !sub && !tactic && !paused && !momentKey && minuto < 90`; caso contrário o quadro congela (continua renderizando). Velocidade do campinho acompanha `speed` (limitada a 0,5–3×).

### 4. Linha do tempo (`.match-timeline`)
- Trilho 8px (`.timeline-track`) com preenchimento gradiente ciano→lima até `minuto/90`.
- Marcadores `●` amarelos para **cada gol** (de ambos os times, mesma cor), posicionados em `minuto/90`, `title="{min}' {texto}"`.
- Rótulos `0'`, `45'`, `90'` abaixo (12px `--ink-3`).

### 5. Controles (`.match-controls`)
| Botão | Ícone lucide | Texto | Regras |
|---|---|---|---|
| Principal (`.primary`) | `Play` 17 / `Pause` 17 | `Jogar` (parado), `Segundo tempo` (minuto 45 parado), `Pausar` (rodando) | `disabled` no minuto 90. Alterna `playing`. |
| Velocidade | — | `1×`, `2×`, `4×` | `.active` + `aria-pressed` no atual; padrão **2×**. Tick = `1400/speed` ms por minuto (1× ≈ 2 min 6 s de jogo; 2× ≈ 63 s; 4× ≈ 31 s). |
| Substituir | `ArrowLeftRight` 16 | `Substituir` | `disabled` no 90. Pausa e abre modal de substituição. |
| Tática | `SlidersHorizontal` 16 | `Tática` | `disabled` no 90. Pausa e abre modal de tática. |

O relógio para sozinho em 45 e 90 (`setPlaying(false)`). O tick também não roda com modal de substituição/tática aberto, com **momento** aberto, ou com `paused` (popup de Pausa aberto ou `busy`). Erro na engine → para e mostra toast de erro.

### 6. Painel "O jogo em números" (`aside.panel.match-stats`)
- Eyebrow com ícone `Activity` 15: `O JOGO EM NÚMEROS`.
- 4 linhas `.match-stat` (grid valor-mandante | rótulo | valor-visitante + `<meter>` embaixo ocupando a largura, `max = soma`, `value = mandante`):
  - `Posse de bola` com sufixo `%` (média acumulada por minuto).
  - `Finalizações` (inteiro).
  - `Gols esperados (xG)` (decimal com até 2 casas, ponto como separador — ex. `1.42`).
  - `Passes` (inteiro).
- Rodapé `.muted.small`: `Seed {match.seed} · A engine decide. A narração descreve.`
- **Notas** (`.match-ratings`): `<h3>` `Notas ao vivo` (durante) / `Melhores em campo` (fim). Top 4 notas **dos dois times juntos**: nome completo (prefixo `★ ` se for o MVP) + `.rating-badge` com nota `x.x`.
- No fim também: `MatchAnalysis` (ver estado Fim de jogo).

### 7. Narração "Direto do campo" (`section.panel.commentary-panel`, estados antes do 90)
- `<h2>` com `Volume2` 19: `Direto do campo`.
- `.commentary-feed` (rolável, `aria-live` = `polite` quando parado, `off` rodando): últimos **30** eventos, **mais recente no topo**. Cada linha: `<time>{min}'</time>` (ciano 15px) + texto com prefixo:
  - `goal` → `⚽ ` + `GOL! {Atleta} marca para o {Clube}! Passe de {Assistente}.` (linha com classe `.goal`, gradiente lima, negrito)
  - `yellow` → `🟨 Cartão amarelo para {Atleta}.`
  - `injury` → `🚑 {Atleta} sente uma lesão. A comissão recomenda substituição.` / `🚑 {Atleta} insistiu no sacrifício e sentiu uma lesão.`
  - `moment` → `💬 {Atleta}: “{fala}”` (classe `.moment`, gradiente ciano, itálico)
  - `save` → `{Atleta} finaliza. O goleiro faz a defesa!` (sem ícone)
  - `miss` → `{Atleta} encontra espaço, mas finaliza para fora.`
  - `sub` → `Substituição: sai X, entra Y.` (inclui trocas da IA adversária, com motivo)
  - `kickoff` (0') → `Bola rolando. Começa a partida!`; `half` (45') → `Intervalo. Hora de ajustar o plano.`; `full` (90') → `Fim de jogo. Cada decisão deixa uma história.`
- Cada linha entra com animação `stage-in`.

---

## Estado A — Pré-início (minuto 0, nunca jogado)

### Elementos
- Placar `0 : 0`, fase `PAUSADO` (dot laranja), relógio `00:00`.
- Campinho com os 22 atletas nas posições da formação, bola no centro com o camisa 11 (índice 10) do mandante, **congelado**.
- Timeline vazia; botão `▶ Jogar`; velocidade `2×` ativa; Substituir/Tática habilitados.
- Números iniciais de `beginMatch`: posse `50%` × `50%`, finalizações `0`, xG `0`, passes `0`.
- Notas ao vivo já calculadas (`matchRatings` com 0 minutos — valores base).
- Narração com 1 linha: `0' Bola rolando. Começa a partida!`.
- Torcida já tocando (murmúrio + cânticos aleatórios a cada 14–32 s).

### Estados e variações
- Não há tela de "entrada em campo", escalações lado a lado ou apito inicial sonoro (o apito só vibra ao clicar `Começar partida` no popup).

### Interações
- Foco inicial do controle: primeiro botão focável do `<main>` → `Jogar` (via `FocusManager.ensure`).
- Ver tabela geral de interações abaixo.

## Estado B — Ao vivo (rodando)

### Elementos
- Fase `AO VIVO` com dot lima pulsante; relógio sobe 1 minuto por tick; botão `⏸ Pausar`.
- Campinho animado; narração acrescenta eventos; números e notas atualizam a cada minuto.
- `aria-live` da narração desligado (evita leitura contínua).

### Efeitos de som e vibração (useEffect que compara placar/minuto anterior)
- **Gol do mandante/visitante**: vibração `goal` (3 pulsos fortes: 180 ms 100%, 140 ms 40/80%, 420 ms 100%) se o gol é do usuário, `concede` (380 ms forte só no motor pesado) se é do rival.
- **Som de gol a favor** (`crowdGoal(true)`): murmúrio sobe para 0,75 em 0,4 s, camada de grito (`roar`) 0,32 por 4 s com filtro 700 Hz, cântico com bumbo + palmas 3,5 s depois, e **narrador TTS** do navegador (voz pt-BR; prefere "Antonio/Daniel/Natural/Online", depois Google) dizendo `Gooooooooool! É gol! Gol, gol, gol!` (rate 0,82, pitch 1,35, volume 1). Tudo passa por compressor (-18 dB, 3:1) com volume mestre 0,55.
- **Gol sofrido** (`crowdGoal(false)`): "lamento" curto (grito 0,5 por 0,6 s em 420 Hz) e silêncio da torcida por ~8 s.
- **Chance** (eventos `save`/`miss` novos no minuto — `chance` é tratado mas a engine não emite): `crowdChance()` = "uuuh".
- **Intervalo/fim**: vibração `whistle` (260 ms) + apito sintetizado 2× (45') ou 3× (90').
- **Momento aberto**: vibração `moment` (2 pulsos curtos).
- Som só toca se o `AudioContext` da torcida estiver rodando (Música ligada). Vibração respeita o toggle "Vibração" da Pausa e funciona via Gamepad API ou WebHID (DualSense).

## Estado C — Pausado (minutos 1–44 e 46–89)
- Fase `PAUSADO` (dot laranja), botão `▶ Jogar`, campinho congelado, narração com `aria-live=polite`.
- Ocorre ao clicar `Pausar`, ao abrir Substituir/Tática, quando surge um momento (o tick suspende mas `playing` continua `true` — a fase segue mostrando `AO VIVO` com dot pulsante, embora nada avance), ou quando o popup de Pausa está aberto (`paused` prop; idem: fase continua `AO VIVO`).

## Estado D — Intervalo (minuto 45)
- O relógio para sozinho em `45:00`; fase `INTERVALO`; botão vira `▶ Segundo tempo`.
- Narração ganha `45' Intervalo. Hora de ajustar o plano.`
- Vibração `whistle` + apito duplo.
- Não há tela de intervalo dedicada (estatísticas do 1º tempo, conversa de vestiário) — tudo continua na mesma tela.

## Estado E — Fim de jogo (minuto 90)

### Elementos que mudam
- Fase `FIM DE JOGO`, relógio `90:00`, apito triplo + vibração `whistle`.
- Botão principal `Jogar`, Substituir e Tática ficam **desabilitados** (velocidades continuam clicáveis sem efeito).
- **Botão de saída** (`button.primary.finish-match`, largura total, 18px): ícone `Check` 18 + `Confirmar resultado e voltar à central`.
- **MVP**: `match.mvp` (gravado pela engine no minuto 90) ou `manOfTheMatch` (maior nota; empate desempata para o time vencedor).
- **MatchAnalysis** (`.match-analysis`, dentro do painel de números, antes das notas):
  - `<h3>`: `Por que vencemos` / `Por que perdemos` / `Por que empatamos` (ponto de vista do usuário).
  - Gráfico SVG `viewBox 0 0 300 95` (`preserveAspectRatio=none`, 100% × 90px, `aria-label="xG acumulado"`): duas polilinhas em degraus começando em (0,90): **verde `#22c55e` = nós**, **vermelha `#ef4444` = rival**; eixo x = minuto/90×300, y = 90 − xG×25. Sem eixos, grade, rótulos ou marcadores de gol.
  - Legenda `.muted.small`: `xG acumulado: nós {a.toFixed(2)} (verde) × {b.toFixed(2)} rival (vermelho)`.
  - Lista de frases `.small` ("por quê"):
    - Vitória: `Vitória construída: criamos mais chances claras.` (xG nosso ≥ rival) ou `Vitória com eficiência: o rival criou mais, mas fomos letais.`
    - Derrota: `Derrota injusta pelos números: criamos mais e faltou pontaria.` ou `Derrota merecida: o rival criou chances melhores.`
    - Empate: `Empate equilibrado nas chances.`
    - Posse ≥ 58%: `Dominamos a bola ({x}%).`; ≤ 42%: `Cedemos a posse ({x}%).`
    - `match.studied`: `O técnico rival estudou nossos jogos e montou um plano específico.`
    - `match.marked`: `A marcação individual travou o principal jogador deles, ao custo de força no meio.`
    - Cada nota de condições do jogo (`match.conditions.notes`), ex.: `Viagem de 2.300 km desgasta o visitante`, `Calor forte: o visitante sente mais o desgaste`, `Altitude de 2.850 m: fôlego cai para quem vem de fora`, `{Clássico}: clássico com peso dobrado na torcida e na diretoria`, `Casa cheia empurra o time`, `Torcida impaciente: vaias pesam no time da casa`.
- Título das notas no painel de números vira `Melhores em campo` (top 4, MVP com `★ `).
- **Painel "Notas da partida"** substitui a narração (`section.panel.commentary-panel.ratings-panel`):
  - `<h2>` com `Star` 19: `Notas da partida`.
  - `.mvp-banner` (gradiente dourado→rosa, cantos 10px): `CRAQUE DO JOGO` (11px 800) + `PlayerFace` `md` + nome (18px) + `.rating-badge`.
  - `.ratings-columns.scroll-area` (2 colunas, rolável, `tabIndex=-1`): uma por clube (mandante, visitante), `<h3>` com `Badge` + sigla. Cada `.rating-row` (grid 30|30|1fr|auto): função na formação (`<small>`, ex. `ST`, `CB`), `PlayerFace` `sm`, nome completo + `⚽` repetido por gol + `🅰` repetido por assistência + `{min}'` em itálico se jogou < 90 min, e `.rating-badge`. Linha do MVP com fundo dourado 20%. Inclui atletas substituídos.
- **Cores das notas** (`ratingTone`): ≥ 8 `elite` azul `#2563eb`; ≥ 7 `good` verde `#16a34a`; ≥ 6,5 `ok` lima `#84cc16`; ≥ 6 `meh` âmbar `#f59e0b`; < 6 `bad` vermelho `#dc2626`. Escala 3,0–10,0 estilo SofaScore.

### Interações
- Foco: permanece onde estava (geralmente `Jogar`, agora desabilitado → o `MutationObserver` reposiciona no primeiro focável). Não há `data-autofocus` no botão de confirmar.
- A (✕) no botão `Confirmar resultado…` → sai para a Central e abre a coletiva.
- RS ▲▼ rola as colunas de notas (área rolável maior).

---

## Tabela geral de interações da tela (sem modal aberto)

| Entrada | Ação |
|---|---|
| Mouse | Clique nos botões; roda rola narração/notas; hover no campinho mostra nome (`title`) e na timeline o gol. |
| Setas / D-pad / LS | Foco espacial entre: Jogar/Pausar, 1×, 2×, 4×, Substituir, Tática, (Confirmar no fim). Nada mais é focável. |
| Enter/Espaço / A (✕) | Ativa o botão focado. |
| Esc / B (○) | Abre o popup **Pausa** com título `Jogo pausado` (tick para). |
| START / ☰ / Options | Alterna popup de Pausa. |
| X (□), Y (△) | **Nada** durante a partida (bloqueados por `career.activeMatch`). |
| LB/RB (L1/R1), `[` `]` | Nada (troca de aba bloqueada em partida). |
| LT/RT (L2/R2), `Q` `E` | Nada (não há `.segmented` na tela). |
| RS ▲▼ | Rola a área rolável mais próxima do foco ou a maior visível (narração / notas). |
| RS ◄ ► / `,` `.` | Rola horizontalmente a maior área com overflow-x (normalmente nada). |

Não existem atalhos diretos (ex.: "X = substituição", "Y = tática", "R1 = velocidade") — tudo exige navegar até o botão.

### Popup de Pausa durante a partida (`App.tsx`, `popup === 'pause'`)
`Modal` título `Jogo pausado`, botões: `← Continuar` (primary), `Vibração: Ligada/Desligada`, `Testar vibração` (+ nota diagnóstica), `Conectar DualSense (vibração)` (se WebHID disponível e não conectado), `Sons do menu: Ligados/Desligados`, `Música: Ligada/Desligada` (desligar também corta a torcida), `Parar caixa postal` (se houver voz tocando), `Conquistas (n/N)`, `Instalar Mando` (se PWA instalável), `Salvar e sair para o menu`. O item "Avanço do calendário" não aparece na partida. B / START fecham.

---

## Modal interno 1 — Substituição (`sub === true`)

### Resumo
Escolha em dois passos (quem sai → quem entra), com cards estilo Ultimate Team.

### Wireframe atual
```
┌ dialog.wide (980px, topo lima) ─────────────────────────────────────────┐
│ QUEM SAI?                                                   ‹ Voltar     │
│ 2 de 5 substituições utilizadas · Escolha o titular que deixa o campo.   │
│ ┌card┐┌card┐┌card┐┌card┐┌card┐                                           │
│ │78 GK││74 CB││..  ││..  ││..  │   (11 titulares, 5 por linha)          │
│ │(foto)││(foto)│                                                        │
│ │NOME ││NOME │                                                          │
│ └────┘└────┘                                                             │
└──────────────────────────────────────────────────────────────────────────┘
Passo 2:
│ QUEM ENTRA NO LUGAR DE PEDRO SILVA?                         ‹ Voltar     │
│ 2 de 5 substituições utilizadas · Escolha o reserva. B volta.            │
│ RECOMENDADOS PARA ST ───────────────────                                  │
│ [⇄ Trocar quem sai] [card] [card] ...                                     │
│ DEMAIS RESERVAS ────────────────────────                                  │
│ [card] [card] ...                                                         │
```

### Elementos
- Título dinâmico: `Quem sai?` → `Quem entra no lugar de {nome}?`; se a troca veio de um momento "quer entrar" (já existe `incoming`): `Quem sai para a entrada de {nome}?`.
- Botão de fechar no cabeçalho do `Modal`: `‹ Voltar` (`ChevronLeft` 16, `data-dialog-close`).
- Linha `.muted`: `{usedSubs} de 5 substituições utilizadas · ` + `Escolha o titular que deixa o campo.` (passo 1) ou `Escolha o reserva. B volta.` (passo 2).
- **Passo 1** (`.card-scroll > .card-grid`): 11 `PlayerCard` dos titulares atuais na ordem da formação, com `role` = função na formação, foco automático no 1º (goleiro). O `PlayerCard` mostra: **OVR** grande (`overall` na função) + **posição** (função se difere da natural), foto `PlayerFace`, nome curto (último sobrenome se o nome tem mais de 2 partes), selo de status `Lesão Nd`/`Suspenso N` se aplicável. Fundo por tier (`cardTier`): bronze < 65, prata 65–74, ouro 75–82, **ouro brilhante (`card-rare`) ≥ 83** com reflexo animado. Classe de grupo `gk/def/mid/att`. A prop `note` (`Cansaço {energySpent}`) e `number` são passadas mas **não renderizadas** pelo `PlayerCard`.
- **Passo 2** (`PlayerPicker`): reservas disponíveis do clube (não titulares, não substituídos, sem lesão/suspensão — `available`), divididos em `Recomendados para {função}` (posição natural cabe na função via `roleFits`) e `Demais reservas` (ordenados por posição e OVR), cada grupo precedido por `.grid-divider`. Primeiro card do grid é `button.player-card.empty` com `ArrowLeftRight` 28 + `Trocar quem sai` (foco automático, volta ao passo 1). Cards desabilitados se `usedSubs >= 5`.

### Estados e variações
- 0–5 trocas usadas; com 5, cards de reserva desabilitados (os titulares continuam clicáveis no passo 1).
- Goleiro só pode ser trocado por goleiro (validação na engine → toast de erro).
- Aberto por momento (`tired`/`injury`/`position`/`badday` → já define quem sai; `bench` → já define quem entra e pula para "quem sai").
- Sem reservas recomendadas: só "Demais reservas" com o botão "Trocar quem sai" no início.

### Interações
- Clique/A num titular → passo 2 (ou, se `incoming` definido, executa a troca e fecha).
- Clique/A num reserva → `onSubstitute(out, in)`: troca, evento `sub` na narração, resolve momentos relacionados, pode abrir momento `subbed` (jogador reclama) — fecha o modal.
- `Trocar quem sai` → volta ao passo 1.
- B (○)/Esc ou `‹ Voltar` → fecha **o modal inteiro** (limpa seleção). Obs.: o texto "B volta" no passo 2 sugere voltar um passo, mas B fecha tudo.
- D-pad navega na grade (Tab cicla dentro do modal no teclado); RS ▲▼ rola `.card-scroll`.
- O jogo continua pausado após fechar (o usuário precisa apertar Jogar).

---

## Modal interno 2 — Tática no jogo (`tactic === true`)

### Wireframe atual
```
┌ dialog.wide ─────────────────────────────────────────────────────────────┐
│ AJUSTAR O PLANO DE JOGO                                     ‹ Voltar      │
│ As mudanças afetam os próximos minutos. O jogo permanece pausado.         │
│ ┌ coluna 1 ───────────────────────┐ ┌ coluna 2 (1.3fr) ─────────────────┐ │
│ │ FORMAÇÃO                         │ │ 🛡 CAPITÃO EM CAMPO                │ │
│ │ [4-3-3][4-4-2][4-2-3-1][3-5-2]...│ │ ┌card┐┌card┐┌card┐ (compact)     │ │
│ │ MENTALIDADE                      │ │ │ C  ││    ││    │                 │ │
│ │ [Defensiva][Equilibrada][Ofensiva]│ │ └────┘└────┘└────┘ ... 11 cards  │ │
│ │ ┌Pressão     3 / 5┐┌Ritmo  3 / 5┐│ │                                   │ │
│ │ │■■■□□  X/✕ editar││■■■□□       ││ │                                   │ │
│ │ ┌Linha def.  3 / 5┐┌Largura 3/5 ┐│ │                                   │ │
│ └──────────────────────────────────┘ └───────────────────────────────────┘ │
```

### Elementos
- Título `Ajustar o plano de jogo`; `‹ Voltar`.
- `.muted`: `As mudanças afetam os próximos minutos. O jogo permanece pausado.`
- `.match-tactic` (grid `1fr | 1.3fr`):
  - **Formação** (`ChipGroup`, `role=radiogroup`): um chip por chave de `formations` (ex. `4-3-3`, `4-4-2`, `4-2-3-1`, `3-5-2` … todas as definidas em `types.ts`), ativo com `.active`/`aria-checked`.
  - **Mentalidade** (`ChipGroup`): `Defensiva`, `Equilibrada`, `Ofensiva`.
  - `.form-grid` com 4 `TacticSlider` (1 a 5): `Pressão`, `Ritmo`, `Linha defensiva`, `Largura`. Cada slider: rótulo, valor `n / 5` (com `‹ ›` quando editando), trilho de 5 segmentos (`.ts-track i.on`), dica `X/✕ editar` ou `← → ajustar · X/✕ salvar · B sair`.
  - **Capitão em campo**: rótulo `.control-label` com `Shield` 15 + `Capitão em campo`; `.card-grid.compact` com os 11 titulares (`PlayerCard`), o capitão atual com `.active` e selo `C`.
- Mudanças aplicam **na hora** em `career.tactic`/`career.roles` (`onChange`), sem confirmar/cancelar.

### Estados e variações
- Mudar a formação reatribui funções dos titulares (cards mostram nova função/OVR) e muda o desenho do campinho do usuário.

### Interações
- Chips: clique/A seleciona.
- Slider: A (✕) ou X (□) entra em edição (`data-toggle-edit`), ◄ ► ajusta (via `data-stepper`), A/X salva, B sai da edição (B não fecha o modal enquanto edita). Mouse: clicar num segmento define o valor.
- Card de capitão: clique/A define `roles['Capitão']`.
- B / `‹ Voltar` fecha. Jogo continua pausado.

---

## Modal interno 3 — Momento do jogo (`MomentDialog`)

### Resumo
Quando a engine abre um `MatchMoment` com `status: 'open'` (apenas para o clube do usuário, máx. 6 por jogo, intervalo ≥ 8 min entre momentos "não-lesão", nada após 88'), o relógio para, o controle vibra (`moment`) e abre este modal (exceto se Substituição/Tática estiverem abertos).

### Wireframe atual
```
┌ dialog.wide ─────────────────────────────────────────────────────────────┐
│ MOMENTO DO JOGO · 63'                                       ‹ Voltar      │
│ ┌ .moment-player (190px) ┐ ┌ .moment-talk ────────────────────────────┐   │
│ │ ┌ PlayerCard ─────────┐│ │ ▶PEDE SUBSTITUIÇÃO◀ (tag na cor do tom)  │   │
│ │ │ 78  ST   (foto)     ││ │ ┃ 💬 “Professor, tô no limite. A perna   │   │
│ │ │ PEDRO               ││ │ ┃    não responde mais, me tira!”        │   │
│ │ └─────────────────────┘│ │ ┃    — Pedro Silva                       │   │
│ │ FÔLEGO  MORAL  RELAÇÃO  │ │ [SUBSTITUIR        ][MAIS UM ESFORÇO   ] │   │
│ │  41%     72     65      │ │ [Escolher quem entra][Risco de lesão sobe]│   │
│ └─────────────────────────┘ └──────────────────────────────────────────┘   │
```

### Elementos
- Título: `Momento do jogo · {minuto}'`.
- Coluna do jogador: `PlayerCard` (sem clique), e `<dl>` com 3 caixas (borda inferior na cor do tom): `Fôlego` = `max(0, fitness − energySpent)%`, `Moral` (0–100), `Relação` (0–100).
- Coluna da fala: `.moment-tag` (faixa com corte diagonal, cor do tom), `<blockquote>` com `MessageCircle` 22, fala entre aspas curvas (display 20–28px) e `— {nome}`.
- **Tons** (`.moment-dialog.tone-*`): `warn` laranja, `danger` vermelho, `info` ciano, `good` lima.
- **Tipos, tags, falas possíveis e ações** (botões `.moment-actions`, cada um com `<strong>` rótulo em caixa alta + `<small>` dica; primário = `.primary`; `off` = desabilitado; foco automático no primeiro habilitado):

| kind | Tag / tom | Exemplos de fala | Ações (rótulo — dica) |
|---|---|---|---|
| `tired` | Pede substituição / warn | "Professor, tô no limite. A perna não responde mais, me tira!" | **Substituir** — Escolher quem entra (off se 5 trocas); Mais um esforço — Risco de lesão sobe |
| `injury` | Lesão em campo / danger | "Senti a coxa, professor! Não sei se dá pra continuar..." | **Substituir** — Preservar o atleta; Manter no sacrifício — Rende menos e agrava a lesão |
| `position` | Pede outra posição / info | "Professor, eu rendo muito mais de {centroavante}. Me deixa jogar lá!" | **Jogar de {FUNÇÃO}** — Troca de função com um companheiro / Sem vaga compatível agora (off se não há troca); Tirar do jogo — Substituir o atleta; Manter onde está — Moral e relação caem |
| `subbed` | Reclamou da substituição / danger | "Por que eu, professor?! Eu tava bem no jogo!" | **Explicar a decisão** — Conversa rápida à beira do campo; Ignorar — Moral e relação caem |
| `bench` | Quer entrar no jogo / good | "Professor, me coloca! Eu vou fazer a diferença, confia em mim!" | **Colocar em campo** — Escolher quem sai; Ainda não — Ele fica frustrado |
| `badday` | Dia ruim / warn | "Tô travado, professor. A cabeça não tá aqui hoje." / "De {pos}? Não tá rolando…" | **Dar confiança** — Pode destravar o jogo dele; Substituir — Tirar a pressão dele; Seguir assim — Ele continua sem confiança |

- A fala também entra na narração como `💬 {nome}: “{fala}”`.

### Estados e variações
- Botões de substituição desabilitados com 5 trocas usadas.
- O momento fica pendente se o usuário abrir Substituir/Tática por cima (o modal some e volta depois).

### Interações
- A (✕)/clique numa ação: ações "Substituir/Tirar do jogo/Colocar em campo" abrem o modal de Substituição já com o jogador pré-selecionado (saindo ou entrando); as demais chamam `resolveMoment` (`insist`, `swap`, `ignore`, `talk`, `support`) e o modal fecha.
- B (○)/Esc/`‹ Voltar`: **fecha escolhendo o padrão** — `insist` para `tired`/`injury`, `ignore` para os demais (penaliza moral/relação).
- D-pad entre os botões de ação. Depois de resolver, o jogo **retoma sozinho** se estava rodando (`playing` continua `true`).

---

## Classes CSS e visual atual (src\styles.css)

- `.match-screen` (gap 10px), `.match-strip` (L2579).
- `.scoreboard` (L2586: gradiente azul→marinho→rosa, padding 10×24, sombra), `.score-center` (`strong` caixa branca 44–72px, `span` azul, `time` lima 20px), `.live-dot` / `.live-dot.paused` (L718–730).
- `.match-layout` (L2644: grid `1.6fr | minmax(220px,.8fr) | minmax(240px,1fr)`).
- `.live-field-panel` (borda topo lima), `.live-field` (gramado listrado, borda branca 2px, sombra interna), `.field-half`, `.field-circle`, `.field-box.left/.right`, `.field-small`, `.field-goal`, `.field-dot` (+ `.away`, `.keeper`, `.with-ball`), `.ball-dot`.
- `.match-timeline`, `.timeline-track` (`i` preenchimento ciano→lima; `span` ● amarelo).
- `.match-controls` (flex wrap gap 8), `.finish-match` (100%, 18px).
- `.match-stats` (borda topo ciano), `.match-stat` (valores display 800 20px; rótulo 13px; `meter` largura total), `.match-ratings`, `.rating-badge` (+ `.elite/.good/.ok/.meh/.bad`).
- `.match-analysis` (L6300: `svg` 100% × 90px).
- `.commentary-panel` (borda topo rosa), `.commentary-feed` (linhas grid 36px|1fr, fundo branco 5%; `.goal` gradiente lima; `.moment` gradiente ciano itálico; `time` ciano).
- `.ratings-panel`, `.mvp-banner` (gradiente `#f5c84299→#ff4fa333`), `.ratings-columns`, `.rating-row` (+ `.mvp`).
- Modais: `.modal-backdrop` (fundo `rgba(2,6,30,.72)` + blur 6px), `.dialog` (600px; `.wide` 980px; gradiente azul; **borda superior 4px lima**), `.dialog-heading h2` (itálico 800 28px caixa alta), `.dialog-body` (rolável).
- Substituição: `.card-scroll`, `.card-grid` (5 por linha), `.grid-divider`, `.player-card` (+ `.gk/.def/.mid/.att`, `.card-bronze/.card-silver/.card-gold/.card-rare`, `.active`, `.out`, `.empty`), `.pc-top`, `.pc-ovr`, `.pc-pos`, `.pc-face`, `.pc-name`, `.pc-meta`, `.pc-badge`. Tiers: bronze `#e7b083→#5e3313`, prata `#f1f5f8→#56636c`, ouro `#ffe590→#7a5512`, rara `#fff6c4→#6b3f00` com `::after` de brilho animado (`card-shine` 3,2 s).
- Tática: `.match-tactic` (L4232), `.chip-group`, `.chips`, `.tactic-slider` (+ `.editing`), `.ts-head`, `.ts-label`, `.ts-value`, `.ts-track`, `.ts-hint`, `.form-grid`, `.control-label`, `.card-grid.compact`.
- Momento: `.moment-dialog` (grid 190px|1fr, `--tone`), `.tone-warn/.tone-danger/.tone-good`, `.moment-player` (+ `dl`, `dt`, `dd` 22px), `.moment-talk`, `.moment-tag` (clip-path diagonal), `blockquote` (borda esquerda 5px na cor do tom, cantos 2/18px), `.moment-actions` (grid auto-fit ≥150px).
- **Responsivo**: `≤1100px` → `.match-layout` 2 colunas e **`.match-stats { display: none }`** (some o painel de números, as notas ao vivo **e a MatchAnalysis**); `≤760px` → 1 coluna, campinho com altura fixa 220px, placar compacto sem nomes dos clubes, `.match-stats` volta; `≤720px` → `.moment-dialog` 1 coluna.

## Regras que o redesign deve preservar

1. O resultado vem **só** da engine (1 minuto por tick, `1400/speed` ms); o campinho é ilustrativo e deve continuar marcado assim (`aria-label`).
2. Pausas automáticas em 45' e 90'; tick suspenso com modal/momento/Pausa aberta.
3. Velocidades 1×/2×/4× (padrão 2×).
4. Máximo de 5 substituições; goleiro por goleiro; reservas indisponíveis (lesão, suspensão, já substituídos) não aparecem; recomendados por função (`roleFits`).
5. Fluxo de momentos: tipos, falas, ações, padrão ao fechar (`insist`/`ignore`) e integração com a substituição pré-selecionada.
6. Tática ao vivo altera `career.tactic` e capitão imediatamente.
7. Estatísticas posse/finalizações/xG/passes; narração com ícones por tipo; top notas; MVP; notas por time com gols/assistências/minutos; cores `ratingTone`.
8. MatchAnalysis (xG acumulado nós × rival e explicações) visível no pós-jogo.
9. Saída somente por `Confirmar resultado…` (que dispara a coletiva) ou salvar e sair.
10. Vibração atual (padrões `goal`, `concede`, `whistle`, `moment`) — o usuário considera **ótima**; manter.
11. Navegação total por controle; B = Pausa fora de modais; B fecha modais.

## Problemas atuais e oportunidades

1. **Som de gol "estourado"**: o gol a favor soma murmúrio a 0,75 + camada de ruído (`roar`) + bumbo/palmas sintéticos + TTS do navegador, tudo num compressor leve — resultado saturado e artificial. O usuário quer **narrador gritando gol** (estilo Galvão/rádio). Oportunidade: amostras gravadas (narração "GOOOOL" + torcida real), limiter de verdade, ducking da torcida durante a narração; manter o TTS só como fallback. Gol sofrido também precisa de som mais crível.
2. **Fase incorreta**: com momento aberto ou Pausa aberta a fase segue `AO VIVO` com dot pulsante, embora o relógio esteja parado.
3. **Painel de números some entre 761–1100px** (incluindo MatchAnalysis e notas) — perda grave em notebooks/TV com zoom.
4. **Sem atalhos de controle**: FIFA usa botões dedicados (ex.: R1 = substituições, L1 = tática, □ = velocidade, OPTIONS = pausa). Aqui tudo exige navegar por foco; X/Y/LB/RB/LT/RT ficam inertes durante a partida. Ideal: X = Jogar/Pausar, Y = Substituir, LB/RB = velocidade, LT/RT = alternar painel (Números/Narração/Notas).
5. **Placar não usa as cores dos clubes** (gradiente fixo azul/rosa) e não há "bug" de TV compacto estilo FIFA (sigla + placar + relógio no canto); o relógio não tem segundos/acréscimos.
6. Pré-início sem cerimônia: não há tela de escalações lado a lado, árbitro, estádio/clima, nem apito sonoro inicial. Intervalo sem resumo do 1º tempo/conversa de vestiário.
7. Timeline marca todos os gols com a mesma cor; não mostra cartões, lesões, substituições nem momentos.
8. `PlayerCard` recebe `note` (cansaço) e `number`, mas não renderiza — no modal de substituição **o cansaço não aparece**, justamente o dado mais importante. Precisa barra de fôlego no card (FIFA mostra a barra verde/amarela/vermelha).
9. Texto "Escolha o reserva. B volta." é enganoso: B fecha o modal inteiro.
10. `xG` usa ponto decimal (`1.42`) enquanto o resto do jogo é pt-BR; posse no gráfico `meter` nativo (visual de navegador).
11. Gráfico de xG sem eixos, minutos, marcadores de gol ou legenda colorida; frase do "por quê" sem destaque visual.
12. Após o 90', os botões desabilitados continuam visíveis; o botão de confirmar não recebe foco automático.
13. Narração só em texto; ícones são emoji; eventos de substituição sem ícone; não há destaque de "lance perigoso" no campinho.
14. Campinho: atletas como bolinhas numeradas; oportunidade de aproximar do radar do FIFA (setas de ataque, nomes ao passar, cores de camisa reais/2º uniforme quando cores colidem — hoje dois clubes de cor parecida ficam indistinguíveis).
15. **100% FIFA-like**: cards com foto e tier (bronze/prata/ouro/ouro brilhante) nos modais de substituição, capitão e momento (já existem); aplicar o mesmo nas notas pós-jogo e no MVP (card grande dourado "Craque do Jogo").
16. Popups devem fechar sozinhos sem X (preferência do usuário): toasts/avisos já somem; aqui os modais usam `‹ Voltar` textual — manter acessível ao controle (B).
