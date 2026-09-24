// The CPU. Each tick it looks at the match, seeing its opponent `reaction` ticks late (like a human's
// reaction time), and returns held buttons exactly like the keyboard's: it plays by the same rules.
import body from '../data/body.json' with { type: 'json' };
import { T, TILE } from './tuning.js';
import { SCREENS } from './level.js';
import * as P from './physics.js';
import { NO_INPUT, STANCES, isActive } from './fighter.js';
import { edgesOpen } from './match.js';
import { nextRandom } from './rng.js';

export const PERSONALITIES = {
  rusher: { reaction: 14, dodge: 0.5, throwChance: 0.003, drawChance: 0, tactics: ['rush'] },
  waiter: { reaction: 10, dodge: 0.9, throwChance: 0, drawChance: 0.02, tactics: ['wait'] },
  shifter: { reaction: 8, dodge: 0.8, throwChance: 0, drawChance: 0, tactics: ['rush', 'wait', 'aerial', 'throw', 'sweep'], switchTicks: 180 },
};
export const LADDER = ['rusher', 'waiter', 'shifter'];

// Navigation tuning: heuristics for the CPU's own pathfinding, not simulation rules, so they live
// here rather than in tuning.js.
const STUCK_EPSILON = 0.05; // px of x movement per tick below which the CPU counts as stuck
const STUCK_TICKS = 30; // ticks stuck before backing off for a run-up
const BACKOFF_TICKS = 30; // how long it backs away before trying again
const PIT_PROBE_AHEAD = 5; // px past the body's front edge probed for a pit
const PIT_PROBE_ROWS = 5; // rows below the feet checked for any floor
const WALL_PROBE_MIN = 6; // nearest px ahead probed for a wall
const WALL_PROBE_MAX = 18; // farthest px ahead probed for a wall
const WALL_PROBE_STEP = 4; // px between wall probes
const WALL_PROBE_HEIGHTS = [5, 15]; // heights above the feet probed for a wall

// Fighting tuning: the tactics' own heuristics (distances in px from body center to body center).
const TACTIC_JITTER_TICKS = 60; // a new tactic starts up to this far into its time, so switches don't fall on a beat
const CALM_TICKS = 900; // 15 s without a kill: a waiting CPU goes in, and an armed one goes over a wall between them
const PAST_MARGIN = 24; // how far past the opponent the arrow holder must be before it runs for its goal
const WALK_CYCLE = 14; // walking lets go for one tick in this many, short of RUN_AFTER_TICKS, so it never breaks into a run
const RUN_FROM = 110; // farther than this, run in rather than walk
const RUN_LET_GO = 30; // a run lets go this far short of where it means to stop, then walks the rest blade first
const FINISH_CLOSE = 16; // an armed finisher walks this close to a downed opponent
const SNAP_MARGIN = 2; // how far inside NECKSNAP_RANGE an unarmed finisher stops to snap
const RUSH_STOP = 20; // how close a rush walks in when it isn't lunging
const RUSH_FLIP_CHANCE = 0.5; // after a clash, the rush flips between low and mid this often
const RUSH_THROW_MIN = 60; // the range a rush's rare throws are tried from
const RUSH_THROW_MAX = 160;
const ENGAGE_CROSS = 7; // how far blades cross when a waiting CPU engages them
const MISMATCH_GAP = 8; // extra room a waiting CPU keeps while its stance doesn't match yet
const ENGAGE_SLACK = 1; // px either side of the engaging distance that still counts as engaged
const SWEEP_CHANCE = 0.06; // per tick, with blades crossed: sweep across them for a stance disarm
const DRAW_CROSS = 5; // how far across their blade a draw plants its tip
const DRAW_RUN_UP = 24; // room a draw needs beyond that point, to walk into a run and then run
const JUMP_MIN = 40; // the range an aerial attack jumps from
const JUMP_MAX = 70;
const AERIAL_STOP = 55; // where an aerial attack walks in to before it jumps
const DIVE_RANGE = 30; // falling, a dive kick is launched this close
const THROW_MIN = 50; // the range the throw tactic throws from
const THROW_MAX = 170;
const ROLL_FROM = 44; // a sweep-in rolls from this close
const ROLL_SWEEP_RANGE = 18; // rolling, it sweeps this close
const SWORD_SEEK_RANGE = 90; // an unarmed CPU goes for a sword this close
const SWORD_CLEAR = 24; // ...if it's on its own side, or nearer than the opponent by this much
const SWORD_STILL = 1; // near enough to a falling sword to wait under it
const PICKUP_MARGIN = 1; // how far inside PICKUP_RANGE it stands to pick a sword up
const PUNCH_RANGE = 12; // unarmed against unarmed, it punches from this close
const DODGE_LOOKAHEAD = 80; // a thrown sword this close and coming is dodged
const ROLLUP_SWORD_RANGE = 40; // getting up, it rolls toward a sword on the floor this close

