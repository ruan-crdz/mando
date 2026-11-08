# Tela: Notificações

## Resumo

Notificações é a segunda área principal do modo carreira. É o destino dos avisos de mensagens que param o avanço; a bolinha da navegação aparece quando há mensagem importante não resolvida. A tela `Office` é reutilizada em modo `notifications`, sem alterar mensagens ou saves.

## Subáreas

- **Caixa de entrada** (`inbox`): lista e leitura em painel dividido. Preserva remetente, data, tipo, texto, estado de leitura, decisões e aplicação do plano do auxiliar. Respostas continuam usando `respondMessage`, `applyStaffPlan` e `onRead`; mensagens de mercado remetem à área Transferências.
- **Conversas com atletas** (`conversations`): somente atletas do clube que
  enviaram uma mensagem. O primeiro contato é a apresentação do capitão.
  Não exibe o elenco inteiro como uma lista de chats.

O manager não inicia elogios, cobranças ou conversas livres. Pode responder uma
única vez a cada contato recebido; depois, os botões desaparecem e o registro
permanece no histórico. Contatos de minutos, parabéns e conselho são raros,
contextuais e têm cooldown global e individual.

## Caixa postal com voz

- Y/△ inicia ou interrompe a leitura das mensagens ainda não lidas. Quando o foco está nas respostas de um atleta, Y/△ cobra dedicação; X/□ oferece apoio. O rodapé indica a ação exata.
- Clique de conexão, tom telefônico e sinal curto anunciam a caixa postal;
  uma ambiência de linha telefônica acompanha a leitura.
- Usa voz pt-BR do navegador, priorizando vozes naturais locais quando disponíveis.
- Lê a 3,8× e agrupa frases sem cortar palavras para reduzir pausas artificiais.
- A música abaixa durante a fala. A leitura continua ao navegar para outras áreas;
  o botão da caixa postal interrompe a reprodução.
- Voz e ambiência encerram juntas ao parar ou concluir a última mensagem.
  A voz nativa do navegador não passa por um filtro de áudio; o efeito de
  telefone é produzido pelos sons de conexão e da linha.
- Ausência de voz, permissão negada ou falha de reprodução gera aviso explícito.

## Navegação e acessibilidade

- A navegação superior, clique e L1/R1 (LB/RB) percorrem as seis áreas. L2/R2 (LT/RT) alternam as subáreas segmentadas.
- Lista, ações e links são botões com rótulos textuais; foco e confirmação usam os comportamentos compartilhados de controle do app.
- O estado de leitura permanece visível; erros de resposta continuam tratados pelos callbacks do jogo.
- X/□ confirma leitura, oferece apoio ou aplica o plano disponível. As regiões lista/mensagem têm travessia lateral explícita. Após responder, o foco volta à mensagem de origem, não ao começo da lista.

## Limites atuais

- Conversas são registros de interações anteriores, não um chat com geração de falas em tempo real.
- Só jogadores profissionais do clube atual aparecem na lista. Não há chat persistente com atletas de outros clubes.
- Mensagens e memórias de saves antigos são preservadas; não recria contatos já respondidos.
