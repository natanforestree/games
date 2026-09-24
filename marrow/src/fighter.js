// The fighter state machine. updateFighter turns one fighter's held buttons into movement and state
// changes, once per tick. It never touches the DOM, the clock or Math.random.
import body from '../data/body.json' with { type: 'json' };
import { T } from './tuning.js';
import * as P from './physics.js';

export const STANCES = body.stances; // 0 low, 1 mid, 2 high
export const NO_INPUT = Object.freeze({ left: false, right: false, up: false, down: false, attack: false, jump: false });
const BUTTONS = Object.keys(NO_INPUT);

export function createFighter(id, x, y) {
  const dir = id === 0 ? 1 : -1; // the player heads right, the CPU heads left
  const f = {
    id, dir, x, y, vx: 0, vy: 0, facing: dir, state: 'stand', t: 0, onGround: true,
    armed: true, stance: 1, fromStance: 1, fromH: 0, prevH: 0, stanceT: 0,
    moveDir: 0, moveT: 0, upHeldT: 0, upPressT: 99, drawT: 99, stunT: 0,
    wallDir: 0, wallRun: 0, ledge: null, noGrabT: 0, heldBy: null,
    punchHitAt: -9999, punchLanded: false, kickLanded: false,
    respawnT: 0, hitWall: 0, hitEdge: false, hitCeiling: false,
    prev: { ...NO_INPUT },
  };
  setStance(f, 1, true);
  return f;
}

export const isActive = (f) => f.state !== 'dead' && f.state !== 'gone';

// Keeps f.prev current from held buttons without running the state machine: used while a fighter
// isn't being simulated (a screen slide), so a key first pressed during that time doesn't fire the
// instant simulation resumes, the same way a key held through a death is swallowed.
export function trackInput(f, held) {
  for (const b of BUTTONS) f.prev[b] = !!held[b];
}

// Blade height above the feet. During a stance change it sweeps from the old height to the new.
export function bladeHeight(f) {
  const k = Math.min(1, f.stanceT / T.STANCE_CHANGE_TICKS);
  return f.fromH + (STANCES[f.stance].height - f.fromH) * k;
}

export function setStance(f, s, instant = false) {
  const to = Math.max(0, Math.min(2, s));
  if (instant) {
    f.fromStance = to;
    f.fromH = STANCES[to].height;
    f.prevH = f.fromH;
    f.stanceT = T.STANCE_CHANGE_TICKS;
  } else {
    f.fromStance = f.stance;
    f.fromH = bladeHeight(f);
    f.stanceT = 0;
  }
  f.stance = to;
}

// True while the blade is mid-sweep between stances (stance disarms happen during the sweep).
export function isSweeping(f) {
  return f.stanceT > 0 && f.prevH !== bladeHeight(f);
}

// A lunge's active ticks, when the arm is thrust out by body.lungeExtend.
export function lungeExtended(f) {
  const s = T.LUNGE_STARTUP_TICKS;
  return f.state === 'lunge' && f.t > s && f.t <= s + T.LUNGE_ACTIVE_TICKS;
}

// ctx = { screen, open, opp }: the current screen, which edges f may walk through, and the other fighter.
export function updateFighter(state, f, held, ctx) {
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!held[b] && !f.prev[b];
    f.prev[b] = !!held[b]; // kept up to date even while dead, so a held key never fires on respawn
  }
  f.upHeldT = held.up ? f.upHeldT + 1 : 0;
  f.upPressT = pressed.up ? 0 : Math.min(99, f.upPressT + 1);
  if (!isActive(f)) return;
  f.prevH = bladeHeight(f);
  f.t++;
  f.drawT = Math.min(99, f.drawT + 1);
  const hx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  HANDLERS[f.state](state, f, { held, pressed, hx }, ctx);
  if (f.stanceT < T.STANCE_CHANGE_TICKS) f.stanceT++;
}