export function createAI(id, personality, seed = 1) {
  const p = PERSONALITIES[personality];
  return {
    id, personality, p, rng: { s: seed >>> 0 }, seen: [], last: { ...NO_INPUT },
    tactic: p.tactics[0], tacticT: 0, calmT: 0, rushStance: 0, walkT: 0,
    stuckT: 0, lastX: null, backoffT: 0, dodgeFor: null, dodging: false, drawTick: null,
  };
}

export function aiIntent(ai, state) {
  const me = state.fighters[ai.id];
  const seen = perceive(ai, state);
  // every kill ends a standoff for both CPUs, the one that died included (dead, it doesn't think)
  ai.calmT = state.events.some((e) => e.type === 'kill') ? 0 : ai.calmT + 1;
  const out = { ...NO_INPUT };
  if (isActive(me) && (state.phase === 'play' || state.phase === 'maw')) think(ai, state, me, seen, out);
  ai.last = out;
  return out;
}

// What the CPU knows about its opponent: the snapshot from `reaction` ticks ago.
function perceive(ai, state) {
  const o = state.fighters[1 - ai.id];
  ai.seen.push({ x: o.x, y: o.y, state: o.state, t: o.t, stance: o.stance, armed: o.armed, active: isActive(o) });
  if (ai.seen.length > ai.p.reaction + 1) ai.seen.shift();
  return ai.seen[0];
}

const hold = (out, dir) => {
  out.left = dir < 0;
  out.right = dir > 0;
};
// A press needs the button up the tick before, so repeated presses alternate held and released.
const press = (ai, out, key) => {
  out[key] = !ai.last[key];
};
// Attack, but never as the tail of the throw chord: armed, an Attack pressed with Up, or within
// THROW_CHORD_TICKS after it (a stance change, a sweep), throws the sword. Only the throw tactics
// mean to throw, and they press both themselves; any other attack waits out the chord.
const attack = (ai, me, out) => {
  const upNow = out.up && !me.prev.up;
  if (me.armed && (upNow || me.upPressT < T.THROW_CHORD_TICKS)) return;
  press(ai, out, 'attack');
};

function think(ai, state, me, seen, out) {
  if (me.state === 'ledge') {
    press(ai, out, 'up');
    return;
  }
  if (me.state === 'wallcling') {
    hold(out, me.wallDir);
    return;
  }
  if (me.state === 'knocked') {
    getUp(ai, state, me, out);
    return;
  }
  const rand = () => nextRandom(ai.rng);
  if (ai.p.switchTicks && ++ai.tacticT >= ai.p.switchTicks) {
    ai.tacticT = Math.floor(rand() * TACTIC_JITTER_TICKS);
    ai.tactic = ai.p.tactics[Math.floor(rand() * ai.p.tactics.length)];
  }
  const oppHere = seen.active && isActive(state.fighters[1 - ai.id]);
  const pastThem = oppHere && Math.sign(seen.x - me.x) === -me.dir && Math.abs(seen.x - me.x) > PAST_MARGIN;
  if (state.arrow === ai.id && (!oppHere || pastThem)) {
    navigate(ai, state, me, out); // nothing between me and my goal: run for it
    return;
  }
  if (!oppHere) return;
  if (dodge(ai, state, me, out, rand)) return;
  if (!me.armed) {
    unarmed(ai, state, me, seen, out, rand);
    return;
  }
  if (ai.calmT > CALM_TICKS && overWall(ai, state, me, seen, out)) return; // a long standoff across a wall: go over it
  const tactic = ai.calmT > CALM_TICKS && ai.tactic === 'wait' ? 'rush' : ai.tactic; // a long standoff: go in
  TACTICS[tactic](ai, state, me, seen, out, rand);
}

