'use strict';

/* =========================================================
   themes.js — Temas do Jogo da Memória
   Banco de dados estático de temas (emojis).
   Para adicionar temas, use admin.html e cole o JSON gerado.
   ========================================================= */

const THEMES = {
  animais: {
    label: '🦁 Animais',
    pairs: ['🦁','🐸','🦖','🐧','🦊','🐙','🦋','🐢'],
  },
  minecraft: {
    label: '⛏️ Minecraft',
    pairs: ['🧱','⛏️','💎','🧟','🐺','🍎','🌲','🔥'],
  },
  espaco: {
    label: '🚀 Espaço',
    pairs: ['🚀','⭐','🌙','🪐','👽','☄️','🛸','🌌'],
  },
  comida: {
    label: '🍕 Comida',
    pairs: ['🍕','🍔','🍦','🎂','🍩','🍭','🍿','🧃'],
  },
};

/**
 * Duplica os pares e embaralha com Fisher-Yates.
 * @param {string[]} pairs - array de N emojis únicos
 * @returns {string[]} array de 2N emojis embaralhados
 */
function shuffleBoard(pairs) {
  const cards = [...pairs, ...pairs];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
