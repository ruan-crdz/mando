# Tela: Popup "Nova carreira" (escolha do mundo)

## Resumo
Modal aberto a partir do menu principal para escolher **qual mundo** a nova carreira vai usar: o **Brasileirão 2026** oficial (Séries A e B com elencos reais e escudos, congelado em 01/01/2026) ou uma **demonstração** com 40 clubes e atletas fictícios. Escolher um mundo leva direto à criação do manager.

## Como se chega / como se sai
**Entrada**: Menu principal › tile "NOVA CARREIRA" (`onNew` → `setPopup('world')`).

**Saída**
- "Brasileirão 2026" → `run(async)`: `setWorld(await loadWorld2026())`, `setCareer(null)`, `setScreen('create')`, fecha o popup → tela **Criar manager** com o mundo oficial.
- "Experimentar a demonstração" → `act()`: `setWorld(createDemoWorld())`, `setCareer(null)`, `setScreen('create')`, fecha → **Criar manager** com o mundo demo.
- "‹ Voltar" no cabeçalho, ○/B ou Esc → `setPopup(null)` (volta ao menu).

## Arquivos-fonte
- `src/App.tsx` — bloco `{popup === 'world' && <Modal title="Nova carreira" … wide>}`.
- `src/components/ui.tsx` — `Modal`.
- `src/game/realWorld.ts` — `loadWorld2026()` (fetch de `/data/world-2026.json` + validação `worldSchema`).
- `src/game/world.ts` — `createDemoWorld()`.
- Ícones lucide: `Trophy`, `Gamepad2`, `ArrowRight`; cabeçalho `ChevronLeft`.

## Wireframe atual
```
┌──────────────────────── fundo escurecido + blur ────────────────────────┐
│  ┌───────────────────────── .dialog.wide (980px) ─────────────────────┐ │
│  │ NOVA CARREIRA                                         ‹ VOLTAR     │ │
│  │                                                                    │ │
│  │ ┌──────── verde (official) ──────┐ ┌──────── laranja (demo) ─────┐ │ │
│  │ │ 🏆                              │ │ 🎮                           │ │ │
│  │ │                                 │ │                              │ │ │
│  │ │ BRASILEIRÃO 2026                │ │ EXPERIMENTAR A DEMONSTRAÇÃO  │ │ │
│  │ │ Séries A e B com elencos reais  │ │ 40 clubes e atletas fictícios│ │ │
│  │ │ e escudos. Mundo congelado em   │ │ para testar o jogo.          │ │ │
│  │ │ 01/01/2026.                     │ │                              │ │ │
│  │ │ [JOGAR →]                       │ │ [JOGAR →]                    │ │ │
│  │ └─────────────────────────────────┘ └──────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

## Elementos
| Elemento | Classe | Conteúdo | Visual |
|---|---|---|---|
| Fundo | `.modal-backdrop` | — | `rgba(2,6,30,.72)` + `blur(6px)`, fade 0.2s |
| Caixa | `section.dialog.wide` (`data-focus-scope="modal"`, `role=dialog`, `aria-label="Nova carreira"`) | — | `min(980px,100%)`, gradiente azul, borda superior 4px lima, entra deslizando |
| Título | `.dialog-heading h2` | **"Nova carreira"** | Itálico 800 28px caixa alta |
| Voltar | `button.text-button[data-dialog-close]` | `ChevronLeft` + "Voltar" | Texto translúcido |
| Faixa | `.world-options.carousel` | 2 cartões lado a lado (rolagem horizontal se faltar espaço) | |
| Cartão oficial | `button.world-option.official` (`disabled={busy}`) | Ícone `Trophy` 44px (renderizado 64px, canto superior esquerdo); `h2` **"Brasileirão 2026"**; `p` **"Séries A e B com elencos reais e escudos. Mundo congelado em 01/01/2026."**; `span` **"JOGAR →"** (`ArrowRight` 18) | Gradiente verde `#8be22a → #34b51f → #138a2c`; `clamp(260px,42vw,440px)` × `clamp(240px,42vh,360px)`; texto alinhado embaixo à esquerda; `h2` itálico 34px |
| Cartão demo | `button.world-option.demo` | Ícone `Gamepad2` 44px; `h2` **"Experimentar a demonstração"**; `p` **"40 clubes e atletas fictícios para testar o jogo."**; `span` **"JOGAR →"** | Gradiente laranja `#ffb32a → #ff7a00 → #e64a00` |

