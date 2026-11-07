# Tela: Temporada

## Objetivo

Apresentar classificação, calendário, estatísticas e histórico da carreira. A tela é aberta pelos atalhos do Escritório ou pelo card do próximo jogo quando não há fixture futuro.

## Subáreas

- **Classificação / Chaves e grupos:** tabela da competição atual ou estrutura de grupos/chaves.
- **Calendário:** partidas da temporada por data, competição e rodada/fase.
- **Estatísticas:** números dos atletas e resultados registrados.
- **Carreira:** histórico do manager e temporadas anteriores.

## Composição

- Cabeçalho identifica temporada e subárea; no modo Escritório há ação para voltar.
- Navegação por controles segmentados.
- Tabelas e listas devem manter competição, posição, escudos, nomes e números alinhados.
- Selecionar uma data pode abrir os jogos correspondentes no calendário; estatísticas e histórico refletem os dados persistidos.

## Dados utilizados

Fixtures e resultados, classificação calculada pelo engine, estatísticas de partidas e histórico da carreira do manager.

## Regras a preservar no redesign

1. Manter as quatro subáreas acima e seus dados reais.
2. Distinguir a liga atual de copas e fases eliminatórias.
3. Preservar navegação de retorno ao Escritório quando a tela for aberta por um atalho.
4. Não adicionar sala de troféus, prêmios individuais ou Seleção.

## Arquivos-fonte

- `src/screens/Season.tsx`
- `src/components/CareerCalendar.tsx`
- `src/components/LivingPanels.tsx`
- `src/game/competitions.ts`
- `src/game/calendar.ts`
- `src/styles/legacy/10-office-season.css`
