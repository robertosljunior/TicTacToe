/* =====================================================
   JOGO DA VELHA P2P — app.js
   Tecnologias: Vanilla JS + PeerJS (WebRTC)
   ===================================================== */

'use strict';

// ─── Constantes de vitória ───────────────────────────
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],   // linhas
  [0,3,6],[1,4,7],[2,5,8],   // colunas
  [0,4,8],[2,4,6]            // diagonais
];

// ─── Estado global ────────────────────────────────────
const state = {
  peer:       null,
  conn:       null,
  isHost:     false,
  mySymbol:   '',          // 'X' ou 'O'
  board:      Array(9).fill(''),
  currentTurn:'X',         // quem deve jogar agora
  gameOver:   false,
  scores:     { local: 0, remote: 0 },
  reconnectTimer: null,
};

// ─── Seletores de UI ─────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  menu: $('screen-menu'),
  host: $('screen-host'),
  join: $('screen-join'),
  game: $('screen-game'),
};

const ui = {
  hostIdDisplay:   $('host-id-display'),
  btnCopy:         $('btn-copy'),
  copyFeedback:    $('copy-feedback'),
  hostStatus:      $('host-status'),
  joinIdInput:     $('join-id-input'),
  btnConnect:      $('btn-connect'),
  guestStatus:     $('guest-status'),
  guestStatusText: $('guest-status-text'),
  localSymbol:     $('local-symbol'),
  remoteSymbol:    $('remote-symbol'),
  playerLocal:     $('player-local'),
  playerRemote:    $('player-remote'),
  scoreLocal:      $('score-local'),
  scoreRemote:     $('score-remote'),
  turnStatus:      $('turn-status'),
  board:           $('board'),
  cells:           document.querySelectorAll('.cell'),
  btnRestart:      $('btn-restart'),
  btnQuit:         $('btn-quit'),
  connBanner:      $('connection-banner'),
  connBannerText:  $('connection-banner-text'),
  resultOverlay:   $('result-overlay'),
  resultEmoji:     $('result-emoji'),
  resultMessage:   $('result-message'),
  btnRestartOverlay: $('btn-restart-overlay'),
};

// ─── Utilitários ─────────────────────────────────────

/** Gera ID alfanumérico curto */
function generateShortId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/** Troca de tela com animação */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/** Exibe/oculta o banner de conexão */
function setConnectionBanner(visible, text = '') {
  if (visible) {
    ui.connBannerText.textContent = text;
    ui.connBanner.classList.remove('hidden');
  } else {
    ui.connBanner.classList.add('hidden');
  }
}

/** Atualiza o texto de status do turno */
function updateTurnStatus() {
  if (state.gameOver) return;
  const isMyTurn = state.currentTurn === state.mySymbol;
  ui.turnStatus.textContent = isMyTurn
    ? 'Conectado! Sua vez 🎉'
    : 'Aguardando oponente...';
  ui.playerLocal.classList.toggle('active-turn', isMyTurn);
  ui.playerRemote.classList.toggle('active-turn', !isMyTurn);
}

// ─── Lógica de Jogo ──────────────────────────────────

/** Verifica vitória e retorna as células vencedoras ou null */
function checkWinner(board) {
  for (const combo of WIN_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }
  return null;
}

function checkDraw(board) {
  return board.every(cell => cell !== '');
}

/** Renderiza o tabuleiro a partir de state.board */
function renderBoard() {
  ui.cells.forEach((cell, i) => {
    const value = state.board[i];
    cell.textContent = value;
    cell.className = 'cell';
    if (value) {
      cell.classList.add(value.toLowerCase(), 'taken');
    }
  });
}

/** Aplica destaque nas células vencedoras */
function highlightWinner(combo) {
  combo.forEach(i => ui.cells[i].classList.add('winner'));
}

/** Exibe o overlay de resultado */
function showResult(emoji, message) {
  ui.resultEmoji.textContent = emoji;
  ui.resultMessage.textContent = message;
  ui.resultOverlay.classList.remove('hidden');
  ui.btnRestart.classList.remove('hidden');
}

/** Aplica um estado de jogo recebido (ou o próprio) */
function applyGameState(gameState) {
  state.board       = gameState.board;
  state.currentTurn = gameState.currentTurn;
  state.gameOver    = gameState.gameOver;

  renderBoard();

  if (gameState.winnerCombo) {
    highlightWinner(gameState.winnerCombo);
  }

  if (!state.gameOver) {
    updateTurnStatus();
  }
}

/** Reseta o tabuleiro localmente */
function resetBoard() {
  state.board       = Array(9).fill('');
  state.currentTurn = 'X';
  state.gameOver    = false;
  ui.resultOverlay.classList.add('hidden');
  ui.btnRestart.classList.add('hidden');
  ui.turnStatus.textContent = '';
  renderBoard();
  updateTurnStatus();
}

