# Tela: Academia

## Resumo

Academia é a quinta área principal. Ao começar a carreira, o clube já possui
18 jovens fictícios de 14 a 17 anos. A base fica separada do elenco profissional
e é persistida no save. Saves anteriores recebem uma base sem perder seus atletas.

## Subáreas implementadas

- **Olheiros:** rede de captação, relatórios, contratação/realocação/dispensa e
  avaliação da peneira. Prospectos contratados entram na base.
- **Elenco jovem:** posição, idade, OVR atual, potencial, evolução, minutos, gols e
  ritmo. Usa o mesmo layout de Jogadores do Time: ficha/atributos à esquerda e
  lista de atletas à direita, com foto, idade, OVR, potencial e condição.
  Focar um atleta atualiza a ficha; confirmar abre sua linha. Promover só aparece
  nessa linha a partir dos 16 anos; o motor também impõe esse limite.
- **Desenvolvimento:** planos individuais e treino de posições, com o mesmo
  cálculo diário usado nos profissionais e influência real dos auxiliares.
- **Torneio de base:** liga sub-20 com oito clubes e 14 rodadas, tabela,
  calendário e resultados. Os jogos são simulados ao avançar a data.

## Controles e estados

- Clique e L2/R2 (LT/RT) percorrem as quatro subáreas; botões de ação existentes aceitam controle e teclado.
- Mensagens de erro e estados de caixa insuficiente continuam ligados aos callbacks atuais. A peneira, jovens e olheiros permanecem no save, sem migração destrutiva.
- Promover preserva crescimento, familiaridade e plano de treino do jogador.
- X/□ promove o atleta cuja linha está aberta e é elegível. Após promoção,
  o foco volta à lista. RS rola a ficha, enquanto D-pad/LS percorre os atletas.
- B/○ fecha a linha e devolve o foco ao atleta; o cursor não troca ou fecha uma
  linha aberta apenas por passar sobre outros jogadores.

## Regras e limites

- Torneio juvenil usa uma simulação simplificada de OVR/condição contra a força
  das bases NPC; não é a mesma simulação lance a lance da equipe profissional.
- Atletas participantes ganham minutos e ritmo e gastam condição.
- Sem onze saudáveis, há W.O. explícito e aviso na caixa postal.
- A cada temporada surgem talentos; atletas acima de 20 deixam a base.
- Menores de 16 não podem ser promovidos, inclusive por APIs alternativas.
