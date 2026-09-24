// Draws the game on the 320x180 canvas, scaled up by the largest whole number that fits the window.
import { VIEW_W, VIEW_H } from './tuning.js';
import { drawPlaceholder, drawHitboxes } from './draw-debug.js';
import { drawFighters, drawSwords } from './draw-fighters.js';

export function createRenderer(canvas, { debug = false } = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const fit = () => {
    const scale = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
    canvas.style.width = `${VIEW_W * scale}px`;
    canvas.style.height = `${VIEW_H * scale}px`;
  };
  addEventListener('resize', fit);
  fit();
  let assets = null;
  return {
    setAssets(a) {
      assets = a;
    },
    // Called once per simulation tick with that tick's events (Task 16 uses it for ichor).
    tick() {},
    // Drawn before any art has loaded, so its colors are fixed here rather than taken from a world.
    message(title, detail) {
      ctx.fillStyle = '#0b0807';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = '8px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ece0c2';
      ctx.fillText(title, VIEW_W / 2, 76);
      ctx.fillStyle = '#9e917a';
      ctx.fillText(detail, VIEW_W / 2, 92);
    },
    draw(state) {
      ctx.imageSmoothingEnabled = false;
      drawPlaceholder(ctx, state, { fighters: !assets });
      if (assets && !state.slide) {
        drawSwords(ctx, state, assets);
        drawFighters(ctx, state, assets);
      }
      if (debug) drawHitboxes(ctx, state);
    },
  };
}