// Run for the goal edge: jump pits and walls, walk off drops, back off for a run-up when stuck.
function navigate(ai, state, me, out) {
  const dir = me.dir, screen = SCREENS[state.screen], open = edgesOpen(state, me);
  if (ai.backoffT > 0) {
    ai.backoffT--;
    hold(out, -dir);
    return;
  }
  ai.stuckT = ai.lastX !== null && Math.abs(me.x - ai.lastX) < STUCK_EPSILON && me.onGround ? ai.stuckT + 1 : 0;
  ai.lastX = me.x;
  if (ai.stuckT > STUCK_TICKS) {
    ai.stuckT = 0;
    ai.backoffT = BACKOFF_TICKS;
    return;
  }
  hold(out, dir);
  if (me.state === 'run' && (pitAhead(screen, me, dir, open) || wallAhead(screen, me, dir, open))) press(ai, out, 'jump');
}

// No floor just past the body's front edge, and none within 50px below: a pit, not a drop.
function pitAhead(screen, me, dir, open) {
  const col = Math.floor((me.x + dir * PIT_PROBE_AHEAD) / TILE), row = Math.floor(me.y / TILE);
  for (let r = row; r < row + PIT_PROBE_ROWS; r++) if (P.solidAt(screen, col, r, open)) return false;
  return true;
}

function wallAhead(screen, me, dir, open) {
  for (let d = WALL_PROBE_MIN; d <= WALL_PROBE_MAX; d += WALL_PROBE_STEP) {
    const col = Math.floor((me.x + dir * d) / TILE);
    for (const up of WALL_PROBE_HEIGHTS) if (P.solidAt(screen, col, Math.floor((me.y - up) / TILE), open)) return true;
  }
  return false;
}

const dist = (me, seen) => Math.abs(seen.x - me.x);
const toward = (me, seen) => Math.sign(seen.x - me.x) || me.facing;
const reachOf = (stance) => body.hilt + STANCES[stance].reach; // from the body's center to the blade tip
const LUNGE_REACH = body.boxes.stand.w / 2 + T.LUNGE_STEP + body.lungeExtend; // their half-width, plus what a lunge adds

// A wall between us, or them up on top of it (B2's step or pillar): jump toward them, as navigate
// does, rather than walk into it forever. A jump that falls short clings and climbs.
function overWall(ai, state, me, seen, out) {
  const dir = toward(me, seen);
  if (!me.onGround || (me.state !== 'stand' && me.state !== 'run')) return false;
  if (dist(me, seen) <= WALL_PROBE_MAX && seen.y >= me.y) return false; // they're this side of it, on my level
  if (!wallAhead(SCREENS[state.screen], me, dir, edgesOpen(state, me))) return false;
  press(ai, out, 'jump');
  hold(out, dir);
  return true;
}

function setStanceTo(ai, me, target, out) {
  if (me.stanceT < T.STANCE_CHANGE_TICKS) return;
  if (me.stance < target) press(ai, out, 'up');
  else if (me.stance > target) press(ai, out, 'down');
}

// Walk in stance: let go for one tick in every WALK_CYCLE, so the walk never breaks into a (bladeless) run.
function walk(ai, out, dir) {
  ai.walkT = (ai.walkT + 1) % WALK_CYCLE;
  if (ai.walkT !== 0) hold(out, dir);
}

// Get within `stopAt` of the opponent: run while far, let go early to plant the blade, then walk in.
function closeIn(ai, me, seen, out, stopAt) {
  const d = dist(me, seen), dir = toward(me, seen);
  if (me.state === 'run') {
    if (d > stopAt + RUN_LET_GO) hold(out, dir);
    return;
  }
  if (d > RUN_FROM) hold(out, dir);
  else if (d > stopAt) walk(ai, out, dir);
}

