// Draws the game on the 320x180 canvas, scaled up by the largest whole number that fits the window.
import { VIEW_W, VIEW_H } from './tuning.js';
import { drawPlaceholder, drawHitboxes } from './draw-debug.js';
import { drawFighters, drawSwords } from './draw-fighters.js';
import { drawWorld, drawMaw } from './draw-world.js';
import { drawHUD } from './draw-ui.js';
import { createEffects } from './effects.js';
import { worldFor } from './assets.js';

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
  const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  let assets = null, fx = null, frame = 0, lastState = null;
  // A new state object is a new match: clean the floors before it's first ticked or drawn,
  // so the old match's stains never flash on the new match's first frame.
  const freshMatch = (state) => {
    if (state !== lastState) {
      fx.reset();
      lastState = state;
    }
  };
  return {
    setAssets(a) {
      assets = a;
      fx = createEffects(makeCanvas, a.palette.ichor);
    },
    // Called once per simulation tick with that tick's events.
    tick(state, events) {
      if (!fx) return;
      freshMatch(state);
      fx.onEvents(events);
      fx.update();
    },
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
    // rung: the ladder rung being fought (0-2), which picks the world the match is drawn in.
    draw(state, rung = 0) {
      frame++;
      ctx.imageSmoothingEnabled = false;
      if (!assets) {
        drawPlaceholder(ctx, state);
        return;
      }
      freshMatch(state);
      const world = worldFor(assets, rung);
      drawWorld(ctx, state, world, fx, frame);
      if (!state.slide) {
        drawSwords(ctx, state, assets);
        drawFighters(ctx, state, assets);
        fx.drawDrops(ctx, state.screen, 0);
        drawMaw(ctx, state, world);
      }
      drawHUD(ctx, state, assets, world, frame);
      if (debug) drawHitboxes(ctx, state);
    },
  };
}
