# Tela: Tutorial inicial

## Resumo

Orientação curta, em etapas, exibida depois da assinatura do primeiro contrato. Apresenta as áreas
principais do jogo e pode ser pulada imediatamente.

## Como se chega / como se sai

- **Entrada:** assinatura do contrato inicial ou carregamento de um save novo que já foi assinado,
  mas ainda não concluiu o tutorial.
- **Saída:** **Pular tutorial**, botão **Concluir** na última etapa, ou fechar pelo comando Voltar.
- `onboarding.tutorialComplete` é gravado no save para não repetir a orientação nas próximas sessões.

## Arquivos-fonte

- `src/App.tsx`: conteúdo das etapas, navegação e persistência do estado.
- `src/game/types.ts`: estado opcional de onboarding compatível com saves antigos.
- `src/styles/legacy/05-entry-flows.css`: layout e indicadores de progresso.

## Wireframe atual

```text
┌──────────────────────── PRIMEIROS PASSOS ───────────────────────┐
│ ORIENTAÇÃO 2 DE 5                                                │
│                                                                  │
│                  Mensagens e notificações                        │
│      Texto curto explicando a área apresentada                   │
│                                                                  │
│                    ● ━ ● ━ ○ ━ ○ ━ ○                             │
│                                                                  │
│ [Pular tutorial]                         [Próximo →]             │
└──────────────────────────────────────────────────────────────────┘
```

## Elementos

- Indicador **ORIENTAÇÃO N DE 5**.
- Título e corpo da etapa atual.
- Progresso visual com um marcador por etapa.
- Botão **Pular tutorial**.
- Botão primário **Próximo**; na última etapa, muda para **Concluir**.

## Etapas atuais

1. **Central:** elenco, escalação e próximo compromisso.
2. **Mensagens e notificações:** explica que a caixa de entrada ainda fica no Escritório.
3. **Time:** formação e funções dos atletas.
4. **Transferências:** mercado e negociações.
5. **Escritório:** mensagens, diretoria, finanças e gestão.

## Estados e variações

- **Em andamento:** etapa e progresso são mantidos durante o popup.
- **Pulado:** marca `tutorialComplete` e fecha.
- **Concluído:** marca `tutorialComplete` e fecha.
- **Save antigo sem onboarding:** não recebe o tutorial retroativamente.

## Interações

- **Mouse/toque:** avançar, concluir ou pular.
- **Controle:** foco inicial no botão principal; confirmar avança/conclui. Voltar/fechar fecha o
  tutorial e conta como pular.
- O conteúdo não altera a simulação nem os dados dos jogadores.

## Classes CSS e visual atual

- `.onboarding-modal`, `.tutorial-modal`, `.tutorial-content`, `.tutorial-progress`,
  `.tutorial-actions`.
- Popup curto sobre a interface Legacy, com indicador de etapas e dois CTAs.

## Regras que o redesign deve preservar

- O jogador precisa poder pular sem percorrer todas as etapas.
- Não repetir tutorial após conclusão ou salto.
- Não criar mensagens ou efeitos de engine ao mostrar o tutorial.
- Toda etapa e botão devem ser navegáveis por controle e teclado.

## Problemas atuais e oportunidades

- O tutorial atual tem apenas cinco orientações e precisa ser atualizado quando a navegação de
  Notificações e Academia for entregue.
- Não há ilustrações, demonstração interativa nem opção de rever o tutorial pelas configurações.
- As etapas explicam áreas, mas ainda não ensinam ações como trocar titular, negociar ou avançar dias.
