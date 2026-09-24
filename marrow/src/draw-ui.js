// Text and the HUD: the map track, the GO arrow, the timer and the flow screens (title, intro, result,
// ladder complete, pause). The HUD's colors are the current world's (its scenes.json `colors.hud`);
// the glows are the fighters' own, the same in every world.
import { VIEW_W, VIEW_H } from './tuning.js';
import { formatTime } from './game.js';
import { LADDER } from './ai.js';

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

const OPPONENTS = {
  rusher: ['I', 'THE RUSHER', 'charges in low and lunges often'],
  waiter: ['II', 'THE WAITER', 'keeps its distance and waits for mistakes'],
  shifter: ['III', 'THE SHIFTER', 'never fights the same way twice'],
};

const BLINK_TICKS = 30; // how often a flow screen's prompt blinks, like ARROW_FRAME_TICKS above

export function drawTimer(ctx, ticks, world) {
  text(ctx, formatTime(ticks), 6, 4, { color: world.colors.hud.dim });
}

// The screens around a match: title, opponent intro, result, ladder complete, and the pause overlay.
// Each is veiled in the world behind it (its `clear` color) and lettered in its HUD colors; the glows
// mark the player (amber) and the CPU (cyan).
export function drawScreens(ctx, game, world, tick) {
  const { hud, clear } = world.colors;
  const blink = Math.floor(tick / BLINK_TICKS) % 2 === 0;
  const cx = VIEW_W / 2;
  const veil = () => {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = clear;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  };
  switch (game.mode) {
    case 'title':
      veil();
      text(ctx, 'MARROW', cx, 44, { color: hud.markHere, align: 'center', size: 24 });
      text(ctx, 'reach the far end. the maw is waiting.', cx, 76, { color: hud.dim, align: 'center' });
      if (game.touchOnly) text(ctx, 'KEYBOARD NEEDED', cx, 104, { color: hud.markHere, align: 'center' });
      else if (blink) text(ctx, 'PRESS ENTER', cx, 104, { color: GLOW[0], align: 'center' });
      text(ctx, 'A/D MOVE   W/S STANCE   F ATTACK   G JUMP', cx, 140, { color: hud.text, align: 'center' });
      text(ctx, 'ESC PAUSE   M MUTE', cx, 152, { color: hud.text, align: 'center' });
      if (game.best !== null) text(ctx, `BEST ${formatTime(game.best)}`, cx, 164, { color: hud.dim, align: 'center' });
      break;
    case 'intro': {
      veil();
      const [num, name, line] = OPPONENTS[LADDER[game.rung]];
      text(ctx, num, cx, 52, { color: GLOW[1], align: 'center', size: 16 });
      text(ctx, name, cx, 76, { color: hud.markHere, align: 'center', size: 16 });
      text(ctx, line, cx, 100, { color: hud.dim, align: 'center' });
      break;
    }
    case 'result': {
      const won = game.outcome === 'win';
      veil();
      text(ctx, won ? 'VICTORY' : 'DEFEAT', cx, 60, { color: won ? GLOW[0] : GLOW[1], align: 'center', size: 16 });
      text(ctx, won ? 'the maw accepts you' : 'the maw took them instead', cx, 86, { color: hud.dim, align: 'center' });
      if (blink) text(ctx, won ? 'ENTER: NEXT OPPONENT' : 'ENTER: TRY AGAIN', cx, 112, { color: hud.text, align: 'center' });
      break;
    }
    case 'complete':
      veil();
      text(ctx, 'THE LADDER IS DONE', cx, 52, { color: GLOW[0], align: 'center', size: 16 });
      text(ctx, formatTime(game.timer), cx, 80, { color: hud.markHere, align: 'center', size: 16 });
      if (game.newBest) text(ctx, 'NEW BEST', cx, 104, { color: GLOW[0], align: 'center' });
      else if (game.best !== null) text(ctx, `BEST ${formatTime(game.best)}`, cx, 104, { color: hud.dim, align: 'center' });
      if (blink) text(ctx, 'PRESS ENTER', cx, 128, { color: hud.text, align: 'center' });
      break;
    case 'match':
      if (!game.paused) break;
      veil();
      text(ctx, 'PAUSED', cx, 72, { color: hud.markHere, align: 'center', size: 16 });
      text(ctx, 'ESC RESUME   M MUTE', cx, 98, { color: hud.dim, align: 'center' });
      break;
  }
}
