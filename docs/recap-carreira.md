# MANDO: recap da carreira, controle e provas

## Fluxo completo

| Tela/área               | Conteúdo                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Menu                    | Continuar com um save; Carregar jogo com vários; nova carreira e exclusão confirmada no seletor                                   |
| Nova carreira           | Mundo brasileiro 2026, identidade/retrato, clube, dificuldade e desafio                                                           |
| Primeiro trabalho       | Contrato, tutorial e apresentação do capitão na caixa postal                                                                      |
| Central                 | Calendário superior, próximo jogo, avanço, manager, caixa postal e elenco                                                         |
| Notificações            | Caixa postal falada e conversas iniciadas exclusivamente pelos atletas                                                            |
| Time: escalação         | Onze com fotos, banco ordenável de nove em quadrados; mesmas grades de banco/não relacionados ao substituir um titular            |
| Time: tática            | Onze formações, mentalidade, pressão, largura, construção e linha                                                                 |
| Time: responsabilidades | Capitão e responsáveis pelas bolas paradas                                                                                        |
| Time: jogadores         | Ficha expandida, camisa, contratos, venda/empréstimo, dispensa e treino de posições                                               |
| Time: comissão          | Cinco candidatos por setor; escolha explícita, bronze/prata/ouro, salário e estrelas                                              |
| Transferências          | Mercado, atletas observados e negociações                                                                                         |
| Academia                | Olheiros, elenco jovem em lista com ficha à esquerda, 18 jovens iniciais, desenvolvimento e torneio sub-20                        |
| Escritório              | Oito opções no mesmo submenu: objetivos, classificação, calendário, orçamento, trabalho, histórico, estatísticas e personalização |
| Pré-jogo                | Resumo do confronto, revisar escalação e começar                                                                                  |
| Partida                 | Relógio, acontecimentos, placar, estatísticas, substituições e ajustes táticos                                                    |
| Pós-jogo                | Resultado e avaliações, registrados na carreira                                                                                   |
| Pausa/preferências      | Avanço, vibração, música, torcida, save e saída                                                                                   |
| Temporada seguinte      | Competições, acesso/rebaixamento, contratos e novos talentos                                                                      |

As [docs por tela](telas/README.md) detalham os painéis e popups. Sistemas removidos
do escopo, como Seleção e conquistas, não foram restaurados.

## Controle primeiro

| Situação                                                 | Xbox        | PlayStation |
| -------------------------------------------------------- | ----------- | ----------- |
| Selecionar / voltar                                      | A / B       | ✕ / ○       |
| Trocar área principal                                    | LB / RB     | L1 / R1     |
| Trocar subárea                                           | LT / RT     | L2 / R2     |
| Navegar opções                                           | D-pad / LS  | D-pad / LS  |
| Rolar painel                                             | RS          | RS          |
| Central: avanço contextual                               | X           | □           |
| Central: Notificações                                    | Y           | △           |
| Pré-jogo: começar / revisar                              | X / Y       | □ / △       |
| Partida: iniciar, pausar, retomar ou confirmar resultado | X           | □           |
| Partida: substituições                                   | Y           | △           |
| Time: autoescalar                                        | X           | □           |
| Banco: enviar selecionado para cima e escolher reserva   | Y, depois A | △, depois ✕ |
| Caixa postal: ouvir / parar                              | Y           | △           |
| Personalização: salvar                                   | X           | □           |
| Pausa                                                    | Menu        | Options     |

Atalhos são contextuais, respeitam o modal superior e botões indisponíveis.
Sliders/steppers têm prioridade de edição; campos de texto abrem teclado virtual.
Contratar um auxiliar exige escolher o candidato: nenhum atalho contrata
arbitrariamente o primeiro da lista.

Vibração depende do suporte do navegador/controle; DualSense pode usar WebHID
com pareamento autorizado. É um jogo web operado por controles Xbox/PS5,
não um executável nativo certificado para consoles.

## Conversas sem spam

Só aparecem jogadores que entraram em contato. O capitão dá boas-vindas no
primeiro trabalho; depois há pedidos raros de minutos, conselho ou parabéns.
Há cooldown de sete dias entre contatos e 28 dias por jogador. Cada mensagem
aceita uma resposta; responder novamente não duplica efeitos ou memória.
Não há botões para iniciar elogios, conversa ou evolução de função na ficha.

## Base e auxiliares

A base inicial contém 18 fictícios de 14 a 17 anos. Promoção exige 16 anos,
preserva evolução e treino e integra o atleta ao profissional. Desenvolvimento
e familiaridade usam a mesma rotina diária dos profissionais.

