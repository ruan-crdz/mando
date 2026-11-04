# Tela: Sala de imprensa (coletiva)

## Resumo

Modal `Sala de imprensa` (componente `PressConference` no fim de `src\App.tsx`) em que o técnico responde, uma por vez, às perguntas de jornalistas fictícios. Existem dois modos:
- **Pós-jogo** (automático ao confirmar o resultado de uma partida): 2 ou 3 perguntas — resultado, um jogador (pior nota ou destaque) e a temporada.
- **Pré-jogo** (opcional, pelo popup Dia de jogo): 3 perguntas — prioridade, tática e vestiário.

Cada pergunta mostra repórter + veículo + texto, é **lida em voz alta** (TTS do navegador com clique de telefone e chiado de linha) e oferece **3 respostas com tom** (ex.: Humilde / Confiante / Exigente). Responder avança; após a última, as respostas são aplicadas (confiança da diretoria, moral do elenco e/ou de um atleta, relação com o repórter, manchete na semana, notícia no Escritório). Pode-se sair a qualquer momento (B / `‹ Voltar` = pular).

## Como se chega / como se sai

**Chegar**
- **Pós-jogo**: tela de Partida (doc 15) → minuto 90 → `Confirmar resultado e voltar à central` → `buildPress(career, world)` (antes de `finishMatch`) → aba Central + modal aberto na pergunta 1. Se `buildPress` falhar, não há coletiva (silencioso).
- **Pré-jogo**: popup Dia de jogo (doc 16) → `Coletiva pré-jogo` → `buildPreMatchPress`; se retornar `null` (sem partida hoje) → toast de erro `Não foi possível iniciar a coletiva pré-jogo.`.
- Estado no App: `press` (sessão), `pressStep` (índice), `pressAnswers` (`{ idPergunta: índiceResposta }`), zerados a cada abertura.

**Sair**
- **Responder a última pergunta** → `stopVoice()`, `applyPress(...)`, fecha, toast `Coletiva encerrada. A repercussão está no Escritório.` (some sozinho).
- **Pular** (`‹ Voltar` no cabeçalho / B (○) / Esc) → `stopVoice()`; se já respondeu alguma, aplica **só as respondidas**; fecha **sem toast**. Não há botão "Pular" explícito com esse nome.
- Ao fechar, fica na aba onde estava (Central). No pré-jogo, o popup Dia de jogo **não** reabre.

## Arquivos-fonte

- `src\App.tsx` — componente `PressConference` (≈L1184–1250) e montagem com `onAnswer`/`onSkip` (≈L991–1015); `onFinish` da partida (≈L540–556); botão no popup prematch (≈L1092–1102); barra de voz global `.voice-bar` (≈L819).
- `src\game\press.ts` — `buildPress`, `buildPreMatchPress`, `applyPress`, lista de repórteres, perguntas, respostas, tons e efeitos.
- `src\components\voice.ts` — `playVoice`, `stopVoice` (TTS + clique de telefone + chiado).
- `src\components\ui.tsx` → `Modal`.
- `src\game\matchRatings.ts` (notas usadas na pergunta do jogador), `src\game\engine.ts` (`standings`), `src\game\calendar.ts` (`fixtureLabel`, `competitionName`).

## Wireframe atual (ASCII)

```
┌ .dialog.wide (980px, gradiente azul, borda superior lima 4px) ─────────────────┐
│ SALA DE IMPRENSA                                                ‹ Voltar        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ COLETIVA · FLAMENGO 2 X 1 PALMEIRAS                       (eyebrow)             │
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬     (.press-progress: done/active/—) │
│ ┃ ┌────────────────────────────────────────────────────────────────────────┐    │
│ ┃ │ 🎙  Caio Ferraz                                                        │    │
│ ┃ │     RÁDIO ARQUIBANCADA                                                 │    │
│ ┃ │     Vitória por 2 a 1 sobre o Palmeiras. O que decidiu o jogo hoje?    │    │
│ ┃ └────────────────────────────────────────────────────────────────────────┘    │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐      │
│ │ HUMILDE              │ │ CONFIANTE            │ │ EXIGENTE             │      │
│ │ Mérito todo dos      │ │ Foi o plano tático   │ │ Ainda não estou      │      │
│ │ jogadores. Eles ...  │ │ que venceu. ...      │ │ satisfeito. ...      │      │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘      │
│ Suas respostas mexem com a confiança da diretoria e o moral do elenco.          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                   ┌ .voice-bar (fora do modal, canto da tela) ┐
                                   │ 📻 RECADO  Caio Ferraz     [■ Parar]       │
                                   └────────────────────────────────────────────┘
```

