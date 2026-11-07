# Tela: Casca do aplicativo

## Objetivo

Moldura global do MANDO. Controla a entrada no jogo, a navegação entre as áreas da carreira, o estado de salvamento, os modais globais e os avisos de operação.

## Estados principais

- **Menu principal:** lista local de carreiras, continuar, nova carreira e excluir save.
- **Criação do manager:** fluxo de identidade e clube escolhido.
- **Carreira:** barra de navegação, área de conteúdo da tela ativa, dicas de controle e indicador de salvamento.
- **Partida:** substitui o conteúdo da carreira enquanto houver `activeMatch`; a navegação principal fica oculta.

## Navegação da carreira

As seis áreas, nesta ordem, são:

1. Central
2. Notificações
3. Time
4. Transferências
5. Academia
6. Escritório

Mouse, teclado e controle podem navegar. L1/R1 ou LB/RB alternam áreas; o foco deve permanecer visível e previsível. O rodapé mostra apenas ações disponíveis no contexto. Durante a partida, permanecem selecionar/voltar.

## Cabeçalho e rodapé

- Identidade do MANDO, área atual, clube/data/caixa e estado de conexão quando aplicável.
- O rodapé apresenta glifos de controle correspondentes ao dispositivo e estado do save local: salvando, salvo ou erro.
- Cada atualização da carreira grava localmente; o backup na nuvem é consolidado após as ações e tenta sincronizar ao voltar a ficar online ou ocultar a página. O App preserva a versão local mais recente mesmo se uma sincronização antiga terminar depois.

## Modais e overlays globais

- Nova carreira e seleção de mundo.
- Pausa e Preferências de avanço.
- Dia de jogo.
- Exclusão de carreira, com confirmação explícita.
- Proposta/assinatura de contrato inicial e tutorial de carreira.
- Overlay de simulação contínua.
- Aviso de atualização PWA, toast de sucesso/erro e indicador de processamento.

Os modais compartilham foco preso, ação Voltar, restauração de foco e navegação por controle. O fundo não deve aceitar interação quando bloqueado por modal ou operação.

## Regras de contexto

- Uma partida ativa abre diretamente a tela de Partida após carregar o save.
- O avanço pode redirecionar para Notificações ou Dia de jogo quando houver decisão pendente ou compromisso na data.
- Options/START abre Pausa fora da Central e Preferências de avanço na Central.
- Pausa, preferência e overlays de avanço não alteram por si só o resultado da simulação.

## Arquivos-fonte

- `src/App.tsx`
- `src/navigation.ts`
- `src/components/ui.tsx`
- `src/controller/GamepadProvider.tsx`
- `src/controller/FocusManager.ts`
- `src/styles/index.css`
- `src/styles/03-responsive.css`

## Invariantes para o redesign

1. Manter as seis áreas e sua ordem.
2. Preservar o estado visível de salvamento e reportar falhas.
3. Todo modal precisa funcionar com controle, mouse e teclado.
4. Não adicionar conquistas, coletivas, Seleção ou páginas fora do escopo.
   Áudio autorizado: música original, torcida e leitura da caixa postal.
5. Em mobile, manter a orientação e a legibilidade sem esconder ações essenciais.
