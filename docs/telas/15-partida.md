# Tela: Partida

## Objetivo

Partida 2D jogável da carreira, aberta a partir do popup Dia de jogo. O manager controla a velocidade, escala substituições, muda o plano tático e pode dar instruções à beira do campo. A simulação é determinística para a mesma carreira e seed.

## Entrada e saída

- **Entrada:** Dia de jogo → **Começar partida**. `beginMatch` cria `career.activeMatch` e abre o relógio no minuto 0, pausado.
- **Saída:** no minuto 90, **Confirmar resultado e voltar à central** chama `finishMatch`, registra estatísticas e resultado, e volta à Central.
- A Pausa permite salvar e sair sem encerrar uma partida ativa. Ao carregar o save, a partida continua do minuto persistido.
- Durante a partida, a navegação principal fica oculta.

## Composição da tela

### Faixa e placar

- A faixa superior mostra competição, fase/rodada e estádio.
- O placar apresenta escudos, nomes dos clubes, gols, minuto e estado: **PAUSADO**, **AO VIVO**, **INTERVALO** ou **FIM DE JOGO**.
- As cores dos clubes aparecem nos extremos do painel do placar.

### Campo e andamento

- `LivePitch` mostra os 22 atletas em um campo 2D. Movimento e passes são uma representação visual; eventos e resultados vêm do engine.
- A linha do tempo mostra os minutos de 0 a 90 e marcadores dos principais eventos.
- Controles permitem iniciar/pausar e alternar a velocidade da simulação.
- O painel **O jogo em números** apresenta posse, finalizações, gols esperados (xG) e passes.
- **Direto do campo** lista eventos recentes em texto.
- Durante a partida, a tela exibe notas dos jogadores; no fim, exibe as notas finais e o Craque do jogo.

### Ações do manager

- **Substituir:** escolhe um titular para sair e um reserva disponível para entrar. Respeita limite de cinco substituições, disponibilidade e posição de goleiro.
- **Tática:** pausa a partida e permite alterar formação, mentalidade, pressão, ritmo, linha defensiva, largura e capitão.
- **Instruções da beira do campo:** oferece comandos táticos com duração e intervalo mínimo entre instruções. A ação fica indisponível durante o intervalo de espera.

### Pós-jogo

- O painel de números dá lugar às notas da partida.
- `MatchAnalysis` apresenta o xG acumulado e uma explicação baseada nos eventos e números.
- O botão de confirmação encerra a partida e retorna à Central.

## Controles e estados

- Mouse/toque e controle podem acionar os botões visíveis; a navegação por controle mantém foco e dicas contextuais.
- Jogar é interrompido ao chegar ao intervalo, ao fim do tempo, ao abrir substituição/tática/instruções, ou quando o app está pausado.
- A pausa da aplicação suspende o avanço do relógio.
- A forma visual do campo não deve ser apresentada como uma simulação de movimento tático com precisão de coordenadas.

## Dados persistidos

O objeto da partida guarda seed, minuto, placar, estatísticas, eventos, escalações, substituições, notas, minutos jogados, desgaste, lesões e expulsões. Não há momentos interativos de jogadores, condições climáticas ou arbitragem/VAR na partida.

## Componentes e regras a preservar

- `src/screens/Match.tsx` — tela ao vivo, controles e estados de partida.
- `src/components/LivePitch.tsx` — campo 2D.
- `src/components/LivingPanels.tsx` — análise pós-jogo.
- `src/components/PlayerCard.tsx` — seleção de substitutos e jogadores.
- `src/game/matches.ts` — partida, substituições e comandos à beira do campo.
- `src/game/matchRatings.ts` — notas e Craque do jogo.
- Preservar avanço reproduzível, regras de substituição, pausa nos controles e registro correto do resultado antes de voltar à Central.
- Não reintroduzir telas ou mecânicas não previstas no escopo: áudio/voz, coletivas, VAR, clima/gramado ou diálogos aleatórios durante a partida.
