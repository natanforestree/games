// Everything in the scene that moves, as pure functions of time in milliseconds, so it's testable and
// never depends on the frame rate. Every position is a whole number of scene pixels.
export const BOB_AMP = 2; // islands bob this many pixels up and down
export const LIFT = 3; // an active island rises this many pixels...
export const LIFT_STEP_MS = 40; // ...one pixel every this many ms
export const CLOUD_SPEEDS = [2, 4, 7]; // px per second: far, mid, near
export const BIRD_EVERY = 45000, BIRD_MS = 16000; // a bird every 45 s, taking 16 s to cross
export const STAR_EVERY = 23000, STAR_MS = 600, STAR_SPEED = 0.15; // shooting stars: px per ms

export function bob(tMs, period, phase) {
  const px = Math.round(BOB_AMP * Math.sin(2 * Math.PI * (tMs / period + phase)));
  return px === 0 ? 0 : px; // never -0
}

// An active island's lift, rising one pixel per LIFT_STEP_MS up to LIFT from the moment it became
// active, and sinking back the same way. from: its lift at that moment; since: that moment (ms).
export function liftAt(active, from, since, tMs) {
  const steps = Math.max(0, Math.floor((tMs - since) / LIFT_STEP_MS));
  return active ? Math.min(LIFT, from + steps) : Math.max(0, from - steps);
}

// The animation frame showing at tMs, for `frames` frames of `ms` each.
export function frameAt(tMs, frames, ms) {
  return Math.floor(tMs / ms) % frames;
}

// How far a cloud layer drifting `speed` px/s has moved, wrapped to its strip's width.
export function drift(tMs, speed, width) {
  return Math.floor((tMs * speed) / 1000) % width;
}

// Deterministic noise in [0, 1) for whole numbers n and seed.
export function hash(n, seed = 0) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// The night's brighter stars, which twinkle: scattered over the upper 60% of the canvas.
export function twinkles(cw, ch, count = 14) {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.floor(hash(i, 6) * cw),
    y: Math.floor(hash(i, 7) * ch * 0.6),
    period: 1600 + Math.floor(hash(i, 8) * 2400),
    phase: hash(i, 9),
  }));
}

// Which of the three twinkle sprites a star shows: dot, small cross, big cross, small cross, ...
export function twinkleFrame(tMs, star) {
  return [0, 1, 2, 1][Math.floor(((tMs / star.period + star.phase) % 1) * 4)];
}

// The odd bird crossing the day sky: one every BIRD_EVERY ms, taking BIRD_MS to cross the canvas,
// flying left or right at a height of its own, wings flapping.
export function birdAt(tMs, cw, ch) {
  const i = Math.floor(tMs / BIRD_EVERY);
  const k = (tMs - i * BIRD_EVERY) / BIRD_MS;
  if (k >= 1) return null;
  const dir = hash(i, 1) < 0.5 ? 1 : -1;
  const across = Math.floor(k * (cw + 16));
  const x = dir > 0 ? across - 8 : cw + 8 - across;
  const y = Math.floor(ch * (0.12 + 0.25 * hash(i, 2)) + 2 * Math.sin(k * 20));
  return { x, y, dir, frame: Math.floor(tMs / 200) % 2 };
}

// A shooting star: at most one every STAR_EVERY ms (about 60% of those have one), lasting STAR_MS,
// falling down and to the left. x, y is its head; age runs 0 -> 1 as it fades.
export function shootingStarAt(tMs, cw, ch) {
  const i = Math.floor(tMs / STAR_EVERY);
  const age = tMs - i * STAR_EVERY;
  if (age >= STAR_MS || hash(i, 3) < 0.4) return null;
  const d = Math.floor(age * STAR_SPEED);
  return { x: Math.floor(cw * (0.3 + 0.6 * hash(i, 4))) - d, y: Math.floor(ch * 0.4 * hash(i, 5)) + d, age: age / STAR_MS };
}
