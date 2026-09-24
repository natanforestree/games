// Ichor: a killed fighter bursts into fluid of their own color. Drops fly and fall, and wherever they
// land they stain that screen for the rest of the match. The colors are palette.json's `ichor`: each
// fighter's glow ramp, the same in every world, because the glow is the fighter's own.
import { T, VIEW_W, VIEW_H, TILE } from './tuning.js';
import { SCREENS } from './level.js';
import * as P from './physics.js';

// makeCanvas(w, h) makes a stain layer; ichor is palette.json's `ichor` (a 3-color ramp per fighter id).
export function createEffects(makeCanvas, ichor) {
  let stains = new Map(); // screen index -> canvas
  let drops = [];
  let seed = 1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stainOf = (i) => {
    if (!stains.has(i)) stains.set(i, makeCanvas(VIEW_W, VIEW_H));
    return stains.get(i);
  };
  const stamp = (screen, x, y, color, size) => {
    const g = stainOf(screen).getContext('2d');
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), size, size);
  };
  return {
    reset() {
      stains = new Map();
      drops = [];
    },
    onEvents(events) {
      for (const e of events) {
        if (e.type !== 'kill' || e.cause === 'pit') continue;
        const ramp = ichor[e.id];
        for (let i = 0; i < T.ICHOR_DROPS_PER_KILL; i++) {
          const a = -Math.PI * rand(), sp = T.ICHOR_DROP_SPEED_MIN + rand() * T.ICHOR_DROP_SPEED_RANGE;
          drops.push({
            screen: e.screen, x: e.x + (rand() - 0.5) * T.ICHOR_DROP_SPREAD_X, y: e.y - T.ICHOR_DROP_RISE_MIN - rand() * T.ICHOR_DROP_RISE_RANGE,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, color: ramp[Math.floor(rand() * 3)], size: rand() < T.ICHOR_DROP_BIG_CHANCE ? 2 : 1, life: T.ICHOR_DROP_LIFE_TICKS,
          });
        }
        for (let i = 0; i < T.ICHOR_SPLASH_STAMPS; i++) {
          stamp(e.screen, e.x + (rand() - 0.5) * T.ICHOR_SPLASH_SPREAD_X, e.y + rand() * T.ICHOR_SPLASH_SPREAD_Y, ramp[Math.floor(rand() * 2)], 1 + Math.floor(rand() * 2));
        }
      }
    },
    update() {
      for (const d of drops) {
        d.vy += T.ICHOR_DROP_GRAVITY;
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
        if (P.solidAt(SCREENS[d.screen], Math.floor(d.x / TILE), Math.floor(d.y / TILE))) {
          stamp(d.screen, d.x, d.y - 1, d.color, d.size);
          d.life = 0;
        }
      }
      drops = drops.filter((d) => d.life > 0 && d.y < VIEW_H + T.ICHOR_OFFSCREEN_MARGIN);
    },
    drawStains(ctx, screen, ox) {
      const c = stains.get(screen);
      if (c) ctx.drawImage(c, Math.round(ox), 0);
    },
    drawDrops(ctx, screen, ox) {
      for (const d of drops) {
        if (d.screen !== screen) continue;
        ctx.fillStyle = d.color;
        ctx.fillRect(Math.round(ox + d.x), Math.round(d.y), d.size, d.size);
      }
    },
  };
}
