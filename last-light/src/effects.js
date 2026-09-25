// The dark spray when a creature is hit: a pool of droplets thrown up and away from you, falling
// back to the snow. They're drawn by the renderer as single pixels. Cosmetic only, so it's driven by
// the frame clock, not the simulation.
const MAX = 160;

export function createEffects() {
  return { drops: Array.from({ length: MAX }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 })), next: 0 };
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

export function updateEffects(fx, dt) {
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
