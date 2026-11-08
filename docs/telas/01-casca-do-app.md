# Tela: Casca do aplicativo

## Objetivo

Moldura global do MANDO. Controla a entrada no jogo, a navegação entre as áreas da carreira, o estado de salvamento, os modais globais e os avisos de operação.

## Estados principais

- **Menu principal:** lista local de carreiras, continuar, nova carreira e excluir save.
- **Criação do manager:** fluxo de identidade e clube escolhido.
- **Carreira:** barra de navegação, área de conteúdo da tela ativa e dicas de controle; salvamento silencioso.
- **Partida:** substitui o conteúdo da carreira enquanto houver `activeMatch`; a navegação principal fica oculta.

## Navegação da carreira

As seis áreas, nesta ordem, são:

1. Central
2. Notificações
3. Time
4. Transferências
5. Academia
6. Escritório

Mouse, teclado e controle podem navegar. L1/R1 ou LB/RB alternam áreas; L2/R2 ou LT/RT alternam o submenu explicitamente marcado da área. O foco é lembrado por tela/submenu e restaurado ao fechar janelas. Durante partidas, as áreas principais ficam bloqueadas.

## Padrão de controle

- ✕/A seleciona, entra em edição e confirma; ○/B cancela o rascunho ou volta um nível.
- □/X executa a ação principal contextual; △/Y executa a alternativa.
- Analógico direito apenas rola o painel focado; nunca troca ordenação, mês ou competição.
- R3/RS (F1 no teclado) abre o mapa dos comandos atuais e devolve o foco ao fechar.
- O rodapé e o mapa usam os mesmos registros de ações da tela/janela. Os comandos de fundo não atravessam janelas, conversas ou edição.
- Na edição numérica: ←/→ ajusta; L1/R1 ou LB/RB usa um passo dez vezes maior; △/Y abre teclado numérico. Confirmar salva, voltar cancela.
- Teclado: Enter confirma, Escape volta, X/Y acionam os atalhos fora dos campos, `[`/`]` mudam áreas e Q/E mudam submenus. Texto digitado em campos mantém seu comportamento normal.

## Cabeçalho e rodapé

- Identidade do MANDO, área atual, clube/data/caixa e estado de conexão quando aplicável.
- O rodapé apresenta glifos de controle correspondentes ao dispositivo. Salvando
  e salvo permanecem ocultos; somente erro de persistência é exibido.
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
- Options/START abre Pausa, inclusive na Central. Preferências continuam acessíveis pela interface e pela pausa.
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
2. Salvar em segundo plano sem popup/indicador de sucesso e reportar falhas.
3. Todo modal precisa funcionar com controle, mouse e teclado.
4. Não adicionar conquistas, coletivas, Seleção ou páginas fora do escopo.
   Áudio autorizado: música original, torcida e leitura da caixa postal.
5. Em mobile, manter a orientação e a legibilidade sem esconder ações essenciais.
