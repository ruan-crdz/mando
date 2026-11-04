# Tela: Popup de Pausa

## Resumo

Modal de pausa do modo carreira (`popup === 'pause'` em `src\App.tsx`). Funciona **fora de partida** (título "Pausa") e **dentro de partida** (título "Jogo pausado", o relógio da partida congela). Reúne: continuar, vibração do controle (ligar/desligar, testar, parear DualSense via WebHID), sons do menu, música, parar caixa postal, atalho para as preferências de avanço do calendário (só fora de partida), conquistas, instalar o app (PWA) e salvar e sair para o menu.

No Ato 3, a composição prioriza desktop e controle: painel grafite fumê, ações em ardósia, seleção petróleo/ciano e resumo com escudo, clube, data e manager. As ações e condições existentes são preservadas.

Em mobile landscape, o modal mantém a coluna de ações com rolagem interna; cabeçalho, resumo e botão Continuar permanecem no mesmo escopo de foco.

## Como se chega / como se sai

**Abrir**

- **○ / B** (ou `Esc`) quando não há modal, detalhe de jogador, exclusão de save nem simulação rodando, e a tela é a carreira (`back` → `setPopup('pause')`). Antes disso, o "voltar" global tenta: fechar o modal do topo (`[data-dialog-close]`) e acionar `main [data-back-action]` / `[data-focus-trap] [data-trap-exit]` (ex.: sair de sub-visões do Time e da negociação de Transferências).
- **Options / ☰ (START)** em qualquer aba **exceto a Central** e **dentro da partida** (`menu` → alterna `pause`). Na Central fora de partida, START abre as Preferências de avanço (doc 10).
- Voltando das **Conquistas** (fechar o modal de conquistas retorna à pausa).
- Cancelando as **Preferências de avanço**, quando abertas pela Pausa.
- Não existe botão de mouse para abrir a pausa (só `Esc` no teclado).

**Fechar**

- Botão "Continuar" (primário), botão "Voltar" do cabeçalho do modal, **○ / B** / `Esc` (clica o "Voltar"), **START** de novo (alterna para `null`).
- Ir para "Avanço do calendário" (troca para o modal `prefs`), "Conquistas" (troca para `achievements`) ou "Salvar e sair para o menu".

## Arquivos-fonte

- `src\App.tsx` — bloco `{popup === 'pause' && career && world && (<Modal …>)}`, estado `hapticNote`, `advanceModes`, `useControllerActions` (back/menu), `menu()` (salvar e sair), `installPrompt`.
- `src\components\ui.tsx` — `Modal` (cabeçalho com título + "Voltar", foco inicial, `data-focus-scope="modal"`).
- `src\controller\GamepadProvider.tsx` — `toggleVibration` (persistido em `localStorage['mando-vibration']`), `toggleSound`, `rumble`, `haptics()`, `hid` (WebHID DualSense), lógica do "voltar".
- `src\controller\dualsenseHid.ts` — pareamento/vibração WebHID.
- `src\audio\music.ts` — `toggleMusic`, `musicEnabled`.
- `src\components\voice.ts` — `stopVoice`, `useVoice`.
- `src\game\achievements.ts` — total de conquistas (22).
- `src\screens\Match.tsx` — prop `paused={Boolean(popup) || busy}` congela o relógio.
- `src\styles\legacy\06-hub.css` — `.hub-modal`, `.hub-dialog-summary` e acabamento de `.pause-options`; estilos-base do modal permanecem nos arquivos de componentes.

## Wireframe atual (ASCII)

```
            (fundo escurecido + blur sobre o jogo)
        ┌──────────────────────────────────────────────┐  ← borda superior ciano
        │ PAUSA  (ou JOGO PAUSADO)          [< Voltar] │
        │ [escudo] CLUBE · DATA · MANAGER              │
        │ [ ← CONTINUAR                              ] │  ← petróleo/ciano, foco inicial
        │ [ 📳 VIBRAÇÃO: LIGADA                      ] │
        │ [ 📳 TESTAR VIBRAÇÃO                       ] │
        │ [ 🎮 CONECTAR DUALSENSE (VIBRAÇÃO)         ] │  (só se WebHID e não pareado)
        │      texto de diagnóstico da vibração        │  (após testar/parear)
        │ [ 🔊 SONS DO MENU: DESLIGADOS              ] │
        │ [ 🎵 MÚSICA: LIGADA                        ] │
        │ [ ■ PARAR CAIXA POSTAL                     ] │  (só com voz tocando)
        │ [ 🗓 AVANÇO DO CALENDÁRIO: UM DIA POR VEZ  ] │  (só fora de partida)
        │ [ 🏅 CONQUISTAS (5/22)                     ] │
        │ [ INSTALAR MANDO                           ] │  (só se o navegador oferecer)
        │ [ SALVAR E SAIR PARA O MENU                ] │
        └──────────────────────────────────────────────┘
```