## Elementos

### 1. Cabeçalho do Modal
- `<h2>` `Sala de imprensa` (itálico 800 28px, caixa alta).
- `‹ Voltar` (`ChevronLeft` 16, `data-dialog-close`) → `onSkip` (pular coletiva).

### 2. Manchete (`p.eyebrow`)
- Pós-jogo: `Coletiva · {Seu clube} {seus gols} x {gols rival} {Rival}` (placar sempre do ponto de vista do usuário).
- Pré-jogo: `Pré-jogo · {Seu clube} x {Adversário}`.

### 3. Progresso (`.press-progress`)
- Uma barra (6px de altura, flex 1) por pergunta; `aria-label="Pergunta {n} de {total}"`.
- Respondidas: `.done` ciano; atual: `.active` gradiente ciano→amarelo `#ffd400`; futuras: branco 18%.
- Sem número visível ("1/3") — só barras.

### 4. Pergunta (`.press-question`)
- Caixa com gradiente ciano 28% → marinho e **borda esquerda ciano 5px**, padding 16×18.
- `span.press-mic` emoji `🎙` 34px (`aria-hidden`).
- `<strong>` nome do repórter (fonte display 20px).
- `<small>` veículo (11px caixa alta, espaçado, opacidade .75).
- `<p>` texto da pergunta (18px, 600).
- **Repórteres** (escolhidos de forma determinística por partida via hash; podem repetir entre perguntas):
  | Repórter | Veículo |
  |---|---|
  | Marina Lopes | Rede Bola |
  | Caio Ferraz | Rádio Arquibancada |
  | Júlia Andrade | Portal Lance Livre |
  | Rafael Teles | TV Esporte Total |
  | Bruna Siqueira | Jornal da Torcida |
  | Diego Paiva | Canal Resenha FC |
- Sem foto/avatar de repórter nem logo do veículo.

### 5. Respostas (`.press-answers`)
- Grid de **3 colunas** (1 coluna ≤ 760px). Cada `button.press-answer` (altura mín. 120px, padding 14, texto à esquerda):
  - `<b>` **tom** em caixa alta, fonte display, **ciano**; vira **amarelo `#ffd400`** quando o botão tem foco.
  - `<span>` texto completo da fala.
  - `.active` se aquela resposta já foi escolhida (só visível se o usuário voltar… o que não é possível; na prática nunca aparece).
  - Primeiro botão tem `data-autofocus` → foco inicial em cada pergunta.
- **Efeitos não são exibidos** (o jogador não vê +/− de moral/confiança).

### 6. Rodapé
- `p.muted.small`: `Suas respostas mexem com a confiança da diretoria e o moral do elenco.`

### 7. Voz (fora do modal)
- Ao mostrar cada pergunta: `playVoice([{ title: repórter, text: pergunta, voice: 'reporter' }])` → clique de telefone (dois bipes quadrados 1800→300 Hz), chiado de linha telefônica baixo (ruído passa-banda 1700 Hz), e após 260 ms a fala via **Web Speech API** do navegador (voz pt-BR, prefere voz **masculina** "Antonio/Daniel…" mesmo para repórteres mulheres; pitch 0,85, rate 1). Texto passa por `speakable` ("2 x 1" → "2 a 1", " x " → " contra ", emojis removidos).
- Exibe a `.voice-bar` global (role status): ícone `Radio` pulsante, `<small>` `Recado`, `<b>` nome do repórter, botão `■ Parar` (`aria-label="Parar caixa postal"`). Ela fica **fora** do escopo de foco do modal (o `main` está inerte e o FocusManager só navega no modal) → **inalcançável pelo controle** durante a coletiva.
- Responder/pular interrompe a fala (`playVoice` seguinte chama `silence()`; ao terminar/pular `stopVoice()`).

