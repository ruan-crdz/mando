# Tela: Escritório

## Objetivo

Área de gestão da carreira, com um único submenu persistente. Classificação,
calendário, histórico e estatísticas reutilizam os painéis de Temporada dentro
do Escritório, sem trocar de área ou abrir outro submenu.

## Navegação

Oito opções no mesmo nível, nesta ordem:

1. Objetivos e mercado
2. Classificação
3. Calendário
4. Orçamento
5. Mercado de trabalho
6. Histórico de carreira
7. Estatísticas dos atletas
8. Personalização

LT/RT ou L2/R2 percorrem estas oito opções. Não há as três abas antigas.

## Orçamento

Apresenta o caixa do clube e os dados financeiros registrados na carreira, incluindo lançamentos de receitas e despesas e histórico de saldo. A tela não oferece gerenciamento de bilheteria, patrocínio, instalações, torcida ou clima econômico.

## Objetivos e mercado

- Mostra os objetivos da Série A ou Série B e a posição/pontuação atual.
- Lista competições da temporada, situação e última fase disputada.
- Exibe o desafio da carreira e seu progresso quando aplicável.
- Propostas com prazo, salário e aceitar/recusar ficam em Mercado de trabalho.
- Mantém as decisões importantes acessíveis na caixa de entrada de Notificações.

## Personalização

Permite editar nome, sobrenome, nacionalidade, país/região, região de nascimento,
data de nascimento, gênero, tratamento, vestuário e aparência. A idade é
recalculada na data da carreira. Dia, mês e ano são alterados com ←/→ após
selecionar o campo com ✕/A; ✕/A ou ○/B conclui a edição. X/□ salva o formulário
validado. Retrato por câmera/IA continua disponível quando o serviço está configurado.

## Acessos da tela

- **Central:** abre Escritório pelo destino de objetivo ou decisão.
- **Notificações:** mensagens recebidas e conversas com atletas são uma área separada.
- **Temporada:** seus painéis são incorporados ao Escritório; a navegação permanece a mesma.
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
