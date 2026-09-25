// Your guns and flares. Shots are instant (hitscan): a ray from your eyes along your facing and pitch,
// stopped by the first wall, hits the nearest creature it passes through: within its `hit` width
// across, and between its feet and its top as it passes, give or take AIM.forgive.
//
// The rifle holds 8 and reloads a round at a time; firing interrupts a reload, and an empty rifle
// starts reloading by itself. The shotgun fires 8 pellets in a spread from 2 barrels, and reloads both
// at once from limited spare shells. Holding the trigger keeps firing as fast as each gun allows.
import { RIFLE, SHOTGUN, SWITCH_TIME, FLARE, FEEL, CREATURES, LIGHT, PLAYER, AIM } from './tuning.js';
import { castRay, createHit } from './raycast.js';
import { damageCreature, KINDS } from './creatures.js';
import { randomBetween } from './rng.js';
import { emit } from './events.js';

export const RIFLE_ID = 0, SHOTGUN_ID = 1;
const HIT_R = KINDS.map((k) => CREATURES[k].hit);
const HEIGHT = KINDS.map((k) => CREATURES[k].height);
export const MAX_FLARES = 8; // burning on the ground at once

export function createGun() {
  return {
    current: RIFLE_ID, next: RIFLE_ID, switching: 0,
    cooldown: 0, reloading: false, reloadT: 0,
    rifle: RIFLE.rounds,
    hasShotgun: false, shells: 0, spare: 0,
    flares: FLARE.start, flareT: 0,
    kick: 0, // view kick, radians, springing back
    shotT: 0, // seconds since the last shot, for the gun's animation
    loadT: 1, // seconds since reloading last started or stopped, for the hands
  };
}

export function createFlares() {
  return Array.from({ length: MAX_FLARES }, () => ({ x: 0, y: 0, t: 0 }));
}

const wallHit = createHit();
const shot = { creature: null, dist: 0 };

// The nearest creature along a ray from your eyes at (ox, oy), at `angle` and `pitch` (up is positive),
// before any wall and within `range`. Returns the reusable `shot` ({ creature, dist }), with creature
// null for a miss.
export function traceShot(state, ox, oy, angle, range, pitch = 0) {
  const dx = Math.cos(angle), dy = Math.sin(angle), rise = Math.tan(pitch);
  const wall = castRay(state.map, ox, oy, dx, dy, wallHit, range) ? wallHit.dist : range;
  shot.creature = null;
  shot.dist = wall;
  for (const c of state.creatures) {
    if (!c.alive || c.dying) continue;
    const rx = c.x - ox, ry = c.y - oy;
    const along = rx * dx + ry * dy;
    if (along <= 0 || along >= shot.dist) continue;
    const across = Math.abs(rx * dy - ry * dx);
    if (across > HIT_R[c.kind]) continue;
    const z = PLAYER.eye + along * rise, give = along * AIM.forgive;
    if (z < c.lift - give || z > c.lift + HEIGHT[c.kind] + give) continue;
    shot.creature = c;
    shot.dist = along;
  }
  return shot;
}

function startSwitch(state, to) {
  const g = state.gun;
  if (to === (g.switching > 0 ? g.next : g.current)) return; // already there, or on the way
  if (to === SHOTGUN_ID && !g.hasShotgun) return;
  g.next = to;
  g.switching = SWITCH_TIME;
  g.reloading = false;
  emit(state, 'switch', state.player.x, state.player.y, to);
}

function startReload(state) {
  const g = state.gun;
  if (g.reloading || g.switching > 0) return;
  if (g.current === RIFLE_ID && g.rifle < RIFLE.rounds) {
    g.reloading = true;
    g.reloadT = RIFLE.reloadPerRound;
  } else if (g.current === SHOTGUN_ID && g.shells < SHOTGUN.shells && g.spare > 0) {
    g.reloading = true;
    g.reloadT = SHOTGUN.reload;
  }
}

