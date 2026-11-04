# Tela: Popup de Conquistas

## Resumo

Modal largo (`popup === 'achievements'` em `src\App.tsx`) que lista as **22 conquistas** da carreira em uma grade de cards, separando desbloqueadas (coloridas pelo tier bronze/prata/ouro, com data) de bloqueadas (esmaecidas, cadeado). Relacionado: o **toast de conquista desbloqueada** (`.achievement-toast`), que aparece sozinho durante o jogo.

## Como se chega / como se sai

- **Entrada única**: botão "Conquistas ({n}/22)" no modal de **Pausa** (doc 08), disponível fora e dentro de partida.
- **Saída**: botão "Voltar" do cabeçalho, **○ / B** ou `Esc` → `onClose={() => setPopup('pause')}` (volta à Pausa, não ao jogo). **START / Options / ☰** também volta para a **Pausa** (`setPopup(p => p === 'pause' || p === 'prefs' ? null : 'pause')`).

## Arquivos-fonte

- `src\App.tsx` — bloco `{popup === 'achievements' && career && (<Modal title="Conquistas" … wide>)}`; efeito de desbloqueio (`unlockAchievements` a cada mudança de `career`, `rumble('goal')`), fila `unlocked` e toast `.achievement-toast` (4,2 s por conquista).
- `src\game\achievements.ts` — lista `achievements` (id, título, descrição, tier, regra), `newAchievements`, `unlockAchievements` (grava `career.achievements[id] = data`).
- `src\components\ui.tsx` — `Modal`, `dateLabel`.
- `src\styles.css` — `.achievement-grid`, `.achievement-card(.unlocked)`, `.tier-bronze/.tier-silver/.tier-gold`, `.achievement-toast`, `@keyframes achievement-in` (~l. 5416–5527); `.dialog.wide`.

## Wireframe atual (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐ ← borda lime
│ CONQUISTAS                                                     [< Voltar]  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │🏅 (cor tier) │ │🏅            │ │🔒 (esmaecido)│ │🔒            │        │
│ │Caneta na mão │ │Primeira vitó…│ │Goleada       │ │Muralha       │        │
│ │Assine seu    │ │Vença sua pri…│ │Vença por 4…  │ │Termine cinco…│        │
│ │primeiro…     │ │              │ │              │ │              │        │
│ │01 DE JAN. …  │ │15 DE FEV. …  │ │BLOQUEADA     │ │BLOQUEADA     │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│ … (grade auto-fill ≥190px, altura máx. 62vh com rolagem) …                │
└────────────────────────────────────────────────────────────────────────────┘

Toast (canto inferior direito, desliza da direita):
                                        ┌───────────────────────────────┐
                                        ▌🏅 CONQUISTA DESBLOQUEADA      │
                                        ▌   Primeira vitória            │
                                        ▌   Vença sua primeira partida… │
                                        └───────────────────────────────┘
```

## Elementos

### Modal
- `Modal title="Conquistas" wide` (até 980 px). Cabeçalho: `h2` "Conquistas" + "Voltar" (`ChevronLeft`).
- `div.achievement-grid`: um `button` por conquista na ordem de `achievements` (os botões existem para navegação por foco; **não têm ação** de clique).
- Cada card `button.achievement-card.tier-{bronze|silver|gold}` (+ `.unlocked` se desbloqueada):
  - Ícone: `Award` (30) se desbloqueada (na cor do tier), `Lock` (26) se bloqueada.
  - `b`: título; `span`: descrição; `small` (rodapé, caixa alta): data de desbloqueio (`dateLabel(date)`, ex. "15 de fev. de 2026") ou "Bloqueada".
  - `aria-label`: "{título}: {descrição}. Desbloqueada em {data}" / "… Bloqueada".
- Dados: `career.achievements` (`Record<id, data ISO>`).

### Lista completa (22)

| # | id | Título | Descrição | Tier |
|---|---|---|---|---|
| 1 | contrato | Caneta na mão | Assine seu primeiro contrato como manager. | bronze |
| 2 | primeira-vitoria | Primeira vitória | Vença sua primeira partida oficial. | bronze |
| 3 | goleada | Goleada | Vença por quatro ou mais gols de diferença. | prata |
| 4 | muralha | Muralha | Termine cinco jogos sem sofrer gols. | prata |
| 5 | embalado | Embalado | Vença cinco partidas seguidas. | prata |
| 6 | invicto | Invencível | Fique dez jogos sem perder. | ouro |
| 7 | artilharia | Máquina de gols | Marque 50 gols com seu clube. | prata |
| 8 | primeira-contratacao | Reforço confirmado | Conclua sua primeira contratação. | bronze |
| 9 | bomba | Contratação bombástica | Contrate um atleta por R$ 30 milhões ou mais. | ouro |
| 10 | venda | Negociador | Arrecade R$ 20 milhões em vendas. | prata |
| 11 | cofre | Cofre cheio | Tenha R$ 150 milhões em caixa. | ouro |
| 12 | titulo | Primeira taça | Conquiste seu primeiro título. | prata |
| 13 | brasileirao | Campeão brasileiro | Vença a Série A. | ouro |
| 14 | libertadores | Glória eterna | Conquiste a Libertadores. | ouro |
| 15 | copa-do-brasil | Rei de copas | Conquiste a Copa do Brasil. | ouro |
| 16 | dobradinha | Dobradinha | Ganhe dois títulos na mesma temporada. | ouro |
| 17 | acesso | Subiu! | Conquiste o acesso à Série A. | ouro |
| 18 | diretoria | Homem de confiança | Alcance 90% de confiança da diretoria. | prata |
| 19 | professor | Professor | Ensine uma nova posição a um atleta no treino. | prata |
| 20 | numeracao | Dono da numeração | Mude o número da camisa de um atleta. | bronze |
| 21 | cem-dias | Cem dias de trabalho | Complete 100 dias no cargo. | bronze |
| 22 | temporada | Missão cumprida | Complete uma temporada inteira. | prata |

Cores de tier: bronze `#e0904a`, prata `#d8e3f0`, ouro `#ffd400` (variável `--tier`).

