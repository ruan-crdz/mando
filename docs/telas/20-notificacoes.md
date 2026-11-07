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

- Y/△ inicia ou interrompe a leitura de todas as mensagens.
- Um toque sonoro anuncia a caixa postal; a seleção acompanha a leitura.
- Usa a voz pt-BR disponível no navegador, sem gerar áudio em serviço externo.
- A música abaixa durante a fala. Sair da área cancela a leitura.
- Ausência de voz, permissão negada ou falha de reprodução gera aviso explícito.

## Navegação e acessibilidade

- A navegação superior, clique e L1/R1 (LB/RB) percorrem as seis áreas. L2/R2 (LT/RT) alternam as subáreas segmentadas.
- Lista, ações e links são botões com rótulos textuais; foco e confirmação usam os comportamentos compartilhados de controle do app.
- O estado de leitura permanece visível; erros de resposta continuam tratados pelos callbacks do jogo.

## Limites atuais

- Conversas são registros de interações anteriores, não um chat com geração de falas em tempo real.
- Só jogadores profissionais do clube atual aparecem na lista. Não há chat persistente com atletas de outros clubes.
- Mensagens e memórias de saves antigos são preservadas; não recria contatos já respondidos.
