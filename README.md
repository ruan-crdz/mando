# Mando

**Seu clube. Suas decisões.** Simulador de carreira de manager de futebol brasileiro,
2D, com interface original de console, React, TypeScript, Supabase e OpenAI.

## Estado real da implementação

Esta versão é um **primeiro ciclo jogável de 2026**, não a implementação de todo o
roadmap. Não exige conta para experimentar.

| Sistema       | Implementado                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Carreira      | Manager, escolha entre 40 clubes, dificuldades e sete desafios                                          |
| Mundo demo    | 1.120 atletas **sintéticos**, atributos e finanças demonstrativos                                       |
| Mundo oficial | Importação de CSV autorizado, validação e snapshot imutável                                             |
| Série A/B     | 38 rodadas, ida/volta, classificação, playoffs de acesso da B                                           |
| Partidas      | Engine determinística por seed, minuto a minuto, pausas, 1×/2×/4×, cinco substituições, ajustes táticos |
| Elenco        | Campo com troca por controle ou arrastar, overall por posição, condição, lesões, suspensões e contratos |
| Mercado       | Filtros combinados, dinheiro + jogador, salário, propostas NPC, decisão matemática e renovação          |
| Clube         | Mensagens, respostas com consequências, memórias, confiança, objetivos, folha, caixa e gráficos         |
| Save          | IndexedDB, exportação/importação JSON e sincronização manual autenticada com conflito de revisão        |
| IA            | Quatro Edge Functions, Responses API com JSON Schema, retrato, cache e limites de uso                   |
| Plataforma    | Gamepad centralizado, teclado virtual, teclado/mouse, PWA e workflow GitHub Pages                       |

**Ainda não implementado:** partidas de estaduais, Copa do Brasil, Supercopa e
torneios continentais; clubes NPC adicionais; temporadas posteriores a 2026;
demissão/troca de emprego; contratação de staff; categorias de base completas;
instruções individuais; motor específico de bola parada; memória vetorial;
realtime/fila de geração de histórias e entrevistas. A visão 2D exibe posições
ilustrativas, não trajetórias físicas da bola/jogadores. Responsabilidades são
persistidas, mas ainda não afetam cobranças específicas da engine.

**Dados reais não estão incluídos.** Nenhum atleta sintético é apresentado como
real. A lista de clubes da demonstração não certifica uma tabela oficial.
Não há scraping de Transfermarkt nem acesso a fontes proibidas.

## Rodar localmente

Requisitos: Node.js **22.12+** (ou 24+) e npm. Em Windows com política de execução
restritiva, use `npm.cmd` / `npx.cmd` em vez de `npm` / `npx`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra `http://127.0.0.1:5173`, escolha **Nova carreira → Experimentar a demonstração**.
Som não é iniciado automaticamente. Ative-o no cabeçalho; a primeira interação
real do usuário libera o áudio conforme as regras do navegador.

### Validação

```powershell
npm.cmd run lint
npm.cmd test
$env:VITE_BASE_PATH = '/mando/'
npm.cmd run build
npm.cmd run test:e2e
```

Se o Playwright solicitar o navegador:

```powershell
npx.cmd playwright install chromium
```

As migrations são executadas em PostgreSQL via PGlite nos testes, com schemas
`auth` e `storage` de teste. Há testes de RLS entre dois usuários, revisão
otimista, importação, imutabilidade e quotas. Não substituem um teste de
integração contra seu projeto Supabase hospedado.

As funções também têm testes HTTP sem consumir OpenAI:

```powershell
npx.cmd deno check supabase\functions\ai-message\index.ts supabase\functions\ai-news\index.ts supabase\functions\ai-staff\index.ts supabase\functions\ai-manager-avatar\index.ts
npx.cmd deno test --allow-env supabase\functions\_shared\handler.test.ts
```

## Configurar Supabase

Nenhuma senha ou chave secreta precisa ser enviada pelo chat.

### 1. Criar o projeto