Largura 600 px (modal comum), coluna única de botões largos alinhados à esquerda.

## Elementos

Modal: `Modal title={career.activeMatch ? 'Jogo pausado' : 'Pausa'}` com classe `hub-modal pause-modal`. Cabeçalho `.dialog-heading`: `h2` display de 26 px, caixa alta, e `button.text-button[data-dialog-close]` com `ChevronLeft` (16) "Voltar". O corpo contém resumo do clube/manager e `.pause-options` (coluna, gap 8).

Botões, na ordem:

1. **Continuar** — `button.primary`, ícone `ArrowLeft` (18). Fecha o modal. Recebe o foco inicial (primeiro botão do corpo).
2. **Vibração** — ícone `Vibrate` (ligada) / `VibrateOff` (desligada) (18), texto "Vibração: Ligada" / "Vibração: Desligada". Alterna `controller.vibration` (salvo em `localStorage`).
3. **Testar vibração** — ícone `Vibrate` (18). Executa `controller.rumble('goal')` e grava em `hapticNote` uma das mensagens:
   - vibração desligada: "A vibração está desligada. Ligue no botão acima."
   - DualSense pareado via WebHID: "DualSense conectado direto: deve ter vibrado agora."
   - WebHID suportado mas não pareado: "Não vibrou? Use \"Conectar DualSense\" abaixo e escolha o controle na lista."
   - nenhum controle: "Nenhum controle detectado. Aperte qualquer botão do controle."
   - sem suporte: "Este navegador não libera a vibração. Use Chrome ou Edge no computador."
4. **Conectar DualSense (vibração)** — só se `controller.hid.supported && !controller.hid.connected`; ícone `Gamepad2` (18). Abre o seletor WebHID do navegador. Resultado em `hapticNote`: "DualSense conectado. A vibração agora funciona em todo o jogo." / "Nenhum controle escolhido." / erro de segurança "O navegador exige um clique: clique neste botão com o mouse uma vez." / mensagem do erro.
5. **Nota de diagnóstico** — `p.muted.small.haptic-note` com `hapticNote` (só se não vazio; persiste enquanto o App estiver montado, não some sozinha).
6. **Sons do menu** — ícone `Volume2` / `VolumeX`, "Sons do menu: Ligados" / "Sons do menu: Desligados" (bipes de navegação; padrão desligado, não persistido).
7. **Música** — ícone `Music` / `VolumeX`, "Música: Ligada" / "Música: Desligada" (`toggleMusic`; durante partida a música fica suspensa e entra o som da torcida, que também depende desse estado).
8. **Parar caixa postal** — só se `voice.current` (há voz tocando); ícone `Square` (16). `stopVoice()`; o modal continua aberto.
9. **Avanço do calendário** — só **fora de partida**; ícone `CalendarClock` (18), texto "Avanço do calendário: {título do modo}" (`Um dia por vez` / `Parar em eventos` / `Nunca parar`). Abre o modal `prefs` (doc 10). Cancelar volta à Pausa; escolher um modo aplica e volta ao jogo.
10. **Conquistas** — ícone `Award` (18), "Conquistas ({desbloqueadas}/{22})" (`Object.keys(career.achievements).length` / `achievements.length`). Abre o modal `achievements` (doc 09).
11. **Instalar Mando** — só se o navegador disparou `beforeinstallprompt`; sem ícone. Mostra o prompt de instalação PWA (via `run`, fica `busy`).
12. **Salvar e sair para o menu** — sem ícone. `menu()`: aguarda a fila de saves, salva localmente, recarrega a lista de saves, para a voz, vai ao menu principal e fecha popup/detalhe (via `run`, mostra "Processando…"). Dentro de partida, a partida em andamento fica salva (`activeMatch`) e é retomada ao continuar o save.

## Estados e variações

| Estado                          | Diferença                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Fora de partida                 | Título "Pausa"; mostra "Avanço do calendário". `main` fica `inert`.                                    |
| Dentro de partida               | Título "Jogo pausado"; sem "Avanço do calendário"; `MatchScreen` recebe `paused` e o relógio para.     |
| Vibração ligada/desligada       | Ícone e texto do botão 2; teste informa se está desligada.                                             |
| WebHID disponível e não pareado | Aparece "Conectar DualSense (vibração)".                                                               |
| Com nota de vibração            | Parágrafo de diagnóstico abaixo dos botões de vibração.                                                |
| Sons/música ligados/desligados  | Ícones e textos.                                                                                       |
| Voz tocando                     | Aparece "Parar caixa postal" (a barra de voz global também segue visível).                             |
| PWA instalável                  | Aparece "Instalar Mando".                                                                              |
| `busy`                          | Ações via `run` bloqueiam a UI (indicador "Processando…"); o mapeamento do controle do App fica vazio. |

