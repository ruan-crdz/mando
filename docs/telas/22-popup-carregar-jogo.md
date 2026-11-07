# Popup: Carregar jogo

Abre pelo card Carregar jogo do [menu](./02-menu-principal.md), disponível com dois ou mais saves.

## Conteúdo

- Modal largo com título Carregar jogo e botão Voltar.
- Grade de todos os saves locais, do mais recente para o mais antigo.
- Cada card mostra escudo, clube, nome completo do manager e data da carreira.
- Selecionar um card valida e abre essa carreira, preservando contrato/tutorial pendentes.
- Cada save tem uma lixeira no canto superior direito, com tamanho fixo de 36 × 36 px inclusive durante o foco.

## Interações e estados

- Clique ou A/✕ abre a carreira selecionada.
- D-pad/analógico esquerdo navega entre os cards e suas lixeiras; RS rola o conteúdo.
- B/○ ou Voltar fecha o modal e retorna ao menu.
- Excluir abre a [confirmação de exclusão](./05-popup-excluir-carreira.md). Cancelar retorna ao mesmo item; confirmar atualiza a grade sem fechar o seletor.
- Se restar um save, o menu passa a Continuar carreira ao fechar o seletor.
- Se todos forem excluídos, o seletor mostra uma mensagem vazia e o menu passa a Nova carreira.
- Erros de carregamento ou exclusão são exibidos; não fecham a interface como se a ação tivesse funcionado.

## Fontes

- `src/screens/MainMenu.tsx`: `SavedGameList`.
- `src/App.tsx`: `popup='load'`, carregar e excluir.
- `src/styles/legacy/05-entry-flows.css`: grade e dimensões da lixeira; a regra de foco global não pode transformar o botão absoluto em um filho flex esticado.