Os botões não usam a classe `.tile`, mas imitam o tile (sem as listras do `::before`).

## Estados e variações
- **Padrão**: foco inicial no cartão oficial (primeiro botão habilitado do corpo).
- **Carregando oficial** (`busy`): `run()` ativa "Processando…" no canto, `main` inert; o cartão oficial fica `disabled` (opacidade .45). O modal **continua aberto** durante o download; não há spinner dentro do cartão.
- **Erro ao carregar** (rede/HTTP/validação): toast vermelho 4s, ex.: "Não foi possível carregar os elencos de 2026 (HTTP 404)."; o modal permanece aberto para tentar de novo.
- **Offline**: em produção o `data/world-2026.json` é pré-cacheado pelo service worker (`globPatterns` inclui `data/*.json`), então funciona offline; se o cache não existir, cai no erro acima. Não há aviso prévio.
- **Demo**: síncrono, sem estado de carregamento.
- Não há "primeira vez" diferente nem lembrança da última escolha.

## Interações
| Entrada | Ação |
|---|---|
| Clique / ✕ / A no cartão oficial | Baixa e valida o mundo 2026 → Criar manager |
| Clique / ✕ / A no cartão demo | Cria mundo demo → Criar manager |
| ←/→ (D-pad, analógico, setas) | Alterna o foco entre os cartões (foco: escala 1.03 + contorno branco 4px) |
| ↑ | Leva ao "Voltar" do cabeçalho |
| `Tab`/`Shift+Tab` | Cicla entre Voltar e os cartões (preso no modal) |
| ○ / B / Esc / "Voltar" | Fecha o modal (volta ao menu). Observação: o provider clica "Voltar" mesmo durante `busy`; se o download estiver em andamento, ao terminar o jogo ainda vai para a criação |
| Analógico direito horizontal | Rola a faixa se houver overflow |

## Classes CSS e visual atual
`.modal-backdrop`, `.dialog.wide`, `.dialog-heading`, `.text-button`, `.dialog-body`, `.world-options.carousel` (padding `8px 4px 12px`), `.world-option`, `.world-option.official`, `.world-option.demo`, `.world-option > svg:first-child` (ícone absoluto 64px, opacidade .9), `.world-option h2`, `.world-option > span` (CTA com fundo preto 22%), `.world-option:focus`.

## Regras que o redesign deve preservar
1. Duas opções: mundo oficial **Brasileirão 2026** (Séries A e B, elencos reais, escudos, data congelada 01/01/2026) e **demonstração** (40 clubes fictícios).
2. Escolher já leva à criação do manager (sem passo extra).
3. Foco inicial no mundo oficial.
4. Estado de carregamento do mundo oficial e mensagem de erro que some sozinha; possibilidade de tentar de novo.
5. Fechar com ○/B/Esc/Voltar.

## Problemas atuais e oportunidades
- Não há feedback de carregamento **no próprio cartão** (só o "Processando…" no canto e o cartão esmaecido); o download do JSON pode demorar. Ideia: barra/spinner no cartão "Carregando elencos…".
- Os cartões são texto + ícone genérico. No estilo FIFA, cartões de "modo de jogo" têm arte forte: para o oficial, escudos dos clubes em mosaico ou o troféu do Brasileirão (`TrophyArt id="A"`); para a demo, um visual "treino".
- Faltam informações úteis: quantos clubes (40: 20 Série A + 20 Série B), competições incluídas (Brasileirão A/B, Copa do Brasil, Supercopa e torneios continentais — ver `game/competitions.ts`), data inicial, tamanho do download.
- A hierarquia não deixa claro que a demo é secundária; poderia ser um cartão menor ou um botão "Experimentar demonstração".
- Fechar o modal durante o download não cancela a ação.
- O título "Nova carreira" + "Voltar" no topo é idêntico a todos os modais; aqui caberia um cabeçalho de etapa ("ESCOLHA O MUNDO") alinhado ao fluxo de criação (MANAGER › CLUBE › DESAFIO).