function finish(ai, me, seen, out) {
  const d = dist(me, seen), dir = toward(me, seen);
  if (me.armed) {
    setStanceTo(ai, me, 0, out); // only a low blade reaches someone on the floor
    if (d > FINISH_CLOSE) walk(ai, out, dir);
    return;
  }
  if (d <= T.NECKSNAP_RANGE - SNAP_MARGIN) attack(ai, me, out);
  else hold(out, dir);
}

function rush(ai, state, me, seen, out, rand) {
  const d = dist(me, seen);
  if (seen.state === 'knocked') {
    finish(ai, me, seen, out);
    return;
  }
  if (state.events.some((e) => e.type === 'clash') && rand() < RUSH_FLIP_CHANCE) ai.rushStance = ai.rushStance === 0 ? 1 : 0;
  setStanceTo(ai, me, ai.rushStance, out);
  if (ai.p.throwChance && rand() < ai.p.throwChance && d > RUSH_THROW_MIN && d < RUSH_THROW_MAX && me.state === 'stand' && !ai.last.up && !ai.last.attack) {
    out.up = true;
    out.attack = true;
    return;
  }
  if (me.state === 'stand' && d <= reachOf(me.stance) + LUNGE_REACH) {
    attack(ai, me, out);
    return;
  }
  closeIn(ai, me, seen, out, RUSH_STOP);
}

function wait(ai, state, me, seen, out, rand) {
  const d = dist(me, seen), dir = toward(me, seen);
  if (seen.state === 'knocked' || !seen.armed) {
    rush(ai, state, me, seen, out, rand);
    return;
  }
  if (drawIn(ai, state, me, seen, out, rand)) return;
  setStanceTo(ai, me, seen.stance, out); // match their height to block
  const engageAt = reachOf(me.stance) + reachOf(seen.stance) - ENGAGE_CROSS;
  if (me.stance !== seen.stance) {
    if (d < engageAt + MISMATCH_GAP) walk(ai, out, -dir); // mismatched: keep out of reach until matched
    return;
  }
  const recovering = seen.state === 'lunge' && seen.t > T.LUNGE_STARTUP_TICKS + T.LUNGE_ACTIVE_TICKS;
  if (recovering && d <= reachOf(me.stance) + LUNGE_REACH && me.state === 'stand') {
    attack(ai, me, out);
    return;
  }
  if (d <= engageAt + ENGAGE_SLACK && me.stanceT >= T.STANCE_CHANGE_TICKS && rand() < SWEEP_CHANCE) {
    press(ai, out, me.stance < 2 ? 'up' : 'down'); // blades crossed: sweep across theirs
    return;
  }
  if (d > engageAt + ENGAGE_SLACK) closeIn(ai, me, seen, out, engageAt);
}

// A draw disarm (the Waiter's): against a low or high blade held still on the same floor, from out of
// reach, now and then match it, run in and let go where stopping plants the blade level with theirs,
// DRAW_CROSS across it and short of their reach to the body. A hunt goes on only from one tick to the
// next (ai.drawTick): letting go, or a tick spent on anything else, ends it.
function drawIn(ai, state, me, seen, out, rand) {
  if (!ai.p.drawChance) return false;
  const d = dist(me, seen), drawAt = 2 * reachOf(seen.stance) - DRAW_CROSS;
  const still = seen.state === 'stand' && ai.seen[1]?.x === seen.x; // not moving: the next snapshot has them in the same place
  const target = still && seen.stance !== 1 && seen.y === me.y;
  const moving = me.state === 'stand' || me.state === 'run';
  const hunting = ai.drawTick === state.tick - 1;
  if (!target || !moving) return false;
  if (!hunting && !(d >= drawAt + DRAW_RUN_UP && rand() < ai.p.drawChance)) return false;
  setStanceTo(ai, me, seen.stance, out);
  if (d <= drawAt) return true; // let go: stopping plants the blade across theirs
  // Down while running is a roll (into their low blade), so run in only once the stances match
  if (me.state !== 'run' || me.stance === seen.stance) hold(out, toward(me, seen));
  ai.drawTick = state.tick;
  return true;
}