---

## Conteúdo por modo (o que pode aparecer)

### Modo Pós-jogo (`buildPress`, `mode: 'post'`)

**Pergunta 1 — Resultado** (`id: result`)
- Textos:
  - Goleada (vitória por ≥ 3): `Goleada de {x a y} contra o {Rival}. O {Clube} chegou ao nível que você queria?`
  - Vitória: `Vitória por {x a y} sobre o {Rival}. O que decidiu o jogo hoje?`
  - Empate: `Empate em {x a y} com o {Rival}. Ficou um gosto amargo ou foi um bom ponto?`
  - Derrota pesada (≥ 3): `Derrota pesada, {x a y} para o {Rival}. A torcida já pede explicações. O que aconteceu?`
  - Derrota: `Derrota por {x a y} para o {Rival}. Onde o time errou?`
- Respostas (tom — texto — efeito interno):
  - Vitória: **Humilde** — "Mérito todo dos jogadores. Eles executaram o plano à risca." (elenco +4, diretoria +1) · **Confiante** — "Foi o plano tático que venceu. Preparamos cada detalhe dessa partida." (diretoria +3, elenco −1) · **Exigente** — "Ainda não estou satisfeito. Dá para jogar muito mais." (diretoria +2, elenco −2)
  - Empate: **Positivo** — "Ponto importante fora de qualquer contexto. O grupo lutou até o fim." (elenco +3) · **Duro** — "Perdemos dois pontos. Não aceito esse tipo de desatenção." (diretoria +2, elenco −3) · **Equilibrado** — "O empate foi justo. Vamos corrigir os detalhes no treino." (diretoria +1, elenco +1)
  - Derrota: **Protetor** — "A responsabilidade é minha. Eu errei na preparação, não os jogadores." (elenco +5, diretoria −3) · **Cobrança** — "Faltou atitude. Quem não estiver comprometido vai perder espaço." (elenco −5, diretoria +3) · **Sereno** — "Futebol tem dias assim. Vamos levantar a cabeça e virar a página." (elenco +1)

**Pergunta 2 — Jogador** (`id: player`, opcional; ligada a um atleta `playerId`)
- Se o pior atleta do usuário com ≥ 45 min teve nota < 6,2 (e não foi vitória com destaque): `{Nome} teve nota {n.n} e foi muito criticado nas redes. Ele segue com sua confiança?`
  - **Apoio** — "Total. {Nome} é peça importante e vai dar a volta por cima." (atleta +10) · **Firme** — "Ninguém tem lugar garantido. Quem render mais, joga." (atleta −8, diretoria +2, elenco +1) · **Neutro** — "Não vou falar de individualidades. Ganhamos e perdemos juntos." (atleta +2)
- Senão, destaque (MVP do usuário ou maior nota): `{Nome} foi o destaque, com {N gol(s) | nota n.n}. Ele já merece uma chance na seleção?`
  - **Elogio** — "Sem dúvida. {Nome} é um dos melhores do país na posição." (atleta +10, elenco −1) · **Cauteloso** — "Ele jogou bem, mas precisa manter isso por muitos jogos." (atleta +3, diretoria +1) · **Coletivo** — "O destaque foi o coletivo. Sem o grupo ninguém brilha." (atleta −2, elenco +3)
- O jogador citado **não aparece** em foto/card no modal (só o nome no texto).

**Pergunta 3 — Temporada** (`id: season`)
- Jogo de copa: `Pensando na {Copa}: o {Clube} entra para ser campeão?`
- Liga, top 4: `O {Clube} está em {pos}º na Série {A|B}. Dá para falar em título?`
- Liga, 15º ou pior: `O {Clube} está em {pos}º, perto da zona de rebaixamento. Você teme pelo cargo?`
- Demais: `Na {pos}ª posição da Série {A|B}, qual é a meta real da temporada?`
- Respostas: **Ambicioso** — "Viemos para ganhar tudo. Esse grupo tem tamanho para isso." (diretoria +3, ou −2 se 12º+ em jogo de liga; elenco +2) · **Pé no chão** — "Jogo a jogo. Não adianta olhar a tabela agora." (diretoria +1) · **Pressão** — "Precisamos de reforços para brigar lá em cima. A diretoria sabe disso." (diretoria −4, elenco −1)

