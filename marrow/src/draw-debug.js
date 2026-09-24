// Placeholder art (until the real art is wired in) and the ?debug=cpu hitbox overlay.
import { TILE, COLS, ROWS, VIEW_W, VIEW_H } from './tuning.js';
import { SCREENS } from './level.js';
import * as P from './physics.js';
import { blade } from './combat.js';

const GLOW = ['#e8a33a', '#6fd6d0'];

// Tiles as blocks and, unless `fighters` is false, fighters as filled boxes with their blades.
export function drawPlaceholder(ctx, state, { fighters = true } = {}) {
  const screen = SCREENS[state.slide ? state.slide.from : state.screen];
  ctx.fillStyle = '#150f0c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#43301f';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (screen.rows[r][c] === '#') ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
  ctx.font = '8px Silkscreen, monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9e917a';
  ctx.fillText(screen.name, 4, VIEW_H - 10);
  if (state.arrow !== null && state.phase === 'play') {
    const h = state.fighters[state.arrow];
    ctx.fillStyle = GLOW[h.id];
    ctx.textAlign = h.dir > 0 ? 'right' : 'left';
    ctx.fillText(h.dir > 0 ? 'GO >' : '< GO', h.dir > 0 ? VIEW_W - 6 : 6, 6);
  }
  if (state.phase === 'maw' || state.phase === 'over') {
    ctx.fillStyle = GLOW[state.winner];
    ctx.textAlign = 'center';
    ctx.fillText(state.winner === 0 ? 'YOU WIN' : 'THE CPU WINS', VIEW_W / 2, 60);
  }
  if (!fighters) return;
  ctx.fillStyle = '#ece0c2';
  for (const s of state.swords) ctx.fillRect(Math.round(s.x) - 4, Math.round(s.y) - (s.state === 'floor' ? 1 : 0), 8, 1);
  for (const f of state.fighters) {
    const box = P.fighterBox(f);
    if (!box) continue;
    ctx.fillStyle = GLOW[f.id];
    ctx.fillRect(Math.round(box.x0), Math.round(box.y0), box.x1 - box.x0, box.y1 - box.y0);
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(Math.round(f.x + f.facing * 2) - 1, Math.round(box.y0) + 2, 2, 2); // which way it faces
    bladeLine(ctx, f, screen);
  }
}

// Outlines of every body box and live blade, drawn over whatever is on screen.
export function drawHitboxes(ctx, state) {
  const screen = SCREENS[state.slide ? state.slide.from : state.screen];
  for (const f of state.fighters) {
    const box = P.fighterBox(f);
    if (!box) continue;
    ctx.strokeStyle = '#ffffff'; // contrasting with GLOW's fill, so the outline reads over a sprite
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(box.x0) + 0.5, Math.round(box.y0) + 0.5, box.x1 - box.x0 - 1, box.y1 - box.y0 - 1);
    bladeLine(ctx, f, screen, '#ff3b3b');
  }
}

// Drawn from the same clipped geometry combat.js collides with, so the blade you see is the blade
// that hits: blade(f, screen) stops at a solid tile exactly where the collision code does.
function bladeLine(ctx, f, screen, color = '#ece0c2') {
  const bl = blade(f, screen);
  if (!bl) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(bl.x0), Math.round(bl.y), Math.round(bl.x1 - bl.x0), 1);
}
