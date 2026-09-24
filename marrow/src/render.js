// Draws the game on the 320x180 canvas, scaled up by the largest whole number that fits the window.
import { VIEW_W, VIEW_H } from './tuning.js';
import { drawPlaceholder, drawHitboxes } from './draw-debug.js';
import { drawFighters, drawSwords } from './draw-fighters.js';
import { drawWorld, drawMaw } from './draw-world.js';
import { drawHUD, drawTimer, drawScreens } from './draw-ui.js';
import { createEffects } from './effects.js';
import { worldFor } from './assets.js';

// The title shows the world of the card icon; every other screen shows the world of the rung being
// fought (the intro the coming opponent's, the result and ladder-complete screens the one just fought).
export const TITLE_WORLD = 'dusk';

export function worldOf(assets, game) {
  return game.mode === 'title' ? assets.worlds[TITLE_WORLD] : worldFor(assets, game.rung);
}

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
    draw(game) {
      frame++;
      ctx.imageSmoothingEnabled = false;
      const state = game.state;
      if (!assets) {
        drawPlaceholder(ctx, state);
        return;
      }
      freshMatch(state);
      const world = worldOf(assets, game);
      drawWorld(ctx, state, world, fx, frame);
      const showMatch = game.mode === 'match' || game.mode === 'result' || game.mode === 'complete';
      if (showMatch && !state.slide) {
        drawSwords(ctx, state, assets);
        drawFighters(ctx, state, assets);
        fx.drawDrops(ctx, state.screen, 0);
        drawMaw(ctx, state, world);
      }
      if (game.mode === 'match') {
        drawHUD(ctx, state, assets, world, frame);
        drawTimer(ctx, game.timer, world);
      }
      if (debug) drawHitboxes(ctx, state);
      drawScreens(ctx, game, world, frame);
    },
  };
}
