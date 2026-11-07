# Tela: Notificações

## Resumo

Notificações é a segunda área principal do modo carreira. É o destino dos avisos de mensagens que param o avanço; a bolinha da navegação aparece quando há mensagem importante não resolvida. A tela `Office` é reutilizada em modo `notifications`, sem alterar mensagens ou saves.

## Subáreas

- **Caixa de entrada** (`inbox`): lista e leitura em painel dividido. Preserva remetente, data, tipo, texto, leitura, voz, decisões, aplicação do plano do auxiliar e memórias vinculadas. Respostas de mensagens continuam usando os callbacks atuais (`respondMessage`, `applyStaffPlan`, `onRead`); mensagens de mercado continuam remetendo à área Transferências.
- **Conversas com atletas** (`conversations`): lista do elenco profissional atual e histórico real de `career.memories` e mensagens vinculadas ao atleta. Não gera diálogo fictício.

Na conversa, os botões **Elogiar esforço**, **Cobrar dedicação** e **Prometer mais minutos** reutilizam `playerConversation` e seus efeitos já existentes sobre moral, relacionamento e promessa. A resposta é registrada na memória da carreira, sem simular uma fala do atleta. Se existir mensagem bloqueadora pendente, as ações ficam desabilitadas até sua resolução na caixa de entrada. Mensagens vinculadas podem ser abertas diretamente na caixa de entrada.

## Navegação e acessibilidade

- A navegação superior, clique e L1/R1 (LB/RB) percorrem as seis áreas. L2/R2 (LT/RT) alternam as subáreas segmentadas.
- Lista, ações e links são botões com rótulos textuais; foco e confirmação usam os comportamentos compartilhados de controle do app.
- Voz e leitura de mensagens mantêm os estados globais existentes de carregamento/interrupção; erros de resposta continuam tratados pelos callbacks do jogo.

## Limites atuais

- Conversas são registros de interações anteriores, não um chat com geração de falas em tempo real.
- Só jogadores profissionais do clube atual aparecem na lista. Não há chat persistente com atletas de outros clubes.
- Saves antigos são lidos sem migração: esta tela consome as mensagens e memórias já salvas.