A liga sub-20 tem oito clubes, 14 rodadas e 56 partidas, com tabela e resultados
persistidos. A simulação juvenil é simplificada; participantes ganham 90 minutos,
ritmo e desgaste. Não é uma animação ou tabela preenchida com placares fixos.

Auxiliares têm conhecimento 1–5, estrelas por posição e salário semanal. Há
20 identidades; cada pessoa fica em um setor, com vários profissionais por setor
até o orçamento salarial redistribuído dos jogadores. O bônus do melhor
contratado em um setor responsável pela posição é:

`(conhecimento + estrelas - 1) × 4%`

Ele multiplica crescimento e treino de posição; a estimativa de dias usa o mesmo
bônus. Não empilha auxiliares nem concede gols instantâneos. A influência
nas partidas aparece pelo desenvolvimento dos atletas e sua familiaridade.
Salários entram na folha; bronze pode ser a escolha economicamente adequada.

## O que realmente entra na simulação profissional

| Fator             | Uso real no motor                                                                 |
| ----------------- | --------------------------------------------------------------------------------- |
| Formação          | Funções e distribuição por setores; quantidade de meias e adequação dos jogadores |
| Mentalidade       | Ofensiva: ataque +6%, defesa −5%; defensiva: ataque −6%, defesa +5%               |
| Pressão           | Confronto com saída de bola, posse, desgaste e disciplina                         |
| Largura           | Confronto entre corredores e proteção lateral/central                             |
| Construção        | Passe/visão ou velocidade; altera desgaste conforme o ritmo                       |
| Linha defensiva   | Confronto entre defesa e velocidade adversária                                    |
| OVR               | Força do atleta calculada com pesos específicos da função                         |
| Improvisação      | Penalidade por familiaridade e redução dos atributos utilizados na função         |
| Condição          | Força efetiva e desgaste durante os minutos                                       |
| Moral e ritmo     | Modificam a força efetiva; ritmo usa `0,85 + ritmo × 0,003`                       |
| Velocidade        | Perfil de corrida, corredores e confronto com linha alta                          |
| Finalização/chute | OVR por função e seleção/eficiência dos finalizadores                             |
| Passe/visão       | Construção, perfil tático e seleção de assistentes                                |
| Defesa            | Proteção e confronto com o ataque                                                 |
| Goleiro           | Reflexos, domínio e mergulho na força do goleiro e chances de defesa              |
| Lesão/suspensão   | Impedem escalação de indisponíveis; ocorrências em jogo mudam os participantes    |

O confronto tático limita ajustes por setor a ±15%. A criação de chances usa
`0,13 × (ataque / defesa)^2,2`. Desgaste por minuto (`src/game/fatigue.ts`) usa
`(0,12 + (pressão − 3) × 0,025 + (construção − 3) × 0,01 ± mentalidade) × carga da função
× (1,35 − fôlego/200) × idade`: goleiro 0,35, zagueiro 0,85, laterais/alas/meias ~1,1; acima de
30 anos +3% por ano. Um titular médio gasta ~10–13 pontos em 90 minutos.
Rendimento pela condição: sem perda acima de 75, −0,35%/ponto entre 75 e 55 e −0,8%/ponto
abaixo de 55; dentro do jogo, o desgaste acumulado tira até 8% (substituto descansado rende mais).
Recuperação diária: `(3 + (100 − condição) × 0,15) × idade × fôlego` — ~97% em três dias;
veteranos 80–90%, jovens 110%. Lesão em jogo só sobe com condição atual abaixo de 60.
Ter a maior barra não significa sempre jogar melhor: depende do adversário.

### IA do técnico rival

- **Antes do jogo** (Amador/Profissional): testa as 625 combinações de pressão, largura, ritmo e
  linha contra o seu desenho, elenco e plano, pela mesma conta de saldo esperado da engine, e
  aplica a melhor sem abandonar a identidade do técnico (custo por passo: 0,035 no Amador,
  0,012 no Profissional). O motivo aparece na narração.
- **Aos 46 e 70 minutos** relê o jogo com cansaço, lesões, expulsões e o seu plano atual.
- **Placar:** perdendo após 60' vai ao ataque (após 75' ou −2 também sobe pressão, ritmo e
  linha); ganhando após 70' administra; no Profissional, empate após 80' fora de casa segura e
  em casa vai atrás.
- **Substituições** (até 5): lesionado sai na hora; nas janelas 46/58/64/70/76/82 compara cada
  titular (overall na função × condição × desgaste) com o melhor reserva da função. Perdendo
  prioriza o ataque, ganhando a marcação, e amarelados da defesa saem antes da expulsão.