/** Lida com fim de jogo: vitória ou empate */
function handleEndGame(winnerSymbol, winnerCombo) {
  state.gameOver = true;

  if (winnerCombo) highlightWinner(winnerCombo);

  const iWon = winnerSymbol === state.mySymbol;

  if (winnerSymbol) {
    if (iWon) {
      state.scores.local++;
      ui.scoreLocal.textContent = state.scores.local;
      showResult('🏆', 'Você venceu!');
    } else {
      state.scores.remote++;
      ui.scoreRemote.textContent = state.scores.remote;
      showResult('😢', 'O oponente venceu!');
    }
  } else {
    showResult('🤝', 'Empatou!');
  }

  ui.turnStatus.textContent = '';
  ui.playerLocal.classList.remove('active-turn');
  ui.playerRemote.classList.remove('active-turn');
}

// ─── Clique na célula ─────────────────────────────────

function handleCellClick(index) {
  if (state.gameOver)                   return;
  if (state.currentTurn !== state.mySymbol) return;
  if (state.board[index])               return;
  if (!state.conn || !state.conn.open)  return;

  state.board[index] = state.mySymbol;
  state.currentTurn  = state.mySymbol === 'X' ? 'O' : 'X';

  const winnerCombo = checkWinner(state.board);
  const isDraw      = !winnerCombo && checkDraw(state.board);
  const winnerSymbol = winnerCombo ? state.mySymbol : null;

  if (winnerCombo || isDraw) state.gameOver = true;

  // Monta pacote de estado para enviar ao oponente
  const gameState = {
    type:        'game_state',
    board:       state.board,
    currentTurn: state.currentTurn,
    gameOver:    state.gameOver,
    winnerCombo: winnerCombo || null,
    winnerSymbol,
  };

  renderBoard();
  if (winnerCombo) highlightWinner(winnerCombo);

  // Envia ao oponente
  state.conn.send(gameState);

  if (state.gameOver) {
    handleEndGame(winnerSymbol, winnerCombo);
  } else {
    updateTurnStatus();
  }
}

// ─── Botão "Jogar Novamente" ──────────────────────────

function requestRestart() {
  if (!state.conn || !state.conn.open) return;
  state.conn.send({ type: 'restart' });
  resetBoard();
}

// ─── Mensagens recebidas do oponente ─────────────────

function handleMessage(data) {
  if (!data || !data.type) return;

  switch (data.type) {

    case 'game_state':
      applyGameState(data);
      if (data.gameOver) {
        handleEndGame(data.winnerSymbol, data.winnerCombo);
      }
      break;

    case 'restart':
      resetBoard();
      break;

    // Host re-sincroniza o estado após reconexão
    case 'sync_request':
      if (state.isHost) {
        state.conn.send({
          type:        'game_state',
          board:       state.board,
          currentTurn: state.currentTurn,
          gameOver:    state.gameOver,
          winnerCombo: null,
          winnerSymbol: null,
        });
      }
      break;
  }
}

// ─── Setup da conexão (reutilizado para host e guest) ─

function setupConnection(conn) {
  state.conn = conn;

  conn.on('open', () => {
    clearTimeout(state.reconnectTimer);
    setConnectionBanner(false);
    showScreen('game');
    resetBoard();

    // Guest solicita sync ao abrir (re)conexão
    if (!state.isHost) {
      conn.send({ type: 'sync_request' });
    }
  });

  conn.on('data', handleMessage);

  conn.on('close', onConnectionLost);
  conn.on('error', onConnectionLost);
}

function onConnectionLost() {
  setConnectionBanner(true, 'Conexão perdida. Tentando reconectar...');

  // Host aguarda o guest reconectar (o peer permanece ativo)
  // Guest tenta reconectar ao host automaticamente
  if (!state.isHost) {
    state.reconnectTimer = setTimeout(() => tryGuestReconnect(), 3000);
  }
}

function tryGuestReconnect() {
  if (!state.peer || state.peer.destroyed) return;
  const hostId = ui.joinIdInput.value.trim().toLowerCase();
  if (!hostId) return;

  const conn = state.peer.connect(hostId, { reliable: true });
  setupConnection(conn);
}

// ─── Inicialização do PeerJS ──────────────────────────

function initPeer(customId = null) {
  // Destrói peer anterior se ainda existir
  if (state.peer && !state.peer.destroyed) {
    state.peer.destroy();
  }

  const options = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ]
    }
  };

  // CORREÇÃO CRÍTICA: ID deve ser o 1º argumento, não uma propriedade de options
  const peer = customId ? new Peer(customId, options) : new Peer(options);
  state.peer = peer;

  peer.on('error', err => {
    console.warn('[PeerJS] erro:', err.type, err.message);
    // ID em uso: gera outro
    if (err.type === 'unavailable-id') {
      peer.destroy();
      initPeer(generateShortId());
    }
  });

  return peer;
}