## Interações

### Mouse / teclado

- Clique nos botões. `Esc` fecha (equivale a ○/B). `Tab`/`Shift+Tab` circulam dentro do modal. Setas movem o foco. Enter aciona.

### Controle

| Botão PS5                  | Botão Xbox | Ação com a Pausa aberta                              |
| -------------------------- | ---------- | ---------------------------------------------------- |
| ✕                          | A          | Aciona o botão focado (foco inicial em "Continuar"). |
| ○                          | B          | Fecha a pausa (clica "Voltar" do modal).             |
| Options                    | ☰         | Fecha a pausa (alterna).                             |
| D-pad / analógico esquerdo | idem       | Move o foco entre os botões (escopo preso ao modal). |
| □                          | X          | Sem efeito (avanço bloqueado com popup aberto).      |
| △                          | Y          | Sem efeito (bloqueado com popup).                    |
| L1/R1                      | LB/RB      | Sem efeito (troca de abas bloqueada com popup).      |
| L2/R2                      | LT/RT      | Sem efeito (não há `.segmented` no modal).           |
| Analógico direito          | idem       | Rola o corpo do modal se não couber.                 |

- Vibração de feedback: `back` ao fechar, `confirm` ao acionar, `goal` no teste.

## Classes CSS e visual atual

- `.modal-backdrop`: fixo, tela inteira, `rgba(2,6,30,.72)` + `blur(6px)`, animação `fade`.
- `.dialog.hub-modal`: até 600 px, altura máx. 92dvh, grafite fumê `#161e2cf5`, borda superior ciano, sombra e animação compartilhadas.
- `.dialog-heading h2`: display 600, 26 px, caixa alta. `.text-button` "Voltar" transparente.
- `.hub-dialog-summary`: superfície carvão com escudo e nome, data e manager.
- `.pause-options`: coluna, gap 8; botões em ardósia, altura mínima 44 px, texto 16 px e cantos de 3 px. Continuar usa petróleo/ciano; hover/foco eleva a superfície e marca a borda esquerda.
- Foco com controle segue o sistema Legacy ciano/petróleo, com alto contraste.
- `.haptic-note`: máx. 340 px, centralizado, muted, 13 px.

## Regras que o redesign deve preservar

1. Duas variantes (fora/dentro de partida) com o relógio da partida congelado enquanto aberta.
2. Todos os itens e suas condições de exibição (DualSense WebHID, caixa postal, avanço do calendário, instalar).
3. Estados textuais Ligado/Desligado de vibração, sons e música; diagnóstico de vibração.
4. Atalhos: ○/B e START fecham; foco inicial em "Continuar"; foco preso ao modal; abrir com ○/B (e START fora da Central).
5. Conquistas com contador X/22 e retorno à pausa ao fechar a tela de conquistas.
6. "Salvar e sair para o menu" salva antes de sair.

## Problemas atuais e oportunidades

1. O resumo já mostra clube/data/manager; placar e minuto na variante de partida ainda podem ser refinados posteriormente.
2. Mistura de categorias sem agrupamento (controle/áudio/carreira/sistema). Agrupar em seções ("Retomar", "Configurações", "Carreira", "Sair") ou sub-abas L2/R2.
3. Não há como abrir a pausa com o mouse (só `Esc`); faltaria um botão de menu no header.
4. Na Central, START abre "Preferências" e não a pausa — inconsistente com o resto do jogo; a dica do footer diz "Pausa" mesmo na Central.
5. O botão "Voltar" no cabeçalho é redundante com "Continuar" (o usuário prefere popups sem botão de fechar).
6. A nota de diagnóstico de vibração nunca some e não é reiniciada.
7. "Sons do menu" não é persistido (sempre começa desligado); a vibração é persistida — inconsistente.
8. Retorno das preferências corrigido no Ato 3: cancelar volta à Pausa; selecionar um modo volta ao jogo com confirmação.
9. "Salvar e sair" não pede confirmação nem informa "Salvo" antes de sair; "Instalar Mando" e "Salvar e sair" não têm ícones.
10. Faltam opções típicas: volume (slider), velocidade padrão da partida, legendas/voz, reiniciar partida/desistir.
