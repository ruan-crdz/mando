# Tela: Popup de Preferências de Avanço

## Resumo

Modal (`popup === 'prefs'` em `src\App.tsx`) com **3 cards grandes** para escolher o que acontece ao apertar **Avançar** (□ / X ou o tile de avanço da Central): "Um dia por vez", "Parar em eventos" ou "Nunca parar". A escolha fica em `career.prefs.advance` (salva junto com o save; padrão `day`).

## Como se chega / como se sai

**Abrir**
- **Options / ☰ (START)** na **Central** (aba 0), fora de partida e sem popup.
- Botão "Avanço do calendário: {modo}" no modal de **Pausa** (só fora de partida).

**Fechar**
- Escolher um card (aplica e fecha).
- "Voltar" do cabeçalho, **○ / B**, `Esc` ou **START** → `setPopup(null)` (volta ao jogo, **não** à Pausa, mesmo se aberto pela Pausa).

## Arquivos-fonte

- `src\App.tsx` — `advanceModes` (id/título/texto), bloco `{popup === 'prefs' && career && (<Modal title="Preferências de avanço">)}`, `advance()` (usa `career.prefs.advance`), `useControllerActions` (menu).
- `src\components\ui.tsx` — `Modal` (foco em `[data-autofocus]`).
- `src\game\types.ts` — `Career.prefs.advance: 'day' | 'event' | 'auto'`.
- `src\game\engine.ts` — `advanceStep` (comportamento de `event` e `auto`).
- `src\styles.css` — `.prefs-options`, `.pref-card`, `.pref-card.active` (~l. 5617–5650).

## Wireframe atual (ASCII)

```
┌──────────────────────────────────────────────────────────────┐ ← borda lime
│ PREFERÊNCIAS DE AVANÇO                           [< Voltar]  │
│ O que acontece quando você aperta Avançar (□ / X).           │
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│ │ 1                │ │ 2                │ │ 3              │ │
│ │ Um dia por vez   │ │ Parar em eventos │ │ Nunca parar    │ │
│ │ Cada toque avança│ │ Avança sozinho e │ │ Simula os jogos│ │
│ │ só um dia. …     │ │ para em qualquer…│ │ responde …     │ │
│ └──────────────────┘ └──────────────────┘ └────────────────┘ │
│   (card ativo: verde com contorno lime, foco inicial)        │
└──────────────────────────────────────────────────────────────┘
```

## Elementos

- `Modal title="Preferências de avanço"` (600 px). Cabeçalho com `h2` + "Voltar" (`ChevronLeft`).
- `p.muted`: "O que acontece quando você aperta Avançar (□ / X)." — glifos fixos, não mudam com o tipo de controle.
- `div.prefs-options` com 3 `button.pref-card` (`aria-pressed` = ativo; `data-autofocus` no ativo → foco inicial; classe `.active`):
  - `b` número (1, 2, 3), `strong` título, `span` texto:

| # | id | Título | Texto |
|---|---|---|---|
| 1 | day | Um dia por vez | Cada toque avança só um dia. Controle total do calendário. |
| 2 | event | Parar em eventos | Avança sozinho e para em qualquer mensagem, decisão ou dia de jogo. |
| 3 | auto | Nunca parar | Simula os jogos, responde decisões com apoio e só para no fim da temporada. |

- Sem ícones lucide nos cards.
- Ao escolher: `setCareer({...career, prefs: {...prefs, advance: id}})`, fecha o modal, toast de sucesso "Avanço: {título}." (2,6 s, topo central).

### Efeito de cada modo (em `advance()` / `advanceStep`)
- **day**: avança um único dia (`advanceDay`); se for dia de jogo abre o pré-jogo; com decisão pendente vai para o Escritório.
- **event**: inicia a simulação contínua (doc 11), parando em dia de jogo (abre "Dia de jogo"), decisão pendente, mensagem nova, fim de temporada ou demissão.
- **auto**: simulação contínua que joga as partidas do usuário automaticamente (escala o melhor time se a escalação for inválida), responde decisões com "apoio" e só para no fim da temporada ou se for demitido.

## Estados e variações
- Card ativo (verde + contorno lime, `aria-pressed=true`) × inativo (azul).
- O texto do botão na Pausa e o título no toast refletem o modo atual.
- Não abre dentro de partida (START em partida alterna a Pausa; o item na Pausa some em partida).

## Interações

### Mouse / teclado
- Clique em um card escolhe e fecha. `Esc`/"Voltar" fecha sem mudar. Setas movem o foco. Os números 1/2/3 **não** são atalhos de teclado.

### Controle

| Botão PS5 | Botão Xbox | Ação |
|---|---|---|
| D-pad ←/→ / analógico esquerdo | idem | Move o foco entre os 3 cards (foco inicial no modo ativo). |
| ✕ | A | Escolhe o card focado, fecha e mostra o toast. |
| ○ | B | Fecha sem alterar. |
| Options | ☰ | Fecha sem alterar. |
| □ / △ / L1 / R1 / L2 / R2 | X / Y / LB / RB / LT / RT | Sem efeito (popup aberto). |

## Classes CSS e visual atual

- `.prefs-options`: grid de 3 colunas, gap 12.
- `.pref-card`: coluna, alinhado à esquerda, altura mín. 150 px, padding 16, **raio 14 px** (o resto do jogo usa 3–4 px), degradê `#1b3b8f → #0d1f52`, sem caixa alta no texto; `b` 28 px, opacidade 0,5; `strong` 18 px; `span` 13 px.
- `.pref-card.active`: degradê verde `#11a85a → #0b6b3a` + `box-shadow: inset 0 0 0 3px #b8ff3c`.
- Foco: contorno global de foco (lime).

## Regras que o redesign deve preservar

1. Três modos com exatamente esse comportamento e textos explicativos; o ativo destacado e focado ao abrir.
2. Escolha com um clique/✕, fechando sozinho com toast curto de confirmação (sem X).
3. Acesso por START na Central e pela Pausa; não disponível em partida.
4. Persistência em `career.prefs.advance` (por save).

## Problemas atuais e oportunidades

1. Glifos "□ / X" fixos no texto; deveriam seguir o controle conectado (como a barra de dicas).
2. Raio 14 px e paleta verde destoam do resto (cantos retos/angulados FIFA). Oportunidade: cards estilo tile FIFA com ícone grande por modo (ex.: calendário, play, avanço rápido).
3. Fechar não volta à Pausa quando aberto por ela (as Conquistas voltam) — inconsistente.
4. A dica do rodapé/tile de avanço não mostra o modo atual de forma clara; poderia exibir um selo "Modo: Parar em eventos".
5. START na Central abre esta tela em vez da Pausa — pouco intuitivo; considerar um botão próprio (ex.: R3/L3) ou entrada no tile de avanço.
6. Sem pré-visualização do próximo evento ("Próxima parada: jogo x Flamengo em 3 dias").