function fire(state) {
  const g = state.gun, p = state.player;
  if (g.current === RIFLE_ID) {
    if (g.rifle === 0) {
      if (!g.reloading) {
        emit(state, 'dry', p.x, p.y, RIFLE_ID);
        startReload(state);
      }
      return;
    }
    g.reloading = false;
    g.rifle--;
    g.cooldown = RIFLE.interval;
    const s = traceShot(state, p.x, p.y, p.facing, RIFLE.range, p.pitch);
    if (s.creature) damageCreature(state, s.creature, RIFLE.damage);
    g.kick += FEEL.kick.rifle;
    emit(state, 'shot', p.x, p.y, RIFLE_ID);
    if (g.rifle === 0) startReload(state);
  } else {
    if (g.shells === 0) {
      emit(state, 'dry', p.x, p.y, SHOTGUN_ID);
      if (g.spare > 0) startReload(state);
      else startSwitch(state, RIFLE_ID);
      g.cooldown = SHOTGUN.interval;
      return;
    }
    g.reloading = false;
    g.shells--;
    g.cooldown = SHOTGUN.interval;
    const n = SHOTGUN.pellets;
    for (let i = 0; i < n; i++) {
      const spread = SHOTGUN.spread * (((i + 0.5) / n) * 2 - 1);
      const jitter = randomBetween(state.rng, -0.3, 0.3) * (SHOTGUN.spread / n);
      const s = traceShot(state, p.x, p.y, p.facing + spread + jitter, SHOTGUN.range, p.pitch);
      if (s.creature) damageCreature(state, s.creature, s.dist > SHOTGUN.falloff ? SHOTGUN.damage / 2 : SHOTGUN.damage);
    }
    g.kick += FEEL.kick.shotgun;
    state.shake = FEEL.shakeTime;
    emit(state, 'shot', p.x, p.y, SHOTGUN_ID);
    if (g.shells === 0 && g.spare > 0) startReload(state);
  }
  g.shotT = 0;
  state.flash = LIGHT.muzzle.time;
}

const flareHit = createHit();

function throwFlare(state) {
  const g = state.gun, p = state.player;
  if (g.flares <= 0 || g.flareT > 0) return;
  let slot = null;
  for (const f of state.flares) {
    if (f.t <= 0) {
      slot = f;
      break;
    }
  }
  if (!slot) return;
  const dx = Math.cos(p.facing), dy = Math.sin(p.facing);
  const d = castRay(state.map, p.x, p.y, dx, dy, flareHit, FLARE.throw) ? Math.max(0, flareHit.dist - 0.3) : FLARE.throw;
  slot.x = p.x + dx * d;
  slot.y = p.y + dy * d;
  slot.t = FLARE.burn;
  g.flares--;
  g.flareT = FLARE.cooldown;
  emit(state, 'flareThrow', slot.x, slot.y);
}

// intents: { fire (held), reload (presses), weapon (0 none, 1 rifle, 2 shotgun), weaponStep (-1, 0, 1), flare (presses) }
export function updateGun(state, intents, dt) {
  const g = state.gun;
  const loading = g.reloading;
  g.shotT += dt;
  if (g.cooldown > 0) g.cooldown -= dt;
  if (g.flareT > 0) g.flareT -= dt;
  g.kick -= g.kick * Math.min(1, FEEL.kickReturn * dt);

  if (intents.weapon === 1) startSwitch(state, RIFLE_ID);
  else if (intents.weapon === 2) startSwitch(state, SHOTGUN_ID);
  else if (intents.weaponStep) startSwitch(state, (g.switching > 0 ? g.next : g.current) === RIFLE_ID ? SHOTGUN_ID : RIFLE_ID);
  if (g.switching > 0) {
    g.switching -= dt;
    if (g.switching <= 0) {
      g.switching = 0;
      g.current = g.next;
    }
  }
  if (intents.reload) startReload(state);
  if (g.reloading) {
    g.reloadT -= dt;
    if (g.reloadT <= 0) {
      if (g.current === RIFLE_ID) {
        g.rifle++;
        emit(state, 'reload', state.player.x, state.player.y, RIFLE_ID);
        if (g.rifle < RIFLE.rounds) g.reloadT += RIFLE.reloadPerRound;
        else g.reloading = false;
      } else {
        const load = Math.min(SHOTGUN.shells - g.shells, g.spare);
        g.shells += load;
        g.spare -= load;
        g.reloading = false;
        emit(state, 'reload', state.player.x, state.player.y, SHOTGUN_ID);
      }
    }
  }
  if (intents.fire && g.cooldown <= 0 && g.switching <= 0) fire(state);
  if (intents.flare) throwFlare(state);
  g.loadT = g.reloading === loading ? g.loadT + dt : 0;
}

export function updateFlares(state, dt) {
  for (const f of state.flares) {
    if (f.t <= 0) continue;
    f.t -= dt;
    if (f.t <= 0) {
      f.t = 0;
      emit(state, 'flareOut', f.x, f.y);
    }
  }
}

// Gives you the shotgun, loaded, with its spare shells, and raises it.
export function giveShotgun(state) {
  const g = state.gun;
  g.hasShotgun = true;
  g.shells = SHOTGUN.shells;
  g.spare = SHOTGUN.foundWith - SHOTGUN.shells;
  startSwitch(state, SHOTGUN_ID);
}
