// Fixed-timestep clock. Each animation frame asks how many whole 120 Hz updates are due, and how far
// the frame sits between the last update and the next (`alpha`, in [0, 1)), which the renderer uses
// to blend positions. A long gap (a hidden tab, sleep, a stall) never turns into a burst of catch-up
// updates that could kill you unseen.
import { TICK_HZ } from './tuning.js';

// rAF timestamps can be coarsened to 0.1 ms, so a frame at exactly the tick cadence can land a hair
// either side of a tick boundary; this tolerance absorbs that.
const TICK_EPS = 0.02;

export function createClock({ hz = TICK_HZ, maxTicksPerFrame = 8, maxGapMs = 250 } = {}) {
  const dt = 1000 / hz;
  let last = null, acc = 0;
  const clock = {
    alpha: 0,
    advance(now) {
      if (last === null) {
        last = now;
        clock.alpha = 0;
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
      clock.alpha = Math.min(1, Math.max(0, acc / dt));
      return n;
    },
    // Starts timing afresh (after a pause), so the paused time isn't counted.
    reset() {
      last = null;
      acc = 0;
      clock.alpha = 0;
    },
  };
  return clock;
}