const enter = (f, s) => {
  f.state = s;
  f.t = 0;
};
const fits = (f, s, ctx) => P.fits(f, s, ctx.screen, ctx.open);
const opponentHere = (ctx) => !!ctx.opp && isActive(ctx.opp);

function faceOpponent(f, ctx, otherwise = 0) {
  if (opponentHere(ctx) && ctx.opp.x !== f.x) f.facing = Math.sign(ctx.opp.x - f.x);
  else if (otherwise) f.facing = otherwise;
}

// Ground states call this first: with no floor underneath, the fighter starts falling.
function leftGround(f, ctx) {
  f.onGround = P.isOnGround(f, ctx.screen, ctx.open);
  if (f.onGround) return false;
  enter(f, 'air');
  P.settle(f, ctx.screen, ctx.open);
  return true;
}

function jump(f, vx) {
  enter(f, 'air');
  f.vx = vx;
  f.vy = T.JUMP_VELOCITY;
  f.onGround = false;
}

function stanceInput(f, pressed) {
  if (!f.armed) return;
  if (pressed.up && f.stance < 2) setStance(f, f.stance + 1);
  if (pressed.down && f.stance > 0) setStance(f, f.stance - 1);
}

function swordUnder(state, f) {
  return state.swords.find((s) => s.state === 'floor' && Math.abs(s.x - f.x) <= T.PICKUP_RANGE && Math.abs(s.y - f.y) <= 4);
}

function pickUp(state, f, sword, stance = 1) {
  state.swords.splice(state.swords.indexOf(sword), 1);
  f.armed = true;
  setStance(f, stance, true);
  state.events.push({ type: 'pickup', id: f.id, x: f.x, y: f.y });
}

function tryThrow(state, f, ctx) {
  if (!f.armed || !P.headroomFree(ctx.screen, f.x, f.y, T.THROW_HEADROOM, ctx.open)) return false;
  f.armed = false;
  state.swords.push({
    id: state.nextSwordId++, state: 'thrown', owner: f.id,
    x: f.x + f.facing * body.hilt, y: f.y - body.throwHeight, vx: f.facing * T.THROWN_SWORD_SPEED, vy: 0,
  });
  enter(f, 'throw');
  f.vx = 0;
  state.events.push({ type: 'throw', id: f.id, x: f.x, y: f.y - body.throwHeight });
  return true;
}

function land(f, hx, ctx) {
  f.onGround = true;
  f.vy = 0;
  if (hx !== 0 && Math.sign(f.vx) === hx && Math.abs(f.vx) >= T.RUN_SPEED - 0.01) {
    enter(f, 'run');
    f.moveDir = hx;
    f.moveT = T.RUN_AFTER_TICKS;
    f.facing = hx;
  } else {
    enter(f, 'stand');
    f.vx = 0;
    f.moveDir = 0;
    f.moveT = 0;
    faceOpponent(f, ctx);
  }
}

