# Tela: Central (hub da carreira)

## Resumo

Primeira aba da carreira (`tab === 0`). O Ato 3 usa um mosaico assimétrico com próximo jogo protagonista, calendário horizontal e navegação espacial por controle. Em mobile, o layout só é liberado em **landscape**: duas colunas compactas com rolagem vertical, sem criar uma versão em retrato.

O hub usa dados reais do save e mantém as regras de avanço, demissão, pendências e virada de temporada. Não adiciona eventos nem altera a simulação.

## Arquivos-fonte

- `src/screens/CareerCentral.tsx`: contexto, mosaico, precedência das ações e ticker.
- `src/components/CareerCalendar.tsx`: calendário compartilhado com a simulação.
- `src/components/LivingPanels.tsx`: `MarketFeed`, com mercado e rede de olheiros.
- `src/App.tsx`: callbacks, navegação, preferências e loop de avanço.
- `src/components/ui.tsx`: escudos, retrato, formatação e modal.
- `src/controller/GamepadProvider.tsx`, `FocusManager.ts`, `ControllerButtonHint.tsx`: controles, foco e glifos.
- `src/styles/legacy/06-hub.css`: acabamento atual; sobrescreve os estilos-base da Central.
- `src/game/calendar.ts`, `engine.ts`, `matches.ts`, `ratings.ts`, `npc.ts`: dados e regras existentes, sem alteração pelo redesign.

## Composição desktop

Largura máxima de 1720 px, cinco colunas e duas linhas:

```text
CLUBE / BOM TRABALHO                 TEMPORADA / DATA / MODO DE AVANÇO

   HOJE          +1             +2             +3             +4

+------------------------------+--------------+--------------+-------------+
| PRÓXIMO JOGO                 | AVANÇAR      | MERCADO /    | MANAGER     |
| escudos, competição,         | dia / evento | OLHEIROS     | retrato     |
| fase, data e estádio         | / temporada  |              |             |
+------------------------------+--------------+--------------+ nome        |
| MENSAGENS                    | SEU TIME     | TABELA       | confiança   |
| até quatro mensagens         | OVR / elenco | posição/caixa|             |
+------------------------------+--------------+--------------+-------------+

MANDO NEWS
```

Áreas CSS: `'fix fix adv market man' / 'inb inb sq tab man'`. O próximo jogo ocupa duas colunas; o manager ocupa duas linhas. O ticker permanece abaixo do mosaico.

Três profundidades: carvão `#151d2b`, ardósia `#253348` e superfície elevada `#334258`. O próximo jogo tem arte autoral de gramado em CSS; avanço e dia atual usam petróleo/ciano; alertas usam coral localizado. Mercado tem violeta discreto. O foco usa o sistema global Legacy, sem trocar os botões por gestos.

## Composição em celular deitado

Até 1100 px de largura, com orientação landscape, o palco da Central rola verticalmente e o mosaico passa a duas colunas:

```text
+-------------------------------+
| calendário de cinco dias      |
+-------------------------------+
| próximo jogo (largura total)  |
+----------------+--------------+
| avançar        | manager      |
+----------------+--------------+
| mercado        | mensagens    |
+----------------+--------------+
| seu time       | tabela       |
+----------------+--------------+
```

As quatro linhas do mosaico têm alturas de 160, 160, 175 e 135 px. Cabeçalho, agenda, logos, textos e espaçamentos são reduzidos para preservar legibilidade no espaço menor. O conteúdo pode exigir rolagem; não há mosaico em retrato. O CSS também compacta preferências, conquistas e calendário modal nessa orientação.

## Entradas e saídas

- Criar/continuar carreira e encerrar partida levam à Central.
- Aba CENTRAL ou L1/R1 (LB/RB) navegam até ela.
- Próximo jogo: pendência leva ao Escritório; jogo hoje abre o pré-jogo; jogo futuro ou ausência de jogo levam à Temporada.
- Manager e mensagens levam ao Escritório. A linha da prévia não seleciona uma mensagem específica.
- Seu time leva ao Time; tabela leva à Temporada.
- Botão com o modo atual abre Preferências por mouse, toque ou confirmação.
- B/○/Esc abre Pausa; START abre Preferências na Central.

## Elementos e dados

### Contexto e calendário

- Clube, saudação com primeiro nome, temporada, fase e data longa.
- Fase: ENCERRADA; PRÉ-TEMPORADA antes de 11/01; EM ANDAMENTO nos demais dias.
- Botão mostra Um dia por vez, Parar em eventos ou Nunca parar.
- `CareerCalendar` mostra hoje e os quatro dias seguintes, com dia da semana, número e mês.
- Partidas do clube usam os fixtures do save e a sigla do adversário. Mensagens usam sua data; decisões pendentes recebem marcador próprio.
- O dia atual tem `aria-current="date"` e destaque petróleo/ciano. Datas mudam junto com o save; não se inventam acontecimentos futuros.

