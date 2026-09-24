// The night: dusk, then one wave an hour from 9 PM to 4 AM, with a lull between. A wave's creatures
// come out of the trails a few at a time, never more alive than the wave's cap, from trails away from
// you. A wave ends when all of its creatures (and the Mother's brood) are dead. In a lull the stove
// heals you, and supplies turn up: a flare, shells once you have the shotgun, and the shotgun itself
// before 11 PM. Clearing 4 AM brings the dawn; running out of health ends the night.
import { NIGHT, FLARE, SHOTGUN, SHELL_BOX, LIGHT } from './tuning.js';
import { spawnCreature, aliveCount, KINDS, MOTHER } from './creatures.js';
import { nextRandom } from './rng.js';
import { emit } from './events.js';
import { giveShotgun } from './weapons.js';

export const LAST_WAVE = NIGHT.waves.length - 1;
export const FLARE_PICKUP = 0, SHELLS_PICKUP = 1, SHOTGUN_PICKUP = 2;

export function createNight() {
  return { phase: 'dusk', wave: 0, t: NIGHT.dusk, queue: new Uint8Array(128), qn: 0, qi: 0, spawnT: 0, reached: 0, dawnT: 0 };
}

export function createPickups(map) {
  return [
    { kind: FLARE_PICKUP, x: map.spots.flare.x, y: map.spots.flare.y, active: false },
    { kind: SHELLS_PICKUP, x: map.spots.shells.x, y: map.spots.shells.y, active: false },
    { kind: SHOTGUN_PICKUP, x: map.spots.shotgun.x, y: map.spots.shotgun.y, active: false },
  ];
}

export function startWave(state, i) {
  const n = state.night, row = NIGHT.waves[i];
  n.phase = 'wave';
  n.wave = i;
  n.reached = Math.max(n.reached, i);
  n.qn = 0;
  n.qi = 0;
  n.spawnT = 0;
  for (let k = 0; k < KINDS.length; k++) for (let j = 0; j < row[KINDS[k]]; j++) n.queue[n.qn++] = k;
  // Shuffle, then bring the Mother forward so she arrives early in her wave.
  for (let j = n.qn - 1; j > 0; j--) {
    const r = Math.floor(nextRandom(state.rng) * (j + 1));
    const t = n.queue[j];
    n.queue[j] = n.queue[r];
    n.queue[r] = t;
  }
  const m = n.queue.subarray(0, n.qn).indexOf(MOTHER);
  const early = Math.min(3, n.qn - 1);
  if (m > early) {
    n.queue[m] = n.queue[early];
    n.queue[early] = MOTHER;
  }
  emit(state, 'wave', 0, 0, i);
}

function spawnNext(state) {
  const n = state.night, p = state.player, spawns = state.map.spawns;
  let far = 0;
  for (const s of spawns) if (Math.hypot(s.x - p.x, s.y - p.y) >= NIGHT.spawnAway) far++;
  let pick = Math.floor(nextRandom(state.rng) * (far || spawns.length));
  let trail = spawns[0];
  for (const s of spawns) {
    if (far && Math.hypot(s.x - p.x, s.y - p.y) < NIGHT.spawnAway) continue;
    if (pick-- === 0) {
      trail = s;
      break;
    }
  }
  spawnCreature(state, n.queue[n.qi++], trail.x + (nextRandom(state.rng) - 0.5) * 0.4, trail.y + (nextRandom(state.rng) - 0.5) * 0.4);
}

function endWave(state) {
  const n = state.night;
  if (n.wave === LAST_WAVE) {
    n.phase = 'dawn';
    n.dawnT = 0;
    n.reached = LAST_WAVE + 1;
    emit(state, 'dawn');
    return;
  }
  n.phase = 'lull';
  n.t = NIGHT.lull;
  const [flare, shells, shotgun] = state.pickups;
  flare.active = true;
  if (state.gun.hasShotgun) shells.active = true;
  if (n.wave + 1 === NIGHT.shotgunBefore && !state.gun.hasShotgun) shotgun.active = true;
  emit(state, 'lull', 0, 0, n.wave + 1);
}

function collect(state) {
  const p = state.player, g = state.gun;
  for (const k of state.pickups) {
    if (!k.active || Math.hypot(k.x - p.x, k.y - p.y) > NIGHT.pickupReach) continue;
    if (k.kind === FLARE_PICKUP) {
      if (g.flares >= FLARE.max) continue;
      g.flares++;
    } else if (k.kind === SHELLS_PICKUP) {
      if (g.spare >= SHOTGUN.maxSpare) continue;
      g.spare = Math.min(SHOTGUN.maxSpare, g.spare + SHELL_BOX);
    } else {
      giveShotgun(state);
    }
    k.active = false;
    emit(state, 'pickup', k.x, k.y, k.kind);
  }
}

export function updateNight(state, dt) {
  const n = state.night, p = state.player;
  if (n.phase === 'dead') return;
  if (n.phase === 'dawn') {
    n.dawnT += dt;
    return;
  }
  collect(state);
  if (n.phase === 'dusk') {
    n.t -= dt;
    if (n.t <= 0) startWave(state, n.wave);
  } else if (n.phase === 'lull') {
    const stove = state.stove;
    if (stove && Math.hypot(stove.x - p.x, stove.y - p.y) <= NIGHT.stoveReach) {
      p.health = Math.min(state.maxHealth, p.health + NIGHT.stoveHeal * dt);
    }
    n.t -= dt;
    if (n.t <= 0) startWave(state, n.wave + 1);
  } else if (n.phase === 'wave') {
    const alive = aliveCount(state);
    n.spawnT -= dt;
    if (n.qi < n.qn && n.spawnT <= 0 && alive < NIGHT.aliveCap(n.wave + 1)) {
      spawnNext(state);
      n.spawnT = NIGHT.spawnEvery;
    }
    if (n.qi >= n.qn && alive === 0) endWave(state);
  }
}

// The sky's light for the current hour, rising to daylight over the dawn.
export function ambientFor(night) {
  const base = LIGHT.night[Math.min(night.wave, LIGHT.night.length - 1)];
  if (night.phase !== 'dawn') return base;
  const k = Math.min(1, night.dawnT / LIGHT.dawnTime);
  return base + (LIGHT.dawn - base) * k * k;
}

// The sky panorama's light level (0-15): dim all night, full at sunrise.
export function skyLevelFor(night) {
  if (night.phase === 'dawn') return Math.round(4 + 11 * Math.min(1, night.dawnT / LIGHT.dawnTime));
  return night.wave >= 6 ? 4 : 3;
}

// What the HUD clock shows: the hour of the wave being fought, or the one coming.
export function hourLabel(night) {
  if (night.phase === 'dawn') return '5 AM';
  if (night.phase === 'dusk') return '8 PM';
  if (night.phase === 'lull') return NIGHT.hours[Math.min(night.wave + 1, LAST_WAVE)];
  return NIGHT.hours[night.wave];
}