// ─── Fluxo HOST ───────────────────────────────────────

function startAsHost() {
  state.isHost   = true;
  state.mySymbol = 'X';

  showScreen('host');
  ui.hostIdDisplay.textContent = '...';
  ui.hostStatus.innerHTML = '<span class="status-dot"></span> Aguardando oponente...';

  const shortId = generateShortId();
  const peer    = initPeer(shortId);

  peer.on('open', id => {
    ui.hostIdDisplay.textContent = id;
  });

  peer.on('connection', conn => {
    // Rejeita conexões extras se já há uma ativa
    if (state.conn && state.conn.open) {
      conn.close();
      return;
    }

    // Atualiza símbolo do jogador na UI
    ui.localSymbol.textContent  = 'X';
    ui.remoteSymbol.textContent = 'O';

    setupConnection(conn);
  });
}

// ─── Fluxo GUEST ─────────────────────────────────────

function startAsGuest() {
  state.isHost   = false;
  state.mySymbol = 'O';
  showScreen('join');
}

function connectToHost() {
  const hostId = ui.joinIdInput.value.trim().toLowerCase();
  if (!hostId) {
    ui.joinIdInput.focus();
    return;
  }

  ui.guestStatus.style.display = 'flex';
  ui.guestStatusText.textContent = 'Conectando...';
  ui.btnConnect.disabled = true;

  // initPeer já destrói peer anterior se existir
  const peer = initPeer();

  peer.on('open', () => {
    // Atualiza símbolo do jogador na UI
    ui.localSymbol.textContent  = 'O';
    ui.remoteSymbol.textContent = 'X';

    const conn = peer.connect(hostId, { reliable: true });
    setupConnection(conn);

    // Timeout de conexão
    const timeout = setTimeout(() => {
      if (!conn.open) {
        ui.guestStatusText.textContent = 'Não foi possível conectar. Verifique o código.';
        ui.btnConnect.disabled = false;
      }
    }, 10000);

    conn.on('open', () => clearTimeout(timeout));
  });

  peer.on('error', () => {
    ui.guestStatusText.textContent = 'Erro ao conectar. Tente novamente.';
    ui.btnConnect.disabled = false;
  });
}

// ─── Voltar ao menu ───────────────────────────────────

function goToMenu() {
  if (state.peer && !state.peer.destroyed) {
    state.peer.destroy();
  }
  state.peer       = null;
  state.conn       = null;
  state.isHost     = false;
  state.mySymbol   = '';
  state.board      = Array(9).fill('');
  state.currentTurn= 'X';
  state.gameOver   = false;
  state.scores     = { local: 0, remote: 0 };
  clearTimeout(state.reconnectTimer);

  ui.joinIdInput.value   = '';
  ui.btnConnect.disabled = false;
  ui.guestStatus.style.display = 'none';
  ui.scoreLocal.textContent  = '0';
  ui.scoreRemote.textContent = '0';
  ui.resultOverlay.classList.add('hidden');
  setConnectionBanner(false);

  showScreen('menu');
}

// ─── Evento: cópia do código ──────────────────────────

function copyHostId() {
  const id = ui.hostIdDisplay.textContent;
  if (!id || id === '...') return;

  navigator.clipboard.writeText(id).then(() => {
    ui.copyFeedback.textContent = 'Copiado!';
    setTimeout(() => { ui.copyFeedback.textContent = ''; }, 2000);
  }).catch(() => {
    // fallback para dispositivos sem Clipboard API
    const el = document.createElement('input');
    el.value = id;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    ui.copyFeedback.textContent = 'Copiado!';
    setTimeout(() => { ui.copyFeedback.textContent = ''; }, 2000);
  });
}

// ─── Registro de eventos ──────────────────────────────

$('btn-create').addEventListener('click', startAsHost);
$('btn-join').addEventListener('click', startAsGuest);

$('btn-back-host').addEventListener('click', goToMenu);
$('btn-back-join').addEventListener('click', goToMenu);

ui.btnCopy.addEventListener('click', copyHostId);
ui.btnConnect.addEventListener('click', connectToHost);

ui.joinIdInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') connectToHost();
});

ui.btnRestart.addEventListener('click', requestRestart);
ui.btnRestartOverlay.addEventListener('click', requestRestart);
ui.btnQuit.addEventListener('click', goToMenu);

ui.cells.forEach(cell => {
  cell.addEventListener('click', () => {
    handleCellClick(Number(cell.dataset.index));
  });
});
