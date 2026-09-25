// The dark spray when a creature is hit: a pool of droplets thrown up and away from you, falling
// back to the snow. And sparks rising off a burning creature. Both are drawn by the renderer as
// single pixels (sparks glowing). Cosmetic only, so they're driven by the frame clock, not the
// simulation.
const MAX = 160, MAX_SPARKS = 96;
const particles = (n) => Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }));

export function createEffects() {
  return { drops: particles(MAX), next: 0, sparks: particles(MAX_SPARKS), nextSpark: 0 };
}

// Deterministic spread per droplet, so the spray needs no Math.random.
const jitter = (i, k) => {
  const n = Math.imul((i * 2654435761) ^ (k * 40503), 2246822507) >>> 0;
  return (n / 4294967296) * 2 - 1;
};

// Throws `count` droplets from (x, y) at height z, away from (fromX, fromY).
export function spray(fx, x, y, z, fromX, fromY, count = 8) {
  const a = Math.atan2(y - fromY, x - fromX);
  for (let i = 0; i < count; i++) {
    const d = fx.drops[fx.next];
    fx.next = (fx.next + 1) % MAX;
    const s = fx.next + i;
    const spread = a + jitter(s, 1) * 0.9, speed = 1.2 + jitter(s, 2) * 0.8;
    d.x = x;
    d.y = y;
    d.z = z + jitter(s, 3) * 0.1;
    d.vx = Math.cos(spread) * speed;
    d.vy = Math.sin(spread) * speed;
    d.vz = 1 + jitter(s, 4) * 0.6;
    d.t = 1.4; // long enough to land and lie on the snow a moment
  }
}

// Sends one spark up from (x, y) at height z; `seed` varies its drift.
export function spark(fx, x, y, z, seed) {
  const d = fx.sparks[fx.nextSpark];
  fx.nextSpark = (fx.nextSpark + 1) % MAX_SPARKS;
  d.x = x + jitter(seed, 5) * 0.15;
  d.y = y + jitter(seed, 6) * 0.15;
  d.z = z + jitter(seed, 7) * 0.2;
  d.vx = jitter(seed, 8) * 0.3;
  d.vy = jitter(seed, 9) * 0.3;
  d.vz = 0.7 + jitter(seed, 10) * 0.3;
  d.t = 0.5 + jitter(seed, 11) * 0.2;
}

export function updateEffects(fx, dt) {
  for (const d of fx.sparks) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
  }
  for (const d of fx.drops) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.vz -= 6 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    if (d.z <= 0) {
      d.z = 0;
      d.vx *= 0.3;
      d.vy *= 0.3;
      d.vz = 0;
    }
  }
}
