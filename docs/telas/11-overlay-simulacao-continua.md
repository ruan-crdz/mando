# Tela: Overlay de Simulação Contínua

## Resumo

Faixa flutuante (`{running && career && (<div className="advance-overlay">)}` em `src\App.tsx`) exibida enquanto o calendário avança sozinho nos modos **"Parar em eventos"** (`event`) e **"Nunca parar"** (`auto`). Mostra a data atual, o que está acontecendo, quantos jogos foram simulados e um botão **Parar**. Ao parar por evento, mostra um toast (notice) e leva o jogador ao lugar certo (pré-jogo, Escritório).

## Como se chega / como se sai

**Inicia**: `advance()` com `career.prefs.advance` = `event` ou `auto` → `setPlayed(0)`, `setRunning(true)`. Disparado por:
- Tile de avanço da Central (clique/✕);
- **□ / X** em qualquer aba da carreira, fora de partida e sem popup.

**Termina**:
- Parada automática (`result.stop` do `advanceStep`), ver tabela abaixo;
- Parada manual: botão "Parar", ou **□/X, ✕/A, ○/B, START** (o provedor do controle detecta `[data-stop-run]` e clica nele), `Esc` (back → para);
- Erro na simulação → para + toast de erro (4 s).

## Arquivos-fonte

- `src\App.tsx` — estados `running`/`played`, `advance()`, efeito do loop (`useEffect` com `setTimeout` de 110 ms), `stopNotes`, bloco `.advance-overlay`, toasts (`notice`/`error`), `useControllerActions` (secondary/back/menu → parar).
- `src\game\engine.ts` — `advanceStep(career, base, mode)` (~l. 1036), `advanceDay`, `simulateOwnMatch`.
- `src\controller\GamepadProvider.tsx` — interceptação `[data-stop-run]` para secondary/confirm/back/menu (vibra `back`).
- `src\components\ui.tsx` — `longDate`/formatação de data.
- `src\styles.css` — `.advance-overlay` (~l. 5652–5672), `.toast` (~l. 3100+).

## Wireframe atual (ASCII)

```
   (tela da carreira continua visível e interativa por baixo)

          ┌──────────────────────────────────────────────────────────┐
          │ 🗓   SÁBADO, 14 DE MARÇO DE 2026                [■ PARAR] │
          │      Simulando a temporada · 3 jogos simulados           │
          └──────────────────────────────────────────────────────────┘
                         (centralizado, 70 px acima da base)

Toast ao parar (topo central):   [ Dia de jogo! O avanço parou. ]
```

## Elementos

- `div.advance-overlay` (`role="status"`):
  - Ícone `CalendarClock` (42).
  - `strong`: data atual da carreira por extenso (22 px), atualiza a cada passo.
  - `span`: "Simulando a temporada" (modo `auto`) ou "Avançando até o próximo evento" (modo `event`), seguido de " · {n} jogo simulado" / " · {n} jogos simulados" quando `played > 0` (na prática só cresce no `auto`, que joga as partidas).
  - `button.primary[data-autofocus][data-stop-run]`: ícone `Square` (16) + "Parar" → `setRunning(false)`.

### Loop
- A cada 110 ms: `advanceStep(career, base, mode)` (`mode = 'auto'` se `prefs.advance === 'auto'`, senão `'event'`), `setCareer(result.career)`, `played++` se `result.played`.
- Lógica do passo: temporada encerrada → para (`season`); demitido → `sacked`; `auto` responde todas as decisões pendentes com "apoio"; `event` com decisão pendente → `decision`; dia de jogo: `event` → `match`; `auto` → simula a partida (escala o melhor time se necessário) e segue; senão avança um dia; após o dia, no `event`: jogo hoje → `match`, decisão → `decision`, mensagem nova → `message`.

### Paradas (notices — toast verde, 2,6 s, sem X) e destino

| stop | Toast | Para onde vai |
|---|---|---|
| match | "Dia de jogo! O avanço parou." | Abre o popup "Dia de jogo" (pré-jogo). |
| decision | "Uma decisão espera por você no escritório." | Aba Escritório (3). |
| message | "Nova mensagem no escritório." | Aba Escritório (3). |
| season | "Temporada encerrada." | Permanece (Central mostra fim de temporada). |
| sacked | "Você foi demitido. Escolha um novo clube na Diretoria." | Aba Escritório (3). |

Toda parada automática vibra `whistle`. Parada manual não mostra toast. Conquistas desbloqueadas durante a simulação aparecem no toast de conquista.

## Estados e variações
- Modo `event` × `auto` (texto do `span`).
- Com/sem contador de jogos.
- Durante a simulação a `main` **não** fica `inert`: dá para clicar em outros elementos, trocar de aba (L1/R1), ir ao Escritório (△/Y) e trocar sub-abas (L2/R2). Clicar de novo no tile de avanço reinicia o contador.
- O rodapé de dicas continua mostrando "Avançar dia".

## Interações

### Mouse / teclado
- Clique em "Parar". `Esc` para. Enter com foco no botão para (o botão recebe o foco ao aparecer).

### Controle

| Botão PS5 | Botão Xbox | Ação durante a simulação |
|---|---|---|
| □ | X | Para. |
| ✕ | A | Para (interceptado via `data-stop-run`). |
| ○ | B | Para. |
| Options | ☰ | Para. |
| L1 / R1 | LB / RB | Troca de aba (não bloqueado). |
| △ | Y | Vai ao Escritório (não bloqueado). |
| L2 / R2 | LT / RT | Troca sub-visões da tela atual. |

## Classes CSS e visual atual

- `.advance-overlay`: `position: fixed`, centralizado horizontalmente, `bottom: 70px`, `z-index: 60`, flex com gap 16, padding 14×22, **raio 16 px**, degradê `#0d1f52f2 → #1b3b8ff2`, sombra grande. `strong` 22 px display; `span` muted.
- Botão "Parar": `button.primary` (lime).
- `.toast`: fixo topo central (`top: 76px`, `z-index: 70`); sucesso verde 2,6 s, erro vermelho 4 s.

## Regras que o redesign deve preservar

1. Indicação clara de que está simulando, com data atual ao vivo e contador de jogos.
2. Parar com qualquer botão principal do controle (□, ✕, ○, START) e com o mouse.
3. Cinco motivos de parada com os textos e destinos acima; avisos que somem sozinhos (2–3 s, sem X) com vibração.
4. Ritmo de 110 ms por dia (sensação de "calendário correndo").

## Problemas atuais e oportunidades

1. Faixa pequena e genérica; no FIFA o "Sim to next event" é uma tela/painel com calendário passando, próximo compromisso e resultados. Oportunidade: mini-calendário animado, próximo evento, e lista dos resultados simulados (placar, adversário).
2. No modo `event` o contador nunca aparece (não joga partidas); poderia mostrar dias avançados.
3. Sem resumo ao parar (ex.: "12 dias · 3 jogos: V 2×0, E 1×1, D 0×1").
4. Parada manual sem nenhum feedback.
5. A tela por baixo continua interativa (cliques/troca de aba), podendo confundir; definir se a simulação deve bloquear ou esmaecer o fundo.
6. Raio 16 px destoa do visual anguloso; o rodapé de dicas não muda para "Parar".
