// Combat, resolved once per tick after both fighters have moved: loose swords fall, then blade meets
// blade (blocks, clashes, stance and draw disarms), then blade meets body. Hits in the same tick land
// together, so both fighters can die at once: a double kill.
import body from '../data/body.json' with { type: 'json' };
import { T, TILE, VIEW_W, COLS, ROWS } from './tuning.js';
import * as P from './physics.js';
import { isSolid, SCREENS } from './level.js';
import { STANCES, bladeHeight, isActive, isSweeping, lungeExtended } from './fighter.js';

const BLADE_STATES = new Set(['stand', 'lunge', 'crouch', 'air']);
const EPS = 1e-6;

// The blade as a horizontal segment in world space, or null when it can't hurt anyone right now.
// With a screen, the blade is clipped at the first solid in-grid tile along its row (never at the
// screen's edges), so a blade or a disarm can't act through a wall.
export function blade(f, screen = null) {
  if (!f.armed || !BLADE_STATES.has(f.state)) return null;
  const crouched = f.state === 'crouch';
  const h = crouched ? body.crouchBlade.height : bladeHeight(f);
  let reach = crouched ? body.crouchBlade.reach : STANCES[f.stance].reach;
  const hilt = f.x + f.facing * (body.hilt + (lungeExtended(f) ? body.lungeExtend : 0));
  const y = f.y - h;
  let tip = hilt + f.facing * reach;
  if (screen) {
    tip = clipToWall(hilt, tip, y, screen);
    reach = Math.abs(tip - hilt);
    if (reach === 0) return null;
  }
  return { y, h, reach, hilt, tip, x0: Math.min(hilt, tip), x1: Math.max(hilt, tip), stance: crouched ? 0 : f.stance };
}

// The point along [hilt, tip] where an in-grid solid tile in this row first blocks it, scanning
// outward from the hilt; tip itself if nothing blocks it. Off-grid columns and rows never block.
function clipToWall(hilt, tip, y, screen) {
  const row = Math.floor(y / TILE);
  if (row < 0 || row >= ROWS) return tip;
  let x = hilt, left = tip - hilt;
  while (left !== 0) {
    const step = Math.abs(left) > 1 ? Math.sign(left) : left;
    const nx = x + step;
    const col = step > 0 ? Math.floor((nx - EPS) / TILE) : Math.floor(nx / TILE);
    if (col >= 0 && col < COLS && isSolid(screen, col, row)) return x;
    x = nx;
    left -= step;
  }
  return x;
}

const overlapX = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
const sameHeight = (a, b) => Math.abs(a.y - b.y) <= T.BLADE_LEVEL_TOLERANCE;
const cuts = (bl, box) => bl.y >= box.y0 && bl.y < box.y1 && bl.x0 < box.x1 && bl.x1 > box.x0;

// env = { screen, openFor(f) }
export function resolveCombat(state, env) {
  moveSwords(state, env);
  const [a, b] = state.fighters;
  bladeVsBlade(state, env, a, b);
  const hits = new Map();
  for (const [atk, def] of [[a, b], [b, a]]) {
    const bl = isActive(atk) ? blade(atk, env.screen) : null;
    const box = P.fighterBox(def);
    if (bl && box && cuts(bl, box)) hits.set(def, 'blade');
  }
  for (const [f, cause] of hits) kill(state, f, cause);
}

