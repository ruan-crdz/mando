# Tela: Escritório

## Objetivo

Área de gestão da carreira. Reúne orçamento, objetivos esportivos e financeiros, propostas de trabalho, informações do clube e personalização do manager. Classificação, calendário, histórico da carreira e estatísticas dos atletas abrem suas respectivas vistas de Temporada por atalhos.

## Navegação

Subáreas principais:

- **Orçamento**
- **Objetivos e mercado**
- **Carreira e perfil**

Atalhos adicionais:

- Classificação
- Calendário
- Mercado de trabalho
- Histórico de carreira
- Estatísticas dos atletas
- Personalização

## Orçamento

Apresenta o caixa do clube e os dados financeiros registrados na carreira, incluindo lançamentos de receitas e despesas e histórico de saldo. A tela não oferece gerenciamento de bilheteria, patrocínio, instalações, torcida ou clima econômico.

## Objetivos e mercado

- Mostra os objetivos da Série A ou Série B e a posição/pontuação atual.
- Lista competições da temporada, situação e última fase disputada.
- Exibe o desafio da carreira e seu progresso quando aplicável.
- Lista propostas de trabalho disponíveis, prazo e salário; permite aceitar ou recusar.
- Mantém as decisões importantes acessíveis na caixa de entrada de Notificações.

## Carreira e perfil

Exibe retrato, nome, nacionalidade, idade, dificuldade e aparência do manager. Quando a geração por IA está disponível, permite criar/trocar o retrato usando uma foto.

## Acessos da tela

- **Central:** abre Escritório pelo destino de objetivo ou decisão.
- **Notificações:** mensagens recebidas e conversas com atletas são uma área separada.
- **Temporada:** classificação, calendário, histórico e estatísticas são vistas próprias abertas pelos atalhos.
- **Academia:** olheiros, elenco jovem e desenvolvimento são uma área separada.

## Interações e estado

- Subáreas usam controles segmentados navegáveis por controle, mouse e teclado.
- Mensagens importantes mantêm seu estado de leitura/resolução e podem bloquear o avanço quando exigem uma decisão.
- Propostas de trabalho podem ser aceitas ou recusadas enquanto estiverem disponíveis.
- Personalização atualiza os dados do manager; nenhuma ação de Escritório cria demissão ou ultimato.

## Arquivos-fonte

- `src/screens/Office.tsx`
- `src/components/PortraitCamera.tsx`
- `src/game/engine.ts`
- `src/game/living.ts`
- `src/styles/screens/office.css`
- `src/styles/legacy/10-office-season.css`

## Regras a preservar no redesign

1. Manter orçamento, objetivos, competições e mercado de managers como áreas distintas e legíveis.
2. Preservar acesso direto à Temporada, histórico e estatísticas.
3. Diferenciar proposta de trabalho de mensagem informativa; somente escolhas explícitas alteram a carreira.
4. Não introduzir módulos de confiança/demissão, patrocínio, torcida, instalações ou clube vivo.