### Modo Pré-jogo (`buildPreMatchPress`, `mode: 'pre'`)
1. **Prioridade** (`expectation`): `O {Clube} enfrenta o {Adversário} pela {Competição}. Qual é a prioridade da equipe?` — **Equilibrado** "Vamos competir com intensidade e respeitar nosso plano." · **Confiante** "A vitória é obrigação. Não aceitamos outro resultado." · **Cauteloso** "O adversário é favorito; precisamos ser pacientes."
2. **Tática** (`tactics`): `Seu time vem com {formação} e postura {mentalidade em minúsculas}. A estratégia pode mudar durante o jogo?` — **Flexível** "Temos um plano, mas vamos reagir ao que acontecer em campo." · **Firme** "Nossa identidade não muda por causa do adversário." · **Reservado** "Vamos avaliar a partida antes de expor nossos ajustes."
3. **Vestiário** (`players`): `A torcida espera uma grande atuação. O que você pediu aos jogadores no vestiário?` — **Motivador** "Que joguem juntos e façam o simples com qualidade." · **Exigente** "Que assumam a responsabilidade e decidam o jogo." · **Leve** "Que aproveitem a oportunidade e se divirtam em campo."

### Consequências (aplicadas no fim; nenhuma é mostrada no modal)
- **Confiança da diretoria** (`career.confidence`, 0–100) soma os `confidence`.
- **Moral do elenco** inteiro (`squad`) e do atleta citado (`player`), limitados 0–100.
- **Relação com o repórter** (`living.media[repórter]`, base 50): tons calorosos (Apoio, Elogio, Leve, Humilde, Positivo, Sereno) +4; duros (Duro, Cobrança, Pressão, Exigente) −5; Reservado −2; demais +1.
- Tom duro numa pergunta sobre jogador → **relação do atleta −6**.
- Tom duro ou **Ambicioso** → **manchete da semana** (`living.headline`, 7 dias): `"{trecho da fala até 90 caracteres}": fala do técnico repercute`.
- **Notícia no Escritório** (mensagem de `Imprensa`, tipo news, não importante): título `{Nome do técnico} na coletiva: {início da 1ª fala}…`; corpo `Antes do jogo|Após o jogo, o técnico do {Clube} falou aos jornalistas. "{fala1}" "{fala2}" …`. Id fixo por partida (refazer coletiva da mesma partida gera mesma id).
- Pular sem responder nada → nenhum efeito.

## Estados e variações

| Estado | Diferença visual |
|---|---|
| Pergunta 1 de N | 1ª barra `active`, demais apagadas; voz tocando; `.voice-bar` visível |
| Pergunta intermediária | barras anteriores `done` ciano |
| Pós-jogo com 2 perguntas | quando não há pergunta de jogador (sem destaque e sem nota baixa) |
| Pré-jogo | eyebrow "Pré-jogo · …"; sempre 3 perguntas |
| Sem suporte a voz | sem fala/clique; `.voice-bar` não aparece |
| ≤ 760px | respostas empilhadas em 1 coluna, sem altura mínima |
| Fim | modal fecha, toast verde "Coletiva encerrada…" |

## Interações

| Entrada | Ação |
|---|---|
| Mouse | Clique numa resposta → registra e avança (sem confirmação). Clique em `‹ Voltar` → pula. |
| Teclado | Setas movem foco entre as 3 respostas e `‹ Voltar`; Enter/Espaço responde; Esc pula. |
| D-pad / LS | ◄ ► entre respostas; ▲ vai para `‹ Voltar`. Vibração `move`. |
| A (✕) | Responde com o botão focado; vibração `confirm`. |
| B (○) | Clica `‹ Voltar` → **pula a coletiva** (aplica respostas já dadas). |
| START / ☰ | Abre popup de Pausa por cima (a coletiva continua montada por trás). |
| X, Y, LB/RB, LT/RT | Sem efeito. |
| RS ▲▼ | Rola o corpo do modal se houver overflow. |