function bladeVsBlade(state, env, a, b) {
  if (!isActive(a) || !isActive(b)) return;
  const ba = blade(a, env.screen), bb = blade(b, env.screen);
  if (!ba || !bb || a.facing === b.facing || Math.sign(b.x - a.x) !== a.facing) return;
  const disarms = [];
  for (const [me, mine, them, theirs] of [[a, ba, b, bb], [b, bb, a, ba]]) {
    // Stance disarm: my blade sweeps across theirs while they overlap by at least half my blade.
    if (isSweeping(me)) {
      const top = me.y - Math.max(me.prevH, mine.h), bottom = me.y - Math.min(me.prevH, mine.h);
      const reach = Math.max(STANCES[me.fromStance].reach, mine.reach);
      const end = mine.hilt + me.facing * reach;
      const swept = { x0: Math.min(mine.hilt, end), x1: Math.max(mine.hilt, end) };
      if (theirs.y >= top && theirs.y <= bottom && overlapX(swept, theirs) + T.DISARM_OVERLAP_SLACK >= STANCES[me.fromStance].reach / 2) {
        disarms.push([them, me, 'stance']);
      }
    }
    // Draw disarm: out of a run, roll or cartwheel into low or high, level with their blade.
    if (me.drawT <= T.DRAW_WINDOW_TICKS && (me.state === 'stand' || me.state === 'lunge') && mine.stance !== 1 &&
        sameHeight(mine, theirs) && overlapX(mine, theirs) > 0) {
      disarms.push([them, me, 'draw']);
    }
  }
  if (disarms.length) {
    for (const [victim, by, kind] of disarms) if (victim.armed) disarm(state, victim, by, kind);
    return;
  }
  // Level blades block each other: they may cross by `engage` of the shorter blade, no further.
  if (!sameHeight(ba, bb)) return;
  const overlap = overlapX(ba, bb), limit = Math.min(ba.reach, bb.reach) * body.engage;
  if (overlap <= limit) return;
  if (a.state === 'lunge' || b.state === 'lunge') {
    clash(state, env, a, b);
    return;
  }
  const push = (overlap - limit) / 2;
  P.moveX(a, env.screen, -a.facing * push, env.openFor(a));
  P.moveX(b, env.screen, -b.facing * push, env.openFor(b));
}

function clash(state, env, a, b) {
  const y = blade(a, env.screen).y;
  for (const f of [a, b]) {
    P.moveX(f, env.screen, -f.facing * T.CLASH_PUSHBACK, env.openFor(f));
    Object.assign(f, { state: 'stand', t: 0, vx: 0, stunT: T.CLASH_STUN_TICKS });
  }
  state.events.push({ type: 'clash', x: (a.x + b.x) / 2, y });
}

// Knocks the victim's sword out of their hand: it pops up, then falls and can be picked up.
export function disarm(state, victim, by, kind) {
  const bl = blade(victim, SCREENS[state.screen]);
  const x = bl ? (bl.x0 + bl.x1) / 2 : victim.x + victim.facing * body.hilt, y = bl ? bl.y : victim.y - T.DISARM_FALLBACK_HEIGHT;
  victim.armed = false;
  state.swords.push({ id: state.nextSwordId++, state: 'loose', owner: null, x, y, vx: (by ? by.facing : -victim.facing) * T.DISARM_POP_VX, vy: -T.DISARM_POP_SPEED });
  state.events.push({ type: 'disarm', id: victim.id, by: by ? by.id : null, kind, x, y });
}

export function kill(state, f, cause) {
  if (!isActive(f)) return;
  state.events.push({ type: 'kill', id: f.id, cause, x: f.x, y: f.y, screen: state.screen });
  state.killsThisTick.push({ id: f.id, cause });
  Object.assign(f, { state: 'dead', t: 0, vx: 0, vy: 0, heldBy: null, ledge: null });
  const other = state.fighters[1 - f.id];
  if (other.heldBy === f.id) other.heldBy = null; // a neck snap in progress is broken off
}

function moveSwords(state, env) {
  for (const s of state.swords) if (s.state === 'loose') fallSword(s, env.screen);
  state.swords = state.swords.filter((s) => !s.gone);
}

function fallSword(s, screen) {
  s.vy = Math.min(T.MAX_FALL_SPEED, s.vy + T.GRAVITY);
  const nx = Math.max(T.SWORD_EDGE_MARGIN, Math.min(VIEW_W - T.SWORD_EDGE_MARGIN, s.x + s.vx));
  if (P.solidAt(screen, Math.floor(nx / TILE), Math.floor(s.y / TILE))) s.vx = 0;
  else s.x = nx;
  const col = Math.floor(s.x / TILE), ny = s.y + s.vy, row = Math.floor(ny / TILE);
  if (s.vy < 0 && P.solidAt(screen, col, row)) s.vy = 0; // hit a ceiling: it falls back down
  else if (s.vy > 0 && P.solidAt(screen, col, row)) {
    Object.assign(s, { y: row * TILE, state: 'floor', vx: 0, vy: 0 });
  } else s.y = ny;
  if (s.y > T.PIT_DEATH_Y) s.gone = true;
}
