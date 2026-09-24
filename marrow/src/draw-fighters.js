// Fighter sprites. Picks each fighter's animation frame from its state and draws it facing the right
// way; then draws the blade from combat.js's geometry, clipped at walls exactly as combat clips it, so
// the blade you see is the blade that hits. The blade colors are palette.json's `blade`, the same three
// that rig.lua's R.blade paints.
import { T } from './tuning.js';
import { SCREENS } from './level.js';
import { blade } from './combat.js';
import { lungeExtended } from './fighter.js';

export function animName(f) {
  switch (f.state) {
    case 'stand':
      if (f.vx !== 0) return f.armed ? `walk${f.stance}` : 'run';
      return f.armed ? `stand${f.stance}` : 'standU';
    case 'air': return f.armed ? `air${f.stance}` : 'airU';
    case 'lunge': return `lunge${f.stance}`;
    case 'rollup': return 'roll';
    case 'wallcling': return f.vy < 0 ? 'wallrun' : 'wallcling';
    case 'dead': return 'death';
    case 'gone': return null;
    default: return f.state; // run, throw, throwpose, crouch, crawl, roll, cartwheel, divekick, sweep, punch, knocked, getup, ledge, climb, necksnap
  }
}

// The sheet frame index for fighter f, or null when nothing should be drawn.
export function frameFor(f, anims) {
  const name = animName(f);
  const a = name && anims[name];
  if (!a) return null;
  let k;
  if (f.state === 'lunge') k = f.t <= T.LUNGE_STARTUP_TICKS ? 0 : lungeExtended(f) ? 1 : 2;
  else if (!a.rate) k = 0;
  else if (a.loop) k = Math.floor(f.t / a.rate) % a.frames.length;
  else {
    k = Math.floor(f.t / a.rate);
    if (f.state === 'dead' && k >= a.frames.length) return null; // the body is gone after the burst
    k = Math.min(a.frames.length - 1, k);
  }
  return a.frames[k];
}

export function drawFighters(ctx, state, assets, ox = 0) {
  const { data, sheets } = assets.fighter;
  const bone = assets.palette.blade;
  const screen = SCREENS[state.screen];
  for (const f of state.fighters) {
    const index = frameFor(f, data.anims);
    if (index === null) continue;
    drawCell(ctx, sheets[f.id], data, index, ox + f.x, f.y, f.facing);
    if (!f.armed || f.state === 'dead' || drawBlade(ctx, f, screen, bone, ox)) continue;
    const s = data.swords[String(index)];
    if (s) line(ctx, ox + f.x + f.facing * s[0], f.y + s[1], ox + f.x + f.facing * s[2], f.y + s[3], bone.body);
  }
}

export function drawSwords(ctx, state, assets, ox = 0) {
  const bone = assets.palette.blade;
  for (const s of state.swords) {
    const x = Math.round(ox + s.x), y = Math.round(s.y);
    if (s.state === 'floor') {
      ctx.fillStyle = bone.body;
      ctx.fillRect(x - 4, y - 1, 8, 1);
      ctx.fillStyle = bone.hilt;
      ctx.fillRect(x - 4, y - 1, 2, 1);
    } else if (s.state === 'thrown') {
      ctx.fillStyle = bone.body;
      ctx.fillRect(x - 4, y, 8, 1);
      ctx.fillStyle = bone.tip;
      ctx.fillRect(s.vx > 0 ? x + 1 : x - 4, y, 3, 1);
    } else {
      const a = s.id + state.tick * 0.4; // tumbling
      line(ctx, x - Math.cos(a) * 4, y - Math.sin(a) * 4, x + Math.cos(a) * 4, y + Math.sin(a) * 4, bone.body);
    }
  }
}

// One cell of the sheet with its anchor on (x, y); mirrored for facing left.
function drawCell(ctx, sheet, data, index, x, y, facing) {
  const [cw, ch] = data.cell, [ax, ay] = data.anchor;
  const sx = (index % data.cols) * cw, sy = Math.floor(index / data.cols) * ch;
  const px = Math.round(x), py = Math.round(y);
  if (facing > 0) {
    ctx.drawImage(sheet, sx, sy, cw, ch, px - ax, py - ay, cw, ch);
    return;
  }
  ctx.save();
  ctx.translate(px, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, cw, ch, -ax, py - ay, cw, ch);
  ctx.restore();
}

// The live blade, on exactly its collision segment (stopped by walls, as in combat).
function drawBlade(ctx, f, screen, bone, ox) {
  const bl = blade(f, screen);
  if (!bl) return false;
  const y = Math.round(bl.y), x0 = Math.round(ox + bl.x0), len = Math.round(bl.x1 - bl.x0);
  ctx.fillStyle = bone.body;
  ctx.fillRect(x0, y, len, 1);
  ctx.fillStyle = bone.hilt;
  ctx.fillRect(f.facing > 0 ? x0 : x0 + len - 2, y, 2, 1);
  ctx.fillStyle = bone.tip;
  ctx.fillRect(f.facing > 0 ? x0 + len - 3 : x0, y, 3, 1);
  return true;
}

function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
