// Match flow: the GO arrow, deaths, respawns, leaving the screen, screen slides and winning.
import { T, VIEW_W } from './tuning.js';
import { SCREENS, LAST, victoryIndex } from './level.js';
import * as P from './physics.js';
import { isActive, setStance } from './fighter.js';
import { kill } from './combat.js';

// Which screen edges fighter f may walk through. Only the arrow holder may leave, and only toward
// their goal; while someone holds the arrow, the other fighter may run off either edge (and comes
// back shortly). With no arrow, both edges are walls.
export function edgesOpen(state, f) {
  if (state.phase !== 'play' || state.arrow === null) return P.CLOSED;
  if (state.arrow !== f.id) return { left: true, right: true };
  const next = state.screen + f.dir;
  const canGo = next >= 0 && next <= LAST;
  return { left: canGo && f.dir < 0, right: canGo && f.dir > 0 };
}

export function updateMatch(state) {
  for (const f of state.fighters) if (isActive(f) && f.y > T.PIT_DEATH_Y) kill(state, f, 'pit');
  const dead = state.killsThisTick;
  if (dead.length) {
    // one death hands the other fighter the arrow; a double kill clears it
    state.arrow = dead.length >= 2 ? null : 1 - dead[0].id;
    for (const d of dead) state.fighters[d.id].respawnT = T.RESPAWN_TICKS;
    state.events.push({ type: 'arrow', holder: state.arrow });
  }
  if (state.phase === 'maw') {
    updateMaw(state);
    return;
  }
  for (const f of state.fighters) {
    if (isActive(f) || f.respawnT <= 0) continue;
    f.respawnT--;
    if (f.respawnT === 0) respawn(state, f);
  }
  for (const f of state.fighters) {
    if (!isActive(f) || (f.x >= 0 && f.x <= VIEW_W)) continue;
    const side = f.x < 0 ? -1 : 1;
    if (state.arrow === f.id && side === f.dir) {
      startSlide(state, f);
      return;
    }
    Object.assign(f, { state: 'gone', t: 0, respawnT: T.OFFSCREEN_RESPAWN_TICKS, heldBy: null });
  }
}

// Back in, armed: RESPAWN_AHEAD in front of the arrow holder, on the nearest safe floor inside the
// screen. With no arrow holder around (after a double kill), at the side's starting spot.
export function respawn(state, f) {
  const screen = SCREENS[state.screen];
  const holder = state.arrow !== null && state.arrow !== f.id ? state.fighters[state.arrow] : null;
  const spot = holder && isActive(holder)
    ? P.findSpawn(screen, holder.x + holder.dir * T.RESPAWN_AHEAD, holder.y)
    : P.findSpawn(screen, T.START_X[f.id], 150);
  placeFighter(f, spot.x, spot.y);
  const other = state.fighters[1 - f.id];
  f.facing = isActive(other) && other.x !== f.x ? Math.sign(other.x - f.x) : f.dir;
  state.events.push({ type: 'respawn', id: f.id, x: f.x, y: f.y });
}

export function placeFighter(f, x, y) {
  Object.assign(f, {
    x, y, vx: 0, vy: 0, state: 'stand', t: 0, onGround: true, armed: true, stunT: 0, drawT: 99,
    moveDir: 0, moveT: 0, heldBy: null, ledge: null, wallDir: 0, wallRun: 0, noGrabT: 0, respawnT: 0, punchHitAt: -9999,
  });
  setStance(f, 1, true);
}

function startSlide(state, f) {
  state.phase = 'slide';
  state.slide = { from: state.screen, to: state.screen + f.dir, dir: f.dir, t: 0, holder: f.id };
  state.swords = [];
  const other = state.fighters[1 - f.id];
  Object.assign(other, { state: 'gone', t: 0, respawnT: T.OFFSCREEN_RESPAWN_TICKS, heldBy: null });
  state.events.push({ type: 'slide', dir: f.dir, to: state.slide.to });
}

// The screen slides for SCREEN_SLIDE_TICKS; then the holder runs in from the edge. Reaching their
// victory screen wins: the loser stays gone and the Maw comes.
export function updateSlide(state) {
  const s = state.slide;
  s.t++;
  if (s.t < T.SCREEN_SLIDE_TICKS) return;
  state.screen = s.to;
  state.phase = 'play';
  state.slide = null;
  const f = state.fighters[s.holder];
  const screen = SCREENS[state.screen];
  const x = s.dir > 0 ? T.SLIDE_ENTRY_X : VIEW_W - T.SLIDE_ENTRY_X;
  const ys = P.surfacesAt(screen, x);
  const y = ys.length ? ys.reduce((best, v) => (Math.abs(v - f.y) < Math.abs(best - f.y) ? v : best)) : P.findSpawn(screen, x, f.y).y;
  Object.assign(f, { x, y, vx: 0, vy: 0, state: 'run', t: 0, onGround: true, moveDir: s.dir, moveT: T.RUN_AFTER_TICKS, facing: s.dir });
  if (state.screen === victoryIndex(f.dir)) {
    state.phase = 'maw';
    state.winner = f.id;
    state.maw = { t: 0, x: null };
    state.fighters[1 - f.id].respawnT = 0;
    state.events.push({ type: 'victory', id: f.id });
  }
}

function updateMaw(state) {
  const m = state.maw, w = state.fighters[state.winner];
  m.t++;
  if (m.t === T.MAW_DELAY_TICKS) {
    m.x = Math.round(w.x);
    state.events.push({ type: 'maw', x: m.x });
  }
  if (m.t === T.MAW_DELAY_TICKS + T.MAW_SWALLOW_TICKS) {
    w.state = 'gone';
    state.events.push({ type: 'swallow', id: w.id });
  }
  if (m.t >= T.MAW_DELAY_TICKS + T.MAW_TICKS) state.phase = 'over';
}