### Provas reproduzíveis, não promessas

- [Balanceamento](../src/game/balance.test.ts): partidas repetidas medem OVR,
  plano recomendado contra padrão/plano ruim e atacante improvisado na zaga.
- [Atributos](../src/game/attributeImpact.test.ts): 72 seeds pareadas por família
  de atributos; medem xG, gols e notas após modificar os atributos reais.
- [Refinamentos](../src/game/careerRefinements.test.ts): 32 seeds pareadas para
  cada controle tático e condição/moral/ritmo; registram xG, posse e desgaste.
  Pressão deve aumentar desgaste em mais de 2 pontos; construção em mais de
  0,5. Status 40 versus 95 deve alterar xG em mais de 0,01.
- A prova de auxiliar avança a mesma data/seed com e sem o candidato escolhido;
  verifica crescimento e familiaridade reais, além da fórmula do bônus.
- Regressões cobrem geometria das onze formações, resposta única, promoção,
  torneio, banco e edição de manager. E2E verifica as telas correspondentes.

Resultados estatísticos são emitidos nos logs da CI. Não se deve inferir que
uma variante vencerá todas as partidas, nem inventar percentuais antes da execução.

### Resultados medidos

Fonte: [execução da CI](https://github.com/ruan-crdz/mando/actions/runs/42439471433),
nos testes de refinamentos, atributos e balanceamento, com a execução inteira aprovada.

| Experimento pareado              | Resultado médio                              |
| -------------------------------- | -------------------------------------------- |
| Mentalidade defensiva → ofensiva | xG 1,12 → 1,40                               |
| Pressão 1 → 5                    | desgaste 5,61 → 13,63; posse 49% → 51%       |
| Largura 1 → 5                    | xG 1,12 → 1,44 neste adversário              |
| Construção 1 → 5                 | xG 0,91 → 1,38; desgaste 8,02 → 11,22        |
| Linha 1 → 5                      | xG 1,19 → 1,28 neste adversário              |
| Formação 4-3-3 → 3-5-2           | xG 1,18 → 1,33 com os titulares adequados    |
| Condição 40 → 95                 | xG 0,67 → 1,26; gols sofridos 3,63 → 1,84    |
| Moral 40 → 95                    | xG 1,15 → 1,34                               |
| Ritmo 40 → 95                    | xG 1,17 → 1,62                               |
| Auxiliar ouro Pedro Santos       | crescimento diário 0,010781 → 0,014231: +32% |
| Velocidade +35                   | xG 1,46 → 1,51                               |
| Finalização +35                  | xG 1,46 → 1,57                               |
| Passe/visão +35                  | nota 6,63 → 6,75                             |
| Defesa +35                       | gols sofridos 1,18 → 1,10                    |
| Goleiro +35                      | gols sofridos 1,18 → 1,13                    |
| Plano recomendado vs padrão      | vitórias 42% vs 26%; saldo +0,27 vs −0,37    |
| Centroavante na zaga             | nota 7,91 → 5,42; gols sofridos 0,62 → 0,77  |

Tática/status usam 32 seeds no mundo demonstrativo, passando pelo motor real;
atributos usam 72 seeds com os elencos 2026, São Paulo contra Bahia.
Balanceamento usa amostras maiores e alterna mando. São comparações controladas,
não previsões universais ou dados de futebol real. Na segunda temporada, a
rotina de prova promove explicitamente jovens de 16+ para repor profundidade
do elenco: o jogo não promove menores nem reforça silenciosamente o profissional.

## Áudio autorizado

Dez faixas eletrônicas originais, sintetizadas por Web Audio, tocam em fila
circular: Neon no Estádio; Virada Elétrica; Luzes da Linha; Ritmo de Jogo;
Noite em São Paulo; Pressão Alta; Cidade em Movimento; Manto Neon; Contra o
Tempo; Último Minuto. As batidas usam bumbo marcado, clap, hi-hats e baixo
sintetizado. Artista exibido: **Mando Studio**. São composições procedurais,
não gravações comerciais ou arquivos de músicas licenciadas.

Cada começo exibe título/artista no canto inferior direito por três segundos.
Torcida é sintetizada durante a partida e reage ao gol. A caixa postal usa
SpeechSynthesis pt-BR, com toque inicial, seleção acompanhando a voz e música
reduzida. Preferências de música e torcida são persistentes.

O navegador pode exigir uma interação autorizada para áudio; controle sozinho
nem sempre desbloqueia autoplay. Voz e WebHID também dependem de suporte e
permissão. Falhas são exibidas, não tratadas como sucesso.
