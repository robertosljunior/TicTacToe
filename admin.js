'use strict';

/* =========================================================
   admin.js — Gerador de Temas para o Jogo da Memória
   Página totalmente separada do app principal.
   Gera um bloco de código JSON para colar em themes.js.
   ========================================================= */

const pairsContainer = document.getElementById('pairs-container');
const outputSection  = document.getElementById('output-section');
const outputCode     = document.getElementById('output-code');

// ── Renderiza as linhas de pares ─────────────────────────────────
function _renderPairs() {
  const rows = pairsContainer.querySelectorAll('.pair-row');
  rows.forEach((row, i) => {
    row.querySelector('.pair-num').textContent = `#${i + 1}`;
  });
}

function _addPairRow(value = '') {
  const row   = document.createElement('div');
  row.className = 'pair-row';

  const num   = document.createElement('span');
  num.className = 'pair-num';
  num.style.cssText = 'font-weight:700;color:#6c63ff;min-width:28px;text-align:center;';
  num.textContent   = `#${pairsContainer.children.length + 1}`;

  const input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Emoji (ex: 🦁)';
  input.value       = value;
  input.maxLength   = 8;
  input.className   = 'pair-input';
  input.autocomplete = 'off';

  const removeBtn = document.createElement('button');
  removeBtn.className   = 'btn-remove';
  removeBtn.textContent = '✕';
  removeBtn.title       = 'Remover par';
  removeBtn.addEventListener('click', () => {
    row.remove();
    _renderPairs();
  });

  row.append(num, input, removeBtn);
  pairsContainer.appendChild(row);
}

// ── Geração do código ────────────────────────────────────────────
function _generate() {
  const key   = document.getElementById('theme-key').value.trim().replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const label = document.getElementById('theme-label').value.trim();
  const inputs = [...pairsContainer.querySelectorAll('.pair-input')];
  const pairs  = inputs.map(i => i.value.trim()).filter(Boolean);

  // Validações
  if (!key) {
    alert('⚠️ Preencha a chave do tema (ex: frutas).');
    document.getElementById('theme-key').focus();
    return;
  }
  if (!label) {
    alert('⚠️ Preencha o rótulo do tema (ex: 🍓 Frutas).');
    document.getElementById('theme-label').focus();
    return;
  }
  if (pairs.length < 4) {
    alert('⚠️ Adicione pelo menos 4 emojis únicos.');
    return;
  }
  const unique = [...new Set(pairs)];
  if (unique.length !== pairs.length) {
    alert('⚠️ Remova emojis duplicados. Cada par deve ser único.');
    return;
  }

  // Gera o bloco de código
  const pairsStr = pairs.map(p => `'${p}'`).join(', ');
  const code = `  ${key}: {\n    label: '${label}',\n    pairs: [${pairsStr}],\n  },`;

  outputCode.textContent = code;
  outputSection.style.display = 'flex';
  outputSection.scrollIntoView({ behavior: 'smooth' });
}

// ── Copiar saída ─────────────────────────────────────────────────
function _copyOutput() {
  const text     = outputCode.textContent;
  const feedback = document.getElementById('copy-ok');
  const done = () => {
    feedback.textContent = '✅ Copiado! Cole dentro de THEMES em themes.js.';
    setTimeout(() => { feedback.textContent = ''; }, 3000);
  };
  navigator.clipboard.writeText(text).then(done).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    done();
  });
}

// ── Init ─────────────────────────────────────────────────────────
document.getElementById('btn-add-pair').addEventListener('click', () => _addPairRow());
document.getElementById('btn-generate').addEventListener('click', _generate);
document.getElementById('btn-copy-output').addEventListener('click', _copyOutput);

// Inicia com 4 linhas de emojis em branco
for (let i = 0; i < 4; i++) _addPairRow();
