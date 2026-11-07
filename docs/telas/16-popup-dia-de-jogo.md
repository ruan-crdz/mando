# Tela: Popup Dia de jogo

## Objetivo

Pré-jogo da partida marcada para a data atual. Resume adversário, competição, estádio, plano tático e desfalques antes de revisar a escalação ou começar.

## Entrada e saída

- **Entrada:** Central em dia de jogo, após avanço do calendário ou pelo card do próximo compromisso.
- **Revisar escalação:** fecha o popup e abre Time.
- **Começar partida:** revalida se há fixture do clube na data atual, cria a partida e abre a tela ao vivo.
- **Voltar**, B/○ ou Esc fecha sem iniciar.

## Composição

- Data e competição/fase no cabeçalho.
- Dois blocos de clubes com escudos, nomes e indicação de mandante/visitante; estádio do mandante.
- Plano de jogo: formação e mentalidade configuradas.
- Lista de desfalques confirmados por lesão, suspensão ou condição física insuficiente; mostra atleta e duração quando aplicável.
- Ações: **Revisar escalação** e **Começar partida**. O segundo recebe foco inicial.

## Dados e arquivos

- `src/App.tsx` — dados e ações do popup.
- `src/game/calendar.ts` — fixture e identificação da competição.
- `src/game/matches.ts` — início da partida.
- `src/game/types.ts` — tática, atleta e estado da carreira.

## Regras a preservar no redesign

1. Abrir somente quando houver jogo do clube na data atual.
2. Mostrar desfalques reais do save e o plano tático escolhido.
3. Preservar revalidação antes de iniciar e encaminhar erro de forma explícita.
4. Não adicionar previsão de probabilidades, clima, arbitragem/VAR, coletiva ou instruções de imprensa.
5. Iniciar vibração de apito ao começar, conforme as preferências do controle.