// Standing in stance, and walking (the blade stays live while walking).
function stand(state, f, { held, pressed, hx }, ctx) {
  if (leftGround(f, ctx)) return;
  if (f.stunT > 0) {
    f.stunT--;
    f.vx = 0;
    return;
  }
  if (pressed.attack) {
    if (f.armed && f.upPressT <= T.THROW_CHORD_TICKS && tryThrow(state, f, ctx)) return;
    if (f.armed) {
      enter(f, 'lunge');
      f.vx = 0;
      return;
    }
    const o = ctx.opp;
    if (o && o.state === 'knocked' && o.heldBy === null && Math.abs(o.x - f.x) <= T.NECKSNAP_RANGE && Math.abs(o.y - f.y) <= T.NECKSNAP_Y_TOLERANCE) {
      enter(f, 'necksnap'); // unarmed, standing over a downed opponent
      f.facing = Math.sign(o.x - f.x) || f.facing;
      f.vx = 0;
      o.heldBy = f.id;
      return;
    }
    enter(f, 'punch');
    f.vx = 0;
    f.punchLanded = false;
    return;
  }
  if (pressed.jump) {
    jump(f, hx * T.WALK_SPEED);
    return;
  }
  stanceInput(f, pressed);
  if (f.armed && f.stance === 2 && f.stanceT >= T.STANCE_CHANGE_TICKS && f.upHeldT >= T.THROWPOSE_HOLD_TICKS &&
      P.headroomFree(ctx.screen, f.x, f.y, T.THROW_HEADROOM, ctx.open)) {
    enter(f, 'throwpose');
    f.vx = 0;
    return;
  }
  if (!f.armed && pressed.down) {
    const sword = swordUnder(state, f);
    if (sword) {
      pickUp(state, f, sword);
      return;
    }
  }
  if (held.down && (!f.armed || (f.stance === 0 && f.stanceT >= T.STANCE_CHANGE_TICKS))) {
    enter(f, 'crouch');
    f.vx = 0;
    return;
  }
  if (hx !== 0) {
    if (hx === f.moveDir) f.moveT++;
    else {
      f.moveDir = hx;
      f.moveT = 1;
    }
    const runAfter = f.armed && opponentHere(ctx) ? T.RUN_AFTER_TICKS : 1;
    if (f.moveT >= runAfter) {
      enter(f, 'run');
      f.facing = hx;
      return;
    }
    f.vx = hx * T.WALK_SPEED;
  } else {
    f.moveDir = 0;
    f.moveT = 0;
    f.vx = 0;
  }
  faceOpponent(f, ctx, hx);
  P.moveX(f, ctx.screen, f.vx, ctx.open);
}

// Running: the blade is carried and harmless. Letting go (or turning) plants it again: a "draw".
function run(state, f, { pressed, hx }, ctx) {
  if (leftGround(f, ctx)) return;
  if (hx !== f.moveDir) {
    enter(f, 'stand');
    f.vx = 0;
    f.drawT = 0;
    f.moveDir = hx;
    f.moveT = hx ? 1 : 0;
    faceOpponent(f, ctx, hx);
    return;
  }
  if (pressed.attack) {
    if (f.armed && f.upPressT <= T.THROW_CHORD_TICKS && tryThrow(state, f, ctx)) return;
    if (f.armed) {
      enter(f, 'lunge');
      f.vx = 0;
      f.drawT = 0;
      faceOpponent(f, ctx);
      return;
    }
    enter(f, 'punch');
    f.vx = 0;
    f.punchLanded = false;
    return;
  }
  if (pressed.jump) {
    jump(f, f.vx || hx * T.RUN_SPEED);
    return;
  }
  if (pressed.down) {
    const sword = !f.armed && swordUnder(state, f);
    if (sword) {
      pickUp(state, f, sword);
      return;
    }
    enter(f, 'roll');
    P.settle(f, ctx.screen, ctx.open); // the roll box is wider than a standing body: step out of a wall it now overlaps
    return;
  }
  stanceInput(f, pressed); // choose the stance you'll draw into
  f.facing = f.moveDir;
  f.vx = f.moveDir * (f.armed ? T.RUN_SPEED : T.RUN_SPEED_UNARMED);
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (f.hitWall) {
    enter(f, 'stand');
    f.vx = 0;
    f.drawT = 0;
    f.moveT = 0;
  }
}

function lunge(state, f, input, ctx) {
  if (leftGround(f, ctx)) return;
  const s = T.LUNGE_STARTUP_TICKS;
  if (f.t <= s) P.moveX(f, ctx.screen, (f.facing * T.LUNGE_STEP) / s, ctx.open);
  if (f.t >= s + T.LUNGE_ACTIVE_TICKS + T.LUNGE_RECOVERY_TICKS) enter(f, 'stand');
}

