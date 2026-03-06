# Contexto do Projeto: Jogo da Velha (Tic-Tac-Toe) P2P Mobile

**Objetivo:** Criar uma aplicação web mobile P2P (Peer-to-Peer) de Jogo da Velha, sem servidor backend, utilizando WebRTC para comunicação direta entre os dispositivos. O deploy será feito no GitHub Pages.

**Atuação Esperada:** Atue como um Desenvolvedor Front-end Especialista em WebRTC, JavaScript Vanilla e UI/UX Mobile.

## Requisitos de Arquitetura e Lógica

1. **Tecnologias:** HTML5, CSS3 e Vanilla JavaScript. Nenhum framework front-end (como React ou Vue) deve ser utilizado.
2. **Conexão e Rede (PeerJS):** - Utilize a biblioteca PeerJS via CDN para abstrair a complexidade do WebRTC e usar o servidor de signaling gratuito deles.
   - **Host (Criar Jogo):** O sistema gera um ID curto (pode ser alfanumérico simples) e exibe na tela para o Host compartilhar.
   - **Guest (Entrar no Jogo):** O usuário tem um campo de input para digitar o ID do Host e conectar via `peer.connect(id)`.
3. **Sincronização e Estado:**
   - O Host começa jogando (X) e o Guest joga em seguida (O).
   - Toda vez que um jogador clica em uma célula, o estado atualizado da matriz do jogo e a indicação de quem é o próximo turno devem ser enviados via `conn.send()`.
   - **Resiliência (Nova Instrução):** Implemente uma lógica de checagem. Se houver uma pequena queda de rede, o Host deve atuar como a "fonte da verdade" (source of truth) para re-sincronizar o tabuleiro assim que a conexão for restabelecida.
4. **Regras de Negócio:**
   - Bloquear o clique na tela se não for o turno do jogador local ou se a célula já estiver preenchida.
   - Verificar localmente condições de vitória ou empate a cada jogada e garantir que ambos vejam o resultado final simultaneamente.
   - Incluir um botão "Jogar Novamente" que limpa o tabuleiro para ambos os jogadores e reinicia o ciclo.

## Requisitos de UI/UX (Mobile-first e Lúdico)

1. **Design Mobile-First:** A interface deve ocupar toda a tela do celular de forma responsiva, evitando rolagens desnecessárias.
2. **Visual Lúdico e Acessível:** O design deve ser colorido, amigável e focado na usabilidade, especialmente pensando em uma criança pequena jogando.
3. **Elementos de Interação:**
   - Botões do menu, inputs e as células do tabuleiro devem ser grandes para facilitar o toque em telas menores.
   - Adicionar animações suaves (CSS transitions) ao desenhar o "X" ou "O".
   - Criar um efeito visual de destaque (como um brilho ou animação pulsante) na linha/coluna vencedora e uma mensagem clara de quem ganhou.
4. **Feedback de Conexão (Nova Instrução):** Mostrar claramente na tela os status: "Aguardando oponente...", "Conectado! Sua vez" ou "Conexão perdida. Tentando reconectar...".

## Entregáveis Esperados

Por favor, forneça o código completo e estruturado nos seguintes blocos:

1. `index.html` (Incluindo a importação da CDN do PeerJS e estrutura semântica).
2. `style.css` (Contendo toda a estilização lúdica e responsiva).
3. `app.js` (Contendo a lógica de negócio, WebRTC e tratamento de falhas de conexão).
4. **Guia de Deploy (Nova Instrução):** Adicione no final da sua resposta um passo a passo simples e direto de como eu devo organizar esses três arquivos e fazer o deploy no **GitHub Pages** de forma gratuita.
