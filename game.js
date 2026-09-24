'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
  '#f06292', // U - rosa
  '#ff1744', // bomba
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
  [[10]],                                      // bomba
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const BOMB_TYPE = 10;
const BOMB_EVERY = 5;
const BOMB_CELL_SCORE = 10;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const nameEntryDiv = document.getElementById('name-entry');
const nameInput = document.getElementById('player-name-input');
const gameOverRecordsDiv = document.getElementById('game-over-records');
const gameOverRecordsList = document.getElementById('game-over-records-list');
const resetRecordsBtnOver = document.getElementById('reset-records-btn-over');

const startScreen = document.getElementById('start-screen');
const startRecordsList = document.getElementById('start-records-list');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtnStart = document.getElementById('reset-records-btn-start');

const THEME_KEY = 'tetris-theme';
const RECORDS_KEY = 'tetris-records';
const MAX_TOP = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let bombQueued, nextBombAt, explosion, combo;
let theme = 'dark';
let gridColor = '#22222e';
let records = loadRecords();
let pendingEntry = null; // entrada de score pendiente de nombre (top 5)

function defaultRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw);
    const top = Array.isArray(parsed.top)
      ? parsed.top
          .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
          .map(e => ({
            name: e.name,
            score: Number(e.score) || 0,
            lines: Number(e.lines) || 0,
            level: Number(e.level) || 1,
            date: typeof e.date === 'string' ? e.date : '',
          }))
          .slice(0, MAX_TOP)
      : [];
    return {
      top,
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch (e) {
    return defaultRecords();
  }
}

function saveRecords(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch (e) {
    // localStorage puede fallar en modo privado; ignorar
  }
}

function renderRecordsTable(container, recs, highlightIndex) {
  container.innerHTML = '';
  if (!recs.top.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records aún';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'records-table';
  recs.top.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('highlight');
    const tdPos = document.createElement('td');
    tdPos.textContent = `${i + 1}.`;
    const tdName = document.createElement('td');
    tdName.textContent = entry.name; // textContent: nunca innerHTML con nombre de usuario
    const tdScore = document.createElement('td');
    tdScore.textContent = entry.score.toLocaleString();
    tr.append(tdPos, tdName, tdScore);
    table.appendChild(tr);
  });
  container.appendChild(table);
}

function renderStartScreen() {
  renderRecordsTable(startRecordsList, records, -1);
  startBestCombo.textContent = records.bestCombo;
  startMaxLines.textContent = records.maxLines;
}

function qualifiesForTop(candidateScore) {
  if (records.top.length < MAX_TOP) return true;
  return candidateScore > records.top[records.top.length - 1].score;
}

function saveScoreEntry(name) {
  if (!pendingEntry) return;
  const entry = {
    name: (name || 'Jugador').slice(0, 12),
    score: pendingEntry.score,
    lines: pendingEntry.lines,
    level: pendingEntry.level,
    date: new Date().toISOString(),
  };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, MAX_TOP);
  saveRecords(records);
  const idx = records.top.indexOf(entry);
  renderRecordsTable(gameOverRecordsList, records, idx);
  nameEntryDiv.classList.add('hidden');
  pendingEntry = null;
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  records = defaultRecords();
  saveRecords(records);
  renderStartScreen();
  renderRecordsTable(gameOverRecordsList, records, -1);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

const RARE_PIECES = { 9: 0.05 }; // tipo → probabilidad de aparición (U ~5%)

function randomType() {
  const r = Math.random();
  let acc = 0;
  for (const [t, p] of Object.entries(RARE_PIECES)) {
    acc += p;
    if (r < acc) return Number(t);
  }
  const common = PIECES.map((_, i) => i).filter(i => i && i !== BOMB_TYPE && !(i in RARE_PIECES));
  return common[Math.floor(Math.random() * common.length)];
}

function randomPiece() {
  const type = randomType();
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function bombPiece() {
  return { type: BOMB_TYPE, shape: [[BOMB_TYPE]], x: Math.floor(COLS / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    while (lines >= nextBombAt) {
      bombQueued = true;
      nextBombAt += BOMB_EVERY;
    }
    updateHUD();
  }
  return cleared;
}

function explode(cx, cy) {
  let count = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) count++;
      board[r][c] = 0;
    }
  }
  score += count * BOMB_CELL_SCORE;
  explosion = { x: cx, y: cy, t: performance.now() };
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === BOMB_TYPE) {
    explode(current.x, current.y);
    // bomba: neutral para el combo, no corta ni suma racha
  } else {
    merge();
    const cleared = clearLines();
    if (cleared > 0) {
      combo++;
      if (combo > records.bestCombo) {
        records.bestCombo = combo;
        saveRecords(records);
      }
    } else {
      combo = 0;
    }
  }
  spawn();
}

function spawn() {
  current = next;
  if (bombQueued) {
    next = bombPiece();
    bombQueued = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === BOMB_TYPE) {
    const cx = x * size + size / 2;
    const cy = y * size + size / 2;
    context.fillStyle = 'rgba(0,0,0,0.7)';
    context.beginPath();
    context.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffb74d';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx + size * 0.15, cy - size * 0.28);
    context.lineTo(cx + size * 0.32, cy - size * 0.42);
    context.stroke();
  }
  context.globalAlpha = 1;
}

function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light', theme === 'light');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
  if (board) {
    draw();
    drawNext();
  }
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  // explosion flash
  if (explosion) {
    const elapsed = performance.now() - explosion.t;
    if (elapsed < 250) {
      const alpha = 1 - elapsed / 250;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ffb74d';
      const ex = Math.max(0, explosion.x - 1);
      const ey = Math.max(0, explosion.y - 1);
      const ew = Math.min(COLS, explosion.x + 2) - ex;
      const eh = Math.min(ROWS, explosion.y + 2) - ey;
      ctx.fillRect(ex * BLOCK, ey * BLOCK, ew * BLOCK, eh * BLOCK);
      ctx.globalAlpha = 1;
    } else {
      explosion = null;
    }
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (lines > records.maxLines) {
    records.maxLines = lines;
    saveRecords(records);
  }

  gameOverRecordsDiv.classList.remove('hidden');
  resetRecordsBtnOver.classList.remove('hidden');

  if (score > 0 && qualifiesForTop(score)) {
    pendingEntry = { score, lines, level };
    nameEntryDiv.classList.remove('hidden');
    nameInput.value = 'Jugador';
    renderRecordsTable(gameOverRecordsList, records, -1);
    overlay.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  } else {
    pendingEntry = null;
    nameEntryDiv.classList.add('hidden');
    renderRecordsTable(gameOverRecordsList, records, -1);
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    dropAccum = 0;
    overlay.classList.add('hidden');
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  bombQueued = false;
  nextBombAt = BOMB_EVERY;
  explosion = null;
  combo = 0;
  pendingEntry = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntryDiv.classList.add('hidden');
  gameOverRecordsDiv.classList.add('hidden');
  resetRecordsBtnOver.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (document.activeElement === nameInput) return; // no interferir con el campo de nombre
  if (!current) return; // el juego aún no ha arrancado (pantalla de inicio)
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  if (pendingEntry) saveScoreEntry(nameInput.value.trim());
  init();
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.key === 'Enter') {
    e.preventDefault();
    saveScoreEntry(nameInput.value.trim());
  }
});

resetRecordsBtnStart.addEventListener('click', resetRecords);
resetRecordsBtnOver.addEventListener('click', resetRecords);

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
renderStartScreen();
