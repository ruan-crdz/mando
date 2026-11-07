# Tela: Calendário de Simulação Contínua

## Resumo

No Ato 3, a cápsula flutuante foi substituída por um **painel modal de calendário horizontal**, sobre o contexto da carreira escurecido. Mostra passado, hoje e próximos dias, contadores, próximo compromisso e Parar. A composição prioriza desktop com experiência de videogame.

É apresentação do avanço existente: `advanceStep`, suas cinco paradas e o intervalo de 110 ms permanecem iguais.

## Como se chega / como se sai

**Inicia**

- `advance()` em modo `event` ou `auto`, pelo tile ou pelo atalho X/□.
- Zera `played`, registra `advanceStartedAt` e liga `running`.
- Impede novo início enquanto já está rodando, ocupado ou com partida ativa.

**Termina**

- Parada automática do motor, conforme tabela abaixo.
- Clique em Parar ou Voltar; A/✕, B/○, X/□, START/Options/☰; Esc ou Enter com foco no botão.
- Erro: interrompe e mostra a mensagem no toast de erro.

O `GamepadProvider` continua priorizando `[data-stop-run]` nos quatro comandos principais; parar não depende de encontrar o botão com o foco.

## Arquivos-fonte

- `src/components/CareerCalendar.tsx`: `CareerCalendar` e `AdvanceOverlay`.
- `src/App.tsx`: `running`, `played`, `advanceStartedAt`, `advance()`, loop, paradas, bloqueio de fundo e atalhos.
- `src/components/ui.tsx`: `Modal` com escopo de foco, classe opcional, fechamento e restauração.
- `src/controller/GamepadProvider.tsx`: interceptação de `[data-stop-run]`.
- `src/styles/legacy/06-hub.css`: `.simulation-dialog`, calendário, contadores e próximo compromisso.
- `src/game/engine.ts`: regras existentes de `advanceStep`; sem alterações pelo redesign.

## Composição

```text
+------------------------------------------------------------------------+
| AVANÇANDO ATÉ O PRÓXIMO EVENTO / FIM DA TEMPORADA              < VOLTAR |
| SIMULAÇÃO AUTOMÁTICA / CALENDÁRIO EM MOVIMENTO                          |
| data atual                                N dias / N partidas          |
|                                                                        |
|   dia -2        dia -1          HOJE          dia +1         dia +2     |
|   marcadores de jogo, mensagem e decisão conforme o save                |
|                                                                        |
| PRÓXIMO COMPROMISSO                                                     |
| decisão pendente ou próxima partida, competição e data                  |
|                                                                        |
| explicação do modo                                      [glifo] PARAR  |
+------------------------------------------------------------------------+
```

- Cinco células atualizadas conforme o calendário avança; duas passadas, hoje e duas futuras.
- Em mobile landscape, as células, os títulos e o espaçamento são compactados para manter o painel dentro da altura disponível.
- Dia da semana, número, mês e marcadores reais. Os dias passados têm contraste menor; hoje recebe petróleo/ciano.
- Mensagens são contadas pela data; decisões importantes não resolvidas têm marcador próprio. Jogos exibem a sigla do adversário.
- Dias avançados = diferença entre data atual e data do início da execução. Partidas = quantidade de `result.played`.
- Próximo compromisso prioriza uma decisão pendente; senão mostra o próximo fixture do clube; sem fixture, informa ausência de partida.
- Auto explica que o auxiliar simula sem abrir a partida; evento explica suas interrupções.
- Parar tem `data-autofocus`, `data-stop-run` e glifo do dispositivo.
- O cabeçalho Voltar também interrompe; não existe retomada oculta por trás de outro modal.

## Loop e paradas

A cada 110 ms, `advanceStep(current, base, mode)` retorna a carreira e, eventualmente, `played` e `stop`. O App grava a carreira, incrementa partidas e aplica o destino existente. O avanço pode gerar mensagens de carreira normalmente.

| stop     | Toast                                      | Destino                 |
| -------- | ------------------------------------------ | ----------------------- |
| match    | Dia de jogo! O avanço parou.               | Modal Dia de jogo       |
| decision | Uma decisão espera por você no escritório. | Escritório              |
| message  | Nova mensagem no escritório.               | Escritório              |
| season   | Temporada encerrada.                       | Permanece na tela atual |

Parada automática vibra `whistle`; notices somem sozinhos em 2,6 s. Erros aparecem por 4 s. Parada manual não cria um novo toast nem altera o modo escolhido.

## Foco e bloqueio do fundo

- Header e `main` ficam `inert` durante `running`.
- L1/R1, Y/△ e cliques por baixo não mudam a tela nem reiniciam a simulação.
- Tab fica confinado ao modal; a confirmação pode parar imediatamente.
- Ao encerrar, o modal é desmontado e o mecanismo compartilhado restaura o foco quando o elemento anterior ainda existe.
- O footer global e o contexto visual da carreira permanecem visíveis; o comando específico Parar fica dentro do painel.

## Invariantes

1. Cinco células, data ao vivo, contadores e próximo compromisso.
2. Todas as formas de interrupção acima, sem duplo início.
3. Mesmas cinco paradas, mensagens e destinos.
4. Mesmo ritmo de 110 ms e registro de `result.played`.
5. Sem mudança de engine, calendário, regras ou formato de save.
