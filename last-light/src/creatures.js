// The after-eaters. Every creature lives in a fixed pool (no allocation mid-night) and runs a small state
// machine each update:
//   crawler  chases and bites
//   gaunt    chases, winds up, swipes
//   leaper   closes in, circles at the edge of your light, crouches with a shriek, leaps in a straight
//            line (sidestep it or shoot it mid-air), lands, and goes round again. Where it can't see
//            you (you're in the cabin) it chases and bites like a crawler. If a wall stops its leap
//            short of you, it comes straight in instead of circling, and pounces once it's close.
//   mother   a slow, huge gaunt that also gives birth to crawlers (within the wave's cap)
// All of them head straight for you when they can see you nearby, and follow the flow field when they
// can't. Flare light halves their speed. They push each other apart, and never into you.
import { CREATURES, MAX_CREATURES, FLARE, NIGHT } from './tuning.js';
import { moveBody, pushOutOfCircle, separate } from './collide.js';
import { canSee } from './raycast.js';
import { flowDir } from './flowfield.js';
import { nextRandom, randomBetween } from './rng.js';
import { emit } from './events.js';
import { hurtPlayer } from './player.js';

export const KINDS = ['crawler', 'gaunt', 'leaper', 'mother'];
export const CRAWLER = 0, GAUNT = 1, LEAPER = 2, MOTHER = 3;
const T = KINDS.map((k) => CREATURES[k]);
const WEIGHT = KINDS.map((k) => CREATURES.pushWeight[k]);

export function createCreatures(n = MAX_CREATURES) {
  return Array.from({ length: n }, (_, id) => ({
    id, alive: false, dying: 0, kind: 0, x: 0, y: 0, px: 0, py: 0, radius: 0, hp: 0,
    heading: 0, moving: false, walked: 0, mode: 'chase', t: 0, attackT: 0, flinch: 0, hurtT: 0,
    circleDir: 1, circleT: 0, unseen: 0, rush: false, leapX: 0, leapY: 0, leapHit: false, lift: 0, birthT: 0,
    struck: 0,
  }));
}

export function spawnCreature(state, kind, x, y) {
  let c = null;
  for (const s of state.creatures) {
    if (!s.alive) {
      c = s;
      break;
    }
  }
  if (!c) return null;
  const t = T[kind];
  c.alive = true;
  c.dying = 0;
  c.kind = kind;
  c.x = c.px = x;
  c.y = c.py = y;
  c.radius = t.radius;
  c.hp = t.health;
  c.heading = Math.atan2(state.player.y - y, state.player.x - x);
  c.moving = false;
  c.walked = 0;
  c.mode = 'chase';
  c.t = 0;
  c.attackT = t.firstBite ?? 0;
  c.flinch = 0;
  c.hurtT = 0;
  c.circleDir = nextRandom(state.rng) < 0.5 ? -1 : 1;
  c.circleT = 0;
  c.unseen = 0;
  c.rush = false;
  c.leapHit = false;
  c.lift = 0;
  c.birthT = t.birthEvery ?? 0;
  c.struck = 0;
  emit(state, 'spawn', x, y, kind);
  return c;
}

// Creatures still in the fight (spawned and not dying).
export function aliveCount(state) {
  let n = 0;
  for (const c of state.creatures) if (c.alive && !c.dying) n++;
  return n;
}

export function inFlare(state, x, y) {
  const r2 = FLARE.radius * FLARE.radius;
  for (const f of state.flares) {
    if (f.t > 0 && (f.x - x) ** 2 + (f.y - y) ** 2 <= r2) return true;
  }
  return false;
}

// Damages a creature; flare light makes it hurt more. Returns true if this killed it.
export function damageCreature(state, c, amount) {
  if (!c.alive || c.dying) return false;
  if (inFlare(state, c.x, c.y)) amount *= FLARE.damage;
  c.hp -= amount;
  c.flinch = T[c.kind].flinch;
  c.hurtT = 0.1;
  const killed = c.hp <= 0;
  if (killed) {
    c.dying = CREATURES.die;
    c.lift = 0;
    state.stats.kills++;
  }
  emit(state, 'hit', c.x, c.y, c.kind, killed ? 1 : 0);
  return killed;
}

const dir = { x: 0, y: 0 };

