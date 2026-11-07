# Tela: Academia

## Resumo

Academia é a quinta área principal. Reutiliza a tela `Office` em modo `academy` e os dados existentes de observação de jovens, prospectos, peneira e atletas da base. Nenhuma regra de partida, economia ou esquema de save é alterada.

## Subáreas implementadas

- **Captação e peneira** (`scouts`): rede de olheiros, relatórios de prospectos, contratação/realocação/dispensa de olheiros, promoção de prospectos e avaliação de candidatos da peneira anual. Usa os mesmos callbacks e custos atuais.
- **Elenco jovem** (`roster`): lista `career.youth` com posição, idade, overall, potencial e nacionalidade; estado vazio quando não há atletas.
- **Desenvolvimento** (`development`): informa quantos jovens há na base e explica os recursos reais disponíveis. Planos de desenvolvimento individuais só existem hoje para o elenco profissional, pela área Time; a tela não aplica efeito de treino juvenil.
- **Torneio de base** (`tournament`): seção claramente marcada **FUNCIONALIDADE FUTURA**. O motor não simula nem agenda torneios juvenis; não há calendário, tabela ou resultado fictício.

## Controles e estados

- Clique e L2/R2 (LT/RT) percorrem as quatro subáreas; botões de ação existentes aceitam controle e teclado.
- Mensagens de erro e estados de caixa insuficiente continuam ligados aos callbacks atuais. A peneira, jovens e olheiros permanecem no save, sem migração destrutiva.
- A partir de Clube vivo no Escritório, o atalho para olheiros leva à área Academia.

## Lacunas honestas

- Não há competição sub-20 simulada.
- Não há painel de desenvolvimento individual para jovens; a tela explica que a ferramenta atual atende o elenco profissional.
- Prospectos e candidatos da peneira continuam com as regras atuais de promoção; nenhuma nova regra econômica foi criada.
