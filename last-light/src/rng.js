// Seeded random numbers (mulberry32). The simulation draws from state.rng only, so a night replays
// identically from its seed.
export function createRng(seed) {
  return { s: seed >>> 0 };
}

export function nextRandom(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A float in [lo, hi).
export function randomBetween(rng, lo, hi) {
  return lo + (hi - lo) * nextRandom(rng);
}
