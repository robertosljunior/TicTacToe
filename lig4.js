'use strict';

/* =========================================================
   lig4.js — Connect 4 (Lig 4) P2P
   Depende de network.js (Network global).
   ========================================================= */

const Lig4 = (() => {

  const ROWS = 6, COLS = 7;

  // ── Estado ────────────────────────────────────────────────────────
  const _s = {
    board:       Array(ROWS * COLS).fill(0), // 0=vazio, 1=p1(vermelho), 2=p2(amarelo)
    myPlayer:    1,   // 1=host, 2=guest
    currentTurn: 1,
    gameOver:    false,
    scores:      { p1: 0, p2: 0 }, // p1=host, p2=guest
  };

  const $ = id => document.getElementById(id);

  // ── Construção do tabuleiro ───────────────────────────────────────
  function _buildBoard() {
    const boardEl = $('lig4-board');
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className    = 'lig4-cell';
        cell.dataset.row  = r;
        cell.dataset.col  = c;
        boardEl.appendChild(cell);
      }
    }
  }

  // ── Renderização ──────────────────────────────────────────────────
  function _renderBoard(winCells = []) {
    document.querySelectorAll('#lig4-board .lig4-cell').forEach((cell, i) => {
      const v = _s.board[i];
      cell.className = 'lig4-cell';
      if (v === 1) cell.classList.add('p1');
      if (v === 2) cell.classList.add('p2');
      if (winCells.includes(i)) cell.classList.add('winner');
    });
  }

  function _updateStatus() {
    if (_s.gameOver) return;
    const mine = _s.currentTurn === _s.myPlayer;
    $('lig4-turn-status').textContent = mine
      ? 'Sua vez! Escolha uma coluna 🎯'
      : 'Vez do oponente...';
    $('lig4-player-local').classList.toggle('active-turn',  mine);
    $('lig4-player-remote').classList.toggle('active-turn', !mine);
  }

  function _updateScores() {
    const localScore  = _s.myPlayer === 1 ? _s.scores.p1 : _s.scores.p2;
    const remoteScore = _s.myPlayer === 1 ? _s.scores.p2 : _s.scores.p1;
    $('lig4-score-local').textContent  = localScore;
    $('lig4-score-remote').textContent = remoteScore;
  }

  // ── Lógica ────────────────────────────────────────────────────────
  function _getLowestEmptyRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (_s.board[r * COLS + col] === 0) return r;
    }
    return -1; // coluna cheia
  }

  function _checkWin(board, player) {
    const check = (r, c, dr, dc) => {
      const cells = [];
      for (let i = 0; i < 4; i++) {
        const nr = r + i * dr, nc = c + i * dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return null;
        if (board[nr * COLS + nc] !== player) return null;
        cells.push(nr * COLS + nc);
      }
      return cells;
    };

    const winning = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
          const w = check(r, c, dr, dc);
          if (w) w.forEach(idx => winning.add(idx));
        }
      }
    }
    return winning.size ? [...winning] : null;
  }

  function _isDraw(board) { return board.every(v => v !== 0); }

  // ── Animação de queda ─────────────────────────────────────────────
  function _animateDrop(cellEl, row) {
    const boardEl = $('lig4-board');
    const firstCell = boardEl.querySelector('.lig4-cell');
    if (!firstCell) return;

    const cellH  = firstCell.offsetHeight;
    const gapStr = getComputedStyle(boardEl).gap;
    const gap    = gapStr ? parseFloat(gapStr) : 5;
    const dist   = row * (cellH + gap) + cellH; // start above row 0

    cellEl.style.setProperty('--drop-from', `${-dist}px`);
    cellEl.style.setProperty('--drop-dur', `${Math.max(0.22, row * 0.06 + 0.18)}s`);
    cellEl.classList.add('dropping');
    cellEl.addEventListener('animationend', () => cellEl.classList.remove('dropping'), { once: true });
  }

  // ── Aplicar movimento ─────────────────────────────────────────────
  function _applyMove(col) {
    const row = _getLowestEmptyRow(col);
    if (row < 0) return;

    const idx    = row * COLS + col;
    _s.board[idx] = _s.currentTurn;

    const allCells = document.querySelectorAll('#lig4-board .lig4-cell');
    _animateDrop(allCells[idx], row);

    const winCells = _checkWin(_s.board, _s.currentTurn);
    const draw     = !winCells && _isDraw(_s.board);

    if (winCells || draw) {
      _s.gameOver = true;
      _renderBoard(winCells || []);
      _endGame(_s.currentTurn, winCells, draw);
    } else {
      _s.currentTurn = _s.currentTurn === 1 ? 2 : 1;
      _renderBoard();
      _updateStatus();
    }
  }

  // ── Fim de jogo ───────────────────────────────────────────────────
  function _endGame(winner, winCells, isDraw) {
    let emoji, message;

    if (isDraw) {
      emoji = '🤝'; message = 'Empate!';
    } else {
      if (winner === 1) _s.scores.p1++; else _s.scores.p2++;
      _updateScores();
      const iWon = winner === _s.myPlayer;
      emoji   = iWon ? '🏆' : '😢';
      message = iWon ? 'Você venceu!' : 'O oponente venceu!';
    }

    $('lig4-turn-status').textContent = '';
    $('lig4-player-local').classList.remove('active-turn');
    $('lig4-player-remote').classList.remove('active-turn');

    Network.showResult(emoji, message,
      () => _requestRestart(),
      () => Network.returnToLobby()
    );
  }

  function _requestRestart() {
    if (!Network.isConnected()) return;
    Network.send({ type: 'lig4_restart' });
    _doReset();
  }

  function _doReset() {
    _s.board       = Array(ROWS * COLS).fill(0);
    _s.currentTurn = 1;
    _s.gameOver    = false;
    Network.hideResult();
    _buildBoard();
    _renderBoard();
    _updateStatus();
  }

  // ── Clique na coluna ──────────────────────────────────────────────
  function _handleColClick(col) {
    if (_s.gameOver)                        return;
    if (_s.currentTurn !== _s.myPlayer)     return;
    if (!Network.isConnected())             return;
    if (_getLowestEmptyRow(col) < 0)        return;

    Network.send({ type: 'lig4_move', col });
    _applyMove(col);
  }

  // ── API pública ───────────────────────────────────────────────────
  function init(isHost) {
    _s.myPlayer  = isHost ? 1 : 2;
    _s.scores    = { p1: 0, p2: 0 };

    const myLabel  = isHost ? '🔴 Vermelho' : '🟡 Amarelo';
    const oppLabel = isHost ? '🟡 Amarelo'  : '🔴 Vermelho';

    $('lig4-local-symbol').textContent  = myLabel;
    $('lig4-remote-symbol').textContent = oppLabel;
    _updateScores();

    Network.showScreen('lig4');
    _doReset();
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'lig4_move':
        _applyMove(data.col);
        break;
      case 'lig4_sync':
        _s.board       = data.board;
        _s.currentTurn = data.currentTurn;
        _s.gameOver    = data.gameOver;
        _s.scores      = data.scores || { p1: 0, p2: 0 };
        _buildBoard();
        _renderBoard();
        _updateScores();
        _updateStatus();
        break;
      case 'lig4_restart':
        _doReset();
        break;
    }
  }

  function syncState() {
    Network.send({
      type:        'lig4_sync',
      board:       _s.board,
      currentTurn: _s.currentTurn,
      gameOver:    _s.gameOver,
      scores:      _s.scores,
    });
  }

  // ── Binding de eventos ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Delegação de clique nas células → coluna
    document.getElementById('lig4-board').addEventListener('click', e => {
      const cell = e.target.closest('.lig4-cell');
      if (!cell) return;
      _handleColClick(parseInt(cell.dataset.col));
    });

    document.getElementById('lig4-btn-lobby')
      .addEventListener('click', () => Network.returnToLobby());
  });

  return { init, handleMessage, syncState };

})();
