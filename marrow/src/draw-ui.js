// Text and the HUD: the map track and the GO arrow. (Task 19 adds the timer and the flow screens.)
// The HUD's colors are the current world's (its scenes.json `colors.hud`); the glows are the fighters'
// own, the same in every world.
import { VIEW_W } from './tuning.js';

const GLOW = ['#e8a33a', '#6fd6d0'];

// The map track: one mark per screen, 9px apart and centered, the Maw's chambers (the two ends) in
// hud.markEnd, the rest in hud.mark, the current screen in hud.markHere.
const MAP_MARKS = 7;
const MAP_SPACING = 9;
const MAP_Y = 5;
const MAP_SIZE = 3;

// The GO arrow's HUD position, and its own frame rate (arrow.json carries no rate of its own).
const ARROW_MARGIN = 8; // from the screen edge, on the holder's goal side
const ARROW_Y = 16;
const ARROW_FRAME_TICKS = 8;
const LABEL_GAP = 4; // between the arrow and its "GO" label

// Every caller passes its color: from the world's HUD colors, or a glow.
export function text(ctx, str, x, y, { color, align = 'left', size = 8 }) {
  ctx.font = `${size}px Silkscreen, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

export function drawHUD(ctx, state, assets, world, tick) {
  // the map: seven marks, the Maw's chambers at each end, the current screen lit
  const hud = world.colors.hud;
  const here = state.slide ? state.slide.to : state.screen;
  for (let i = 0; i < MAP_MARKS; i++) {
    ctx.fillStyle = i === here ? hud.markHere : i === 0 || i === MAP_MARKS - 1 ? hud.markEnd : hud.mark;
    ctx.fillRect(Math.round(VIEW_W / 2 + (i - (MAP_MARKS - 1) / 2) * MAP_SPACING - 1), MAP_Y, MAP_SIZE, MAP_SIZE);
  }
  if (state.arrow === null || state.phase !== 'play') return;
  // the GO arrow: the holder's color, pointing toward their goal
  const h = state.fighters[state.arrow];
  const { data, sheets } = assets.arrow;
  const [fw, fh] = data.frame;
  const k = Math.floor(tick / ARROW_FRAME_TICKS) % data.frames;
  const x = h.dir > 0 ? VIEW_W - fw - ARROW_MARGIN : ARROW_MARGIN, y = ARROW_Y;
  if (h.dir > 0) ctx.drawImage(sheets[h.id], k * fw, 0, fw, fh, x, y, fw, fh);
  else {
    ctx.save();
    ctx.translate(x + fw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sheets[h.id], k * fw, 0, fw, fh, 0, y, fw, fh);
    ctx.restore();
  }
  text(ctx, 'GO', h.dir > 0 ? x - LABEL_GAP : x + fw + LABEL_GAP, y + 2, { color: GLOW[h.id], align: h.dir > 0 ? 'right' : 'left' });
}
