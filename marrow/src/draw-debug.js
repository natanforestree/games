// The ?debug=cpu hitbox overlay.
import { SCREENS } from './level.js';
import * as P from './physics.js';
import { blade } from './combat.js';

// Outlines of every body box and live blade, drawn over whatever is on screen.
export function drawHitboxes(ctx, state) {
  const screen = SCREENS[state.slide ? state.slide.from : state.screen];
  for (const f of state.fighters) {
    const box = P.fighterBox(f);
    if (!box) continue;
    ctx.strokeStyle = '#ffffff'; // white against the fighters' glow, so the outline reads over a sprite
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(box.x0) + 0.5, Math.round(box.y0) + 0.5, box.x1 - box.x0 - 1, box.y1 - box.y0 - 1);
    bladeLine(ctx, f, screen, '#ff3b3b');
  }
}

// Drawn from the same clipped geometry combat.js collides with, so the blade you see is the blade
// that hits: blade(f, screen) stops at a solid tile exactly where the collision code does.
function bladeLine(ctx, f, screen, color) {
  const bl = blade(f, screen);
  if (!bl) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(bl.x0), Math.round(bl.y), Math.round(bl.x1 - bl.x0), 1);
}