### Toast de conquista (global, fora do modal)
- Quando `career` muda, `unlockAchievements` grava as novas conquistas com a data do jogo e as enfileira; vibra `goal`.
- `div.achievement-toast.tier-{tier}` (role status): `Award` (30) + "Conquista desbloqueada" (small, cor do tier) + título (`b`, 22 px) + descrição (`em`).
- Mostra uma por vez, 4,2 s cada (`setTimeout` + animação `achievement-in`: entra deslizando da direita, some deslizando), sem botão de fechar, `pointer-events: none`. Posição fixa `right: 18px; bottom: 120px`.
- "Caneta na mão" desbloqueia logo ao criar a carreira.

## Estados e variações
- Card desbloqueado (opacidade 1, borda superior na cor do tier, degradê claro, ícone colorido, data) × bloqueado (opacidade 0,6, borda superior branca 15%, cadeado, "Bloqueada").
- Carreira nova: só "Caneta na mão" desbloqueada.
- Grade rola quando passa de 62vh.
- Não há progresso parcial (ex.: 3/5 vitórias) nem conquistas ocultas.

## Interações

### Mouse / teclado
- Clique nos cards não faz nada. "Voltar" ou `Esc` retorna à Pausa. Setas/Tab movem o foco entre cards (escopo preso ao modal).

### Controle

| Botão PS5 | Botão Xbox | Ação |
|---|---|---|
| D-pad / analógico esquerdo | idem | Move o foco entre os cards (foco inicial: primeiro card). A rolagem acompanha o foco. |
| ✕ | A | Sem efeito (card sem ação). |
| ○ | B | Volta à Pausa. |
| Options | ☰ | Volta à Pausa. |
| Analógico direito | idem | Rola a grade. |
| □ / △ / L1 / R1 / L2 / R2 | X / Y / LB / RB / LT / RT | Sem efeito (popup aberto). |

## Classes CSS e visual atual

- `.dialog.wide` (980 px, degradê azul, borda superior lime).
- `.achievement-grid`: `grid-template-columns: repeat(auto-fill, minmax(190px, 1fr))`, gap 10, `max-height: 62vh`, `overflow-y: auto`.
- `.achievement-card`: coluna, altura mín. 132 px, padding 12×14, fundo branco 5%, `border-top: 4px` branco 15%, opacidade 0,6; `b` display 18 px; `span` 13 px `--ink-2`; `small` 11 px caixa alta `--ink-3`.
- `.achievement-card.unlocked`: opacidade 1, `border-top-color: var(--tier)`, degradê branco 12%→3%, `svg` na cor do tier.
- `.achievement-toast`: fixo, 380 px, degradê `#06164f → #0b3fae`, borda esquerda 6 px na cor do tier, sombra; animação `achievement-in` 4,2 s.

## Regras que o redesign deve preservar

1. As 22 conquistas com título, descrição, tier e data de desbloqueio; distinção clara bloqueada × desbloqueada.
2. Contador "X/22" na Pausa e entrada pela Pausa (ou equivalente acessível no controle); fechar retorna ao menu de origem.
3. Navegação completa por D-pad com rolagem acompanhando o foco; ○/B para voltar.
4. Toast automático ao desbloquear (some sozinho, sem X, com vibração), em fila, um por vez.

## Problemas atuais e oportunidades

1. Visual de lista genérica; no estilo FIFA (troféus/"Accomplishments"), cards maiores com arte de troféu por tier, brilho/animação no foco e um resumo no topo (ex.: "5/22 · 2 ouro · 1 prata · 2 bronze" e barra de progresso).
2. Sem filtros/sub-abas (Todas / Desbloqueadas / Bloqueadas / por tier) — poderiam usar L2/R2.
3. Sem progresso parcial nas bloqueadas (ex.: "Embalado 3/5", "Cofre cheio R$ 80 mi/150 mi").
4. Cards são botões sem ação; ✕ não abre detalhe. Oportunidade: painel de detalhe do card focado.
5. Só é acessível pela Pausa; poderia ter um tile/atalho no hub (perfil do manager).
6. O toast dura 4,2 s (acima dos 2–3 s preferidos pelo usuário para avisos) e várias conquistas simultâneas formam fila longa.
7. Usa `Object.keys(career.achievements).length` no contador: ids antigos/inexistentes contariam a mais.
