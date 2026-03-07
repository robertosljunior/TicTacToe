'use strict';

/* =========================================================
   memory.js — Jogo da Memória P2P
   Depende de network.js (Network), themes.js (THEMES, shuffleBoard).
   ========================================================= */

const MemoryGame = (() => {

  // ── Estado ────────────────────────────────────────────────────────
  const _s = {
    themeKey:    '',
    board:       [],     // array de emojis (já embaralhados, 2N itens)
    flipped:     [],     // bool[] — carta virada para cima
    matched:     [],     // bool[] — par encontrado
    firstFlip:   null,   // índice da 1ª carta virada neste turno
    myPlayer:    1,      // 1=host, 2=guest
    currentTurn: 1,      // 1 ou 2
    scores:      { p1: 0, p2: 0 },
    gameOver:    false,
    locked:      false,  // bloqueia cliques durante animação de não-par
    isHost:      false,
  };

  const $ = id => document.getElementById(id);

  // ── Construção do grid ────────────────────────────────────────────
  function _buildGrid() {
    const grid = $('memory-grid');
    grid.innerHTML = '';
    const n = _s.board.length;

    _s.board.forEach((_, i) => {
      const card = document.createElement('div');
      card.className   = 'memory-card';
      card.dataset.idx = i;

      const back  = document.createElement('div');
      back.className   = 'card-back';
      back.textContent = '🎴';

      const front = document.createElement('div');
      front.className   = 'card-front';
      front.dataset.idx = i; // used for emoji display

      card.append(back, front);
      card.addEventListener('click', () => _handleCardClick(i));
      grid.appendChild(card);
    });

    // Ajusta colunas dinamicamente (sempre 4 colunas para 16 cartas)
    const cols = n <= 16 ? 4 : 5;
    grid.style.gridTemplateColumns = `repeat(${cols}, var(--mem-card))`;

    _renderGrid();
  }

  // ── Renderização ──────────────────────────────────────────────────
  function _renderGrid() {
    document.querySelectorAll('#memory-grid .memory-card').forEach((card, i) => {
      const front = card.querySelector('.card-front');

      // Emoji só aparece na frente
      front.textContent = _s.board[i];

      card.classList.toggle('flipped',  _s.flipped[i] || _s.matched[i]);
      card.classList.toggle('matched',  _s.matched[i]);
    });
  }

  function _updateStatus() {
    if (_s.gameOver) return;
    const mine = _s.currentTurn === _s.myPlayer;
    $('memory-turn-status').textContent = mine ? 'Sua vez! Vire uma carta 🃏' : 'Vez do oponente...';
    $('memory-player-local').classList.toggle('active-turn',  mine);
    $('memory-player-remote').classList.toggle('active-turn', !mine);
  }

  function _updateScores() {
    const local  = _s.myPlayer === 1 ? _s.scores.p1 : _s.scores.p2;
    const remote = _s.myPlayer === 1 ? _s.scores.p2 : _s.scores.p1;
    $('memory-score-local').textContent  = local;
    $('memory-score-remote').textContent = remote;
  }

  // ── Lógica central: aplicar virada (local e remota) ───────────────
  function _applyFlip(index) {
    if (_s.matched[index] || _s.flipped[index] || _s.locked) return;

    _s.flipped[index] = true;
    _renderGrid();

    if (_s.firstFlip === null) {
      // Primeira carta do turno
      _s.firstFlip = index;
    } else {
      // Segunda carta
      const first = _s.firstFlip;
      _s.firstFlip = null;
      _s.locked    = true;

      if (_s.board[first] === _s.board[index] && first !== index) {
        // ✅ Par encontrado!
        setTimeout(() => {
          _s.matched[first]  = true;
          _s.matched[index]  = true;
          _s.locked          = false;

          // Marca ponto para o jogador atual
          if (_s.currentTurn === 1) _s.scores.p1++; else _s.scores.p2++;

          _renderGrid();
          _updateScores();

          // Mesmo jogador continua
          _checkGameOver();
          if (!_s.gameOver) _updateStatus();
        }, 500);

      } else {
        // ❌ Não é par — vira de volta após 1.5s e troca turno
        setTimeout(() => {
          _s.flipped[first]  = false;
          _s.flipped[index]  = false;
          _s.locked          = false;
          _s.currentTurn     = _s.currentTurn === 1 ? 2 : 1;
          _renderGrid();
          _updateStatus();
        }, 1500);
      }
    }
  }

  // ── Clique na carta ───────────────────────────────────────────────
  function _handleCardClick(index) {
    if (_s.gameOver)                         return;
    if (_s.currentTurn !== _s.myPlayer)      return;
    if (_s.flipped[index] || _s.matched[index]) return;
    if (_s.locked)                           return;
    if (_s.firstFlip === index)              return; // mesma carta
    if (!Network.isConnected())              return;

    Network.send({ type: 'memory_flip', index });
    _applyFlip(index);
  }

  // ── Fim de jogo ───────────────────────────────────────────────────
  function _checkGameOver() {
    if (!_s.matched.every(Boolean)) return;
    _s.gameOver = true;

    const localScore  = _s.myPlayer === 1 ? _s.scores.p1 : _s.scores.p2;
    const remoteScore = _s.myPlayer === 1 ? _s.scores.p2 : _s.scores.p1;

    let emoji, message;
    if (localScore > remoteScore)       { emoji = '🏆'; message = `Você venceu! ${localScore}×${remoteScore}`; }
    else if (remoteScore > localScore)  { emoji = '😢'; message = `Você perdeu! ${localScore}×${remoteScore}`; }
    else                                { emoji = '🤝'; message = `Empate! ${localScore}×${remoteScore}`; }

    $('memory-turn-status').textContent = '';
    $('memory-player-local').classList.remove('active-turn');
    $('memory-player-remote').classList.remove('active-turn');

    Network.showResult(emoji, message,
      () => _requestRestart(),
      () => Network.returnToLobby()
    );
  }

  // ── Reinício ──────────────────────────────────────────────────────
  function _requestRestart() {
    if (!Network.isConnected()) return;

    if (_s.isHost) {
      // Host embaralha novamente e envia
      const newBoard = shuffleBoard(THEMES[_s.themeKey].pairs);
      Network.send({ type: 'memory_restart', board: newBoard });
      _doReset(_s.themeKey, newBoard);
    } else {
      // Guest solicita reinício ao host
      Network.send({ type: 'memory_restart_request' });
    }
  }

  function _doReset(themeKey, board) {
    _s.themeKey    = themeKey;
    _s.board       = board;
    _s.flipped     = Array(board.length).fill(false);
    _s.matched     = Array(board.length).fill(false);
    _s.firstFlip   = null;
    _s.currentTurn = 1;
    _s.gameOver    = false;
    _s.locked      = false;
    Network.hideResult();
    _buildGrid();
    _updateScores();
    _updateStatus();
  }

  // ── API pública ───────────────────────────────────────────────────
  function init(isHost, themeKey, board) {
    _s.isHost    = isHost;
    _s.myPlayer  = isHost ? 1 : 2;
    _s.scores    = { p1: 0, p2: 0 };
    _s.themeKey  = themeKey;

    Network.showScreen('memory');
    _doReset(themeKey, board);
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'memory_flip':
        _applyFlip(data.index);
        break;

      case 'memory_sync':
        _s.themeKey    = data.themeKey;
        _s.board       = data.board;
        _s.flipped     = data.flipped;
        _s.matched     = data.matched;
        _s.firstFlip   = data.firstFlip;
        _s.currentTurn = data.currentTurn;
        _s.scores      = data.scores;
        _s.gameOver    = data.gameOver;
        _s.locked      = false;
        _buildGrid();
        _updateScores();
        _updateStatus();
        break;

      case 'memory_restart':
        _doReset(_s.themeKey, data.board);
        break;

      case 'memory_restart_request':
        if (_s.isHost) {
          const newBoard = shuffleBoard(THEMES[_s.themeKey].pairs);
          Network.send({ type: 'memory_restart', board: newBoard });
          _doReset(_s.themeKey, newBoard);
        }
        break;
    }
  }

  function syncState() {
    Network.send({
      type:        'memory_sync',
      themeKey:    _s.themeKey,
      board:       _s.board,
      flipped:     _s.flipped,
      matched:     _s.matched,
      firstFlip:   _s.firstFlip,
      currentTurn: _s.currentTurn,
      scores:      _s.scores,
      gameOver:    _s.gameOver,
    });
  }

  // ── Binding de eventos ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('memory-btn-lobby')
      .addEventListener('click', () => Network.returnToLobby());
  });

  return { init, handleMessage, syncState };

})();
