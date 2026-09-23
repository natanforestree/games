// Draws the game on the 320x180 canvas, scaled up by the largest whole number that fits the window.
import { VIEW_W, VIEW_H } from './tuning.js';
import { drawPlaceholder, drawHitboxes } from './draw-debug.js';

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
  return {
    draw(state) {
      ctx.imageSmoothingEnabled = false;
      drawPlaceholder(ctx, state);
      if (debug) drawHitboxes(ctx, state);
    },
  };
}
