'use strict';

/* =========================================================
   network.js — Hub de Jogos P2P
   Gerencia PeerJS, telas, lobby e roteamento de mensagens.
   ========================================================= */

const Network = (() => {

  // ── Estado privado ────────────────────────────────────────────────
  const _s = {
    peer:        null,
    conn:        null,
    isHost:      false,
    currentGame: null,   // 'tictactoe' | 'chess' | null
    reconnTimer: null,
  };

  // ── Utilitário ────────────────────────────────────────────────────
  function _genId(len = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  // ── Gerenciamento de telas ─────────────────────────────────────────
  const _screens = {};

  function showScreen(name) {
    Object.values(_screens).forEach(s => s.classList.remove('active'));
    if (_screens[name]) _screens[name].classList.add('active');
    _s.currentGame = (name === 'tictactoe' || name === 'chess') ? name : null;
  }

  // ── Banners de conexão ─────────────────────────────────────────────
  const _bannerIds = ['lobby-conn-banner', 'ttt-conn-banner', 'chess-conn-banner'];

  function showConnectionBanner(show) {
    _bannerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    });
  }

  // ── Overlay de resultado ───────────────────────────────────────────
  function showResult(emoji, message, onPlayAgain, onLobby) {
    const overlay = document.getElementById('result-overlay');
    document.getElementById('result-emoji').textContent   = emoji;
    document.getElementById('result-message').textContent = message;
    overlay.classList.remove('hidden');

    const _rebind = (id, cb) => {
      const old = document.getElementById(id);
      const fresh = old.cloneNode(true);
      old.replaceWith(fresh);
      fresh.addEventListener('click', () => { overlay.classList.add('hidden'); cb && cb(); });
    };
    _rebind('btn-result-play-again', onPlayAgain);
    _rebind('btn-result-lobby',      onLobby);
  }

  function hideResult() {
    document.getElementById('result-overlay').classList.add('hidden');
  }

  // ── Envio de mensagem ──────────────────────────────────────────────
  function send(data) {
    if (_s.conn && _s.conn.open) { _s.conn.send(data); return true; }
    return false;
  }

  // ── Roteamento de mensagens ────────────────────────────────────────
  function _routeMsg(data) {
    if (!data || !data.type) return;

    switch (data.type) {

      case 'START_GAME':
        _onStartGame(data.game);
        break;

      case 'RETURN_LOBBY':
        _returnToLobbyLocal();
        break;

      case 'sync_request':
        if (_s.isHost) {
          if      (_s.currentGame === 'tictactoe') TicTacToe.syncState();
          else if (_s.currentGame === 'chess')     ChessGame.syncState();
          else send({ type: 'sync_lobby' });
        }
        break;

      case 'sync_lobby':
        _showConnectedLobby();
        break;

      default:
        if      (data.type.startsWith('ttt_'))   TicTacToe.handleMessage(data);
        else if (data.type.startsWith('chess_')) ChessGame.handleMessage(data);
    }
  }

  // ── Lobby conectado ────────────────────────────────────────────────
  function _showConnectedLobby() {
    showScreen('lobby');
    showConnectionBanner(false);

    const hint = document.getElementById('lobby-hint');
    hint.textContent = _s.isHost
      ? '👑 Você é o Host — escolha o jogo para os dois!'
      : '⏳ Aguardando o Host escolher o jogo...';

    document.querySelectorAll('.game-card').forEach(card => {
      card.disabled      = !_s.isHost;
      card.style.opacity = _s.isHost ? '1' : '0.55';
      card.style.cursor  = _s.isHost ? 'pointer' : 'not-allowed';
    });
  }

  function _onStartGame(game) {
    if      (game === 'tictactoe') TicTacToe.init(_s.isHost);
    else if (game === 'chess')     ChessGame.init(_s.isHost);
  }

  function _returnToLobbyLocal() {
    hideResult();
    _showConnectedLobby();
  }

  function returnToLobby() {
    send({ type: 'RETURN_LOBBY' });
    _returnToLobbyLocal();
  }

  // ── Eventos de conexão ─────────────────────────────────────────────
  function _setupConn(conn) {
    _s.conn = conn;

    conn.on('open', () => {
      clearTimeout(_s.reconnTimer);
      showConnectionBanner(false);
      _showConnectedLobby();
      if (!_s.isHost) send({ type: 'sync_request' });
    });

    conn.on('data',  _routeMsg);
    conn.on('close', _onConnLost);
    conn.on('error', _onConnLost);
  }

  function _onConnLost() {
    showConnectionBanner(true);
    if (!_s.isHost) {
      _s.reconnTimer = setTimeout(_tryReconnect, 3000);
    }
  }

  function _tryReconnect() {
    if (!_s.peer || _s.peer.destroyed) return;
    const hostId = document.getElementById('join-id-input').value.trim().toLowerCase();
    if (!hostId) return;
    _setupConn(_s.peer.connect(hostId, { reliable: true }));
  }

  // ── PeerJS ────────────────────────────────────────────────────────
  function _initPeer(customId = null) {
    if (_s.peer && !_s.peer.destroyed) _s.peer.destroy();

    const opts = {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ]
      }
    };

    const peer = customId ? new Peer(customId, opts) : new Peer(opts);
    _s.peer = peer;

    peer.on('error', err => {
      console.warn('[PeerJS]', err.type);
      if (err.type === 'unavailable-id') { peer.destroy(); _initPeer(_genId()); }
    });

    return peer;
  }

  // ── Fluxo Host ────────────────────────────────────────────────────
  function _startHost() {
    _s.isHost = true;
    showScreen('host');
    document.getElementById('host-id-display').textContent = '...';

    const peer = _initPeer(_genId());

    peer.on('open', id => {
      document.getElementById('host-id-display').textContent = id;
    });

    peer.on('connection', conn => {
      if (_s.conn && _s.conn.open) { conn.close(); return; }
      _setupConn(conn);
    });
  }

  // ── Fluxo Guest ───────────────────────────────────────────────────
  function _startGuest() {
    _s.isHost = false;
    showScreen('join');
  }

  function _connectToHost() {
    const hostId = document.getElementById('join-id-input').value.trim().toLowerCase();
    if (!hostId) { document.getElementById('join-id-input').focus(); return; }

    const statusEl  = document.getElementById('guest-status');
    const statusTxt = document.getElementById('guest-status-text');
    const btnConn   = document.getElementById('btn-connect');

    statusEl.style.display = 'flex';
    statusTxt.textContent  = 'Conectando...';
    btnConn.disabled       = true;

    const peer = _initPeer();

    peer.on('open', () => {
      const conn    = peer.connect(hostId, { reliable: true });
      const timeout = setTimeout(() => {
        if (!conn.open) {
          statusTxt.textContent = 'Não foi possível conectar. Verifique o código.';
          btnConn.disabled = false;
        }
      }, 10000);
      conn.on('open', () => clearTimeout(timeout));
      _setupConn(conn);
    });

    peer.on('error', () => {
      statusTxt.textContent = 'Erro ao conectar. Tente novamente.';
      btnConn.disabled = false;
    });
  }

  // ── Copiar código ─────────────────────────────────────────────────
  function _copyHostId() {
    const id = document.getElementById('host-id-display').textContent;
    if (!id || id === '...') return;
    const feedback = document.getElementById('copy-feedback');
    const done = () => {
      feedback.textContent = '✅ Copiado!';
      setTimeout(() => { feedback.textContent = ''; }, 2000);
    };
    navigator.clipboard.writeText(id).then(done).catch(() => {
      const el = document.createElement('input');
      el.value = id;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      done();
    });
  }

  // ── Sair / resetar ────────────────────────────────────────────────
  function destroy() {
    clearTimeout(_s.reconnTimer);
    if (_s.peer && !_s.peer.destroyed) _s.peer.destroy();
    _s.peer = null; _s.conn = null;
    _s.isHost = false; _s.currentGame = null;
  }

  function goToMenu() {
    destroy();
    document.getElementById('join-id-input').value    = '';
    document.getElementById('btn-connect').disabled   = false;
    document.getElementById('guest-status').style.display = 'none';
    showConnectionBanner(false);
    hideResult();
    showScreen('menu');
  }

  // ── Bootstrap ─────────────────────────────────────────────────────
  function init() {
    ['menu','host','join','lobby','tictactoe','chess'].forEach(n => {
      _screens[n] = document.getElementById('screen-' + n);
    });

    // Botões de navegação
    document.getElementById('btn-create').addEventListener('click', _startHost);
    document.getElementById('btn-join').addEventListener('click',   _startGuest);
    document.getElementById('btn-back-host').addEventListener('click', goToMenu);
    document.getElementById('btn-back-join').addEventListener('click', goToMenu);
    document.getElementById('btn-copy').addEventListener('click',    _copyHostId);
    document.getElementById('btn-connect').addEventListener('click', _connectToHost);
    document.getElementById('btn-disconnect').addEventListener('click', goToMenu);

    document.getElementById('join-id-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') _connectToHost();
    });

    // Cards de seleção de jogo (apenas host pode clicar)
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!_s.isHost || card.disabled) return;
        const game = card.dataset.game;
        send({ type: 'START_GAME', game });
        _onStartGame(game);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── API pública ───────────────────────────────────────────────────
  return {
    send,
    showScreen,
    showResult,
    hideResult,
    showConnectionBanner,
    returnToLobby,
    goToMenu,
    isHost:      () => _s.isHost,
    isConnected: () => !!((_s.conn && _s.conn.open)),
  };

})();
