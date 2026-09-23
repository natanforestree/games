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
  thrownHits(state, hits);
  for (const [f, cause] of hits) kill(state, f, cause);
  unarmedHits(state, env);
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
  for (const s of state.swords) {
    if (s.state === 'thrown') flySword(state, s, env.screen);
    else if (s.state === 'loose') fallSword(s, env.screen);
  }
  state.swords = state.swords.filter((s) => !s.gone);
}

// Thrown swords fly straight, without gravity. A wall (or a closed screen edge) drops them.
function flySword(state, s, screen) {
  const nx = s.x + s.vx;
  if (P.solidAt(screen, Math.floor(nx / TILE), Math.floor(s.y / TILE))) {
    Object.assign(s, { state: 'loose', vx: -Math.sign(s.vx) * T.SWORD_WALL_BOUNCE_VX, vy: 0, owner: null });
    state.events.push({ type: 'swordwall', x: s.x, y: s.y });
  } else s.x = nx;
}

// A thrown sword against each body in its path. A mid or high blade facing it deflects it (decided by
// stance, not pixels); otherwise it kills whoever's body it reaches. Crouching and rolling bodies are
// below its path, so it flies over them.
function thrownHits(state, hits) {
  for (const s of state.swords) {
    if (s.state !== 'thrown') continue;
    for (const f of state.fighters) {
      const box = P.fighterBox(f);
      if (f.id === s.owner || !box || hits.has(f) || s.y < box.y0 || s.y >= box.y1) continue;
      const sx0 = s.x - T.THROWN_SWORD_HALF_W, sx1 = s.x + T.THROWN_SWORD_HALF_W;
      const bl = blade(f);
      if (bl && bl.stance >= 1 && f.facing === -Math.sign(s.vx) && sx1 > Math.min(box.x0, bl.x0) && sx0 < Math.max(box.x1, bl.x1)) {
        Object.assign(s, { state: 'loose', vx: -Math.sign(s.vx) * T.DEFLECT_VX, vy: -T.DEFLECT_POP_SPEED, owner: null });
        state.events.push({ type: 'deflect', id: f.id, x: s.x, y: s.y });
        break;
      }
      if (sx1 > box.x0 && sx0 < box.x1) {
        hits.set(f, 'thrown');
        s.gone = true;
        break;
      }
    }
  }
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

// An attack's hit box (from body.json) for fighter f, in world space.
function hitBox(f, def) {
  const xa = f.x + f.facing * def.x[0], xb = f.x + f.facing * def.x[1];
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: f.y + def.y[0], y1: f.y + def.y[1] };
}
const overlaps = (p, q) => p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0;

const GROUNDED = new Set(['stand', 'run', 'lunge', 'crouch', 'crawl', 'throwpose', 'throw', 'punch', 'sweep', 'roll', 'cartwheel', 'getup', 'rollup', 'necksnap']);

function knockDown(state, o, by, env, disarmToo = true) {
  if (disarmToo && o.armed) disarm(state, o, by, 'kick');
  Object.assign(o, { state: 'knocked', t: 0, vx: by.facing * T.KNOCKDOWN_VX, stunT: 0, ledge: null });
  P.settle(o, env.screen, env.openFor(o));
  state.events.push({ type: 'knockdown', id: o.id, x: o.x, y: o.y });
}

// Kicks, punches and neck snaps, from fighters still standing after the blades.
function unarmedHits(state, env) {
  for (const f of state.fighters) {
    // a hold ends as soon as its holder is no longer snapping
    if (f.heldBy !== null && state.fighters[f.heldBy].state !== 'necksnap') f.heldBy = null;
    // a snap ends as soon as its victim is no longer held by it (killed some other way, etc.), so a
    // snapper is never stuck in `necksnap` forever with nothing left to finish
    if (f.state === 'necksnap' && state.fighters[1 - f.id].heldBy !== f.id) Object.assign(f, { state: 'stand', t: 0 });
  }
  for (const f of state.fighters) {
    const o = state.fighters[1 - f.id];
    if (!isActive(f) || !isActive(o)) continue;
    const ob = P.fighterBox(o);
    if (f.state === 'divekick' && !f.kickLanded && o.state !== 'knocked' && overlaps(hitBox(f, body.hits.divekick), ob)) {
      f.kickLanded = true;
      knockDown(state, o, f, env);
      Object.assign(f, { state: 'air', t: 0, vx: -f.facing * T.DIVEKICK_BOUNCE_VX, vy: -T.DIVEKICK_BOUNCE_VY }); // bounce off
      state.events.push({ type: 'kick', id: f.id, x: o.x, y: o.y - body.boxes.stand.h / 2 });
    } else if (f.state === 'sweep' && !f.kickLanded && f.t >= T.SWEEP_ACTIVE_FROM && f.t <= T.SWEEP_ACTIVE_TO) {
      const hb = hitBox(f, body.hits.sweep);
      if (o.state === 'ledge' && overlaps(hb, ob)) {
        f.kickLanded = true;
        Object.assign(o, { state: 'air', t: 0, vx: -o.ledge.side * T.LEDGE_KICK_VX, vy: 0, ledge: null, noGrabT: T.LEDGE_REGRAB_TICKS });
        state.events.push({ type: 'kick', id: f.id, x: o.x, y: o.y - T.LEDGE_KICK_HIT_Y });
      } else if (GROUNDED.has(o.state) && overlaps(hb, ob)) {
        f.kickLanded = true;
        knockDown(state, o, f, env);
        state.events.push({ type: 'kick', id: f.id, x: o.x, y: (hb.y0 + hb.y1) / 2 });
      }
    } else if (f.state === 'punch' && !f.punchLanded && f.t >= T.PUNCH_ACTIVE_FROM && f.t <= T.PUNCH_ACTIVE_TO && o.state !== 'knocked') {
      const hb = hitBox(f, body.hits.punch);
      if (overlaps(hb, ob)) {
        f.punchLanded = true;
        state.events.push({ type: 'punch', id: f.id, x: o.x, y: (hb.y0 + hb.y1) / 2 });
        if (state.tick - o.punchHitAt <= T.PUNCH_COMBO_WINDOW) {
          knockDown(state, o, f, env, false);
          o.punchHitAt = -9999;
        } else {
          o.punchHitAt = state.tick;
          P.moveX(o, env.screen, f.facing * T.PUNCH_PUSHBACK, env.openFor(o));
          if (o.state === 'stand' || o.state === 'run' || o.state === 'punch') Object.assign(o, { state: 'stand', t: 0, vx: 0, stunT: T.PUNCH_STUN_TICKS });
        }
      }
    } else if (f.state === 'necksnap' && f.t >= T.NECKSNAP_TICKS) {
      if (o.state === 'knocked' && o.heldBy === f.id) kill(state, o, 'necksnap');
      Object.assign(f, { state: 'stand', t: 0 });
    }
  }
}