1. Acesse <https://supabase.com/dashboard> e entre na sua conta.
2. Crie um projeto em sua organização; escolha nome, região e uma senha forte
   para o banco. Guarde a senha em um gerenciador.
3. Aguarde o banco ficar pronto.
4. Em **SQL Editor**, execute, nesta ordem, a
   [migration inicial](supabase/migrations/202611030001_world_and_careers.sql), a
   [migration de nuvem para demonstração](supabase/migrations/202611030002_demo_cloud.sql) e a
   [migration de conflitos HTTP](supabase/migrations/202611030003_explicit_save_conflicts.sql).
   Alternativamente, com Supabase CLI:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref SEU_PROJECT_REF
npx.cmd supabase db push
```

A migration cria snapshots, clubes, jogadores, saves, views por carreira,
jobs de IA, storage privado, RLS e RPCs. O estado mutável referencia os IDs
do mundo base; não copia nomes/atributos de todos os jogadores a cada save.

Para disponibilizar nuvem e IA também na demonstração:

```powershell
npm.cmd run bundle:demo
```

Execute o SQL gerado em `dist-edge/demo-world.sql` no SQL Editor. Ele publica
somente o snapshot sintético, identificado como `demo`, com 40 clubes e 1.120
atletas. Não é selecionado pela opção **Carreira oficial**. O seed é repetível,
mas recusa substituir um snapshot por dados diferentes.

Se executou as migrations pelo SQL Editor e depois passar a usar a CLI,
registre o histórico após vincular o projeto, antes de `db push`:

```powershell
npx.cmd supabase migration repair 202611030001 202611030002 202611030003 --status applied
```

O [smoke test hospedado](supabase/tests/hosted-smoke.sql) verifica revisões,
conflitos, RLS entre usuários, permissões e deduplicação de IA e storage privado.
Execute como `postgres` no SQL Editor. Os dados temporários são revertidos com
`rollback`; não cria usuários permanentes nem consome OpenAI.

### 2. Conectar o frontend

Em **Project Settings → API / API Keys**, copie a Project URL e a
**publishable key**. A chave legada `anon` também funciona.

Copie [.env.example](.env.example) para `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_BASE_PATH=/
```

Reinicie o Vite. Nunca use `service_role`, secret key ou OpenAI em variáveis `VITE_*`.

### 3. Login

Em **Authentication → URL Configuration**:

- Site URL: `https://ruan-crdz.github.io/mando/` quando publicado;
- Redirect URLs: `https://ruan-crdz.github.io/mando/` e
  `http://127.0.0.1:5173/` (para desenvolvimento).

Habilite o provedor Email. Para produção, configure SMTP próprio e limites de
envio. No jogo, abra **Configurações**, informe seu e-mail e use o link recebido.
Login não gera chamadas pagas à OpenAI.

### 4. Publicar o snapshot oficial

Este passo exige um CSV autorizado dos elencos em **01/01/2026**. Não é obtido
automaticamente e não deve ser substituído por nomes/atributos inventados.

Os modelos estão em [data/](data/). CSV UTF-8, com cabeçalho, valores numéricos
sem `R$`, pontos como separador decimal e datas ISO `YYYY-MM-DD`.

- **Clubes:** `id,name,short,league,color,state,stadium,reputation,budget,debt`.
  `league`: A/B, 20 em cada; cor: `#RRGGBB`; orçamento/dívida em BRL.
- **Atletas:** `id,clubId,name,birthDate,nationality,position,foot,potential,uncertainty,value,wage,contractEnd`
  e os 19 atributos presentes no template.
- Posições: `GK,CB,LB,RB,DM,CM,AM,LW,RW,ST`. Pé: `D,E,A`.
- Atributos e potencial: 1–99. Incerteza: 0–10. Salário **mensal**, em BRL.
- Cada clube: 18–75 atletas, ao menos dois goleiros; todos os IDs devem ser únicos.
- Registre fonte/data de coleta e licença/autorização de redistribuição.

