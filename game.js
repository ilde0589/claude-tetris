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

// ---- Skins ----
// Cada skin define su propia paleta (mismos índices 0-10 que COLORS, incluida
// la bomba) más una función draw(context, x, y, colorIndex, size, color) que
// pinta solo el cuerpo del bloque. El glifo de la bomba se dibuja aparte,
// encima, en drawBombGlyph, así se ve igual en todos los skins.
const SKINS = {
  retro: {
    label: 'Retro',
    bg: null, // null = no pintar fondo propio, usa el --board-bg del tema (claro/oscuro)
    grid: null, // null = usa el --grid-line del tema
    colors: COLORS,
    draw(context, x, y, colorIndex, size, color) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    bg: '#000000',
    grid: '#1a2a33',
    colors: [
      null,
      '#00e5ff', '#ffea00', '#e040fb', '#00e676', '#ff1744',
      '#2979ff', '#ff9100', '#e0e0e0', '#ff4081', '#ff3d00',
    ],
    draw(context, x, y, colorIndex, size, color) {
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      const baseAlpha = context.globalAlpha;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.fillStyle = color;
      context.globalAlpha = baseAlpha * 0.35;
      context.fillRect(px, py, s, s);
      context.globalAlpha = baseAlpha;
      context.strokeRect(px + 1, py + 1, s - 2, s - 2);
      context.restore();
    },
  },
  pastel: {
    label: 'Pastel',
    bg: '#f4eef8',
    grid: '#e0d4ea',
    colors: [
      null,
      '#b3e5fc', '#fff9c4', '#e1bee7', '#c8e6c9', '#ffcdd2',
      '#bbdefb', '#ffe0b2', '#cfd8dc', '#f8bbd0', '#ff8a80',
    ],
    draw(context, x, y, colorIndex, size, color) {
      const px = x * size + 2, py = y * size + 2;
      const w = size - 4, h = size - 4, r = Math.min(8, w / 2, h / 2);
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(px + r, py);
      context.arcTo(px + w, py, px + w, py + h, r);
      context.arcTo(px + w, py + h, px, py + h, r);
      context.arcTo(px, py + h, px, py, r);
      context.arcTo(px, py, px + w, py, r);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.15)';
      context.lineWidth = 1;
      context.stroke();
    },
  },
  pixel: {
    label: 'Pixel Art',
    bg: '#14141f',
    grid: '#2a2a3a',
    colors: COLORS,
    draw(context, x, y, colorIndex, size, color) {
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // patrón checker 4x4 (dither)
      const cell = Math.max(2, Math.floor(s / 4));
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let gy = 0; gy * cell < s; gy++) {
        for (let gx = 0; gx * cell < s; gx++) {
          if ((gx + gy) % 2 === 0) {
            context.fillRect(px + gx * cell, py + gy * cell, cell, cell);
          }
        }
      }
      // bisel pixelado: claro arriba-izquierda, oscuro abajo-derecha
      const edge = Math.max(2, Math.floor(size * 0.12));
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px, py, s, edge);
      context.fillRect(px, py, edge, s);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + s - edge, s, edge);
      context.fillRect(px + s - edge, py, edge, s);
    },
  },
};

const SKIN_KEY = 'tetris-skin';
let currentSkin = 'retro';

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
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let bombQueued, nextBombAt, explosion;
let theme = 'dark';
let gridColor = '#22222e';

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
  } else {
    merge();
    clearLines();
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

function drawBombGlyph(context, x, y, size) {
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x, y, colorIndex, size, color);
  if (colorIndex === BOMB_TYPE) {
    drawBombGlyph(context, x, y, size);
  }
  context.globalAlpha = 1;
}

function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light', theme === 'light');
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  themeToggle.checked = theme === 'light';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
  if (board) {
    draw();
    drawNext();
  }
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  if (skinSelect) skinSelect.value = currentSkin;
  try { localStorage.setItem(SKIN_KEY, currentSkin); } catch (e) { /* almacenamiento no disponible */ }
  if (board) {
    draw();
    drawNext();
  }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid || gridColor;
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
  const skinBg = SKINS[currentSkin] && SKINS[currentSkin].bg;
  if (skinBg) {
    ctx.fillStyle = skinBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  const skinBg = SKINS[currentSkin] && SKINS[currentSkin].bg;
  if (skinBg) {
    nextCtx.fillStyle = skinBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
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
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
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

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

if (skinSelect) {
  // sincroniza el texto de las opciones con SKINS[*].label (fuente única)
  for (const opt of skinSelect.options) {
    if (SKINS[opt.value]) opt.textContent = SKINS[opt.value].label;
  }
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
  });
}

let savedTheme = 'dark';
let savedSkin = 'retro';
try { savedTheme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { /* almacenamiento no disponible */ }
try { savedSkin = localStorage.getItem(SKIN_KEY) || 'retro'; } catch (e) { /* almacenamiento no disponible */ }

applyTheme(savedTheme);
applySkin(savedSkin);
init();
