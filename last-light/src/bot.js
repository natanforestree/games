// ?debug=bot: the game plays itself, for testing whole nights. It turns and looks up or down (at a
// human-ish rate) towards the nearest creature it can see and fires once on target, backs off from anything close, takes the
// shotgun to close quarters, throws a flare into a crowd, reloads in quiet moments, and in a lull goes
// for supplies and then warms up at the stove. It produces the same intents as the keyboard and mouse.
import { canSee } from './raycast.js';
import { KINDS, MOTHER } from './creatures.js';
import { SHOTGUN_ID, RIFLE_ID } from './weapons.js';
import { CREATURES as TUNED, PLAYER, VIEW } from './tuning.js';

const TURN = 7; // radians per second
const HIT_R = KINDS.map((k) => TUNED[k].hit);
const HEIGHT = KINDS.map((k) => TUNED[k].height);

export function createBot() {
  return { facing: null, pitch: 0, out: { facing: 0, pitch: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0 } };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
    }
  } else if (n.phase === 'lull') {
    let pick = null;
    for (let i = 0; i < state.pickups.length; i++) if (state.pickups[i].active) { pick = state.pickups[i]; break; }
    const porch = state.map.start;
    let gx, gy;
    if (pick && !(pick.kind === 0 && g.flares >= 5)) {
      gx = pick.x;
      gy = pick.y;
    } else if (p.health < state.maxHealth && state.stove) {
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