Para conceder a **si mesmo** permissão de publicação, substitua o e-mail
na consulta abaixo, execute no SQL Editor e saia/entre novamente no jogo:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'SEU_EMAIL';
```

Somente `app_metadata` atribuído pelo servidor concede essa permissão.
Abra Configurações → **Publicar snapshot oficial**, carregue ambos os CSVs e
publique. Erros interrompem a importação inteira: não há preenchimento automático
de atributos ausentes. Cada publicação ganha um novo ID. Saves antigos continuam
referenciando o snapshot original imutável.

### 5. Integrar OpenAI no servidor

Na OpenAI, crie uma API key de projeto com orçamento e limites de uso.
Em **Supabase → Edge Functions → Secrets**, adicione:

```text
OPENAI_API_KEY = sua chave privada
ALLOWED_ORIGINS = https://ruan-crdz.github.io,http://127.0.0.1:5173
OPENAI_TEXT_MODEL = gpt-4.1-mini
OPENAI_IMAGE_MODEL = gpt-image-1
```

Os nomes dos modelos são configuráveis. A disponibilidade depende do seu projeto
OpenAI; imagens podem exigir verificação da organização. O aplicativo informa
falhas de API e não as disfarça como respostas de sucesso.

Publique as funções:

```powershell
npx.cmd supabase functions deploy ai-message
npx.cmd supabase functions deploy ai-news
npx.cmd supabase functions deploy ai-staff
npx.cmd supabase functions deploy ai-manager-avatar
```

As configurações de JWT estão em [supabase/config.toml](supabase/config.toml).
Cada função verifica explicitamente o bearer token com `auth.getUser()` antes
de consultar dados ou consumir a OpenAI, e filtra a carreira pelo proprietário.

Alternativa sem CLI: execute `npm.cmd run bundle:edge` e carregue o conteúdo de
cada arquivo gerado em `dist-edge/` no editor de Edge Functions do dashboard.
Use exatamente os quatro nomes acima. Após publicar, confirme nas configurações
de cada função que **Verify JWT with legacy secret** está desligado; a
autenticação é realizada pelo handler, não removida.

**Uso:** entre na conta, sincronize uma carreira e abra uma mensagem no escritório.
Funciona na demonstração publicada ou em um snapshot oficial autorizado.
O botão de IA sincroniza o evento, gera/cacheia o texto e salva o resultado.
O retrato é gerado na aba Comissão e perfil. Não há chamadas por jogador/dia
nem geração automática ao avançar.
Carreiras demonstrativas antigas com ID `demo-2026-v1` continuam funcionando
offline; para nuvem, crie uma nova demonstração.

Limites: 30 jobs por usuário/dia, um retrato por usuário/dia e uma geração de
retrato por carreira. Jobs são deduplicados por carreira/evento/tipo. Falhas
permanecem explícitas para evitar reenvios pagos involuntários; o administrador
deve conferir logs e cobrança antes de remover um job falho para liberar retry.
Logs não incluem chaves, prompts ou conversas.

## GitHub Pages

1. Em **Settings → Pages**, selecione **GitHub Actions** como origem.
2. Em **Settings → Secrets and variables → Actions → Variables**, adicione
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. São valores públicos.
3. Faça push para `main` ou execute **Validate and deploy Mando** manualmente.
4. O workflow valida lint, engine, migrations, Edge Functions, build e navegador
   antes de publicar <https://ruan-crdz.github.io/mando/>.

O deploy usa `/mando/`, não requer roteamento no servidor e gera o service worker
com paths relativos ao projeto. Para um domínio próprio, altere `VITE_BASE_PATH`
para `/` no workflow e as origens/URLs de autenticação.

Após o primeiro carregamento online, os assets ficam disponíveis offline.
A instalação é oferecida pelo navegador (ou no menu de pausa quando disponível).
No iPhone/iPad, use Compartilhar → Adicionar à Tela de Início. Instalação,
orientação e modo standalone dependem do navegador; não forçamos tela cheia.
Ao existir atualização, o jogo pede confirmação antes de recarregar.

## Controles

Conecte um controle padrão Xbox/DualSense via USB ou Bluetooth e pressione um
botão. `navigator.getGamepads()` roda somente no provider central.

| Ação                        | Xbox                            | PlayStation                     | Teclado           |
| --------------------------- | ------------------------------- | ------------------------------- | ----------------- |
| Navegar                     | Direcional / analógico esquerdo | Direcional / analógico esquerdo | Setas / Tab       |
| Selecionar                  | A                               | ✕                               | Enter / Espaço    |
| Voltar / fechar             | B                               | ○                               | Escape            |
| Aba anterior/próxima        | LB / RB                         | L1 / R1                         | `[` / `]`         |
| Avançar dia fora da partida | X                               | □                               | Botão Avançar dia |
| Conexão e informações       | Y                               | △                               | Configurações     |
| Menu / pausa                | Menu                            | Options                         | Menu da carreira  |

Campos de texto abrem um teclado virtual pelo controle. Em seletores e sliders,
esquerda/direita altera o valor; cima/baixo muda o foco. A UI troca os símbolos
automaticamente pelo último dispositivo usado. Controles sem `mapping=standard`
são identificados como incompatíveis em vez de ter botões interpretados
incorretamente. O suporte em hardware físico depende do navegador/driver;
os testes automatizados usam gamepads virtuais. Escolha de arquivos externos
também pode depender do seletor nativo do sistema.

## Saves, simulação e limites

- IndexedDB é a fonte local, não memória de um componente. O indicador mostra
  erro explicitamente se o navegador negar escrita ou não houver espaço.
- Exporte regularmente. Limpar os dados do site apaga saves locais. Um JSON
  exportado contém o snapshot para permitir restauração offline.
- Uma carreira em nuvem pertence ao usuário autenticado. A gravação exige a
  revisão anterior e rejeita sobrescrita concorrente. **Exportar o save local
  antes de carregar a nuvem** evita perder progresso de outra sessão.
- Cada minuto usa uma seed derivada da partida/minuto. Mesmas entradas e
  mesmas intervenções produzem o mesmo resultado; mudar a tática muda o jogo.
- O motor usa atributos por posição, condição, moral, tática e mando.
  Dificuldade muda negociação, informação, sensibilidade e reação tática,
  nunca adiciona overall secreto ao adversário.
- O calendário usa as datas gerais de 2026, mas **gera as rodadas** e os
  critérios de desempate da simulação; não é uma cópia da tabela oficial.
  O formato dos playoffs deve ser validado contra o REC antes de lançar
  uma base oficial. A nota pública da CBF confirma os confrontos 3º/6º e 4º/5º.
- A simulação solo roda no cliente: os saves são validados, mas não são
  anticheat nem adequados a rankings competitivos.
- IA é uma camada opcional de apresentação. O modelo não calcula gols,
  aceita propostas, altera relações nem determina lesões.

## Organização

```text
src/
  game/         Tipos validados, snapshot demo e motores determinísticos
  controller/   GamepadProvider, foco espacial e mapas de símbolos
  screens/      Fluxo inicial e áreas do clube
  components/   Componentes visuais e configuração
  services/     IndexedDB, Supabase, importação e validação
supabase/
  migrations/   Banco, políticas RLS, RPCs e storage
  functions/    Auth, limites, cache, OpenAI e testes HTTP
tests/          Fluxos reais de navegador e controles virtuais
```

## Referências e direitos

O design, os escudos tipográficos e a ilustração do manager são originais.
Nenhum asset da EA, Football Manager ou Brasfoot é distribuído.
Nomes de clubes são referências factuais; dados oficiais e direitos de
imagem/marca precisam de avaliação própria antes de um lançamento público.

- [CBF — formato da Série B 2026](https://www.cbf.com.br/futebol-brasileiro/noticias/undefined/portuguesa-x-parnahyba/cbf-divulga-documentos-tecnicos-do-brasileirao-da-serie-b-de-2026)
- [MDN — Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OpenAI — Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

Código original sob [MIT](LICENSE). Fontes externas de dados não herdam
automaticamente a licença deste repositório.
