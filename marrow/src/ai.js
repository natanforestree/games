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
  rusher: { reaction: 14, dodge: 0.5, throwChance: 0.003, tactics: ['rush'] },
  waiter: { reaction: 10, dodge: 0.9, throwChance: 0, tactics: ['wait'] },
  shifter: { reaction: 8, dodge: 0.8, throwChance: 0, tactics: ['rush', 'wait', 'aerial', 'throw', 'sweep'], switchTicks: 180 },
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

export function createAI(id, personality, seed = 1) {
  const p = PERSONALITIES[personality];
  return {
    id, personality, p, rng: { s: seed >>> 0 }, seen: [], last: { ...NO_INPUT },
    tactic: p.tactics[0], tacticT: 0, calmT: 0, rushStance: 0, walkT: 0,
    stuckT: 0, lastX: null, backoffT: 0, dodgeFor: null, dodging: false,
  };
}

export function aiIntent(ai, state) {
  const me = state.fighters[ai.id];
  const seen = perceive(ai, state);
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

function think(ai, state, me, seen, out) {
  if (me.state === 'ledge') {
    press(ai, out, 'up');
    return;
  }
  if (me.state === 'wallcling') {
    hold(out, me.wallDir);
    return;
  }
  const oppHere = seen.active && isActive(state.fighters[1 - ai.id]);
  if (!oppHere && state.arrow === ai.id) navigate(ai, state, me, out);
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
