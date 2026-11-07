# Tela: Popup "Nova carreira"

## Objetivo

Selecionar o mundo oficial do Brasileirão 2026 antes de criar um manager. A carreira usa as Séries A e B com elencos reais, escudos e snapshot congelado em 01/01/2026.

## Entrada e saída

- **Entrada:** menu principal → **Nova carreira**.
- **Escolher Brasileirão 2026:** carrega e valida os dados do mundo, depois abre Criar manager.
- **Voltar**, B/○ ou Esc fecha o modal e retorna ao menu.

## Composição atual

- Modal compartilhado e largo, título **Nova carreira**.
- Um card grande com ícone, nome **Brasileirão 2026**, resumo do snapshot e ação **Jogar**.
- Enquanto os elencos carregam, o card fica desabilitado e o App exibe o indicador de processamento.
- Erros de rede, carregamento ou validação são apresentados em toast; o card continua disponível para nova tentativa.

## Dados e arquivos

- `src/App.tsx` — modal e navegação para a criação do manager.
- `src/game/realWorld.ts` — `loadWorld2026()`.
- `public/data/world-2026.json` — mundo congelado do jogo.
- `src/components/ui.tsx` — modal e controles comuns.

## Interações

- Clique ou ✕/A no card inicia o carregamento.
- Setas/D-pad alternam o foco; Tab permanece dentro do modal.
- B/○/Esc ou Voltar retorna ao menu.

## Regras a preservar no redesign

1. Existe apenas o mundo oficial do Brasileirão 2026; não exibir modo demonstração ou mundo fictício.
2. Selecionar o mundo leva diretamente à tela Criar manager.
3. Preservar carregamento, validação, estado de espera e mensagem explícita de erro.
4. O card permanece operável com controle, mouse e teclado.