function aerial(ai, state, me, seen, out, rand) {
  const d = dist(me, seen), dir = toward(me, seen);
  if (me.state === 'air') {
    hold(out, dir);
    if (me.vy > 0 && d < DIVE_RANGE) attack(ai, me, out);
    return;
  }
  if (me.armed) setStanceTo(ai, me, 2, out);
  if (me.state === 'stand' && d >= JUMP_MIN && d <= JUMP_MAX) {
    press(ai, out, 'jump');
    hold(out, dir);
    return;
  }
  if (d < JUMP_MIN) walk(ai, out, -dir);
  else closeIn(ai, me, seen, out, AERIAL_STOP);
}

function throwSword(ai, state, me, seen, out, rand) {
  const d = dist(me, seen);
  const room = P.headroomFree(SCREENS[state.screen], me.x, me.y, T.THROW_HEADROOM);
  if (room && d > THROW_MIN && d < THROW_MAX && me.state === 'stand' && seen.state !== 'crouch' && !ai.last.up && !ai.last.attack) {
    out.up = true;
    out.attack = true;
    return;
  }
  wait(ai, state, me, seen, out, rand);
}

function sweepIn(ai, state, me, seen, out, rand) {
  const d = dist(me, seen), dir = toward(me, seen);
  if (seen.armed && seen.stance !== 2) {
    wait(ai, state, me, seen, out, rand); // only a high blade lets a roll-and-sweep in
    return;
  }
  if (me.state === 'roll') {
    if (d < ROLL_SWEEP_RANGE) attack(ai, me, out);
    return;
  }
  if (me.state === 'run' && d < ROLL_FROM) {
    press(ai, out, 'down');
    hold(out, dir);
    return;
  }
  hold(out, dir);
}

const TACTICS = { rush, wait, aerial, throw: throwSword, sweep: sweepIn };

function nearestSword(state, me) {
  let best = null;
  for (const s of state.swords) if (s.state !== 'thrown' && (!best || Math.abs(s.x - me.x) < Math.abs(best.x - me.x))) best = s;
  return best;
}

function unarmed(ai, state, me, seen, out, rand) {
  const d = dist(me, seen), dir = toward(me, seen);
  const sword = nearestSword(state, me);
  if (sword) {
    const sd = Math.abs(sword.x - me.x), sdir = Math.sign(sword.x - me.x);
    if (sd < SWORD_SEEK_RANGE && (sdir !== dir || sd < d - SWORD_CLEAR)) { // not on the far side of the opponent
      if (sword.state === 'floor' && sd <= T.PICKUP_RANGE - PICKUP_MARGIN) press(ai, out, 'down');
      else if (sd > SWORD_STILL) hold(out, sdir);
      return;
    }
  }
  if (seen.state === 'knocked') {
    finish(ai, me, seen, out);
    return;
  }
  if (!seen.armed) {
    if (d <= PUNCH_RANGE) attack(ai, me, out);
    else hold(out, dir);
    return;
  }
  aerial(ai, state, me, seen, out, rand); // against a blade, come in from above
}

// A thrown sword on its way: a mid or high blade deflects it (hold still), otherwise duck.
function dodge(ai, state, me, out, rand) {
  const s = state.swords.find((w) => w.state === 'thrown' && w.owner !== ai.id && Math.sign(me.x - w.x) === Math.sign(w.vx) && Math.abs(me.x - w.x) < DODGE_LOOKAHEAD);
  if (!s) {
    ai.dodgeFor = null;
    return false;
  }
  if (ai.dodgeFor !== s.id) {
    ai.dodgeFor = s.id;
    ai.dodging = rand() < ai.p.dodge;
  }
  if (!ai.dodging) return false;
  if (me.armed && me.stance >= 1 && me.state === 'stand') return true;
  out.down = true;
  return true;
}

function getUp(ai, state, me, out) {
  if (me.t < T.KNOCKDOWN_TICKS) return;
  const sword = !me.armed && nearestSword(state, me);
  if (sword && sword.state === 'floor' && Math.abs(sword.x - me.x) < ROLLUP_SWORD_RANGE) hold(out, Math.sign(sword.x - me.x));
  else out.up = true;
}
