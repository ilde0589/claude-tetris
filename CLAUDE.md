# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No build, no deps, no package.json, no tests, no linter. README and UI text are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` → http://localhost:8000.

## Architecture

Three files, all logic in `game.js` (single script, global scope, `'use strict'`):

- `index.html` — `<canvas id="board">` (300×600 = `COLS*BLOCK` × `ROWS*BLOCK`), `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), `#overlay` (pause/game over, toggled via `hidden` class). If changing `COLS`/`ROWS`/`BLOCK`, update canvas `width`/`height` in HTML manually.
- `game.js` — module-level mutable state (`board`, `current`, `next`, `score`, ...) reset by `init()`.
  - Board: `ROWS×COLS` matrix; 0 = empty, 1–7 = piece type index into `COLORS`/`PIECES` (index 0 is `null` on purpose).
  - Piece: `{type, shape, x, y}`; shape is a square matrix whose cell values equal the type index. Rotation = `rotateCW` (no per-piece rotation states); `tryRotate` kicks in order `[0,-1,1,-2,2]` horizontally only.
  - Flow: `loop` (rAF, accumulates `dropAccum` vs `dropInterval`) → `lockPiece` → `merge` + `clearLines` + `spawn`. `spawn` calls `endGame()` if new piece collides.
  - Keyboard handler drives moves directly; `softDrop`/`hardDrop` award score (1/2 pts per cell).
  - Pause/game over both cancel the rAF (`animId`); `togglePause` restarts `loop` with a fresh `lastTime`.
  - Speed: `dropInterval = max(100, 1000 - (level-1)*90)`; level = `floor(lines/10)+1`; line score = `LINE_SCORES[n] * level`.
  - Bomb power-up: type index `10` (`BOMB_TYPE`), a 1×1 piece, excluded from `randomType()`'s normal pool. `clearLines` queues one (`bombQueued`) every `BOMB_EVERY` (5) lines via `nextBombAt`; `spawn` hands out the queued bomb as `next` instead of a random piece. In `lockPiece`, a bomb piece skips `merge`/`clearLines` and calls `explode(x, y)` instead, clearing the 3×3 area centered on it (bounds-checked, no gravity refill) and scoring `BOMB_CELL_SCORE` per cleared cell; `explosion` state drives a brief flash in `draw()`.
- `style.css` — dark/retro styling.
