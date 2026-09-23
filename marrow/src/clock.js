// Fixed-timestep clock: turns requestAnimationFrame timestamps into whole 60 Hz ticks. A long gap
// (hidden tab, sleep, a stall) never becomes a burst of catch-up ticks that could kill you unseen.
import { TICK_HZ } from './tuning.js';

// Some browsers coarsen rAF timestamps to 0.1ms in non-isolated pages, so an exact-cadence frame can
// land a hair either side of a tick boundary. This tolerance absorbs that; the remainder is allowed
// to go slightly negative rather than clamped to 0, so it nets out over time instead of every frame
// rounding the same way. A timing tolerance, not a gameplay constant, so it stays out of tuning.js.
const TICK_EPS = 0.05;

export function createClock({ hz = TICK_HZ, maxTicksPerFrame = 4, maxGapMs = 250 } = {}) {
  const dt = 1000 / hz;
  let last = null, acc = 0;
  return {
    ticks(now) {
      if (last === null) {
        last = now;
        return 0;
      }
      let gap = now - last;
      last = now;
      if (gap > maxGapMs || gap < 0) gap = dt;
      acc += gap;
      let n = Math.floor(acc / dt + TICK_EPS);
      acc -= n * dt;
      if (n > maxTicksPerFrame) {
        n = maxTicksPerFrame;
        acc = 0;
      }
      return n;
    },
  };
}