function crouch(state, f, { held, pressed, hx }, ctx) {
  if (leftGround(f, ctx)) return;
  f.vx = 0;
  if (!f.armed) {
    const sword = swordUnder(state, f);
    if (sword) pickUp(state, f, sword, 0);
  }
  if (pressed.attack) {
    enter(f, 'sweep');
    f.kickLanded = false;
    return;
  }
  if (!held.down && fits(f, 'stand', ctx)) {
    enter(f, 'stand'); // the stance stays low
    return;
  }
  if (hx !== 0) {
    enter(f, 'crawl');
    return;
  }
  faceOpponent(f, ctx);
}

function crawl(state, f, { held, pressed, hx }, ctx) {
  if (leftGround(f, ctx)) return;
  if (!f.armed) {
    const sword = swordUnder(state, f);
    if (sword) pickUp(state, f, sword, 0);
  }
  if (pressed.attack) {
    enter(f, 'sweep');
    f.vx = 0;
    f.kickLanded = false;
    return;
  }
  if (!held.down && fits(f, 'stand', ctx)) {
    enter(f, 'stand');
    f.vx = 0;
    return;
  }
  if (hx === 0) {
    enter(f, 'crouch');
    f.vx = 0;
    return;
  }
  f.facing = hx;
  f.vx = hx * T.CRAWL_SPEED;
  P.moveX(f, ctx.screen, f.vx, ctx.open);
}

// Rolls pass under mid and high blades. Letting go of Down in the first few ticks makes it a cartwheel.
function roll(state, f, input, ctx) {
  const { held, pressed } = input;
  if (f.t <= T.CARTWHEEL_TAP_TICKS && !held.down && fits(f, 'cartwheel', ctx)) {
    f.state = 'cartwheel'; // keep the timer
    cartwheel(state, f, input, ctx);
    return;
  }
  if (pressed.attack) {
    enter(f, 'sweep');
    f.kickLanded = false;
    if (f.armed) setStance(f, 0, true);
    return;
  }
  if (!P.isOnGround(f, ctx.screen, ctx.open)) {
    enter(f, 'air');
    f.onGround = false;
    P.settle(f, ctx.screen, ctx.open);
    return;
  }
  f.vx = f.facing * T.ROLL_SPEED;
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (f.t >= T.ROLL_TICKS && fits(f, 'stand', ctx)) {
    enter(f, 'stand');
    f.vx = 0;
    f.drawT = 0;
    f.moveDir = 0;
    f.moveT = 0;
    if (f.armed) setStance(f, 0, true); // coming up from a roll resets the stance to low
    faceOpponent(f, ctx);
  }
}

function cartwheel(state, f, input, ctx) {
  if (leftGround(f, ctx)) return;
  f.vx = f.facing * T.CARTWHEEL_SPEED;
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (f.t >= T.CARTWHEEL_TICKS) {
    enter(f, 'stand'); // a cartwheel keeps its stance
    f.vx = 0;
    f.drawT = 0;
    f.moveDir = 0;
    f.moveT = 0;
    faceOpponent(f, ctx);
  }
}

function air(state, f, { pressed, hx }, ctx) {
  if (pressed.attack) {
    enter(f, 'divekick');
    f.kickLanded = false;
    if (hx) f.facing = hx;
    return;
  }
  if (f.noGrabT > 0) f.noGrabT--;
  stanceInput(f, pressed);
  if (hx > 0 && f.vx < T.RUN_SPEED) f.vx = Math.min(T.RUN_SPEED, f.vx + T.AIR_ACCEL);
  if (hx < 0 && f.vx > -T.RUN_SPEED) f.vx = Math.max(-T.RUN_SPEED, f.vx - T.AIR_ACCEL);
  if (f.armed && opponentHere(ctx)) faceOpponent(f, ctx);
  else if (hx) f.facing = hx;
  f.vy = Math.min(T.MAX_FALL_SPEED, f.vy + T.GRAVITY);
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (f.hitWall && !f.hitEdge) {
    enter(f, 'wallcling'); // jumping into a wall clings to it
    f.wallDir = f.hitWall;
    f.wallRun = 0;
    f.vx = 0;
    f.facing = -f.wallDir;
    return;
  }
  if (f.vy >= 0 && f.noGrabT === 0) {
    const ledge = P.findLedge(f, ctx.screen, hx || Math.sign(f.vx) || f.facing, T.LEDGE_GRAB_RANGE, ctx.open);
    if (ledge) {
      grabLedge(f, ledge);
      return;
    }
  }
  if (P.moveY(f, ctx.screen, f.vy, ctx.open)) land(f, hx, ctx);
}

