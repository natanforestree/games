// Fixed-timestep clock: turns requestAnimationFrame timestamps into whole 60 Hz ticks. A long gap
// (hidden tab, sleep, a stall) never becomes a burst of catch-up ticks that could kill you unseen.
import { TICK_HZ } from './tuning.js';

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
      let n = Math.floor(acc / dt + 1e-6);
      acc = Math.max(0, acc - n * dt);
      if (n > maxTicksPerFrame) {
        n = maxTicksPerFrame;
        acc = 0;
      }
      return n;
    },
  };
}
