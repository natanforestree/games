// Embers: the warmth an after-eater stole, spilling out where it dies (creatures.js drops them). They
// glow on the snow and cool in EMBERS.life seconds; you walk to them to take them, and spend them at
// the stove in a lull (upgrades.js). A fixed pool: a new ember in a full pool takes the place of the
// one closest to going out. With "Embers come to you" (state.gentle) they drift to you instead.
import { EMBERS } from './tuning.js';
import { emit } from './events.js';

// An ember is on the snow while t (seconds left) is above 0.
export function createEmbers(n = EMBERS.max) {
  return Array.from({ length: n }, () => ({ x: 0, y: 0, value: 0, t: 0 }));
}

// Drops an ember worth `value` at (x, y). Returns it, or null for a value of 0.
export function dropEmber(state, x, y, value) {
  if (value <= 0) return null;
  let e = state.embers[0];
  for (const o of state.embers) {
    if (o.t <= 0) {
      e = o;
      break;
    }
    if (o.t < e.t) e = o;
  }
  e.x = x;
  e.y = y;
  e.value = value;
  e.t = EMBERS.life;
  emit(state, 'emberDrop', x, y, value);
  return e;
}

// Embers on the snow now.
export function emberCount(state) {
  let n = 0;
  for (const e of state.embers) if (e.t > 0) n++;
  return n;
}

// Takes the embers you're close enough to (Long reach widens it), drifts them to you in gentle mode,
// and cools the rest.
export function updateEmbers(state, dt) {
  const p = state.player, perks = state.perks;
  const reach = perks.reach ? EMBERS.longReach : EMBERS.reach;
  for (const e of state.embers) {
    if (e.t <= 0) continue;
    let dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (state.gentle && d > reach) {
      const step = Math.min(d - reach * 0.5, EMBERS.drift * dt);
      e.x += (dx / d) * step;
      e.y += (dy / d) * step;
      dx = p.x - e.x;
      dy = p.y - e.y;
      d = Math.sqrt(dx * dx + dy * dy);
    }
    if (d <= reach) {
      state.carried += e.value;
      if (perks.warm && p.health > 0) p.health = Math.min(state.maxHealth, p.health + EMBERS.warm * e.value);
      emit(state, 'ember', e.x, e.y, e.value);
      e.t = 0;
      continue;
    }
    e.t -= dt;
    if (e.t <= 0) {
      e.t = 0;
      emit(state, 'emberOut', e.x, e.y);
    }
  }
}
