# Tela: Popup de Preferências de Avanço

## Resumo

Modal largo com três opções para o comportamento do calendário. No Ato 3, usa painel grafite fumê, cards angulosos e escolha ativa petróleo/ciano, com composição priorizada para desktop e controle.

A preferência continua em `career.prefs.advance`, salva por carreira; padrão `day`. Não há alteração das regras de simulação.

## Como se chega / como se sai

**Abrir**

- START/Options/☰ na Central, fora de partida e sem popup.
- Botão com o modo atual no cabeçalho da Central.
- Avanço do calendário no modal de Pausa, fora de partida.

**Fechar**

- Escolher um card aplica, fecha para o jogo e mostra o toast `Avanço: {título}.`.
- Voltar, B/○/Esc ou START cancelam sem alterar o modo.
- **Ajuste de UX do Ato 3:** cancelar retorna à Pausa se as preferências foram abertas por ela; caso contrário retorna ao jogo. O `prefsFromPause` registra essa origem.

## Arquivos-fonte

- `src/App.tsx`: `advanceModes`, modal `prefs`, origem da abertura, escolha e atalhos.
- `src/components/ui.tsx`: `Modal`, foco e restauração.
- `src/controller/ControllerButtonHint.tsx`: glifo conforme dispositivo.
- `src/styles/legacy/06-hub.css`: `.hub-modal`, `.prefs-options`, `.pref-card`, `.pref-state`.
- `src/game/types.ts`: `'day' | 'event' | 'auto'`.
- `src/game/engine.ts`: `advanceDay` e `advanceStep`, sem alteração pelo redesign.

## Composição

```text
+-----------------------------------------------------------------------+
| PREFERÊNCIAS DE AVANÇO                                      < VOLTAR   |
| Escolha como o calendário progride ao usar [glifo] Avançar.             |
| +--------------------+ +--------------------+ +---------------------+ |
| | 1                  | | 2                  | | 3                   | |
| | UM DIA POR VEZ     | | PARAR EM EVENTOS   | | NUNCA PARAR         | |
| | explicação        | | explicação         | | explicação          | |
| | MODO ATIVO        | | SELECIONAR MODO    | | SELECIONAR MODO     | |
| +--------------------+ +--------------------+ +---------------------+ |
+-----------------------------------------------------------------------+
```

Modal `wide`, até 980 px. Em desktop, três colunas com cards de pelo menos 190 px; em mobile landscape, os cards reduzem para 150 px e mantêm as três opções lado a lado. Cantos de 3 px; cada card mostra número, título, explicação e estado. O ativo tem superfície petróleo, borda ciano e marcador inferior; os demais usam carvão.

`aria-pressed` indica a escolha persistida. `data-autofocus` fica no card ativo. O texto introdutório usa `ControllerButtonHint`, sem glifos fixos de PS5/Xbox. Números 1/2/3 são rótulos, não atalhos.

## Modos

| #   | id    | Título           | Explicação                                                                  |
| --- | ----- | ---------------- | --------------------------------------------------------------------------- |
| 1   | day   | Um dia por vez   | Cada toque avança só um dia. Controle total do calendário.                  |
| 2   | event | Parar em eventos | Avança sozinho e para em qualquer mensagem, decisão ou dia de jogo.         |
| 3   | auto  | Nunca parar      | Simula os jogos, responde decisões com apoio e só para no fim da temporada. |

- **day**: `advanceDay`, avançando exatamente um dia por comando.
- **event**: avanço contínuo até jogo, decisão pendente, mensagem nova ou fim de temporada.
- **auto**: simula os jogos e responde decisões com apoio; para no fim de temporada ou por comando manual.

A explicação curta do terceiro card é preservada.

## Interações

- Clique ou A/✕ seleciona, persiste e fecha.
- Setas/D-pad/analógico esquerdo navegam entre cards; foco inicial no modo ativo.
- Tab permanece dentro do modal; ao fechar, o mecanismo compartilhado restaura o foco.
- B/○/Esc, Voltar e START cancelam com o retorno descrito acima.
- Não disponível durante partida; na Pausa da partida, o item fica oculto.
- Em simulação, o fundo fica bloqueado e não permite abrir preferências.

## Invariantes

1. Mesmos três modos, ids e regras.
2. Preferência persistida por save.
3. Escolha com uma confirmação e toast curto, sem nova confirmação intermediária.
4. Glifos conforme o dispositivo e alternativas de mouse.
5. Cancelamento não muda a preferência; retorno à origem explícito.