function divekick(state, f, input, ctx) {
  f.vx = f.facing * T.DIVEKICK_SPEED;
  f.vy = T.DIVEKICK_SPEED;
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (P.moveY(f, ctx.screen, f.vy, ctx.open)) {
    enter(f, 'stand');
    f.vx = 0;
    f.onGround = true;
    f.stunT = T.DIVEKICK_LAND_TICKS;
    f.moveDir = 0;
    f.moveT = 0;
    faceOpponent(f, ctx);
  }
}

function sweep(state, f, { held }, ctx) {
  if (leftGround(f, ctx)) return;
  f.vx *= 0.8; // a sweep out of a roll slides a little
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (f.t < T.SWEEP_TICKS) return;
  f.vx = 0;
  enter(f, !held.down && fits(f, 'stand', ctx) ? 'stand' : 'crouch');
}

function punch(state, f, input, ctx) {
  if (leftGround(f, ctx)) return;
  if (f.t >= T.PUNCH_TICKS) enter(f, 'stand');
}

function throwing(state, f, input, ctx) {
  if (leftGround(f, ctx)) return;
  if (f.t >= T.THROW_TICKS) enter(f, 'stand');
}

function throwpose(state, f, { held, pressed, hx }, ctx) {
  if (leftGround(f, ctx)) return;
  if (!f.armed || !held.up) {
    enter(f, 'stand'); // the stance stays high
    f.vx = 0;
    return;
  }
  if (pressed.attack && tryThrow(state, f, ctx)) return;
  if (pressed.jump) {
    jump(f, hx * T.WALK_SPEED);
    return;
  }
  f.vx = hx * T.WALK_SPEED;
  faceOpponent(f, ctx, hx);
  P.moveX(f, ctx.screen, f.vx, ctx.open);
}

function grabLedge(f, ledge) {
  enter(f, 'ledge');
  f.ledge = ledge;
  f.facing = ledge.side;
  f.vx = 0;
  f.vy = 0;
  f.wallDir = 0;
  f.x = ledge.cornerX - (ledge.side * body.boxes.stand.w) / 2;
  f.y = ledge.top + body.boxes.stand.h - 2;
}

// On a wall: hold toward it to run up WALL_RUN_HEIGHT, otherwise slide down slowly. Jump leaps away.
function wallcling(state, f, { pressed, hx }, ctx) {
  f.facing = -f.wallDir;
  if (pressed.jump) {
    const away = -f.wallDir;
    enter(f, 'air');
    f.vx = away * T.WALL_JUMP_SPEED;
    f.vy = T.JUMP_VELOCITY;
    f.wallDir = 0;
    return;
  }
  if (pressed.down) {
    enter(f, 'air');
    f.vx = -f.wallDir * T.WALL_LETGO_PUSH;
    f.vy = 0;
    f.wallDir = 0;
    return;
  }
  if (hx === f.wallDir && f.wallRun < T.WALL_RUN_HEIGHT) f.vy = Math.min(f.vy + T.GRAVITY, -T.WALL_RUN_SPEED);
  else f.vy = Math.min(f.vy + T.GRAVITY, T.WALL_SLIDE_SPEED);
  if (f.vy < 0) f.wallRun -= f.vy;
  const ledge = P.findLedge(f, ctx.screen, f.wallDir, T.LEDGE_GRAB_RANGE, ctx.open);
  if (ledge) {
    grabLedge(f, ledge);
    return;
  }
  if (P.moveY(f, ctx.screen, f.vy, ctx.open)) {
    f.wallDir = 0;
    land(f, 0, ctx);
    return;
  }
  if (!P.touchingWall(f, ctx.screen, f.wallDir, ctx.open)) {
    enter(f, 'air');
    f.wallDir = 0;
  }
}