// Steps towards you: straight if it can see you, else down the flow field. Returns false if it's stuck.
function heading(state, c, sees) {
  const p = state.player;
  if (!sees && flowDir(state.field, state.map, c.x, c.y, dir)) return true;
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  dir.x = dx / d;
  dir.y = dy / d;
  return true;
}

function walk(state, c, vx, vy, dt) {
  const hitWall = moveBody(state.map, c, vx * dt, vy * dt);
  for (const prop of state.map.props) pushOutOfCircle(c, prop.x, prop.y, prop.radius);
  const mx = c.x - c.px, my = c.y - c.py, moved = Math.sqrt(mx * mx + my * my);
  c.moving = moved > 1e-4;
  if (c.moving) {
    c.heading = Math.atan2(vy, vx);
    c.walked += moved;
  }
  return hitWall;
}

// A landed attack; `struck` times the attack animation.
function strike(state, c, damage) {
  c.struck = 0.25;
  hurtPlayer(state, damage, c.x, c.y);
}

function update(state, c, dt) {
  const t = T[c.kind], p = state.player;
  c.px = c.x;
  c.py = c.y;
  c.moving = false;
  if (c.hurtT > 0) c.hurtT -= dt;
  if (c.struck > 0) c.struck -= dt;
  if (c.dying) {
    c.dying -= dt;
    if (c.dying <= 0) c.alive = false;
    return;
  }
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
  const touch = d - c.radius - p.radius; // gap between the two circles
  const sees = d < CREATURES.sightRange && canSee(state.map, c.x, c.y, p.x, p.y);
  const slow = inFlare(state, c.x, c.y) ? FLARE.slow : 1;
  if (c.flinch > 0) {
    c.flinch -= dt;
    if (c.mode !== 'leap') return;
  }

  if (c.kind === LEAPER) {
    // It gives up a circle only after a moment out of sight, and a circle broken off at a doorway or a
    // corner resumes with the time it had left, so a leaper at the edge of sight still leaps.
    if (c.mode === 'chase' || c.mode === 'circle') {
      c.unseen = sees ? 0 : c.unseen + dt;
      if (c.mode === 'circle' && c.unseen >= t.lostSight) {
        c.mode = 'chase';
      } else if (c.mode === 'chase' && sees && !c.rush && d <= t.circleAt + 0.5) {
        c.mode = 'circle';
        if (c.circleT <= 0) c.circleT = randomBetween(state.rng, t.circleMin, t.circleMax);
      }
    }
    switch (c.mode) {
      case 'chase':
        // Coming straight in after a wall cut its leap short: it pounces once it sees you close.
        if (c.rush && sees && d < t.closeLeap) return crouch(state, c, t, dx, dy);
        if (!sees && touch <= t.reach) return bite(state, c, t, dt, dx, dy);
        c.attackT = t.interval;
        heading(state, c, sees);
        walk(state, c, dir.x * t.speed * slow, dir.y * t.speed * slow, dt);
        return;
      case 'circle': {
        c.circleT -= dt;
        if (c.circleT <= 0 || d < t.closeLeap) return crouch(state, c, t, dx, dy);
        const ux = dx / d, uy = dy / d;
        const radial = Math.max(-1, Math.min(1, d - t.circleAt));
        let vx = -uy * c.circleDir + ux * radial, vy = ux * c.circleDir + uy * radial;
        const l = Math.sqrt(vx * vx + vy * vy) || 1;
        vx = (vx / l) * t.circleSpeed * slow;
        vy = (vy / l) * t.circleSpeed * slow;
        if (walk(state, c, vx, vy, dt)) c.circleDir = -c.circleDir;
        return;
      }
      case 'crouch':
        c.heading = Math.atan2(dy, dx);
        c.t -= dt;
        if (c.t <= 0) {
          c.mode = 'leap';
          c.t = t.leapTime;
          c.leapX = dx / d;
          c.leapY = dy / d;
          c.leapHit = false;
          emit(state, 'leap', c.x, c.y);
        }
        return;
      case 'leap': {
        c.t -= dt;
        c.lift = 0.35 * Math.sin(Math.PI * Math.min(1, 1 - c.t / t.leapTime));
        const wall = walk(state, c, c.leapX * t.leapSpeed * slow, c.leapY * t.leapSpeed * slow, dt);
        const lx = p.x - c.x, ly = p.y - c.y, gap = Math.sqrt(lx * lx + ly * ly) - c.radius - p.radius;
        if (!c.leapHit && gap <= 0.15) {
          c.leapHit = true;
          strike(state, c, t.pounce);
        }
        if (wall || c.t <= 0) {
          c.mode = 'land';
          c.t = t.land;
          c.lift = 0;
          // A wall stopped it with you still ahead (it leapt at a doorway's edge, or at where it last
          // saw you): no clear line from here, so next it comes straight in rather than circling.
          c.rush = wall && !c.leapHit && (p.x - c.x) * c.leapX + (p.y - c.y) * c.leapY > 0;
        }
        return;
      }
      case 'land':
        c.t -= dt;
        if (c.t <= 0) {
          c.mode = 'chase';
          c.attackT = t.interval;
          c.circleT = 0; // the next circle is a fresh one
        }
        return;
    }
    return;
  }

  if (c.kind === MOTHER) {
    c.birthT -= dt;
    // She gives birth on a timer, but not past the wave's cap on creatures alive at once.
    if (c.birthT <= 0 && aliveCount(state) + t.births <= NIGHT.aliveCap(state.night.wave + 1)) {
      c.birthT = t.birthEvery;
      emit(state, 'birth', c.x, c.y);
      for (let i = 0; i < t.births; i++) {
        const a = c.heading + Math.PI + (i - (t.births - 1) / 2) * 0.8;
        const b = spawnCreature(state, CRAWLER, c.x + Math.cos(a) * (c.radius + 0.3), c.y + Math.sin(a) * (c.radius + 0.3));
        if (b) moveBody(state.map, b, 0, 0);
      }
    }
  }

  if (c.kind === CRAWLER) {
    if (touch <= t.reach) return bite(state, c, t, dt, dx, dy);
    c.attackT = t.firstBite;
    heading(state, c, sees);
    walk(state, c, dir.x * t.speed * slow, dir.y * t.speed * slow, dt);
    return;
  }

  // Gaunt and Mother: chase, wind up, strike. Their reach is longer than a wall is thick, so both the
  // wind-up and the strike need sight of you; without it they path round, in by the doorway.
  if (c.attackT > 0) c.attackT -= dt;
  if (c.mode === 'windup') {
    c.heading = Math.atan2(dy, dx);
    c.t -= dt;
    if (c.t <= 0) {
      c.mode = 'chase';
      c.attackT = t.interval;
      if (sees && touch <= t.reach + 0.2) strike(state, c, t.damage);
    }
    return;
  }
  if (sees && touch <= t.reach) {
    if (c.attackT <= 0) {
      c.mode = 'windup';
      c.t = t.windup;
      emit(state, 'windup', c.x, c.y, c.kind);
    }
    c.heading = Math.atan2(dy, dx);
    return;
  }
  heading(state, c, sees);
  walk(state, c, dir.x * t.speed * slow, dir.y * t.speed * slow, dt);
}

// A leaper crouches with a shriek, facing you, before it leaps.
function crouch(state, c, t, dx, dy) {
  c.mode = 'crouch';
  c.t = t.crouch;
  c.heading = Math.atan2(dy, dx);
  emit(state, 'shriek', c.x, c.y);
}

// Crawlers (and leapers that can't see you) bite on a timer while they're touching you.
function bite(state, c, t, dt, dx, dy) {
  c.heading = Math.atan2(dy, dx);
  c.attackT -= dt;
  if (c.attackT <= 0) {
    c.attackT = t.interval;
    strike(state, c, t.damage);
  }
}

export function updateCreatures(state, dt) {
  const cs = state.creatures, p = state.player;
  for (const c of cs) if (c.alive) update(state, c, dt);
  // Push apart, then back out of walls and out of you.
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i];
    if (!a.alive || a.dying) continue;
    for (let j = i + 1; j < cs.length; j++) {
      const b = cs[j];
      if (b.alive && !b.dying) separate(a, b, WEIGHT[a.kind], WEIGHT[b.kind]);
    }
  }
  for (const c of cs) {
    if (!c.alive || c.dying) continue;
    pushOutOfCircle(c, p.x, p.y, p.radius);
    moveBody(state.map, c, 0, 0);
  }
}
