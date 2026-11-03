# MANDO — WORLD_2026 | 40 clubes, 1,758 registros de elenco

**Status:** base preliminar **com nomes reais coletados**, não uma fotografia histórica validada de 01/01/2026.

- 20 clubes Série A, 20 clubes Série B; **todos têm elencos nominais**.
- 1758 linhas de jogadores, incluindo reservas e atletas das listagens 2026; IDs gerados pelo MANDO.
- 50 datas de nascimento provenientes de cadastro anterior da temporada; 904 idades de fontes 2026 (ou derivadas de nascimento).
- 135 valores de mercado **externos** associados às linhas. **Alturas confirmadas: 0**; **salários públicos confirmados: 0**.
- Todos os 1758 atletas têm overall, potencial, atributos, valor interno e salário **ficcionais calculados pelo MANDO**, com flag sintética.

## Arquivos

- `clubs.csv/json`: os 40 clubes.
- `players.csv/json`: 1 linha por entrada nominal de elenco, incluindo dados conhecidos e dados fictícios do jogo separados.
- `player-attributes.csv/json`: atributos sintéticos, chave estrangeira `player_id`.
- `coverage.csv/json`: contagem por clube e fonte.
- `manifest.json`: contadores e ressalvas de qualidade.

## Interpretação dos campos

`birth_date`, `height_cm`, `dominant_foot`, `contract_end_date`, `salary_public_eur_month` e `market_value_external_eur` **vazios = desconhecidos**. Não substituir por 0.

`height_cm_mando_placeholder` é ALTURA FICTÍCIA temporária e nunca deve ser apresentada como a altura real do atleta.

`age_reported_in_source` NÃO é a idade exata em 01/01/2026. Guias de 2026, sites atuais e fontes secundárias têm datas não sincronizadas.

`overall_mando`, `potential_mando`, atributos, `market_value_mando_eur` e `salary_mando_eur_month` são **simulações iniciais para jogar** (não EA FC, FIFA, salário real ou estimativas jornalísticas). As avaliações devem passar por revisão e calibragem.

`primary_position` pode ser apenas `DEF`, `MEI` e `ATA` quando a fonte não discrimina subposições.

`name_is_full_legal_name_verified=false` significa que o site pode exibir apenas o nome de jogo.

**CRÍTICO:** iniciar o jogo em 01/01/2026 com o elenco dinâmico dos sites significa incluir possíveis transferências futuras. Se o objetivo for consistência histórica, precisa de validação individual de transferências e datas, antes de tratar isso como elenco congelado de janeiro.

## Método de ratings (não factual)

Rating-base da Série A 71, Série B 63; variação determinística por ID e faixa etária; quando há preço externo, combinação heurística com função logarítmica. Alguns nomes de destaque receberam calibração editorial inicial. Potencial depende do rating/idade disponível. Valor e salário internos são funções do overall e da faixa etária. Os atributos são variações de game balance por macroposição. Estes números **não medem desempenho real de campo**.

## Fontes

- oGol, guia 2026: https://www.ogol.com.br/noticias/guia-do-brasileirao-2026-os-craques-as-novidades-e-o-que-ficar-de-olho-nos-20-times/1036937
- oGol elencos: https://www.ogol.com.br/equipe/palmeiras e https://www.ogol.com.br/equipe/santos e https://www.ogol.com.br/equipe/ceara
- Guiagol, clubes 2026: https://guiagol.com/br/time/novorizontino/ (e páginas de equipes em `coverage.csv`)
- Criciúma, elenco: https://www.criciuma.com.br/m/elenco-profissional
- Avaí, elenco: https://avai.com.br/futebol/profissional/
- Transfermarkt (dados parciais da versão anterior), nas linhas marcadas com `market_value_external_source_url`.

Fonte URL de cada jogador incluída diretamente em `source_roster_url`.

## Importação no Supabase

1. Importe `clubs.csv` por `club_id`.
2. Importe `players.csv` por `player_id`, chave para `club_id`.
3. Importe `player-attributes.csv` com chave `player_id`.
4. Use política de UTF-8 e campos vazios como `NULL`.
5. Trate `WORLD_2026` como estágio **DRAFT**, não publique como base histórica oficial até revisão.

O CSV preserva macroposição, nacionalidade quando disponível, origem e data de extração. Os componentes React devem consultar o Supabase, nunca manter dados hardcoded.
