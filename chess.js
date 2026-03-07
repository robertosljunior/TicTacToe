'use strict';

/* =========================================================
   chess.js — Lógica do Xadrez P2P
   Depende de network.js (Network global) e da biblioteca
   chess.js (global Chess) carregada via CDN.
   ========================================================= */

const ChessGame = (() => {

  // Peças Unicode
  const PIECES = {
    wk:'♔', wq:'♕', wr:'♖', wb:'♗', wn:'♘', wp:'♙',
    bk:'♚', bq:'♛', br:'♜', bb:'♝', bn:'♞', bp:'♟',
  };

  const FILES = ['a','b','c','d','e','f','g','h'];

  // ── Estado ────────────────────────────────────────────────────────
  const _s = {
    chess:       null,   // instância chess.js
    myColor:     'w',    // 'w' = host, 'b' = guest
    selectedSq:  null,
    validMoves:  [],     // casas destino válidas
    captureMovs: [],     // subconjunto de validMoves que têm peça inimiga
    gameOver:    false,
    lastMove:    null,   // { from, to }
  };

  // ── Auxiliares de tabuleiro ───────────────────────────────────────

  /** Cor visual da casa (light/dark) */
  function _sqColor(file, rank) {
    return ((FILES.indexOf(file) + 1 + rank) % 2 === 0) ? 'dark' : 'light';
  }

  /**
   * Retorna as 64 casas na ordem de renderização (top-left → bottom-right).
   * Branco: fileiras 8→1, colunas a→h
   * Preto : fileiras 1→8, colunas h→a  (tabuleiro girado)
   */
  function _orderedSquares() {
    const sqs = [];
    if (_s.myColor === 'w') {
      for (let r = 8; r >= 1; r--)
        for (const f of FILES) sqs.push(f + r);
    } else {
      for (let r = 1; r <= 8; r++)
        for (let fi = FILES.length - 1; fi >= 0; fi--) sqs.push(FILES[fi] + r);
    }
    return sqs;
  }

  // ── Construção do DOM do tabuleiro ────────────────────────────────
  function _buildBoard() {
    const boardEl = document.getElementById('chess-board');
    boardEl.innerHTML = '';
    _orderedSquares().forEach(sq => {
      const [f, r] = [sq[0], parseInt(sq[1])];
      const div = document.createElement('div');
      div.className  = `chess-sq ${_sqColor(f, r)}`;
      div.dataset.sq = sq;
      div.addEventListener('click', () => _handleClick(sq));
      boardEl.appendChild(div);
    });
  }

  // ── Renderização do tabuleiro ─────────────────────────────────────
  function _renderBoard() {
    const boardEl = document.getElementById('chess-board');

    // Mapa posição → peça a partir do chess.js board()
    const raw = _s.chess.board();
    const pieceMap = {};
    raw.forEach((row, rIdx) => {
      row.forEach((p, fIdx) => {
        if (p) pieceMap[FILES[fIdx] + (8 - rIdx)] = p;
      });
    });

    // Rei em xeque
    let checkKingSq = null;
    if (_s.chess.in_check()) {
      const turn = _s.chess.turn();
      raw.forEach((row, rIdx) => {
        row.forEach((p, fIdx) => {
          if (p && p.type === 'k' && p.color === turn)
            checkKingSq = FILES[fIdx] + (8 - rIdx);
        });
      });
    }

    boardEl.querySelectorAll('.chess-sq').forEach(el => {
      const sq = el.dataset.sq;

      // Limpa classes dinâmicas e conteúdo
      el.classList.remove('selected','valid-move','valid-capture','last-move','in-check');
      el.innerHTML = '';

      // Peça
      const p = pieceMap[sq];
      if (p) {
        const span = document.createElement('span');
        span.className   = 'chess-piece';
        span.textContent = PIECES[p.color + p.type] || '?';
        el.appendChild(span);
      }

      // Último movimento
      if (_s.lastMove && (sq === _s.lastMove.from || sq === _s.lastMove.to))
        el.classList.add('last-move');

      // Rei em xeque
      if (sq === checkKingSq) el.classList.add('in-check');

      // Selecionado
      if (sq === _s.selectedSq) el.classList.add('selected');

      // Movimentos válidos
      if (_s.validMoves.includes(sq))
        el.classList.add(_s.captureMovs.includes(sq) ? 'valid-capture' : 'valid-move');
    });
  }

  // ── Status do turno ───────────────────────────────────────────────
  function _updateStatus() {
    const el = document.getElementById('chess-turn-status');
    if (_s.gameOver) { el.textContent = ''; return; }

    const mine = _s.chess.turn() === _s.myColor;

    if (_s.chess.in_check()) {
      el.textContent = mine ? '⚠️ Você está em xeque!' : '⚠️ Oponente em xeque!';
      el.style.color = 'var(--pink)';
    } else {
      el.textContent = mine ? 'Sua vez ♟️' : 'Vez do oponente...';
      el.style.color = mine ? 'var(--purple)' : 'var(--text-light)';
    }
  }

  // ── Interação: clique na casa ─────────────────────────────────────
  function _handleClick(sq) {
    if (_s.gameOver)                        return;
    if (_s.chess.turn() !== _s.myColor)     return;

    const piece = _s.chess.get(sq);

    if (_s.selectedSq === null) {
      // Selecionar peça própria
      if (piece && piece.color === _s.myColor) {
        _s.selectedSq   = sq;
        _s.validMoves   = _s.chess.moves({ square: sq, verbose: true }).map(m => m.to);
        _s.captureMovs  = _s.chess.moves({ square: sq, verbose: true })
          .filter(m => _s.chess.get(m.to))
          .map(m => m.to);
        _renderBoard();
      }
    } else if (_s.validMoves.includes(sq)) {
      // Executar movimento
      _doMove(_s.selectedSq, sq);
    } else if (piece && piece.color === _s.myColor && sq !== _s.selectedSq) {
      // Trocar seleção para outra peça própria
      _s.selectedSq   = sq;
      _s.validMoves   = _s.chess.moves({ square: sq, verbose: true }).map(m => m.to);
      _s.captureMovs  = _s.chess.moves({ square: sq, verbose: true })
        .filter(m => _s.chess.get(m.to))
        .map(m => m.to);
      _renderBoard();
    } else {
      // Desselecionar
      _s.selectedSq  = null;
      _s.validMoves  = [];
      _s.captureMovs = [];
      _renderBoard();
    }
  }

  function _doMove(from, to) {
    const piece       = _s.chess.get(from);
    const isPromo     = piece && piece.type === 'p' &&
      ((piece.color === 'w' && to[1] === '8') ||
       (piece.color === 'b' && to[1] === '1'));

    const moveObj = { from, to };
    if (isPromo) moveObj.promotion = 'q';  // promoção automática para rainha

    if (!_s.chess.move(moveObj)) return;   // movimento inválido (não deve ocorrer)

    _s.lastMove   = { from, to };
    _s.selectedSq = null;
    _s.validMoves = [];
    _s.captureMovs = [];

    Network.send({ type: 'chess_move', from, to, promotion: isPromo ? 'q' : null });

    _renderBoard();
    _updateStatus();
    _checkGameOver();
  }

  // ── Fim de jogo ───────────────────────────────────────────────────
  function _checkGameOver() {
    if (!_s.chess.game_over()) return;
    _s.gameOver = true;
    _updateStatus();

    let emoji, message;

    if (_s.chess.in_checkmate()) {
      // O turno atual perdeu por xeque-mate
      const iLost = _s.chess.turn() === _s.myColor;
      emoji   = iLost ? '😢' : '♟️👑';
      message = iLost ? 'Xeque-mate! Você perdeu!' : 'Xeque-mate! Você venceu!';
    } else if (_s.chess.in_stalemate()) {
      emoji = '🤝'; message = 'Empate por afogamento!';
    } else {
      emoji = '🤝'; message = 'Empate!';
    }

    Network.showResult(emoji, message,
      () => _requestRestart(),
      () => Network.returnToLobby()
    );
  }

  // ── Mensagens P2P ─────────────────────────────────────────────────
  function handleMessage(data) {
    switch (data.type) {

      case 'chess_move': {
        const mv = { from: data.from, to: data.to };
        if (data.promotion) mv.promotion = data.promotion;
        _s.chess.move(mv);
        _s.lastMove   = { from: data.from, to: data.to };
        _s.selectedSq = null;
        _s.validMoves = [];
        _s.captureMovs = [];
        _renderBoard();
        _updateStatus();
        _checkGameOver();
        break;
      }

      case 'chess_sync':
        _s.chess.load(data.fen);
        _s.lastMove  = data.lastMove  || null;
        _s.gameOver  = data.gameOver  || false;
        _s.selectedSq = null;
        _s.validMoves = [];
        _s.captureMovs = [];
        _renderBoard();
        _updateStatus();
        break;

      case 'chess_restart':
        _doReset();
        break;
    }
  }

  function syncState() {
    Network.send({
      type:     'chess_sync',
      fen:      _s.chess.fen(),
      lastMove: _s.lastMove,
      gameOver: _s.gameOver,
    });
  }

  // ── Reinício ──────────────────────────────────────────────────────
  function _doReset() {
    _s.chess      = new Chess();
    _s.selectedSq = null;
    _s.validMoves = [];
    _s.captureMovs = [];
    _s.gameOver   = false;
    _s.lastMove   = null;
    Network.hideResult();
    _buildBoard();
    _renderBoard();
    _updateStatus();
  }

  function _requestRestart() {
    if (!Network.isConnected()) return;
    Network.send({ type: 'chess_restart' });
    _doReset();
  }

  // ── API pública ───────────────────────────────────────────────────
  function init(isHost) {
    _s.myColor = isHost ? 'w' : 'b';

    // Indicadores visuais de cor
    const myDot  = document.getElementById('chess-my-color');
    const oppDot = document.getElementById('chess-opp-color');
    if (myDot)  myDot.textContent  = isHost ? '♔' : '♚';
    if (oppDot) oppDot.textContent = isHost ? '♚' : '♔';

    Network.showScreen('chess');
    _doReset();
  }

  // ── Binding de eventos (uma única vez) ───────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chess-btn-lobby')
      .addEventListener('click', () => Network.returnToLobby());
  });

  return { init, handleMessage, syncState };

})();
