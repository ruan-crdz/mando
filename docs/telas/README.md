# Mando — documentação de telas (para redesign)

Uma doc por tela/popup do jogo, descrevendo o estado atual: wireframe, elementos, dados, estados, interações (mouse e controle PS5/Xbox), classes CSS, regras a preservar e oportunidades de melhoria.

**Direção do redesign:** 100% FIFA-like (era FIFA 14 / EA FC), tiles grandes, navegação superior, tudo jogável no controle. O redesign pode mudar livremente o layout, mas deve preservar as funcionalidades listadas em "Regras que o redesign deve preservar" de cada doc.

## Preferências fixas do dono do jogo

- O card do jogador **é a foto**: foto grande, centralizada, base colada embaixo; só nome, posição e overall (sem número).
- Cards por nível de overall: bronze, prata, ouro e ouro brilhante; fonte branca.
- Jogador sem foto: silhueta/bonequinho padrão, sem sigla e sem fundo escuro.
- Avisos/popups informativos fecham sozinhos em 2–3 s, **sem X**.
- Nada de modais pesados onde uma linha expansível resolve (ex.: aba Jogadores).
- Tudo navegável no controle, com dicas de botões visíveis.

> As referências a `src\styles.css` e números de linha nas docs apontam para o arquivo antigo. Veja o mapa em [00-design-system.md](./00-design-system.md#mapa-do-antigo-stylescss).

## Índice

| # | Doc | Tela |
|---|-----|------|
| 00 | [00-design-system.md](./00-design-system.md) | Design system atual (cores, fontes, componentes, controle) |
| 01 | [01-casca-do-app.md](./01-casca-do-app.md) | Moldura: header, abas, rodapé, avisos |
| 02 | [02-menu-principal.md](./02-menu-principal.md) | Menu principal |
| 03 | [03-popup-nova-carreira.md](./03-popup-nova-carreira.md) | Popup Nova carreira (escolha do mundo) |
| 04 | [04-criar-manager.md](./04-criar-manager.md) | Criar manager (3 passos) |
| 05 | [05-popup-excluir-carreira.md](./05-popup-excluir-carreira.md) | Popup Excluir carreira |
| 06 | [06-central.md](./06-central.md) | Central (hub) |
| 07 | [07-escritorio.md](./07-escritorio.md) | Escritório e rotas para dados da temporada |
| 08 | [08-popup-pausa.md](./08-popup-pausa.md) | Popup Pausa |
| 10 | [10-popup-preferencias-avanco.md](./10-popup-preferencias-avanco.md) | Popup Preferências de avanço |
| 11 | [11-overlay-simulacao-continua.md](./11-overlay-simulacao-continua.md) | Overlay de simulação contínua |
| 12 | [12-time.md](./12-time.md) | Time (Escalação, Tática, Responsabilidades, Jogadores, Comissão) |
| 13 | [13-transferencias.md](./13-transferencias.md) | Transferências (Mercado, Observados, Negociações, Sala de negociação) |
| 14 | [14-temporada.md](./14-temporada.md) | Dados da temporada (abertos pelo Escritório) |
| 15 | [15-partida.md](./15-partida.md) | Partida ao vivo e pós-jogo |
| 16 | [16-popup-dia-de-jogo.md](./16-popup-dia-de-jogo.md) | Popup Dia de jogo (pré-jogo) |
| 18 | [18-popup-contrato-inicial.md](./18-popup-contrato-inicial.md) | Proposta e assinatura do contrato inicial |
| 19 | [19-tutorial-inicial.md](./19-tutorial-inicial.md) | Tutorial inicial |
| 20 | [20-notificacoes.md](./20-notificacoes.md) | Notificações (caixa de entrada e conversas com atletas) |
| 21 | [21-academia.md](./21-academia.md) | Academia (captação, elenco jovem e lacunas de simulação) |
| 22 | [22-popup-carregar-jogo.md](./22-popup-carregar-jogo.md) | Popup Carregar jogo (selecionar e excluir saves) |
