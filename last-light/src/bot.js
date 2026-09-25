// ?debug=bot: the game plays itself, for testing whole nights. It turns and looks up or down (at a
// human-ish rate) towards the nearest creature it can see and fires once on target, backs off from anything close, takes the
// shotgun to close quarters, throws a flare into a crowd, reloads in quiet moments, and in a lull goes
// for supplies and then warms up at the stove. It fetches embers it can reach safely before they
// cool (walking to one while it shoots, when the nearest creature isn't close), and at the fire takes
// the card it likes best. It produces the same intents as the keyboard and mouse.
import { canSee } from './raycast.js';
import { KINDS, MOTHER } from './creatures.js';
import { SHOTGUN_ID, RIFLE_ID, flareMax } from './weapons.js';
import { CREATURES as TUNED, PLAYER, VIEW } from './tuning.js';
import { UPGRADE_LIST, UPGRADE_COUNT, upgradeCost } from './upgrades.js';

const TURN = 7; // radians per second
const HIT_R = KINDS.map((k) => TUNED[k].hit);
const HEIGHT = KINDS.map((k) => TUNED[k].height);

export function createBot() {
  return { facing: null, pitch: 0, out: { pick: 0, facing: 0, pitch: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0 } };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The cards it prefers, best first.
const PREFER = ['warm', 'quickLever', 'pierce', 'reach', 'dragon', 'deepMagazine', 'magnesium', 'steady', 'wick', 'snowshoes', 'slugs', 'pockets']
  .map((key) => UPGRADE_LIST.findIndex((u) => u.key === key));
const FETCH = { range: 8, clear: 3, speed: 4.8, spare: 0.3 }; // how far, how clear of creatures, how fast it runs, time to spare

// The nearest ember worth fetching: within range, clear of creatures, and still warm when it gets there.
function emberToFetch(state) {
  const p = state.player;
  let pick = null, best = FETCH.range;
  for (const e of state.embers) {
    if (e.t <= 0) continue;
    const ex = e.x - p.x, ey = e.y - p.y, d = Math.sqrt(ex * ex + ey * ey);
    if (d >= best || e.t < d / FETCH.speed + FETCH.spare) continue;
    let clear = true;
    for (const c of state.creatures) {
      if (!c.alive || c.dying) continue;
      const cx = c.x - e.x, cy = c.y - e.y;
      if (cx * cx + cy * cy < FETCH.clear * FETCH.clear) {
        clear = false;
        break;
      }
    }
    if (clear) {
      best = d;
      pick = e;
    }
  }
  return pick;
}

// The offered card it likes best, as a key press (1 to 3).
function bestCard(state) {
  let slot = 0, rank = UPGRADE_COUNT;
  for (let i = 0; i < state.offerN; i++) {
    const r = PREFER.indexOf(state.offer[i]);
    if (r < rank) {
      rank = r;
      slot = i;
    }
  }
  return slot + 1;
}

// Heads for (gx, gy), running; returns false once it's there.
function goTo(out, bot, p, gx, gy) {
  const d = Math.sqrt((gx - p.x) * (gx - p.x) + (gy - p.y) * (gy - p.y));
  if (d <= 0.2) return false;
  steer(out, bot.facing, (gx - p.x) / d, (gy - p.y) / d);
  out.run = true;
  return true;
}

function steer(out, facing, wx, wy) {
  const c = Math.cos(facing), s = Math.sin(facing);
  out.forward = Math.max(-1, Math.min(1, wx * c + wy * s));
  out.strafe = Math.max(-1, Math.min(1, -wx * s + wy * c));
}

export function botIntents(state, bot, dt) {
  const p = state.player, g = state.gun, out = bot.out, n = state.night;
  if (bot.facing === null) bot.facing = p.facing;
  out.fire = false;
  out.flare = 0;
  out.reload = 0;
  out.weapon = 0;
  out.forward = 0;
  out.strafe = 0;
  out.run = false;
  out.pick = state.choosing ? bestCard(state) : 0;
  const ember = emberToFetch(state);

  // The nearest creature in sight, except that the Mother comes first when nothing is close.
  let target = null, best = Infinity, crowd = 0, mother = null, motherD = 0;
  for (const c of state.creatures) {
    if (!c.alive || c.dying) continue;
    const cx = c.x - p.x, cy = c.y - p.y, d = Math.sqrt(cx * cx + cy * cy);
    if (d < 4) crowd++;
    if (!canSee(state.map, p.x, p.y, c.x, c.y)) continue;
    if (c.kind === MOTHER) {
      mother = c;
      motherD = d;
    }
    if (d < best) {
      best = d;
      target = c;
    }
  }
  if (mother && best > 2.5) {
    target = mother;
    best = motherD;
  }

  let want = bot.facing, wantPitch = 0;
  if (target) {
    want = Math.atan2(target.y - p.y, target.x - p.x);
    const low = target.lift, high = target.lift + HEIGHT[target.kind];
    wantPitch = Math.atan2((low + high) / 2 - PLAYER.eye, best);
    const err = Math.abs(wrap(want - bot.facing));
    const z = PLAYER.eye + best * Math.tan(bot.pitch); // where the crosshair is as it passes the target
    out.fire = err < Math.asin(Math.min(1, (HIT_R[target.kind] * 0.8) / Math.max(best, 0.01))) && z >= low && z <= high;
    const close = best < 3;
    out.weapon = close && g.hasShotgun && g.shells + g.spare > 0 ? 2 : !close || !g.hasShotgun ? 1 : 0;
    if (crowd >= 4 && g.flares > 0 && err < 0.3) out.flare = 1;
    if (best < 2.5) {
      // Back off, sliding sideways so we don't back into a corner.
      const ax = (p.x - target.x) / best, ay = (p.y - target.y) / best;
      steer(out, bot.facing, ax - ay * 0.5, ay + ax * 0.5);
      out.run = true;
    } else if (ember && best > 4) goTo(out, bot, p, ember.x, ember.y);
  } else if (ember) {
    // Embers first: they cool.
    want = Math.atan2(ember.y - p.y, ember.x - p.x);
    goTo(out, bot, p, ember.x, ember.y);
  } else if (n.phase === 'lull') {
    let pick = null;
    for (let i = 0; i < state.pickups.length; i++) if (state.pickups[i].active) { pick = state.pickups[i]; break; }
    const porch = state.map.start;
    const shop = state.carried >= upgradeCost(state.bought) && state.bought < UPGRADE_COUNT;
    let gx, gy;
    if (pick && !(pick.kind === 0 && g.flares >= flareMax(state))) {
      gx = pick.x;
      gy = pick.y;
    } else if ((p.health < state.maxHealth || shop) && state.stove) {
      // Through the doorway: line up on the porch first.
      const inside = p.y < porch.y - 1.2;
      gx = inside || Math.abs(p.x - porch.x) < 0.3 ? state.stove.x : porch.x;
      gy = inside || Math.abs(p.x - porch.x) < 0.3 ? state.stove.y + 0.9 : porch.y;
    } else {
      gx = porch.x;
      gy = porch.y + 2;
    }
    const d = Math.sqrt((gx - p.x) * (gx - p.x) + (gy - p.y) * (gy - p.y));
    if (d > 0.2) {
      want = Math.atan2(gy - p.y, gx - p.x);
      steer(out, bot.facing, (gx - p.x) / d, (gy - p.y) / d);
    }
    if (g.current === RIFLE_ID && g.rifle < 8) out.reload = 1;
  } else {
    // Nothing in sight: turn slowly, and top up the rifle.
    want = bot.facing + 1.5 * dt * 4;
    if (g.current === RIFLE_ID && g.rifle < 6) out.reload = 1;
    if (g.current === SHOTGUN_ID && g.shells < 2) out.reload = 1;
    const cx = state.map.start.x, cy = state.map.start.y + 3, d = Math.sqrt((cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y));
    if (d > 3) steer(out, bot.facing, (cx - p.x) / d, (cy - p.y) / d);
  }
  const turn = wrap(want - bot.facing);
  bot.facing = wrap(bot.facing + Math.max(-TURN * dt, Math.min(TURN * dt, turn)));
  wantPitch = Math.max(-VIEW.maxPitch, Math.min(VIEW.maxPitch, wantPitch));
  bot.pitch += Math.max(-TURN * dt, Math.min(TURN * dt, wantPitch - bot.pitch));
  out.facing = bot.facing;
  out.pitch = bot.pitch;
  return out;
}
