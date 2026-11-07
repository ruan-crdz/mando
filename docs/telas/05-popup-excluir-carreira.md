# Tela: Popup "Excluir carreira?"

## Resumo
Modal de confirmação para apagar um save local pelo seletor Carregar jogo. Mostra qual carreira será removida (manager, clube, data no jogo) e oferece **Cancelar** ou **Excluir**.

## Como se chega / como se sai
**Entrada**: Menu principal › Carregar jogo › botão lixeira (`Trash2`) de um slot → `onDelete(save)` → `setDeleting(save)`. O seletor inclui todos os saves, inclusive o mais recente.

**Saída**
- "Cancelar", "‹ Voltar", ○/B ou Esc → `setDeleting(null)` (volta ao seletor, nada muda).
- "Excluir" → interrompe o autosave da carreira escolhida se ela ainda estiver carregada em memória, aguarda gravações locais pendentes, remove o save e atualiza o seletor. Uma sincronização atrasada não deve recriar o save excluído.

## Arquivos-fonte
- `src/App.tsx` — `{deleting && <Modal title="Excluir carreira?" onClose={() => setDeleting(null)}>…}`, estado `deleting: SavedCareer | null` (`{ career, world }`), `run()`.
- `src/components/ui.tsx` — `Modal`, `dateLabel`.
- `src/services/storage.ts` — `removeLocal(id)`, `listLocal()` (IndexedDB local).
- `src/screens/MainMenu.tsx` — botão lixeira que dispara `onDelete`.

## Wireframe atual
```
┌──────────────────── fundo escurecido + blur ────────────────────┐
│     ┌──────────────── .dialog (≈620px) ──────────────────┐      │
│     │ EXCLUIR CARREIRA?                     ‹ VOLTAR     │      │
│     │                                                    │      │
│     │ Ruan · São Paulo · 14 MAR 2026                     │      │
│     │                                                    │      │
│     │ [ CANCELAR ]  [ EXCLUIR (vermelho) ]               │      │
│     └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

## Elementos
| Elemento | Classe | Conteúdo / dado |
|---|---|---|
| Fundo | `.modal-backdrop` | escurecido + blur; `main` fica `inert` |
| Caixa | `section.dialog` (`role=dialog`, `data-focus-scope="modal"`) | largura padrão (não `wide`), borda superior lima |
| Título | `.dialog-heading h2` | **"Excluir carreira?"** |
| Voltar | `button.text-button[data-dialog-close]` | `ChevronLeft` + "Voltar" |
| Descrição | `<p>` | **`{deleting.career.manager.firstName} · {nome do clube (deleting.world.clubs.find(c => c.id === deleting.career.clubId)?.name)} · {dateLabel(deleting.career.date)}`** — só o primeiro nome do manager; data do jogo formatada (ex.: "14 MAR 2026") |
| Ações | `.button-row` | `button` "Cancelar" (estilo padrão, **primeiro → foco inicial**); `button.danger` "Excluir" (gradiente vermelho) |

Sem ícones nos botões, sem escudo, sem retrato.

## Estados e variações
- **Padrão**: foco em "Cancelar" (seguro contra exclusão acidental com ✕).
- **Excluindo** (`busy`): indicador global "Processando…"; os botões não são desabilitados explicitamente, mas o `run` é único.
- **Erro** (IndexedDB): toast vermelho 4s via `fail`; o modal continua aberto.
- **Sucesso**: o modal fecha e o slot some da lista; **não há toast de confirmação**.
- Não depende de rede/IA. O backup em nuvem (Supabase), se existir, **não** é apagado.

## Interações
| Entrada | Ação |
|---|---|
| Clique / ✕ / A em "Cancelar" | Fecha sem excluir |
| Clique / ✕ / A em "Excluir" | Exclui o save local e atualiza a lista |
| ←/→ | Alterna o foco entre Cancelar e Excluir; ↑ vai ao "Voltar" |
| `Tab`/`Shift+Tab` | Ciclo preso no modal |
| ○ / B / Esc / "Voltar" | Cancela |
| Vibração | `error` só se falhar (via toast de erro) |

## Classes CSS e visual atual
`.modal-backdrop`, `.dialog`, `.dialog-heading`, `.text-button`, `.dialog-body p`, `.button-row` (flex com gap), `button` padrão (fundo branco translúcido, caixa alta itálica), `button.danger` (gradiente vermelho, texto branco), foco com contorno lima/escala (ver design system).

## Regras que o redesign deve preservar
1. Confirmação explícita antes de excluir; foco inicial na opção segura (Cancelar).
2. Identificação da carreira: manager, clube e data no jogo.
3. Cancelar com ○/B/Esc/Voltar; navegável só no controle.
4. Após excluir, o seletor é atualizado imediatamente; ao fechá-lo, o menu distingue novamente 0, 1 e 2+ saves.

## Problemas atuais e oportunidades
- Texto mínimo: não diz que a ação é **irreversível** nem que o backup na nuvem continua (ou não). Adicionar "Esta ação não pode ser desfeita."
- Falta identidade visual: mostrar escudo do clube, retrato do manager, temporada/posição na tabela, como um "card de save" FIFA.
- Sem feedback de sucesso: um aviso curto que some em 2–3s ("Carreira excluída") ajudaria.
- No estilo FIFA/console, ações destrutivas costumam exigir **segurar ✕** (barra de progresso) em vez de um toque — reduz exclusões acidentais no controle.
- Com exatamente um save, Continuar abre diretamente a carreira. A exclusão fica no seletor quando ele está aberto.
- Só o primeiro nome do manager aparece; usar nome completo.

## Estado do redesign MANDO 27 LEGACY
- **Lote 2 implementado:** a confirmação mostra o nome completo, clube e data em uma superfície de aviso coral, informa que a ação é irreversível e que o backup em nuvem permanece.
- Cancelar, confirmação, foco inicial seguro e remoção do save local continuam com os handlers originais.