// Hanging from a ledge: Up or Jump climbs (holding Up climbs after a moment); Down lets go.
function ledge(state, f, { held, pressed }) {
  if (pressed.up || pressed.jump || (held.up && f.t > T.LEDGE_CLIMB_HOLD_TICKS)) {
    enter(f, 'climb');
    return;
  }
  if (pressed.down) {
    const side = f.ledge.side;
    enter(f, 'air');
    f.x -= side;
    f.vx = 0;
    f.vy = T.LEDGE_RELEASE_FALL;
    f.ledge = null;
    f.noGrabT = T.LEDGE_REGRAB_TICKS;
  }
}

function climb(state, f, input, ctx) {
  if (f.t < T.CLIMB_TICKS) return;
  const { side, cornerX, top } = f.ledge;
  f.x = cornerX + side * (body.boxes.stand.w / 2 + 1);
  f.y = top;
  enter(f, 'stand');
  f.ledge = null;
  f.onGround = true;
  f.vx = 0;
  f.moveDir = 0;
  f.moveT = 0;
  faceOpponent(f, ctx);
}

// Knocked down: helpless for KNOCKDOWN_TICKS, then Up stands, Left/Right rolls up.
function knocked(state, f, { held, hx }, ctx) {
  f.vx *= 0.85;
  f.vy = Math.min(T.MAX_FALL_SPEED, f.vy + T.GRAVITY);
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  f.onGround = P.moveY(f, ctx.screen, f.vy, ctx.open) || P.isOnGround(f, ctx.screen, ctx.open);
  if (f.heldBy !== null || f.t < T.KNOCKDOWN_TICKS || !f.onGround) return;
  if (held.up) {
    enter(f, 'getup');
    f.vx = 0;
    P.settle(f, ctx.screen, ctx.open);
    return;
  }
  if (hx) {
    enter(f, 'rollup');
    f.facing = hx;
  }
}

function getup(state, f, input, ctx) {
  if (f.t < T.GETUP_TICKS || !fits(f, 'stand', ctx)) return;
  enter(f, 'stand');
  f.moveDir = 0;
  f.moveT = 0;
  if (f.armed) setStance(f, 1, true);
  faceOpponent(f, ctx);
}

// A roll-up passes over swords on the floor and picks one up.
function rollup(state, f, input, ctx) {
  if (leftGround(f, ctx)) return;
  f.vx = f.facing * T.ROLL_SPEED;
  P.moveX(f, ctx.screen, f.vx, ctx.open);
  if (!f.armed) {
    const sword = swordUnder(state, f);
    if (sword) pickUp(state, f, sword, 0);
  }
  if (f.t >= T.ROLLUP_TICKS && fits(f, 'stand', ctx)) {
    enter(f, 'stand');
    f.vx = 0;
    f.drawT = 0;
    f.moveDir = 0;
    f.moveT = 0;
    if (f.armed) setStance(f, 0, true);
    faceOpponent(f, ctx);
  }
}

function necksnap(state, f) {
  f.vx = 0;
}

const HANDLERS = {
  stand, run, lunge, crouch, crawl, roll, cartwheel, air, divekick, sweep, punch, throw: throwing, throwpose,
  wallcling, ledge, climb, knocked, getup, rollup, necksnap,
};
