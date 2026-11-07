# Tela: Pausa

## Objetivo

Modal global para retomar o jogo, configurar vibração, escolher o comportamento do avanço de calendário e salvar a carreira antes de voltar ao menu.

## Entrada e saída

- Abre com Options/START/☰ durante a carreira; na Central, o mesmo botão abre Preferências de avanço.
- Título **Pausa** fora de partida e **Jogo pausado** durante a partida.
- **Continuar**, Voltar, B/○ ou Esc fecham o modal. Dentro de uma partida, o relógio permanece parado enquanto o modal está aberto.
- **Salvar e sair para o menu** persiste a carreira antes de trocar para o menu principal. Uma partida ativa continua salva e pode ser retomada.

## Conteúdo atual

O resumo apresenta escudo e nome do clube, data da carreira e manager. A lista de ações contém:

1. **Continuar** — fecha a Pausa e retorna à carreira.
2. **Vibração: Ligada/Desligada** — alterna a resposta háptica do controle.
3. **Testar vibração** — executa o padrão de teste e apresenta uma mensagem de diagnóstico.
4. **Conectar DualSense** — aparece quando WebHID está disponível e ainda não há controle pareado.
5. **Avanço do calendário** — disponível fora de partida; abre o modal de Preferências de avanço e mostra o modo selecionado.
6. **Instalar Mando** — aparece somente quando o navegador oferece instalação PWA.
7. **Salvar e sair para o menu** — salva e retorna ao menu.
8. **Música: Ligada/Desligada** — preferência persistente das dez faixas originais.
9. **Torcida: Ligada/Desligada** — preferência persistente da ambiência da partida.

## Apresentação e acessibilidade

- Modal compartilhado com foco preso, retorno de foco e navegação por mouse, teclado e controle.
- O botão Continuar recebe foco inicial. As demais ações aparecem em uma coluna rolável.
- Mensagens de diagnóstico de vibração ficam junto ao controle testado; não são confundidas com o toast geral.
- Não introduzir conquistas. A leitura da caixa postal fica em Notificações.

## Arquivos-fonte

- `src/App.tsx` — conteúdo e transições da Pausa.
- `src/controller/GamepadProvider.tsx` e `src/controller/dualsenseHid.ts` — vibração e conexão.
- `src/components/ui.tsx` — modal compartilhado.
- `src/styles/legacy/06-hub.css` — estilos do modal de carreira.
