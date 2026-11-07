# Tela: Proposta e assinatura do contrato inicial

## Resumo

Popup obrigatório apresentado ao criar uma carreira nova. A presidência oferece o cargo, exibe
informações financeiras do clube e metas da temporada; o jogador precisa assinar antes de acessar o
restante da carreira.

## Como se chega / como se sai

- **Entrada:** depois de escolher manager, clube, desafio e dificuldade, quando o save novo é criado.
- **Saída:** botão **Assinar contrato** executa a animação e abre o tutorial. O popup não pode ser
  dispensado; saves antigos, já criados antes do onboarding, não recebem essa etapa.
- O estado `onboarding.contractSigned` é gravado na carreira e sobrevive ao recarregamento.

## Arquivos-fonte

- `src/App.tsx`: estado do popup, apresentação da proposta, assinatura e persistência.
- `src/game/engine.ts`: inicialização de `onboarding` e mensagens de boas-vindas.
- `src/game/types.ts`: manager e estado opcional de onboarding, com compatibilidade para saves antigos.
- `src/screens/CreateManager.tsx`: ficha do manager, seleção de clube e configuração inicial.
- `src/styles/legacy/05-entry-flows.css`: layout e animação de assinatura.

## Wireframe atual

```text
┌──────────────────── PROPOSTA DA PRESIDÊNCIA ────────────────────┐
│ [escudo] TERMO DE CONTRATAÇÃO · temporada                       │
│         clube                                                    │
│         saudação personalizada ao manager                       │
│                                                                  │
│ [orçamento de transferência] [caixa] [dívida] [salário semanal]  │
│                                                                  │
│ OBJETIVOS DA TEMPORADA                                           │
│ • colocação da liga                                              │
│ • meta correspondente ao desafio escolhido                      │
│                                                                  │
│                     linha de assinatura                         │
│                         [Assinar contrato]                      │
└──────────────────────────────────────────────────────────────────┘
```

## Elementos

- Cabeçalho **Proposta da presidência**.
- Escudo e nome do clube atual.
- Saudação usando `manager.formOfAddress`, `firstName` e `lastName`.
- Dados financeiros de `career.finances[club.id]` (com fallback para dados do clube):
  - orçamento de transferências;
  - caixa;
  - dívida registrada.
- Salário semanal apresentado no contrato; atualmente é derivado da reputação do clube.
- Objetivo da liga, baseado na Série A/B, e descrição do `career.challenge`.
- Linha de assinatura e nome do manager.
- Botão primário **Assinar contrato** com ícone de confirmação.

## Estados e variações

- **Inicial:** documento pronto para assinatura.
- **Assinando:** botão desabilitado, texto muda para **Assinando contrato…**, e o nome do manager
  aparece animado na linha de assinatura.
- **Carreira nova recarregada antes de assinar:** o estado não concluído abre a proposta novamente.
- **Carreira antiga:** `onboarding` ausente; não força a assinatura.

## Interações

- **Mouse/toque:** clicar em **Assinar contrato**.
- **Controle:** o foco inicial cai no botão; confirmar inicia a assinatura. O popup não oferece
  cancelamento/volta porque a assinatura é requisito para começar.
- Ao concluir a animação, `contractSigned` passa a `true` e o tutorial é aberto.

## Classes CSS e visual atual

- `.onboarding-modal`, `.contract-modal`, `.contract-document`, `.contract-heading`,
  `.contract-finances`, `.contract-objectives`, `.contract-signature`, `.signature-line`,
  `.signature-mark` e `.contract-sign-button`.
- Superfícies escuras MANDO 27 Legacy, hierarquia de título/eyebrow, resumo financeiro em blocos e
  animação curta de assinatura.

## Regras que o redesign deve preservar

- Não mostrar a Central antes da assinatura em uma carreira nova.
- Preservar a apresentação do clube, metas, dados financeiros e salário semanal.
- A assinatura precisa ser uma ação explícita e persistida, não apenas fechar o popup.
- Não voltar a abrir contrato para um save antigo que já estava em andamento.
- Não apagar nem resetar saves durante a migração visual.
- Manter foco e confirmação plenamente operáveis no controle.

## Problemas atuais e oportunidades

- O salário é calculado para exibição pela reputação; não é atualmente uma remuneração contabilizada
  no orçamento de carreira do manager.
- As metas são texto descritivo e não um contrato negociável.
- A saudação e o texto presidencial são templates locais, não uma mensagem gerada pelo modelo de IA.
- A ficha permite escolher país/nacionalidade e região de origem como texto livre; não há editor
  separado de cabeça e roupa geradas por IA além do fluxo de retrato já existente.