### Próximo jogo

- Foco inicial (`data-autofocus`).
- Mandante e visitante com nomes e escudos; competição, fase/rodada, data e estádio do mandante.
- Jogo hoje: HOJE É DIA DE JOGO. Sem fixture: FIM DA TEMPORADA, troféu e ano.

### Avanço: precedência preservada

| Primeira condição verdadeira                      | Título               | Clique no tile           |
| ------------------------------------------------- | -------------------- | ------------------------ |
| Demitido                                          | Escolher novo clube  | Escritório/Diretoria     |
| Modo auto, sem demissão e sem temporada encerrada | Simular temporada    | Inicia avanço automático |
| Decisão pendente                                  | Abrir escritório     | Escritório               |
| Temporada encerrada                               | Iniciar próximo ano  | `startNextSeason`        |
| Dia de jogo                                       | Dia de jogo          | Pré-jogo                 |
| Modo event                                        | Avançar até o evento | Inicia avanço contínuo   |
| Modo day                                          | Avançar dia          | Avança um dia            |

O tile mostra hoje e amanhã, mesmo quando o modo avança vários dias. CTA prioriza processamento, propostas de emprego, pendências e nova temporada; caso contrário mostra Continuar. A dica de START usa glifo do dispositivo.

**O atalho □/X continua chamando `advance()` diretamente**, não a ação contextual do tile: não inicia uma nova temporada nem ignora a validação do motor. No modo dia, pendência/dia de jogo/fim de temporada podem gerar erro explícito; no modo evento produzem a parada correspondente.

### Mercado e rede de olheiros

Tile `MarketFeed`, dentro do mosaico, com duas páginas:

1. **Mercado da Bola**: manchete ainda válida, torcida com medidor e seis últimas movimentações, da mais recente para a mais antiga. Mostra atleta, origem, destino e valor ou Livre; tem estado vazio.
2. **Rede de olheiros**: quantidade de olheiros/3, jovens nos relatórios, nome/região/nível de cada olheiro e progresso real X/7. Sem olheiros, orienta contratar no Escritório.

Setas e dots clicáveis alternam conteúdo. Analógico direito horizontal também alterna enquanto algum botão do tile tem foco, usando `useStickX`; `,` e `.` são os equivalentes de teclado. Modal aberto impede essa rotação. Não há rotação automática.

O botão Escritório mantém esse destino geral; não promete abrir diretamente a sub-aba de olheiros.

### Manager, mensagens, time e tabela

- **Manager**: retrato por IA ou silhueta existente, nome completo e confiança com medidor acessível.
- **Mensagens**: contador de não lidas e quatro mensagens mais recentes; remetente, data, título, distinção lida/não lida e DECISÃO PENDENTE. A lista rola internamente; tem estado vazio.
- **Seu time**: formação, overall médio calculado sobre o elenco, quantidade de atletas e lesionados.
- **Tabela**: série, posição nas classificações existentes e caixa.
- **MANDO NEWS**: notícia mais recente ou frase inicial do projeto.
- Mundo demo mantém a faixa de identificação; header e footer pertencem à casca do app.

## Controles

| Entrada                               | Ação                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| D-pad/analógico esquerdo ou setas     | Navegação espacial                                   |
| A/✕ ou Enter/Espaço                   | Ativa o botão focado                                 |
| B/○ ou Esc                            | Abre Pausa, fora de modal                            |
| X/□                                   | Avança conforme preferência; durante simulação, para |
| Y/△                                   | Escritório                                           |
| LB/RB ou L1/R1, `[`/`]`               | Troca de aba                                         |
| START                                 | Preferências na Central                              |
| Analógico direito horizontal, `,`/`.` | Alterna o conteúdo do tile de mercado focado         |
| Analógico direito vertical            | Rola a área rolável mais próxima                     |

Durante a simulação, header e palco ficam `inert`; troca de abas e atalho para Escritório são bloqueados. O calendário modal recebe o foco e permite parar sem reiniciar contadores. Ver [simulação contínua](11-overlay-simulacao-continua.md).

## Invariantes

1. Abrir focando o próximo jogo.
2. Preservar todos os destinos e a precedência do avanço.
3. Usar clube, elenco, calendário e mensagens do save.
4. Manter alternativas clicáveis para as subopções do controle.
5. Não alterar engine, regras, formato dos saves ou ritmo de 110 ms.
6. Referências de composição: desktop 1366×768 e 1920×1080; mobile landscape 844×390 com rolagem vertical.
