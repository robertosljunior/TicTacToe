'use strict';

/* =========================================================
   tictactoe.js — Lógica do Jogo da Velha P2P
   Depende de network.js (Network global).
   ========================================================= */

const TicTacToe = (() => {

  const WIN_COMBOS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];

  // ── Estado ────────────────────────────────────────────────────────
  const _s = {
    mySymbol:    '',
    board:       Array(9).fill(''),
    currentTurn: 'X',
    gameOver:    false,
    scores:      { local: 0, remote: 0 },
  };

  // ── Helpers de UI ─────────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function _renderBoard() {
    $$('#ttt-board .cell').forEach((cell, i) => {
      const v = _s.board[i];
      cell.textContent = v;
      cell.className   = 'cell' + (v ? ` ${v.toLowerCase()} taken` : '');
    });
  }

  function _highlight(combo) {
    combo.forEach(i => $$('#ttt-board .cell')[i].classList.add('winner'));
  }

  function _updateTurnStatus() {
    if (_s.gameOver) return;
    const mine = _s.currentTurn === _s.mySymbol;
    $('ttt-turn-status').textContent = mine ? 'Conectado! Sua vez 🎉' : 'Aguardando oponente...';
    $('ttt-player-local').classList.toggle('active-turn',  mine);
    $('ttt-player-remote').classList.toggle('active-turn', !mine);
  }

  // ── Lógica ────────────────────────────────────────────────────────
  function _checkWinner(board) {
    for (const [a, b, c] of WIN_COMBOS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c];
    }
    return null;
  }

  function _isDraw(board) { return board.every(v => v !== ''); }

  function _applyState(gs) {
    _s.board       = gs.board;
    _s.currentTurn = gs.currentTurn;
    _s.gameOver    = gs.gameOver;
    _renderBoard();
    if (gs.winnerCombo) _highlight(gs.winnerCombo);
    if (!_s.gameOver)   _updateTurnStatus();
  }

  function _resetBoard() {
    _s.board       = Array(9).fill('');
    _s.currentTurn = 'X';
    _s.gameOver    = false;
    Network.hideResult();
    $('ttt-btn-restart').classList.add('hidden');
    $('ttt-turn-status').textContent = '';
    $('ttt-player-local').classList.remove('active-turn');
    $('ttt-player-remote').classList.remove('active-turn');
    _renderBoard();
    _updateTurnStatus();
  }

  function _endGame(winnerSymbol, winnerCombo) {
    _s.gameOver = true;
    if (winnerCombo) _highlight(winnerCombo);

    const iWon = winnerSymbol === _s.mySymbol;

    if (winnerSymbol) {
      if (iWon) { _s.scores.local++;  $('ttt-score-local').textContent  = _s.scores.local; }
      else       { _s.scores.remote++; $('ttt-score-remote').textContent = _s.scores.remote; }
    }

    $('ttt-btn-restart').classList.remove('hidden');
    $('ttt-turn-status').textContent = '';
    $('ttt-player-local').classList.remove('active-turn');
    $('ttt-player-remote').classList.remove('active-turn');

    const emoji   = winnerSymbol ? (iWon ? '🏆' : '😢') : '🤝';
    const message = winnerSymbol ? (iWon ? 'Você venceu!' : 'O oponente venceu!') : 'Empatou!';

    Network.showResult(emoji, message,
      () => _requestRestart(),
      () => Network.returnToLobby()
    );
  }

  // ── Clique na célula ──────────────────────────────────────────────
  function _handleCellClick(index) {
    if (_s.gameOver)                          return;
    if (_s.currentTurn !== _s.mySymbol)       return;
    if (_s.board[index])                      return;
    if (!Network.isConnected())               return;

    _s.board[index] = _s.mySymbol;
    _s.currentTurn  = _s.mySymbol === 'X' ? 'O' : 'X';

    const winnerCombo  = _checkWinner(_s.board);
    const draw         = !winnerCombo && _isDraw(_s.board);
    const winnerSymbol = winnerCombo ? _s.mySymbol : null;

    if (winnerCombo || draw) _s.gameOver = true;

    const gs = {
      type:        'ttt_state',
      board:       _s.board,
      currentTurn: _s.currentTurn,
      gameOver:    _s.gameOver,
      winnerCombo: winnerCombo || null,
      winnerSymbol,
    };

    _renderBoard();
    if (winnerCombo) _highlight(winnerCombo);

    Network.send(gs);

    if (_s.gameOver) _endGame(winnerSymbol, winnerCombo);
    else              _updateTurnStatus();
  }

  function _requestRestart() {
    if (!Network.isConnected()) return;
    Network.send({ type: 'ttt_restart' });
    _resetBoard();
  }

  // ── API pública ───────────────────────────────────────────────────
  function init(isHost) {
    _s.mySymbol = isHost ? 'X' : 'O';
    _s.scores   = { local: 0, remote: 0 };

    const myS  = _s.mySymbol;
    const oppS = myS === 'X' ? 'O' : 'X';

    $('ttt-local-symbol').textContent   = myS;
    $('ttt-remote-symbol').textContent  = oppS;
    $('ttt-local-symbol').style.color   = myS === 'X' ? 'var(--purple)' : 'var(--pink)';
    $('ttt-remote-symbol').style.color  = myS === 'X' ? 'var(--pink)'   : 'var(--purple)';
    $('ttt-score-local').textContent    = '0';
    $('ttt-score-remote').textContent   = '0';

    Network.showScreen('tictactoe');
    _resetBoard();
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'ttt_state':
        _applyState(data);
        if (data.gameOver) _endGame(data.winnerSymbol, data.winnerCombo);
        break;
      case 'ttt_restart':
        _resetBoard();
        break;
    }
  }

  function syncState() {
    Network.send({
      type:        'ttt_state',
      board:       _s.board,
      currentTurn: _s.currentTurn,
      gameOver:    _s.gameOver,
      winnerCombo: null,
      winnerSymbol: null,
    });
  }

  // ── Binding de eventos (uma única vez) ───────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#ttt-board .cell').forEach(cell => {
      cell.addEventListener('click', () => _handleCellClick(Number(cell.dataset.index)));
    });
    document.getElementById('ttt-btn-restart').addEventListener('click', _requestRestart);
    document.getElementById('ttt-btn-lobby').addEventListener('click',   () => Network.returnToLobby());
  });

  return { init, handleMessage, syncState };

})();
