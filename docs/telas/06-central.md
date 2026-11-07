# Tela: Central

## Objetivo

Hub principal da carreira. Resume data e temporada, apresenta o próximo compromisso, deixa o manager avançar o calendário ou abrir o jogo e mostra objetivos e decisões pendentes.

## Composição

1. **Faixa superior:** clube, saudação ao manager, número da temporada, situação (pré-temporada/em andamento/encerrada), data e modo de avanço atual.
2. **Próximo jogo:** competição/fase, escudos, nomes dos clubes, data e estádio. Em dia de jogo, o CTA muda para **Hoje é dia de jogo** e abre o pré-jogo. Sem partidas futuras, informa o encerramento da temporada e abre a tabela.
3. **Avanço:** botão principal contextual. Pode avançar um dia, avançar até um evento, iniciar o modo automático, abrir Notificações para decisões pendentes ou iniciar a próxima temporada.
4. **Manager:** retrato integrado, nome, clube e classificação; acesso ao Escritório.
5. **Caixa postal:** prévia das mensagens e decisões pendentes; acesso a Notificações.
6. **Elenco:** prévia dos atletas e overall; acesso ao Time.

O calendário horizontal voltou ao topo, com navegação pelos dias. A composição
retoma os tiles assimétricos da Central anterior ao último redesign.

## Regras de ação

- Uma decisão importante pendente direciona o avanço para Notificações.
- Em dia de jogo, o card de avanço abre o pré-jogo.
- Ao encerrar a temporada, o card inicia a seguinte.
- O modo de avanço é configurado no modal Preferências de avanço.
- A Central não calcula resultados nem altera a simulação; chama as ações do engine e apresenta o estado salvo.

## Interações

- Card do próximo jogo: abre Dia de jogo ou, sem fixture, a tabela da temporada.
- Card de avanço: executa a ação definida pela situação atual.
- Card do manager: abre Escritório.
- Card/atalho de decisão: abre Notificações.
- Modo de avanço e Options/START abrem Preferências de avanço.
- X/□ executa o avanço contextual; Y/△ abre Notificações.

## Dados utilizados

`career.date`, `career.season`, `career.seasonEnded`, `career.clubId`, `career.manager`, `career.prefs.advance`, fixtures futuros, classificação da liga e mensagens importantes não resolvidas.

## Layout responsivo

- O próximo jogo é o maior card da grade e recebe o foco inicial.
- Avanço deve permanecer imediatamente acessível ao lado dele.
- Manager, caixa postal e elenco devem permanecer legíveis sem competir com o próximo jogo.
- Em telas estreitas, preservar a ordem: calendário, próximo jogo, avanço e previews.
- Não usar cards de feed de mercado, torcida, olheiros ou estatísticas extras nesta tela.

## Arquivos-fonte

- `src/screens/CareerCentral.tsx`
- `src/styles/screens/central.css`
- `src/styles/legacy/06-hub.css`
- `src/game/calendar.ts` e `src/game/engine.ts`
- `src/navigation.ts`

## Regras a preservar no redesign

1. O estado e as ações dependem da carreira ativa, sem conteúdo fictício.
2. Dia de jogo, decisão pendente e fim de temporada têm precedência contextual no CTA.
3. Os atalhos para Escritório, Notificações e Preferências devem continuar disponíveis.
4. Navegação por controle, mouse e teclado deve funcionar sem depender de hover.
