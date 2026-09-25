// You: a circle that walks and runs with snappy acceleration, slides along walls and round props,
// and remembers where it was last update so the renderer can blend between the two. It also keeps how
// long you've stood still (Steady hands reads it).
import { PLAYER, FEEL, PERKS } from './tuning.js';
import { moveBody, pushOutOfCircle } from './collide.js';
import { emit } from './events.js';

const ACCEL = PLAYER.run / PLAYER.accelTime;
const DECEL = PLAYER.run / PLAYER.stopTime;

export function createPlayer(start) {
  return {
    x: start.x, y: start.y, px: start.x, py: start.y,
    vx: 0, vy: 0, radius: PLAYER.radius, facing: start.facing, pitch: 0,
    health: PLAYER.health, walked: 0, running: false, stillT: 0,
  };
}

// intents: { facing, pitch (up is positive), forward (-1..1), strafe (-1..1, positive is right), run }.
// `speed` scales your walk, run and acceleration (Snowshoes).
export function movePlayer(map, p, intents, dt, speed = 1) {
  p.px = p.x;
  p.py = p.y;
  p.facing = intents.facing;
  p.pitch = intents.pitch;
  const c = Math.cos(p.facing), s = Math.sin(p.facing);
  let wx = intents.forward * c - intents.strafe * s;
  let wy = intents.forward * s + intents.strafe * c;
  const wl = Math.sqrt(wx * wx + wy * wy);
  if (wl > 1) {
    wx /= wl;
    wy /= wl;
  }
  p.running = intents.run && wl > 0;
  const max = (p.running ? PLAYER.run : PLAYER.walk) * speed;
  const tx = wx * max, ty = wy * max;
  const dvx = tx - p.vx, dvy = ty - p.vy;
  const dl = Math.sqrt(dvx * dvx + dvy * dvy);
  const step = (wl > 0 ? ACCEL : DECEL) * speed * dt;
  if (dl <= step) {
    p.vx = tx;
    p.vy = ty;
  } else {
    p.vx += (dvx / dl) * step;
    p.vy += (dvy / dl) * step;
  }
  moveBody(map, p, p.vx * dt, p.vy * dt);
  for (const prop of map.props) pushOutOfCircle(p, prop.x, prop.y, prop.radius);
  const mx = p.x - p.px, my = p.y - p.py, moved = Math.sqrt(mx * mx + my * my);
  p.walked += moved;
  p.stillT = moved < PERKS.steady.speed * dt ? p.stillT + dt : 0;
}

// Something hit you for `amount`, from (x, y). With ?god you never drop below 1.
export function hurtPlayer(state, amount, x, y) {
  const p = state.player;
  if (p.health <= 0) return;
  p.health -= amount;
  if (state.god && p.health < 1) p.health = 1;
  state.hurt = FEEL.hurtTime;
  emit(state, 'hurt', x, y, amount);
}