- A cada pergunta o foco volta para a **primeira resposta** (`data-autofocus`).
- Não dá para voltar à pergunta anterior nem mudar a resposta.
- O botão `Parar` da voz não é alcançável pelo controle (fica fora do modal); a fala é cortada ao responder.

## Classes CSS e visual atual (src\styles.css)

- `.modal-backdrop`, `.dialog.wide` (980px, gradiente azul, borda superior lima 4px), `.dialog-heading`, `.dialog-body`.
- `.press-room` (L5672) — grid gap 14px.
- `.press-progress` (L5676) / `i` / `i.done` (ciano) / `i.active` (gradiente ciano→`#ffd400`).
- `.press-question` (L5691) — flex, gradiente `rgba(0,170,255,.28)` → `rgba(4,11,51,.6)`, borda esquerda 5px ciano; `strong` display 20px; `small` 11px caixa alta; `p` 18px 600.
- `.press-mic` — 34px.
- `.press-answers` (L5720) — grid 3 colunas, gap 10.
- `.press-answer` (L5725) — grid, min-height 120px, padding 14, texto à esquerda; `b` display caixa alta ciano; foco → `b` amarelo `#ffd400`; ≤760px 1 coluna.
- `.muted.small` — rodapé.
- `.voice-bar` — barra flutuante global com `Radio` pulsando.
- `.toast.success` — aviso de encerramento.

## Regras que o redesign deve preservar

1. Pós-jogo automático após confirmar o resultado; pré-jogo opcional pelo Dia de jogo.
2. Uma pergunta por vez, 3 respostas com **tom** visível + texto completo; avanço imediato ao responder.
3. Ordem e conteúdo das perguntas/repórteres/veículos vindos de `press.ts` (determinísticos por partida).
4. Progresso de perguntas visível.
5. Pular a qualquer momento (B), aplicando só as respostas já dadas; finalizar aplica tudo e avisa "Coletiva encerrada. A repercussão está no Escritório.".
6. Leitura em voz da pergunta, interrompida ao responder/pular.
7. Foco inicial na primeira resposta; 100% navegável no controle.

## Problemas atuais e oportunidades

1. **Cenário pobre para "100% FIFA-like"**: sem fundo de sala de imprensa (painel de patrocinadores, microfones, flashes), sem avatar do repórter nem logo do veículo; o emoji 🎙 é o único elemento gráfico.
2. **Jogador citado sem card**: na pergunta 2 deveria aparecer o card FIFA do atleta (foto, OVR, tier bronze/prata/ouro/ouro brilhante, nota do jogo).
3. **Consequências invisíveis**: o jogador não sabe o impacto. Oportunidade: ícones de tendência discretos por resposta (diretoria ↑/↓, elenco ↑/↓, atleta ↑/↓, imprensa ↑/↓) ou um resumo final de repercussão antes de fechar (que pode **fechar sozinho** após alguns segundos, conforme preferência do usuário por popups sem X).
4. **Pular é escondido**: só `‹ Voltar`/B; não há rótulo "Pular coletiva"/"Encerrar" nem dica de botão. Exibir a legenda de botões do controle (A responder · B pular).
5. **Voz**: TTS escolhe voz masculina até para repórteres mulheres (Marina, Júlia, Bruna); `Parar` inacessível no controle; não há legenda sincronizada. Oportunidade: voz por gênero/repórter ou áudio gravado; tecla dedicada (Y) para repetir/silenciar.
6. Barras de progresso sem "Pergunta 2 de 3" escrito.
7. Classe `.active` em respostas nunca é visível (não há como revisitar pergunta).
8. No pré-jogo, ao terminar a coletiva o usuário não volta ao Dia de jogo — fluxo quebrado (ver doc 16).
9. Toast só aparece ao concluir; ao pular nada é dito, mesmo quando respostas parciais foram aplicadas.
10. Notícia no Escritório usa id fixo por partida — fazer a coletiva pré-jogo e pós-jogo da mesma partida gera ids diferentes? (pré usa `fixture.id`, pós usa `match.fixtureId` = mesmo valor) → **a mensagem pós-jogo pode colidir com a do pré-jogo** (mesma id). O redesign não deve depender de ambas aparecerem.
