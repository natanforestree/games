# Last Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build *Last Light*, a first-person wave-survival horror shooter at `natanforestree.github.io/games/last-light/`: hold a snowy cabin through one night, from 8 PM dusk to dawn, against the Hungry, with a raycaster that feels super smooth. Then give it an island on the games page.

**Architecture:**
- **Simulation.** A deterministic 120 Hz simulation (`step(state, intents)`) holds every rule and is tested in Node. It updates in place and allocates nothing, and never touches the DOM, the clock or `Math.random`.
- **Renderer.** A software raycaster draws into a `Uint32Array` pixel buffer at about 270 px tall, lit through pre-shaded palette tables and a light grid. It's also plain arithmetic, so it's tested and timed in Node too.
- **The browser layer.** Thin layers turn the state into a picture (`scene.js`) and add the HUD with the canvas 2D context. They also read the keyboard and raw mouse, play Web Audio, and run the screens (title, playing, paused, dead, dawn).
- **Art.** All art comes from Lua scripts run through Aseprite.

**Tech Stack:**
- The game: plain JavaScript ES modules, with no build step and no dependencies, on a Canvas 2D context. Sound is Web Audio, generated live.
- Tests: `node --test` on Node 22 (v22.22.1 is installed), plus the Playwright MCP for browser checks.
- Art: Aseprite 1.3.18 Lua (`json`, `Image{fromFile}`), run as `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script <file>`.
- UI font: Silkscreen, from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-24-last-light-design.md`. Read it alongside this plan. The plan implements it, and the spec explains why.

**How this plan was made:** every JavaScript file below was written and run in a scratch prototype before this plan was written.
- **Tests.** Each task's tests were replayed in order in a clean folder, and pass at every stage (9 → 23 → 50 → 86 → 89 → 107 → 128 → 134 tests, and 140 once the art exists).
- **Speed.** On Nathan's 2017 MacBook Pro (i7-7700HQ), `npm run bench` draws a busy 480×270 frame in about 3 ms.
- **Browser.** The whole game ran in Chrome (with stand-in art). A bot that can't die played a full night to the dawn screen with 0 errors.

So the code blocks here are known to work together. Transcribe them exactly. When a test fails, the transcription is the first suspect.

## Global Constraints

**Hosting and build**
- Static files only, served by GitHub Pages from `main` at the repo root (`/Users/nathan/Documents/code/games`). No build step and no npm dependencies.
- `last-light/package.json` has `"type": "module"`, a `test` script and a `bench` script, and nothing else.
- The game lives in `last-light/` and its id is `last-light`. Its URL is `natanforestree.github.io/games/last-light/`.

**Code**
- Plain ES modules. Data is **fetched**, never imported with JSON import attributes.
- The simulation modules never touch the DOM, the canvas, the clock or `Math.random`. They are `tuning`, `rng`, `map`, `events`, `collide`, `player`, `raycast`, `flowfield`, `creatures`, `weapons`, `night` and `sim`. Randomness comes from `state.rng` (`rng.js`, mulberry32).
- **Nothing is allocated per frame or per update** in the simulation, the renderer or the scene builder. Use pools (creatures, flares, events, sprites, droplets), reused out-objects, and no closures or object literals in hot paths. The HUD takes its numbers from a table of pre-made strings. Web Audio source nodes are made per sound (the API requires it); the positional voices are pooled.
- Every number the game plays by lives in `last-light/src/tuning.js`.
- Every `localStorage` access goes through `storage.js`, inside `try/catch`. The keys are `last-light-best`, `last-light-dawns`, `last-light-sensitivity`, `last-light-volume` and `last-light-muted`.

**Timing and view**
- The world updates at a fixed **120 Hz** (`TICK_HZ`). Frames draw on `requestAnimationFrame` and blend positions with the clock's `alpha`.
- **Turning never waits:** `input.js` owns your facing, which changes on each `mousemove`, and frames draw with it directly.
- The internal view is the whole-number scale nearest **270 px tall**, with the width filling the window up to 21:9. The vertical half-angle's tangent is **0.5625**, which is 90° across at 16:9.
- The canvas has `image-rendering: pixelated` and image smoothing off, and is scaled up in one `drawImage`.

**Art**
- Every image comes from a Lua script in `art/last-light/` (the island from `art/site/`). Scripts are run from the repo root with `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/<name>.lua`.
- Rebuilding is **deterministic**: use `L.rnd` and never `math.random`. The rebuild loop reproduces every committed file byte for byte:
  `for s in textures sky sprites hands hud icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done`
- `art/last-light/palette.lua` holds every colour. Its `order` is the palette index, so colours are only ever added at the end. World images (textures, sky, sprites) use palette colours only, at full opacity; `lib.lua`'s writers check this. The hands and HUD are drawn as images and may use alpha.
- Scripts write editable `.aseprite` files to `art/last-light/`, and PNG and JSON to `last-light/assets/`. `preview-*.png` files are review images and aren't committed.

**Content**
- The creatures, place and story are original. Nothing is taken from any book, and no real culture's beliefs, names or history are used. Keep the words plain (the Hungry, crawlers, gaunts, leapers, the Mother).

**Git and publishing**
- Work on branch `last-light` (already created, with the spec committed as `0fb5228`). Commit after each task, and end every commit message with the attribution lines from the session's system reminder.
- Nathan pre-approved publishing to `main` when the game is done (2026-09-24). Only Task 13 publishes. Before a fast-forward push, always run `git fetch` and merge `origin/main`. Never force-push.
- Playwright screenshots are saved only under `/Users/nathan/Documents/code/.playwright-mcp/`.

**Tests**
- `cd /Users/nathan/Documents/code/games/last-light && npm test`. Every task leaves the whole suite green.
- Tasks that touch the games page also run `cd /Users/nathan/Documents/code/games/site && npm test` (69 tests before Task 12).

## Refinements to the spec

These follow from the spec but are decided here, so reviewers can see them in one place. Most came from running the prototype.

1. **Build order.** The spec builds the walkable page at step 4. Here, the browser comes together once, in Task 10, after the pure modules and the art exist. The prototype already measured the frame rate (3 ms bench; about 2.5 ms of script per frame in Chrome at 427×240), and doing it once avoids writing `main.js` three times. The bench arrives with the renderer, in Task 3.
2. **The style test.** Its sheet (Task 6) shows the palette, every texture at three light levels, the sky, and the crawler and gaunt. Its "mock first-person frame" is the engine's own render of that art: the screenshot in Task 10. It isn't hand-painted. Nathan gets both as previews, and building doesn't wait on him.
3. **The Mother fits through gaps.** Every creature's collision `radius` is under 0.5 (the Mother's is 0.45), so everything fits through the doorway and any one-cell gap. The Mother's sprite and her `hit` width stay large. The prototype's bot found her wedged in a one-cell gap by the woodpile, soft-locking the 4 AM wave.
4. **Her births** only happen while the wave has room under its alive cap.
5. **The woodpile** sits two cells east of the cabin (x 26–27), leaving a two-cell gap.
6. **The stove's light** is full to 2.5 cells and dark by 8, so its glow spills out of the windows and doorway onto the snow.
7. **A leaper** circles while it sees you, and keeps circling through up to 0.5 s out of sight (`CREATURES.leaper.lostSight`). Its `circleT` is kept between circles and cleared on landing. If a wall cuts a leap short, it "rushes": it comes straight in and pounces from close range (`closeLeap`), skipping the circle until it next lands. The crawler-style bite remains as a fallback.
8. **The shot's width.** A creature's `hit` width (how wide it is to a shot) is separate from its collision `radius`.
9. **Weapon switches.** Asking for the gun you already hold, or the one already coming up, does nothing. The prototype's bot found that re-pressing restarted the switch forever.
10. **`?wave=N`** is 1-based (1–8), so `?wave=8` shows the Mother, as the spec's browser check says. From wave 3 (11 PM) on, you start with the shotgun.
11. **Extra modules:**
    - `events.js` (the event pool), `lightmap.js` (the light grid), `scene.js` (state to frame), `effects.js` (the hit spray), `bot.js` (`?debug=bot`), `bench.js`
    - the test helpers: `test/helpers.js`, `render-helpers.js`, `fake-art.js`, `fake-audio.js`
12. **The pause menu** is a small HTML form over the canvas (sliders and buttons), so it works with the keyboard and screen readers. Resuming needs a click, because pointer lock does.
13. **The death and dawn screens.** With the mouse still locked, a click starts the next night, but only after 2.5 s, so a panicked click doesn't skip the screen.
14. **The spray** is cosmetic: droplets driven by the frame clock (`effects.js`), drawn as lit pixels. It's kept out of the simulation.
15. **The wave banners:**
    - 9 PM: "They're coming out of the trees."
    - 11 PM: "Something leaps in the dark."
    - 4 AM: "Something huge is coming."
    - the first lull: "Warm up by the stove."
    - the shotgun: "1 and 2 switch guns".

## Review Focus

These are the five inputs most likely to break the game for a real player that the spec's tests don't name. Each is pinned by a test in the task that owns the code:

1. **A browser mouse glitch.** A single `mousemove` with a huge `movementX` (Chrome sometimes sends one when the pointer lock starts) should be ignored, not spin you round. Pinned by `input.test.js` (Task 9).
2. **Losing focus or the pointer lock** while holding W and the trigger, then resuming. Expected: no running and no firing on resume, and no reload or flare queued from a key pressed on the pause menu. Pinned by `input.test.js` (Task 9).
3. **A creature that can't reach you.** A creature (especially the Mother) must not get stuck behind the cabin or in a gap, because that soft-locks the wave. Expected: creatures path round the cabin and through the doorway. Pinned by `creatures.test.js` and `flowfield.test.js` (Task 4).
4. **Mashing weapon keys, or a trackpad fling of wheel events, mid-switch.** Expected: at most one switch, never stuck lowered. Pinned by `weapons.test.js` (Task 4) and `input.test.js` (Task 9).
5. **A hidden tab, sleep, or a long hitch mid-wave.** Expected: at most one update runs, and the night doesn't fast-forward and kill you unseen. The game also pauses when the tab hides. Pinned by `clock.test.js` (Task 1) and checked in the browser in Task 10.

## File Structure

```
art/last-light/
  .gitignore        preview-*.png (review images aren't committed)
  palette.lua       every colour; `order` is the palette index; glow list; named colours
  lib.lua           paths, JSON, buffers, noise, dither, drawing, saving, and the sheet writers
                    (writePalette, checkPalette, writeTextures, writeSprites, writePieces)
  textures.lua      -> last-light/assets/palette.json, textures.png, textures.json
  sky.lua           -> last-light/assets/sky.png (the night panorama)
  sprites.lua       -> last-light/assets/sprites.png, sprites.json (creatures, props, pickups, flare)
  hands.lua         -> last-light/assets/hands.png, hands.json (the guns and lantern in your hands)
  hud.lua           -> last-light/assets/hud.png, hud.json (HUD icons)
  icon.lua          -> last-light/icon.png (48x48 tab icon)
  style-test.lua    -> art/last-light/preview-style.png (review only; not in the rebuild loop)
  *.aseprite        editable sources the scripts write
art/site/island-last-light.lua   the games-page island (Task 12)
last-light/
  index.html        canvas, font, pause menu, messages; loads src/main.js
  package.json      {"type":"module"} + test and bench scripts
  bench.js          npm run bench: renderer timing in Node
  icon.png          tab icon (from icon.lua)
  assets/           generated art (committed)
  src/tuning.js     every number
  src/clock.js      fixed-step clock with alpha
  src/rng.js        seeded random numbers
  src/storage.js    safe localStorage
  src/map.js        the text-grid map and its parsing
  src/events.js     the per-update event pool
  src/collide.js    circle vs grid and circle vs circle
  src/player.js     your movement and health
  src/view.js       internal size, scale, field of view
  src/raycast.js    DDA casting and line of sight
  src/shade.js      palette light tables and dither
  src/lightmap.js   the light grid (baked stove + moving lights)
  src/render.js     draws the world into the pixel buffer
  src/flowfield.js  BFS paths towards you
  src/creatures.js  the Hungry
  src/weapons.js    rifle, shotgun, flares, hitscan
  src/night.js      waves, lulls, pickups, stove, dawn, death
  src/sim.js        createState + step
  src/bot.js        ?debug=bot
  src/assets.js     loading and unpacking the art
  src/effects.js    the hit spray
  src/scene.js      state -> the renderer's frame
  src/hud.js        hands, HUD, screens
  src/input.js      keyboard, raw mouse, pointer lock
  src/music.js      the score's rules
  src/audio.js      Web Audio
  src/game.js       screens, flow, best night
  src/main.js       boot, loop, wiring
  test/*.test.js    node --test suites, with helpers.js, render-helpers.js, fake-art.js, fake-audio.js
```

---

## Phase 1: The simulation's foundations

### Task 1: Scaffold, tuning and timing

**Files:**
- Create: `last-light/package.json`, `last-light/src/tuning.js`, `last-light/src/rng.js`, `last-light/src/storage.js`, `last-light/src/clock.js`
- Test: `last-light/test/clock.test.js`, `last-light/test/rng.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `tuning.js`: `TICK_HZ` (120), `DT`, `PLAYER`, `VIEW`, `MOUSE`, `LIGHT`, `RIFLE`, `SHOTGUN`, `SWITCH_TIME`, `FLARE`, `SHELL_BOX`, `CREATURES`, `MAX_CREATURES`, `NIGHT`, `FEEL` and `KEYS`. Every later task reads its numbers from here.
  - `rng.js`: `createRng(seed) → { s }`, `nextRandom(rng) → [0, 1)` and `randomBetween(rng, lo, hi)`.
  - `storage.js`: `safeStorage(backend?) → { get(key) → string|null, set(key, value) }`. It never throws.
  - `clock.js`: `createClock({ hz, maxTicksPerFrame = 8, maxGapMs = 250 }?) → { alpha, advance(now) → ticks, reset() }`.

- [ ] **Step 1: Write the package file and the failing tests**

`last-light/package.json`:
```json
{
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.js",
    "bench": "node bench.js"
  }
}
```

`last-light/test/clock.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/clock.js';

const TICK = 1000 / 120;

test('the first frame runs no updates', () => {
  const c = createClock();
  assert.equal(c.advance(1000), 0);
  assert.equal(c.alpha, 0);
});

test('a 60 Hz display gets two updates a frame, a 144 Hz display about 5 in 6', () => {
  const c = createClock();
  c.advance(0);
  let total = 0;
  for (let i = 1; i <= 60; i++) total += c.advance((i * 1000) / 60);
  assert.equal(total, 120);
  const d = createClock();
  d.advance(0);
  total = 0;
  for (let i = 1; i <= 144; i++) total += d.advance((i * 1000) / 144);
  assert.ok(total === 119 || total === 120, `ran ${total}`);
});

test('alpha is how far the frame sits between two updates', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(TICK * 1.5), 1);
  assert.ok(Math.abs(c.alpha - 0.5) < 1e-9, `alpha ${c.alpha}`);
  assert.equal(c.advance(TICK * 1.75), 0);
  assert.ok(Math.abs(c.alpha - 0.75) < 1e-9, `alpha ${c.alpha}`);
});

test('a long gap (hidden tab, sleep) runs one update, not a burst', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(5000), 1);
});

test('a slow frame is capped at 8 updates and drops the rest', () => {
  const c = createClock();
  c.advance(0);
  assert.equal(c.advance(200), 8);
  assert.equal(c.alpha, 0);
});

test('timestamps coarsened to 0.1 ms still give exactly one update per tick', () => {
  const c = createClock();
  c.advance(0);
  let total = 0;
  for (let i = 1; i <= 120; i++) total += c.advance(Math.round(i * TICK * 10) / 10);
  assert.equal(total, 120);
});

test('reset forgets the time spent paused', () => {
  const c = createClock();
  c.advance(0);
  c.advance(100);
  c.reset();
  assert.equal(c.advance(10000), 0);
  assert.equal(c.advance(10000 + TICK), 1);
});
```

`last-light/test/rng.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, nextRandom, randomBetween } from '../src/rng.js';

test('the same seed gives the same sequence, in [0, 1)', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const x = nextRandom(a);
    assert.equal(x, nextRandom(b));
    assert.ok(x >= 0 && x < 1);
  }
});

test('randomBetween stays in its range', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const x = randomBetween(r, 2, 4);
    assert.ok(x >= 2 && x < 4);
  }
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL. Both files error with `Cannot find module '.../src/clock.js'` (and `rng.js`).

- [ ] **Step 3: Write the modules**

`last-light/src/tuning.js`:
```js
// Every number the game plays by. Distances are in grid cells, times in seconds, angles in radians.
// Play-testing changes go here.
export const TICK_HZ = 120;
export const DT = 1 / TICK_HZ;

export const PLAYER = {
  radius: 0.25,
  walk: 3.0,
  run: 4.8,
  accelTime: 0.1, // from standing to full speed
  stopTime: 0.08, // from full speed to standing
  health: 100,
};

export const VIEW = {
  targetHeight: 270, // internal pixels; 1080p is exactly 4x
  tanHalfV: 0.5625, // fixed vertical half-angle: 90 degrees across at 16:9
  maxAspect: 21 / 9,
  bobPixels: 1.5, // head bob height at walking speed, in internal pixels at 270 tall
};

export const MOUSE = {
  sensitivity: 0.0025, // radians per count at 1x
  minScale: 0.25,
  maxScale: 4,
  spike: 600, // a single event moving more than this many counts is a browser glitch, and is ignored
};

export const LIGHT = {
  lantern: { full: 3, dark: 7, intensity: 1 },
  flare: { full: 1.5, dark: 4, intensity: 1.1 },
  stove: { full: 2.5, dark: 8, intensity: 1 },
  muzzle: { full: 2, dark: 6, intensity: 0.8, time: 0.05 },
  eyes: { full: 12, dark: 16 }, // glowing eyes fade out between these distances
  // The sky's light by hour index (0 = 9 PM ... 7 = 4 AM); dawn brightens to `dawn`.
  night: [0.03, 0.03, 0.035, 0.04, 0.045, 0.05, 0.06, 0.08],
  dawn: 0.85,
  dawnTime: 8, // seconds for the sun to come up
};

export const RIFLE = { damage: 10, rounds: 8, interval: 0.45, reloadPerRound: 0.4, range: 40 };
export const SHOTGUN = {
  pellets: 8,
  damage: 7,
  spread: (6 * Math.PI) / 180, // each side of the crosshair
  falloff: 4, // half damage past this distance
  interval: 0.25,
  reload: 1.2,
  shells: 2,
  foundWith: 8,
  maxSpare: 30,
  range: 20,
};
export const SWITCH_TIME = 0.25; // lowering one gun and raising the other
export const FLARE = { start: 2, max: 5, throw: 6, burn: 10, radius: 4, slow: 0.5, damage: 1.5, cooldown: 0.5 };
export const SHELL_BOX = 6;

export const CREATURES = {
  crawler: { radius: 0.22, hit: 0.3, health: 10, speed: 4.0, reach: 0.35, damage: 6, interval: 0.7, firstBite: 0.25, flinch: 0.12 },
  gaunt: { radius: 0.3, hit: 0.32, health: 45, speed: 1.6, reach: 0.9, windup: 0.45, damage: 25, interval: 1.5, flinch: 0.06 },
  leaper: {
    radius: 0.25, hit: 0.3, health: 20, speed: 3.4, reach: 0.35, damage: 8, interval: 0.8, flinch: 0.12,
    circleAt: 5, circleSpeed: 3.0, circleMin: 2, circleMax: 4, crouch: 0.5, leapSpeed: 9, leapTime: 1.0,
    pounce: 20, land: 0.6, closeLeap: 2,
  },
  mother: {
    radius: 0.45, hit: 0.7, health: 500, speed: 1.3, reach: 1.4, windup: 0.6, damage: 40, interval: 2, flinch: 0,
    birthEvery: 10, births: 2,
  },
  // `hit` is how wide a creature is to a shot (its sprite), `radius` how wide it is to walls and others.
  // Every radius stays under 0.5, so everything fits through the doorway and any one-cell gap.
  die: 0.6, // seconds the death animation plays
  sightRange: 10, // creatures head straight for you when they can see you this close; otherwise they path
  pushWeight: { crawler: 1, gaunt: 2.5, leaper: 1, mother: 8 },
};
export const MAX_CREATURES = 64;

export const NIGHT = {
  dusk: 6,
  lull: 20,
  spawnEvery: 0.6,
  aliveCap: (wave) => 8 + 2 * wave, // wave counts from 1
  stoveHeal: 25,
  stoveReach: 1.5,
  pickupReach: 0.6,
  spawnAway: 8, // trails closer than this to you aren't used, when others are free
  shotgunBefore: 2, // the shotgun appears in the lull before wave index 2 (11 PM)
  // One row per hour, 9 PM to 4 AM.
  waves: [
    { crawler: 6, gaunt: 0, leaper: 0, mother: 0 },
    { crawler: 10, gaunt: 1, leaper: 0, mother: 0 },
    { crawler: 12, gaunt: 2, leaper: 2, mother: 0 },
    { crawler: 14, gaunt: 3, leaper: 3, mother: 0 },
    { crawler: 16, gaunt: 4, leaper: 4, mother: 0 },
    { crawler: 20, gaunt: 5, leaper: 5, mother: 0 },
    { crawler: 24, gaunt: 6, leaper: 6, mother: 0 },
    { crawler: 10, gaunt: 2, leaper: 2, mother: 1 },
  ],
  hours: ['9 PM', '10 PM', '11 PM', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM'],
};

export const FEEL = {
  kick: { rifle: 0.035, shotgun: 0.07 }, // view kick, radians, springs back
  kickReturn: 14, // per second
  shake: { shotgun: 1.5 }, // pixels
  shakeTime: 0.12,
  hurtTime: 0.35,
  lowHealth: 30,
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  rifle: ['Digit1'],
  shotgun: ['Digit2'],
  flare: ['KeyF'],
  mute: ['KeyM'],
};
```

`last-light/src/rng.js`:
```js
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
```

`last-light/src/storage.js` (the same as Marrow's):
```js
// localStorage can throw (private windows, blocked site data), so every access goes through here.
// When it fails, the game just doesn't remember things.
function defaultBackend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function safeStorage(backend = defaultBackend()) {
  return {
    get(key) {
      try {
        return backend ? backend.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        backend?.setItem(key, String(value));
      } catch {
        // not saved; the game still works
      }
    },
  };
}
```

`last-light/src/clock.js`:
```js
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 9 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/package.json last-light/src last-light/test
git commit -m "Last Light: tuning, seeded random numbers, safe storage and the fixed-step clock"
```

---

### Task 2: The map, collision and you

**Files:**
- Create: `last-light/src/map.js`, `last-light/src/events.js`, `last-light/src/collide.js`, `last-light/src/player.js`
- Test: `last-light/test/helpers.js`, `last-light/test/map.test.js`, `last-light/test/collide.test.js`, `last-light/test/player.test.js`

**Interfaces:**
- Consumes:
  - From Task 1: `PLAYER`, `FEEL` (in `tuning.js`).
- Produces:
  - `map.js`:
    - `MAP_ROWS` (40 strings of 40 characters) and `WALLS`.
    - `parseMap(rows?) → map`. The map object is `{ w, h, solid, wall, wallKinds, roofed, blocked, passLight, props, spawns, start, spots }`, laid out as `map.js`'s comment says.
    - `isSolid(map, cx, cy)` (outside the map counts as solid) and `isRoofed(map, cx, cy)`.
  - `events.js`:
    - `MAX_EVENTS` (128) and `createEvents()`.
    - `emit(state, type, x?, y?, a?, b?)`. It writes into `state.events[state.eventCount++]`, and the event types are listed in the file's comment.
  - `collide.js`:
    - `moveBody(map, body, dx, dy) → touchedWall`, which slides and sub-steps. `body` is `{ x, y, radius }`.
    - `pushOutOfCircle(body, cx, cy, cr)`.
    - `separate(a, b, wa?, wb?)`.
  - `player.js`:
    - `createPlayer(start) → { x, y, px, py, vx, vy, radius, facing, health, walked, running }`.
    - `movePlayer(map, p, intents, dt)`.
    - `hurtPlayer(state, amount, x, y)`, which uses `state.player`, `state.god` and `state.hurt`, and emits `hurt`.
  - `test/helpers.js`: `room(rows?)`, `near(a, b, eps?)` and `intents(over?)`. An intent is `{ facing, forward, strafe, run, fire, flare, reload, weapon, weaponStep }`.
- Coordinates:
  - x runs east and y runs south, down the rows. A facing angle of 0 looks east, and π/2 looks south.
  - Positions are in cells: the centre of cell (3, 4) is (3.5, 4.5).
- The map was generated and checked: every open cell is reachable from the start without crossing walls or props, and the woodpile leaves a two-cell gap (Refinement 5). Copy the rows exactly.

- [ ] **Step 1: Write the test helpers and the failing tests**

`last-light/test/helpers.js` (Task 4 extends it):
```js
// Shared test helpers.
import { parseMap } from '../src/map.js';

// A small map from rows; by default an open 12x12 room with the start in the middle.
export function room(rows) {
  return parseMap(
    rows ?? [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#.....@....#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
  );
}

export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Intents for one update, all idle; override what a test needs.
export function intents(over = {}) {
  return { facing: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0, ...over };
}
```

`last-light/test/map.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_ROWS, parseMap, isSolid, isRoofed } from '../src/map.js';

const map = parseMap();

test('the map is 40x40, walled all round', () => {
  assert.equal(MAP_ROWS.length, 40);
  for (const row of MAP_ROWS) assert.equal(row.length, 40);
  for (let i = 0; i < 40; i++) {
    assert.ok(isSolid(map, i, 0) && isSolid(map, i, 39) && isSolid(map, 0, i) && isSolid(map, 39, i));
  }
  assert.ok(isSolid(map, -1, 5) && isSolid(map, 5, 40), 'outside the map is solid');
});

test('it has six trails, a start, the three supply spots and the props', () => {
  assert.equal(map.spawns.length, 6);
  for (const s of map.spawns) assert.ok(s && !isSolid(map, Math.floor(s.x), Math.floor(s.y)));
  assert.deepEqual(map.start, { x: 19.5, y: 20.5, facing: Math.PI / 2 });
  assert.deepEqual(Object.keys(map.spots).sort(), ['flare', 'shells', 'shotgun']);
  assert.deepEqual(map.props.map((p) => p.kind).sort(), ['pine', 'pine', 'pine', 'pine', 'stove', 'well']);
});

test('every open cell can be reached from the start without crossing walls or props', () => {
  const { w, h } = map;
  const seen = new Uint8Array(w * h);
  const q = [Math.floor(map.start.y) * w + Math.floor(map.start.x)];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop();
    for (const n of [i + 1, i - 1, i + w, i - w]) {
      if (!seen[n] && !map.blocked[n]) {
        seen[n] = 1;
        q.push(n);
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (!map.blocked[i]) assert.ok(seen[i], `cell ${i % w},${Math.floor(i / w)} is cut off`);
});

test('the cabin: logs, two windows that let light out, a doorway, a roof and the stove', () => {
  assert.ok(isRoofed(map, 19, 15) && isRoofed(map, 19, 18), 'floor and doorway are roofed');
  assert.ok(!isRoofed(map, 19, 20), 'the porch is open sky');
  assert.ok(!isSolid(map, 19, 18), 'the doorway is open');
  assert.equal(map.passLight[18 * 40 + 17], 1);
  assert.equal(map.passLight[18 * 40 + 21], 1);
  const kind = (x, y) => map.wallKinds[map.wall[y * 40 + x]];
  assert.deepEqual(kind(15, 15), { ns: 'logs', ew: 'logs' });
  assert.deepEqual(kind(10, 24), { ns: 'wagonSide', ew: 'wagonEnd' });
  assert.deepEqual(kind(0, 0), { ns: 'trunks', ew: 'trunks' });
});

test('a bad row or character is reported', () => {
  assert.throws(() => parseMap(['###', '##']), /row 1/);
  assert.throws(() => parseMap(['###', '#?#', '###']), /unknown character "\?"/);
});
```

`last-light/test/collide.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, pushOutOfCircle, separate } from '../src/collide.js';
import { room, near } from './helpers.js';

test('moving into a wall slides along it instead of stopping', () => {
  const map = room();
  const b = { x: 1.4, y: 5.5, radius: 0.25 };
  const hit = moveBody(map, b, -0.5, 0.3);
  assert.ok(hit);
  assert.ok(near(b.x, 1.25), `x ${b.x}`);
  assert.ok(near(b.y, 5.8), `y ${b.y}`);
});

test('a long move never passes through a wall', () => {
  const map = room(['#####', '#...#', '#.#.#', '#...#', '#####']);
  const b = { x: 1.5, y: 2.5, radius: 0.25 };
  moveBody(map, b, 0.95, 0);
  assert.ok(b.x <= 1.75 + 1e-9, `x ${b.x}`);
});

test('running along a wall past its corner rounds it smoothly', () => {
  // A wall block at cell (3, 1) only; running east just below it.
  const map = room(['#######', '#..#..#', '#.....#', '#.....#', '#######']);
  const b = { x: 2.5, y: 2.2, radius: 0.25 };
  // Starts overlapping the block's underside: pushed down to y = 2.25 and keeps going east.
  let lastX = b.x;
  for (let i = 0; i < 40; i++) {
    moveBody(map, b, 0.04, 0);
    assert.ok(b.x > lastX, 'never stops');
    lastX = b.x;
  }
  assert.ok(b.x > 4, `made it past, x ${b.x}`);
  assert.ok(near(b.y, 2.25), `y ${b.y}`);
});

test('a circle is pushed out of a prop, and two bodies apart by weight', () => {
  const b = { x: 5.3, y: 5, radius: 0.25 };
  assert.ok(pushOutOfCircle(b, 5, 5, 0.45));
  assert.ok(near(Math.hypot(b.x - 5, b.y - 5), 0.7));
  const a = { x: 0, y: 0, radius: 0.5 }, c = { x: 0.6, y: 0, radius: 0.5 };
  assert.ok(separate(a, c, 1, 3));
  assert.ok(near(c.x - a.x, 1));
  assert.ok(near(a.x, -0.3) && near(c.x, 0.7), `${a.x} ${c.x}`);
  assert.ok(!separate(a, c));
});
```

`last-light/test/player.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, movePlayer } from '../src/player.js';
import { PLAYER, DT } from '../src/tuning.js';
import { room, intents, near } from './helpers.js';

const speed = (p) => Math.hypot(p.vx, p.vy);

test('walking reaches full speed within 0.1 s, running too', () => {
  const map = room();
  const p = createPlayer({ x: 3.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1 }), DT);
  assert.ok(near(speed(p), PLAYER.walk), `walk ${speed(p)}`);
  const q = createPlayer({ x: 3.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, q, intents({ forward: 1, run: true }), DT);
  assert.ok(near(speed(q), PLAYER.run), `run ${speed(q)}`);
});

test('letting go stops you within 0.08 s, even from a run', () => {
  const map = room();
  const p = createPlayer({ x: 2.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1, run: true }), DT);
  for (let i = 0; i < 10; i++) movePlayer(map, p, intents(), DT);
  assert.equal(speed(p), 0);
});

test('diagonal input is no faster than straight', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ forward: 1, strafe: 1 }), DT);
  assert.ok(near(speed(p), PLAYER.walk), `${speed(p)}`);
});

test('strafe right moves to your right: south, when facing east', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  for (let i = 0; i < 12; i++) movePlayer(map, p, intents({ strafe: 1 }), DT);
  assert.ok(p.y > 5.5 && near(p.x, 5.5), `${p.x} ${p.y}`);
});

test('the last position is kept for blending, and the facing follows the intent', () => {
  const map = room();
  const p = createPlayer({ x: 5.5, y: 5.5, facing: 0 });
  movePlayer(map, p, intents({ forward: 1, facing: 1 }), DT);
  assert.equal(p.px, 5.5);
  assert.equal(p.facing, 1);
  assert.ok(p.walked > 0);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL, with `Cannot find module` for `map.js`, `collide.js` and `player.js`. The 9 tests from Task 1 still pass.

- [ ] **Step 3: Write the modules**

`last-light/src/map.js`:
```js
// The clearing, as a text grid: one character per cell, rows top (north) to bottom (south). x runs
// east along a row and y south down the rows, so a facing angle of 0 looks east and PI / 2 looks south.
// Positions are in cells: the centre of cell (3, 4) is (3.5, 4.5).
//
//   #  pines (the forest wall)       .  snow
//   L  cabin logs                    ,  cabin floor (under the roof)
//   W  cabin window (lets light out) D  doorway (open, under the roof)
//   P  woodpile                      G  wagon (its sides face north and south)
//   S  stove (a prop, in the cabin)  O  well (a prop)       T  lone pine (a prop)
//   1-6  where each trail's creatures come out
//   @  where you start, facing south
//   f  where flares turn up          s  where shells turn up     g  where the shotgun turns up
export const MAP_ROWS = [
  '########################################',
  '########################################',
  '########################################',
  '###############..#######################',
  '###############5.#######################',
  '###############..#######################',
  '###############...######################',
  '################......#########.########',
  '################........######.6.#######',
  '##############............###...########',
  '############...............#...#########',
  '###########...................##########',
  '##########...................###########',
  '##########.....LLLLLLLLL.....###########',
  '#########..T...L,,,S,,,L......##########',
  '###.4..##......L,,,,,,,L.......#########',
  '###............L,,,,,,,L..PP....########',
  '######.........L,,,,,,,L.........#######',
  '########.......LLWLDLWLL.........#######',
  '########....................T....#######',
  '########.........f.@.s...........#######',
  '########.........................#######',
  '#########.........................######',
  '#########.g..........................###',
  '#########GGG....................#..1.###',
  '#########.................O....#########',
  '#########......................#########',
  '#########....T................##########',
  '##########..............T...############',
  '#########...................############',
  '########...##..............#############',
  '#######.3.######....##...###############',
  '########.#############..################',
  '######################...###############',
  '#######################..###############',
  '#######################.2###############',
  '#######################..###############',
  '########################################',
  '########################################',
  '########################################',
];

// What each wall character is drawn with. The wagon shows its side on north and south faces, its end
// on east and west faces.
export const WALLS = {
  '#': { ns: 'trunks', ew: 'trunks' },
  L: { ns: 'logs', ew: 'logs' },
  W: { ns: 'window', ew: 'window' },
  P: { ns: 'woodpile', ew: 'woodpile' },
  G: { ns: 'wagonSide', ew: 'wagonEnd' },
};
const ROOFED = new Set([',', 'D', 'S']);
const PROPS = { S: { kind: 'stove', radius: 0.35 }, O: { kind: 'well', radius: 0.45 }, T: { kind: 'pine', radius: 0.3 } };

// Parses rows into the map the game uses:
//   w, h            size in cells
//   solid           Uint8Array, 1 where a cell is a wall (movement, shots and sight stop there)
//   wall            Uint8Array, the index into `wallKinds` of each wall cell (0 for open cells)
//   wallKinds       [{ ns, ew }] texture names, in first-seen order, from index 1
//   roofed          Uint8Array, 1 under the cabin roof (planks below, rafters above)
//   blocked         Uint8Array, 1 where creatures may not path: walls and prop cells
//   passLight       Uint8Array, 1 for window cells (static light shines through them)
//   props           [{ kind, x, y, radius }] at cell centres
//   spawns          [{ x, y }] trail ends in order 1-6
//   start           { x, y, facing }
//   spots           { flare, shells, shotgun } as { x, y }
export function parseMap(rows = MAP_ROWS) {
  const h = rows.length, w = rows[0].length;
  const size = w * h;
  const map = {
    w, h,
    solid: new Uint8Array(size), wall: new Uint8Array(size), wallKinds: [null],
    roofed: new Uint8Array(size), blocked: new Uint8Array(size), passLight: new Uint8Array(size),
    props: [], spawns: [], start: null, spots: {},
  };
  const kindIndex = new Map();
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`map row ${y} is ${rows[y].length} wide, not ${w}`);
    for (let x = 0; x < w; x++) {
      const c = rows[y][x], i = y * w + x;
      if (WALLS[c]) {
        if (!kindIndex.has(c)) {
          kindIndex.set(c, map.wallKinds.length);
          map.wallKinds.push(WALLS[c]);
        }
        map.solid[i] = 1;
        map.blocked[i] = 1;
        map.wall[i] = kindIndex.get(c);
        if (c === 'W') map.passLight[i] = 1;
        continue;
      }
      if (ROOFED.has(c)) map.roofed[i] = 1;
      if (PROPS[c]) {
        map.props.push({ kind: PROPS[c].kind, x: x + 0.5, y: y + 0.5, radius: PROPS[c].radius });
        map.blocked[i] = 1;
      } else if (c >= '1' && c <= '6') map.spawns[c - 1] = { x: x + 0.5, y: y + 0.5 };
      else if (c === '@') map.start = { x: x + 0.5, y: y + 0.5, facing: Math.PI / 2 };
      else if (c === 'f') map.spots.flare = { x: x + 0.5, y: y + 0.5 };
      else if (c === 's') map.spots.shells = { x: x + 0.5, y: y + 0.5 };
      else if (c === 'g') map.spots.shotgun = { x: x + 0.5, y: y + 0.5 };
      else if (c !== '.' && c !== ',' && c !== 'D') throw new Error(`map cell ${x},${y} has an unknown character "${c}"`);
    }
  }
  return map;
}

// Outside the map counts as solid, so nothing ever walks or sees off the edge.
export function isSolid(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return true;
  return map.solid[cy * map.w + cx] === 1;
}

export function isRoofed(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return false;
  return map.roofed[cy * map.w + cx] === 1;
}
```

`last-light/src/events.js`:
```js
// What happened during an update, for sound, effects and the HUD to react to. The events live in a
// fixed pool that each update reuses, so nothing is allocated: read state.events[0 .. eventCount).
//
//   type          x, y            a                    b
//   shot          you             0 rifle, 1 shotgun
//   dry           you             weapon               (fired with nothing loaded)
//   reload        you             weapon               (a round or both shells went in)
//   switch        you             weapon now raising
//   hit           the creature    kind                 1 if it died
//   flareThrow    where it lands
//   flareOut      where it was
//   hurt          the attacker    damage
//   windup        the creature    kind                 (a gaunt or the Mother winding up)
//   shriek        the leaper                           (crouching to leap)
//   leap          the leaper
//   birth         the Mother
//   spawn         the creature    kind
//   pickup        the spot        0 flare, 1 shells, 2 shotgun
//   wave          -               wave index
//   lull          -               the next wave's index
//   dawn / dead   -
export const MAX_EVENTS = 128;

export function createEvents() {
  return Array.from({ length: MAX_EVENTS }, () => ({ type: '', x: 0, y: 0, a: 0, b: 0 }));
}

export function emit(state, type, x = 0, y = 0, a = 0, b = 0) {
  if (state.eventCount >= MAX_EVENTS) return;
  const e = state.events[state.eventCount++];
  e.type = type;
  e.x = x;
  e.y = y;
  e.a = a;
  e.b = b;
}
```

`last-light/src/collide.js`:
```js
// Circles against the grid and against each other. A move is split into short steps, and after each
// step the circle is pushed out of any wall cell it overlaps, along the shortest way out. That slides
// a body along walls and rounds it smoothly past corners instead of catching on them, and a step is
// never long enough to pass through a wall.
import { isSolid } from './map.js';

function pushOutOfWalls(map, body) {
  const r = body.radius;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const x0 = Math.floor(body.x - r), x1 = Math.floor(body.x + r);
    const y0 = Math.floor(body.y - r), y1 = Math.floor(body.y + r);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!isSolid(map, cx, cy)) continue;
        const nx = Math.max(cx, Math.min(body.x, cx + 1));
        const ny = Math.max(cy, Math.min(body.y, cy + 1));
        const dx = body.x - nx, dy = body.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2), push = r - d;
          body.x += (dx / d) * push;
          body.y += (dy / d) * push;
        } else {
          // The centre is inside the cell (only possible if something placed it there): leave by the
          // nearest side.
          const left = body.x - cx, right = cx + 1 - body.x, up = body.y - cy, down = cy + 1 - body.y;
          const m = Math.min(left, right, up, down);
          if (m === left) body.x = cx - r;
          else if (m === right) body.x = cx + 1 + r;
          else if (m === up) body.y = cy - r;
          else body.y = cy + 1 + r;
        }
      }
    }
  }
  return hit;
}

// Moves `body` ({ x, y, radius }) by (dx, dy), sliding along walls. Returns true if it touched one.
export function moveBody(map, body, dx, dy) {
  const stepLen = body.radius * 0.5;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / stepLen));
  let hit = false;
  for (let i = 0; i < steps; i++) {
    body.x += dx / steps;
    body.y += dy / steps;
    if (pushOutOfWalls(map, body)) hit = true;
  }
  return hit;
}

// Pushes `body` out of a fixed circle (a prop). Returns true if they overlapped.
export function pushOutOfCircle(body, cx, cy, cr) {
  const dx = body.x - cx, dy = body.y - cy;
  const min = body.radius + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-9) body.x += min; // exactly on top: any way out will do
  else {
    body.x = cx + (dx / d) * min;
    body.y = cy + (dy / d) * min;
  }
  return true;
}

// Pushes two bodies apart so they just touch. Each moves in proportion to the other's weight, so a
// heavy body barely shifts. Returns true if they overlapped.
export function separate(a, b, wa = 1, wb = 1) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const min = a.radius + b.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  let d = Math.sqrt(d2), ux, uy;
  if (d < 1e-9) {
    ux = 1;
    uy = 0;
    d = 0;
  } else {
    ux = dx / d;
    uy = dy / d;
  }
  const overlap = min - d, total = wa + wb;
  a.x -= ux * overlap * (wb / total);
  a.y -= uy * overlap * (wb / total);
  b.x += ux * overlap * (wa / total);
  b.y += uy * overlap * (wa / total);
  return true;
}
```

`last-light/src/player.js`:
```js
// You: a circle that walks and runs with snappy acceleration, slides along walls and round props,
// and remembers where it was last update so the renderer can blend between the two.
import { PLAYER, FEEL } from './tuning.js';
import { moveBody, pushOutOfCircle } from './collide.js';
import { emit } from './events.js';

const ACCEL = PLAYER.run / PLAYER.accelTime;
const DECEL = PLAYER.run / PLAYER.stopTime;

export function createPlayer(start) {
  return {
    x: start.x, y: start.y, px: start.x, py: start.y,
    vx: 0, vy: 0, radius: PLAYER.radius, facing: start.facing,
    health: PLAYER.health, walked: 0, running: false,
  };
}

// intents: { facing, forward (-1..1), strafe (-1..1, positive is right), run }
export function movePlayer(map, p, intents, dt) {
  p.px = p.x;
  p.py = p.y;
  p.facing = intents.facing;
  const c = Math.cos(p.facing), s = Math.sin(p.facing);
  let wx = intents.forward * c - intents.strafe * s;
  let wy = intents.forward * s + intents.strafe * c;
  const wl = Math.hypot(wx, wy);
  if (wl > 1) {
    wx /= wl;
    wy /= wl;
  }
  p.running = intents.run && wl > 0;
  const max = p.running ? PLAYER.run : PLAYER.walk;
  const tx = wx * max, ty = wy * max;
  const dvx = tx - p.vx, dvy = ty - p.vy;
  const dl = Math.hypot(dvx, dvy);
  const step = (wl > 0 ? ACCEL : DECEL) * dt;
  if (dl <= step) {
    p.vx = tx;
    p.vy = ty;
  } else {
    p.vx += (dvx / dl) * step;
    p.vy += (dvy / dl) * step;
  }
  moveBody(map, p, p.vx * dt, p.vy * dt);
  for (const prop of map.props) pushOutOfCircle(p, prop.x, prop.y, prop.radius);
  p.walked += Math.hypot(p.x - p.px, p.y - p.py);
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 23 tests. If a map test fails, compare `MAP_ROWS` with the plan character by character: every row is 40 wide.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test
git commit -m "Last Light: the clearing's map, sliding collision, and your movement"
```

---

### Task 3: The renderer

**Files:**
- Create: `last-light/src/view.js`, `last-light/src/raycast.js`, `last-light/src/shade.js`, `last-light/src/lightmap.js`, `last-light/src/render.js`, `last-light/bench.js`
- Test: `last-light/test/render-helpers.js`, `last-light/test/view.test.js`, `last-light/test/raycast.test.js`, `last-light/test/shade.test.js`, `last-light/test/lightmap.test.js`, `last-light/test/render.test.js`

**Interfaces:**
- Consumes:
  - From Task 1: `VIEW` and `LIGHT`.
  - From Task 2: `parseMap`, `isSolid` and the map fields `wall`, `wallKinds`, `roofed` and `passLight`.
  - From `test/helpers.js`: `room` and `near`.
- Produces:
  - `view.js`: `chooseView(cssW, cssH, dpr?) → { dw, dh, scale, w, h, focal, plane, ox, oy }`.
  - `raycast.js`:
    - `createHit()` and `castRay(map, px, py, rdx, rdy, hit, maxDist?) → bool`. The hit is `{ dist, side, cellX, cellY, kind, face ('ns'|'ew'), u }`.
    - `canSee(map, ax, ay, bx, by)`.
  - `shade.js`: `LEVELS` (16), `FOG`, `BAYER`, `hexToRgb`, `buildShades(colors, glowSet?) → { table, fade, emissive }` and `levelAt(light, x, y)`.
  - `lightmap.js`:
    - `RES` (4 samples per cell), `falloff(d, full, dark)` and `createLightmap(map)`.
    - `bakeStatic(lm, map, lights)`, `beginLight(lm, ambient)`, `addLight(lm, x, y, full, dark, intensity)` and `lightAt(lm, x, y)`.
  - `render.js`:
    - `TEX` (32) and `createRenderer(art, map) → { buffer, resize(view), draw(frame) }`.
    - `art` is `{ shades, walls: {name: Uint8Array col-major}, floors: {snow, planks, rafters: row-major}, sky: {w, h, px}, flake, ichor }`.
    - `frame` is `{ x, y, facing, bob, map, lightmap, skyLevel, time, sprites: [{ x, y, height, lift, frame: {w, h, px col-major}, flip, glow }], spriteCount, snow, drops? }`.
    - `drops` (the hit spray, Task 7) is optional here. When it's present, its live droplets are drawn as lit points in the `art.ichor` colour.
  - `bench.js`: `npm run bench` prints `480x270: N ms a frame (target under 4 ms)`.

- [ ] **Step 1: Write the failing tests**

`last-light/test/render-helpers.js`:
```js
// A tiny art set for renderer tests: every texture is one flat palette colour, so a pixel's colour
// says what was drawn there.
import { buildShades } from '../src/shade.js';
import { TEX } from '../src/render.js';

export const IDX = { trunks: 1, logs: 2, window: 3, woodpile: 4, wagonSide: 5, wagonEnd: 6, snow: 7, planks: 8, rafters: 9, sky: 10, body: 11, eye: 12, flake: 13 };
const colors = Object.keys(IDX).map((_, i) => `#${(40 + i * 12).toString(16)}${(200 - i * 9).toString(16)}${(90 + i * 7).toString(16)}`);

export function testArt() {
  const flat = (i) => new Uint8Array(TEX * TEX).fill(i);
  return {
    shades: buildShades(colors, new Set([IDX.eye])),
    walls: { trunks: flat(1), logs: flat(2), window: flat(3), woodpile: flat(4), wagonSide: flat(5), wagonEnd: flat(6) },
    floors: { snow: flat(7), planks: flat(8), rafters: flat(9) },
    sky: { w: 64, h: 40, px: new Uint8Array(64 * 40).fill(10) },
    flake: 13,
  };
}

// The palette index a pixel was drawn from at full light, or null.
export function drawnAt(art, buf, w, x, y) {
  const v = buf[y * w + x];
  for (const i of Object.values(IDX)) if (art.shades.table[(15 << 8) | i] === v) return i;
  return null;
}
```

`last-light/test/view.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseView } from '../src/view.js';

test('1080p is exactly 4x: 480x270, 90 degrees across', () => {
  const v = chooseView(1920, 1080, 1);
  assert.deepEqual([v.scale, v.w, v.h, v.ox, v.oy], [4, 480, 270, 0, 0]);
  assert.ok(Math.abs(v.plane - 1) < 1e-9);
});

test('other screens pick the scale nearest 270 tall, and the width fills the window', () => {
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(2560, 1440, 1)), [5, 512, 288]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(1440, 900, 2)), [7, 412, 258]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(1280, 720, 1)), [3, 427, 240]);
  assert.deepEqual(((v) => [v.scale, v.w, v.h])(chooseView(300, 200, 1)), [1, 300, 200]);
});

test('the scaled view covers the window, cropping at most one pixel each way', () => {
  for (const [w, h, d] of [[1440, 900, 2], [1280, 720, 1], [1366, 768, 1], [1536, 864, 1.25]]) {
    const v = chooseView(w, h, d);
    assert.ok(v.w * v.scale >= v.dw && v.w * v.scale - v.dw < v.scale, `${w}x${h}@${d}`);
    assert.ok(v.h * v.scale >= v.dh && v.h * v.scale - v.dh < v.scale, `${w}x${h}@${d}`);
  }
});

test('past 21:9 the view stops widening and sits between bars', () => {
  const v = chooseView(3440 * 1.2, 1440, 1);
  assert.equal(v.w, Math.floor(288 * (21 / 9)));
  assert.ok(v.ox > 0);
});

test('a wider window sees more to the sides, with the same vertical field of view', () => {
  const a = chooseView(1920, 1080, 1), b = chooseView(2520, 1080, 1);
  assert.equal(a.focal, b.focal);
  assert.ok(b.plane > a.plane);
});
```

`last-light/test/raycast.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castRay, createHit, canSee } from '../src/raycast.js';
import { parseMap } from '../src/map.js';
import { room, near } from './helpers.js';

test('a ray east hits the east wall at the right distance and face', () => {
  const hit = createHit();
  assert.ok(castRay(room(), 6.5, 5.5, 1, 0, hit));
  assert.ok(near(hit.dist, 4.5));
  assert.deepEqual([hit.side, hit.cellX, hit.cellY, hit.face], [0, 11, 5, 'ew']);
  assert.ok(near(hit.u, 0.5));
});

test('rays exactly along grid lines and diagonals', () => {
  const hit = createHit();
  const map = room();
  assert.ok(castRay(map, 6, 5, 0, -1, hit));
  assert.ok(near(hit.dist, 4));
  assert.equal(hit.face, 'ns');
  assert.ok(castRay(map, 6.5, 6.5, Math.SQRT1_2, Math.SQRT1_2, hit));
  assert.ok(near(hit.dist, Math.SQRT2 * 4.5));
});

test('u runs left to right across a wall as you see it, whichever way you face', () => {
  const hit = createHit();
  const map = room();
  const u = (x, y, dx, dy) => (castRay(map, x, y, dx, dy, hit), hit.u);
  // Each pair of rays lands on the same wall cell, one a little left of the other.
  // Facing east, left is north.
  assert.ok(u(6.5, 5.5, 1, -0.05) < u(6.5, 5.5, 1, 0.05));
  // Facing west, left is south.
  assert.ok(u(6.5, 5.5, -1, 0.05) < u(6.5, 5.5, -1, -0.05));
  // Facing south, left is east.
  assert.ok(u(6.5, 5.5, 0.05, 1) < u(6.5, 5.5, -0.05, 1));
  // Facing north, left is west.
  assert.ok(u(6.5, 5.5, -0.05, -1) < u(6.5, 5.5, 0.05, -1));
});

test('camera rays give depth along the facing, not the slanted length', () => {
  const hit = createHit();
  assert.ok(castRay(room(), 6.5, 5.5, 1, 0.5, hit));
  assert.ok(near(hit.dist, 4.5));
});

test('the wagon shows its side facing north and south, its end east and west', () => {
  const map = parseMap();
  const hit = createHit();
  castRay(map, 10.5, 22.5, 0, 1, hit);
  assert.equal(map.wallKinds[hit.kind][hit.face], 'wagonSide');
  castRay(map, 14.5, 24.5, -1, 0, hit);
  assert.equal(map.wallKinds[hit.kind][hit.face], 'wagonEnd');
});

test('a ray that runs past maxDist hits nothing; sight is blocked by walls', () => {
  const hit = createHit();
  assert.equal(castRay(room(), 6.5, 5.5, 1, 0, hit, 3), false);
  assert.equal(hit.dist, Infinity);
  const map = parseMap();
  assert.ok(canSee(map, 19.5, 21.5, 19.5, 24.5));
  assert.ok(!canSee(map, 16.5, 21.5, 16.5, 15.5), 'the cabin wall is in the way');
  assert.ok(!canSee(map, 17.5, 21.5, 17.5, 15.5), 'windows block sight and shots');
  assert.ok(canSee(map, 19.5, 21.5, 19.5, 15.5), 'the doorway does not');
});
```

`last-light/test/shade.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShades, levelAt, FOG, BAYER } from '../src/shade.js';

const rgb = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];

test('level 0 is the fog, and brightness rises with every level', () => {
  const { table } = buildShades(['#c0c0c0']);
  assert.deepEqual(rgb(table[(0 << 8) | 1]), [...FOG, 255]);
  let last = -1;
  for (let l = 0; l < 16; l++) {
    const [r, g, b] = rgb(table[(l << 8) | 1]);
    const sum = r + g + b;
    assert.ok(sum > last, `level ${l}`);
    last = sum;
  }
});

test('full light is warm (lantern amber), dim light is cold', () => {
  const { table } = buildShades(['#c0c0c0']);
  const [r15, , b15] = rgb(table[(15 << 8) | 1]);
  const [r4, , b4] = rgb(table[(4 << 8) | 1]);
  assert.ok(r15 > b15, 'warm');
  assert.ok(b4 > r4, 'cold');
});

test('glowing colours ignore light in the table, and fade by level in `fade`', () => {
  const { table, fade, emissive } = buildShades(['#c0c0c0', '#ff3020'], new Set([2]));
  assert.equal(emissive[2], 1);
  assert.deepEqual(rgb(table[(0 << 8) | 2]), [255, 48, 32, 255]);
  assert.deepEqual(rgb(fade[(15 << 8) | 2]), [255, 48, 32, 255]);
  assert.deepEqual(rgb(fade[(0 << 8) | 2]), [...FOG, 255]);
  assert.equal(fade[(7 << 8) | 1], table[(7 << 8) | 1], 'plain colours are the same in both');
});

test('index 0 stays transparent, and too many colours is an error', () => {
  const { table } = buildShades(['#ffffff']);
  assert.equal(table[(15 << 8) | 0], 0);
  assert.throws(() => buildShades(Array(256).fill('#000000')), /255/);
});

test('light between two levels dithers between them', () => {
  const seen = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(levelAt(0.5, x, y));
  assert.deepEqual([...seen].sort((a, b) => a - b), [7, 8]);
  assert.equal(levelAt(0, 3, 3), 0);
  assert.equal(levelAt(5, 0, 0), 15);
  assert.equal(BAYER.length, 16);
});
```

`last-light/test/lightmap.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLightmap, bakeStatic, beginLight, addLight, lightAt, falloff } from '../src/lightmap.js';
import { parseMap } from '../src/map.js';
import { LIGHT } from '../src/tuning.js';
import { room, near } from './helpers.js';

test('falloff is full inside `full`, smooth to nothing at `dark`', () => {
  assert.equal(falloff(1, 3, 7), 1);
  assert.equal(falloff(7, 3, 7), 0);
  assert.ok(near(falloff(5, 3, 7), 0.5));
});

test('a moving light adds to ambient, and fades with distance', () => {
  const map = room();
  const lm = createLightmap(map);
  beginLight(lm, 0.05);
  assert.ok(near(lightAt(lm, 6, 6), 0.05));
  addLight(lm, 6, 6, 1, 4, 1);
  assert.ok(lightAt(lm, 6, 6) > 1);
  assert.ok(lightAt(lm, 8, 6) < lightAt(lm, 7, 6));
  assert.ok(near(lightAt(lm, 11.5, 11.5), 0.05));
});

test('the stove lights the cabin and spills out of the windows, not through the logs', () => {
  const map = parseMap();
  const lm = createLightmap(map);
  const stove = map.props.find((p) => p.kind === 'stove');
  bakeStatic(lm, map, [{ x: stove.x, y: stove.y, ...LIGHT.stove }]);
  beginLight(lm, 0);
  assert.ok(lightAt(lm, 19.5, 15.5) > 0.5, 'inside');
  assert.ok(lightAt(lm, 16.8, 20) > 0.1, 'out of the west window, onto the snow');
  assert.ok(near(lightAt(lm, 15.5, 19.5), 0), 'but not through the logs beside it');
  assert.ok(near(lightAt(lm, 19.5, 12.5), 0), 'behind the back wall');
});

test('beginLight wipes the last frame`s moving lights', () => {
  const lm = createLightmap(room());
  beginLight(lm, 0);
  addLight(lm, 6, 6, 1, 4, 1);
  beginLight(lm, 0);
  assert.equal(lightAt(lm, 6, 6), 0);
});

test('lightAt is safe at and past the map edge', () => {
  const lm = createLightmap(room());
  beginLight(lm, 0.1);
  for (const [x, y] of [[0, 0], [-3, 5], [12, 12], [50, -2]]) assert.ok(Number.isFinite(lightAt(lm, x, y)));
});
```

`last-light/test/render.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/render.js';
import { chooseView } from '../src/view.js';
import { parseMap } from '../src/map.js';
import { createLightmap, beginLight, addLight } from '../src/lightmap.js';
import { room } from './helpers.js';
import { testArt, drawnAt, IDX } from './render-helpers.js';

const view = chooseView(480, 270, 1);

function setup(map, ambient = 1) {
  const art = testArt();
  const r = createRenderer(art, map);
  r.resize(view);
  const lm = createLightmap(map);
  beginLight(lm, ambient);
  const frame = (over) => ({ x: 6.5, y: 5.5, facing: 0, bob: 0, map, lightmap: lm, skyLevel: 15, time: 0, sprites: [], spriteCount: 0, snow: false, ...over });
  return { art, r, lm, frame };
}

test('facing a wall 4.5 cells away: wall at the horizon, sky above it, snow below', () => {
  const { art, r, frame } = setup(room());
  r.draw(frame());
  const { w, h, focal } = view;
  const at = (x, y) => drawnAt(art, r.buffer, w, x, y);
  const x = w / 2;
  const half = focal / 4.5 / 2;
  assert.equal(at(x, h / 2), IDX.trunks);
  assert.equal(at(x, Math.floor(h / 2 - half) - 2), IDX.sky);
  assert.equal(at(x, Math.ceil(h / 2 + half) + 2), IDX.snow);
  assert.equal(at(x, Math.floor(h / 2 - half) + 2), IDX.trunks);
});

test('a sprite in front of the wall is drawn; one behind the wall is hidden', () => {
  const { art, r, frame } = setup(room());
  const body = { w: 2, h: 2, px: new Uint8Array(4).fill(IDX.body) };
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.8, frame: body }], spriteCount: 1 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h / 2 + 10), IDX.body);
  r.draw(frame({ sprites: [{ x: 12.5, y: 5.5, height: 0.8, frame: body }], spriteCount: 1 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h / 2 + 5), IDX.trunks);
});

test('glowing eyes show in the dark, and fade with the sprite glow level', () => {
  const { art, r, frame } = setup(room(), 0);
  const eyes = { w: 1, h: 1, px: new Uint8Array([IDX.eye]) };
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.5, frame: eyes, glow: 15 }], spriteCount: 1 }));
  const px = r.buffer[(view.h / 2 + 20) * view.w + view.w / 2];
  assert.equal(px, art.shades.table[(15 << 8) | IDX.eye]);
  r.draw(frame({ sprites: [{ x: 8.5, y: 5.5, height: 0.5, frame: eyes, glow: 4 }], spriteCount: 1 }));
  assert.equal(r.buffer[(view.h / 2 + 20) * view.w + view.w / 2], art.shades.fade[(4 << 8) | IDX.eye]);
});

test('a light brightens the snow near it', () => {
  const { r, lm, frame } = setup(room(), 0);
  const y = view.h - 3, x = view.w / 2;
  r.draw(frame());
  const dark = r.buffer[y * view.w + x];
  addLight(lm, 6.5, 5.5, 3, 7, 1);
  r.draw(frame());
  assert.notEqual(r.buffer[y * view.w + x], dark);
});

test('inside the cabin you see rafters overhead, not sky', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI / 2 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, 0), IDX.rafters);
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h - 1), IDX.planks);
});

test('falling snow shows outside, never under the roof', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  const count = () => {
    let n = 0;
    for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) if (drawnAt(art, r.buffer, view.w, x, y) === IDX.flake) n++;
    return n;
  };
  r.draw(frame({ x: 19.5, y: 25.5, facing: Math.PI / 2, snow: true, time: 3 }));
  assert.ok(count() > 20, 'flakes outside');
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI, snow: true, time: 3 }));
  assert.equal(count(), 0, 'none indoors, looking at the wall');
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL. The five new files can't find their modules.

- [ ] **Step 3: Write the modules**

`last-light/src/view.js`:
```js
// The view's size for a window. The world is drawn at a low internal resolution and scaled up by a
// whole number: the one that makes the view closest to 270 pixels tall (1080p is exactly 4x, giving
// 480x270). The width fills the window, so a wider window sees more to the sides, up to 21:9; past
// that the view stops widening and sits centred between dark bars. The vertical field of view is
// fixed; pixels are square, so one focal length serves both directions.
import { VIEW } from './tuning.js';

export function chooseView(cssW, cssH, dpr = 1) {
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(cssH * dpr));
  const scale = Math.max(1, Math.round(dh / VIEW.targetHeight));
  const h = Math.ceil(dh / scale);
  const w = Math.max(1, Math.min(Math.ceil(dw / scale), Math.floor(h * VIEW.maxAspect)));
  const focal = h / 2 / VIEW.tanHalfV; // pixels per unit of lateral offset at depth 1
  return {
    dw, dh, scale, w, h, focal,
    plane: w / 2 / focal, // tan of the horizontal half-angle
    ox: Math.floor((dw - w * scale) / 2), // where the scaled view sits in the device-pixel canvas
    oy: Math.floor((dh - h * scale) / 2),
  };
}
```

`last-light/src/raycast.js`:
```js
// Grid ray casting (DDA): steps a ray cell by cell until it enters a solid cell. Used for every
// screen column of the walls, and for shots, sight and flares.
import { isSolid } from './map.js';

// A reusable result, so casting allocates nothing.
export function createHit() {
  return { dist: Infinity, side: 0, cellX: 0, cellY: 0, kind: 0, face: 'ns', u: 0 };
}

// Casts from (px, py) along (rdx, rdy), which needn't be a unit vector: `dist` comes back in multiples
// of it. With a camera ray (facing + plane * cameraX) that's the depth along the facing; with a unit
// vector it's the true distance. Returns false (dist = Infinity) if nothing is hit within maxDist.
//   side  0 if it hit a cell's east or west face, 1 for north or south
//   face  'ew' or 'ns', to pick the wall's texture
//   u     where along the face it hit, 0..1, left to right as the viewer sees it
export function castRay(map, px, py, rdx, rdy, hit, maxDist = 64) {
  let mapX = Math.floor(px), mapY = Math.floor(py);
  const deltaX = rdx === 0 ? Infinity : Math.abs(1 / rdx);
  const deltaY = rdy === 0 ? Infinity : Math.abs(1 / rdy);
  let stepX, stepY, sideX, sideY;
  if (rdx < 0) {
    stepX = -1;
    sideX = (px - mapX) * deltaX;
  } else {
    stepX = 1;
    sideX = (mapX + 1 - px) * deltaX;
  }
  if (rdy < 0) {
    stepY = -1;
    sideY = (py - mapY) * deltaY;
  } else {
    stepY = 1;
    sideY = (mapY + 1 - py) * deltaY;
  }
  let side = 0, dist = 0;
  for (;;) {
    if (sideX < sideY) {
      dist = sideX;
      sideX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      dist = sideY;
      sideY += deltaY;
      mapY += stepY;
      side = 1;
    }
    if (dist > maxDist) {
      hit.dist = Infinity;
      return false;
    }
    if (isSolid(map, mapX, mapY)) break;
  }
  hit.dist = dist;
  hit.side = side;
  hit.cellX = mapX;
  hit.cellY = mapY;
  const inside = mapX >= 0 && mapY >= 0 && mapX < map.w && mapY < map.h;
  hit.kind = inside ? map.wall[mapY * map.w + mapX] : 1;
  if (side === 0) {
    let f = py + dist * rdy;
    f -= Math.floor(f);
    hit.face = 'ew';
    hit.u = rdx > 0 ? f : 1 - f;
  } else {
    let f = px + dist * rdx;
    f -= Math.floor(f);
    hit.face = 'ns';
    hit.u = rdy > 0 ? 1 - f : f;
  }
  return true;
}

// True if nothing solid lies between two points.
const sightHit = createHit();
export function canSee(map, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return true;
  return !castRay(map, ax, ay, dx / d, dy / d, sightHit, d);
}
```

`last-light/src/shade.js`:
```js
// Colours and light. Textures and sprites are stored as palette indices (0 is transparent), and light
// is applied with pre-shaded colour tables, as in Doom: 16 light levels per palette colour, from the
// night's blue-black fog up to warm lantern amber. `table[level << 8 | index]` is a pixel ready for
// the buffer (RGBA, as a little-endian Uint32 over ImageData).
//
// Glowing colours (eyes, embers, the window's glow) ignore light. In `table` they're always full; in
// `fade` they fade into the fog by level instead, so a sprite can dim its eyes with distance.
export const LEVELS = 16;
export const FOG = [6, 8, 14];
const COLD = [0.7, 0.8, 1.0];
const WARM = [1.08, 0.92, 0.72];

// A 4x4 ordered-dither threshold in [0, 1), by (y & 3) << 2 | (x & 3): light between two levels is
// shown as a pattern of both.
export const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => v / 16);

const pack = (r, g, b) => ((255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
const clamp = (v) => Math.max(0, Math.min(255, v));

export function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// colors: ["#rrggbb", ...] for palette indices 1..n; glow: the set of indices that ignore light.
export function buildShades(colors, glow = new Set()) {
  if (colors.length > 255) throw new Error(`the palette has ${colors.length} colours; at most 255 fit`);
  const table = new Uint32Array(LEVELS * 256);
  const fade = new Uint32Array(LEVELS * 256);
  const emissive = new Uint8Array(256);
  colors.forEach((hex, n) => {
    const i = n + 1;
    const [r, g, b] = hexToRgb(hex);
    if (glow.has(i)) emissive[i] = 1;
    for (let l = 0; l < LEVELS; l++) {
      const k = l / (LEVELS - 1);
      const t = Math.pow(k, 1.4);
      const tint = [0, 1, 2].map((c) => COLD[c] + (WARM[c] - COLD[c]) * k);
      const lit = [r, g, b].map((v, c) => clamp(FOG[c] + (v * tint[c] - FOG[c]) * t));
      const faded = [r, g, b].map((v, c) => clamp(FOG[c] + (v - FOG[c]) * k));
      table[(l << 8) | i] = emissive[i] ? pack(r, g, b) : pack(...lit);
      fade[(l << 8) | i] = emissive[i] ? pack(...faded) : table[(l << 8) | i];
    }
  });
  return { table, fade, emissive };
}

// The light level (0..15) for a light value (0 = dark, 1 = full) at screen pixel (x, y), dithered.
export function levelAt(light, x, y) {
  const l = (light * (LEVELS - 1) + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
  return l < 0 ? 0 : l > LEVELS - 1 ? LEVELS - 1 : l;
}
```

`last-light/src/lightmap.js`:
```js
// Light over the ground, on a grid four samples to a cell. Static light (the stove) is baked once,
// with walls casting shadows, except windows, which let it spill out onto the snow. Moving lights
// (your lantern, flares, the muzzle flash) are added each frame over just the samples they reach,
// without shadows. The renderer reads it with lightAt().
import { canSee } from './raycast.js';

export const RES = 4;

export function falloff(d, full, dark) {
  if (d <= full) return 1;
  if (d >= dark) return 0;
  const t = (dark - d) / (dark - full);
  return t * t * (3 - 2 * t);
}

export function createLightmap(map) {
  const w = map.w * RES, h = map.h * RES;
  return { w, h, baked: new Float32Array(w * h), cur: new Float32Array(w * h), ambient: 0 };
}

// Sight for baking: like canSee, but windows don't block.
function lit(map, ax, ay, bx, by) {
  if (canSee(map, ax, ay, bx, by)) return true;
  // Walk the segment in small steps, letting light through window cells only.
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 8);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(ax + ((bx - ax) * i) / n), y = Math.floor(ay + ((by - ay) * i) / n);
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    const c = y * map.w + x;
    if (map.solid[c] && !map.passLight[c]) return false;
  }
  return true;
}

// lights: [{ x, y, full, dark, intensity }], fixed for the whole night.
export function bakeStatic(lm, map, lights) {
  lm.baked.fill(0);
  for (let sy = 0; sy < lm.h; sy++) {
    for (let sx = 0; sx < lm.w; sx++) {
      const x = (sx + 0.5) / RES, y = (sy + 0.5) / RES;
      let v = 0;
      for (const L of lights) {
        const d = Math.hypot(x - L.x, y - L.y);
        if (d >= L.dark) continue;
        // A sample inside a wall takes the light of the open side, so test from just outside it.
        if (lit(map, L.x, L.y, x, y) || lit(map, L.x, L.y, x + (L.x - x) * (0.3 / d), y + (L.y - y) * (0.3 / d))) {
          v += L.intensity * falloff(d, L.full, L.dark);
        }
      }
      lm.baked[sy * lm.w + sx] = v;
    }
  }
}

// Starts a frame's light from the baked light and the sky's ambient light.
export function beginLight(lm, ambient) {
  lm.cur.set(lm.baked);
  lm.ambient = ambient;
}

// Adds one moving light (no shadows) over the samples within its reach.
export function addLight(lm, x, y, full, dark, intensity) {
  const x0 = Math.max(0, Math.floor((x - dark) * RES)), x1 = Math.min(lm.w - 1, Math.ceil((x + dark) * RES));
  const y0 = Math.max(0, Math.floor((y - dark) * RES)), y1 = Math.min(lm.h - 1, Math.ceil((y + dark) * RES));
  for (let sy = y0; sy <= y1; sy++) {
    const dy = (sy + 0.5) / RES - y;
    for (let sx = x0; sx <= x1; sx++) {
      const dx = (sx + 0.5) / RES - x;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dark) lm.cur[sy * lm.w + sx] += intensity * falloff(d, full, dark);
    }
  }
}

// The light at a world point: the four nearest samples blended, plus ambient.
export function lightAt(lm, x, y) {
  let fx = x * RES - 0.5, fy = y * RES - 0.5;
  if (fx < 0) fx = 0;
  else if (fx > lm.w - 1.001) fx = lm.w - 1.001;
  if (fy < 0) fy = 0;
  else if (fy > lm.h - 1.001) fy = lm.h - 1.001;
  const ix = fx | 0, iy = fy | 0;
  const tx = fx - ix, ty = fy - iy, i = iy * lm.w + ix, c = lm.cur;
  const top = c[i] + (c[i + 1] - c[i]) * tx;
  const bottom = c[i + lm.w] + (c[i + lm.w + 1] - c[i + lm.w]) * tx;
  return lm.ambient + top + (bottom - top) * ty;
}
```

`last-light/src/render.js`. It's the one hot loop in the game. Its floor loop inlines `lightAt`, and it's allocation-free. Don't "tidy" these away:
```js
// Draws the world into a pixel buffer: the sky, the walls, the snow and floorboards, the rafters under
// the cabin roof, the sprites and the falling snow, all lit from the lightmap. It's arithmetic on
// typed arrays and allocates nothing per frame, so it runs (and is tested and timed) in Node too.
//
// art (see assets.js):
//   shades   { table, fade, emissive } from shade.js
//   walls    { name: Uint8Array(32 * 32) }, column-major (index x * 32 + y), palette indices
//   floors   { snow, planks, rafters: Uint8Array(32 * 32) }, row-major
//   sky      { w, h, px: Uint8Array }, row-major; a panorama whose bottom row sits on the horizon
//   flake    the palette index falling snow is drawn in
//   ichor    the palette index of the spray when a creature is hit
import { castRay, createHit } from './raycast.js';
import { BAYER, LEVELS } from './shade.js';
import { lightAt, RES } from './lightmap.js';

export const TEX = 32;
const TOP = LEVELS - 1;
const FLAKES = 300;
const SNOW_BOX = 12; // flakes fill a box this many cells across, centred on you
const SNOW_TOP = 1.3;

// Deterministic per-flake numbers in [0, 1).
function hash(i, k) {
  let n = (i * 374761393 + k * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(art, map) {
  const { table, fade, emissive } = art.shades;
  const wallTex = map.wallKinds.map((k) => k && { ns: art.walls[k.ns], ew: art.walls[k.ew] });
  for (let i = 1; i < wallTex.length; i++) {
    for (const f of ['ns', 'ew']) if (!wallTex[i][f]) throw new Error(`no wall texture "${map.wallKinds[i][f]}"`);
  }
  const { snow, planks, rafters } = art.floors;
  const sky = art.sky;
  const flakes = new Float32Array(FLAKES * 4);
  for (let i = 0; i < FLAKES; i++) {
    flakes[i * 4] = hash(i, 1) * SNOW_BOX;
    flakes[i * 4 + 1] = hash(i, 2) * SNOW_BOX;
    flakes[i * 4 + 2] = hash(i, 3); // fall phase
    flakes[i * 4 + 3] = 0.25 + hash(i, 4) * 0.25; // fall speed, cells per second
  }
  const hit = createHit();
  let w = 0, h = 0, focal = 1, plane = 1;
  let buf, zbuf, wallTop, wallBot, rayX, rayY, skyCol, order, depths;
  // This frame's camera, shared with point().
  let cx = 0, cy = 0, dirX = 1, dirY = 0, hz = 0, lm = null;

  // A point in the world (height z) as one lit pixel, or a 2x2 block up close, hidden by walls.
  function point(wx, wy, z, idx) {
    const rx = wx - cx, ry = wy - cy;
    const depth = rx * dirX + ry * dirY;
    if (depth < 0.2) return;
    const sxp = (w / 2 + ((rx * -dirY + ry * dirX) / depth) * focal) | 0;
    const syp = (hz + ((0.5 - z) * focal) / depth) | 0;
    if (sxp < 0 || sxp >= w || syp < 0 || syp >= h || depth >= zbuf[sxp]) return;
    let l = (lightAt(lm, wx, wy) * TOP + 0.5) | 0;
    if (l > TOP) l = TOP;
    if (l === 0) return;
    const c = table[(l << 8) | idx];
    buf[syp * w + sxp] = c;
    if (depth < 2 && sxp + 1 < w && syp + 1 < h) {
      buf[syp * w + sxp + 1] = c;
      buf[(syp + 1) * w + sxp] = c;
      buf[(syp + 1) * w + sxp + 1] = c;
    }
  }

  const r = {
    buffer: null,
    resize(view) {
      ({ w, h, focal, plane } = view);
      buf = new Uint32Array(w * h);
      zbuf = new Float32Array(w);
      wallTop = new Int32Array(w);
      wallBot = new Int32Array(w);
      rayX = new Float32Array(w + 1);
      rayY = new Float32Array(w + 1);
      skyCol = new Int32Array(w);
      order = new Int32Array(256);
      depths = new Float32Array(256);
      r.buffer = buf;
    },
    draw(f) {
      lm = f.lightmap;
      cx = f.x;
      cy = f.y;
      dirX = Math.cos(f.facing);
      dirY = Math.sin(f.facing);
      const rightX = -dirY * plane, rightY = dirX * plane;
      hz = Math.round(h / 2 + (f.bob || 0));
      const skyRow = (f.skyLevel | 0) << 8;

      // Walls, one column at a time.
      for (let x = 0; x <= w; x++) {
        const camX = (2 * x) / w - 1 + 1 / w;
        rayX[x] = dirX + rightX * camX;
        rayY[x] = dirY + rightY * camX;
      }
      for (let x = 0; x < w; x++) {
        const rdx = rayX[x], rdy = rayY[x];
        const ang = f.facing + Math.atan2((2 * x) / w - 1 + 1 / w, 1 / plane);
        let a = (ang / (2 * Math.PI)) % 1;
        if (a < 0) a += 1;
        skyCol[x] = (a * sky.w) | 0;
        if (!castRay(map, cx, cy, rdx, rdy, hit)) {
          zbuf[x] = Infinity;
          wallTop[x] = hz;
          wallBot[x] = hz;
          continue;
        }
        const dist = Math.max(hit.dist, 1e-4);
        zbuf[x] = dist;
        const lineH = focal / dist;
        const top = hz - lineH * 0.5;
        const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(h, Math.ceil(top + lineH - 0.5));
        wallTop[x] = y0;
        wallBot[x] = y1;
        const tex = wallTex[hit.kind][hit.face];
        let tx = (hit.u * TEX) | 0;
        if (tx > TEX - 1) tx = TEX - 1;
        const col = tx * TEX;
        // Light where the ray met the wall, pulled back a little into the open side.
        const back = 0.05 / Math.hypot(rdx, rdy);
        const light = lightAt(lm, cx + rdx * (dist - back), cy + rdy * (dist - back)) * TOP;
        const step = TEX / lineH;
        let pos = (y0 + 0.5 - top) * step;
        for (let y = y0, o = y0 * w + x; y < y1; y++, o += w, pos += step) {
          const idx = tex[col + ((pos | 0) & (TEX - 1))];
          let l = (light + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
          if (l > TOP) l = TOP;
          buf[o] = table[(l << 8) | idx];
        }
      }

      // Floor and ceiling, a row at a time: every pixel of a row is at the same depth. Above the
      // horizon it's sky, except under the cabin roof.
      const half = 0.5 * focal;
      const lmw = lm.w, cur = lm.cur, amb = lm.ambient;
      const lmMaxX = lm.w - 1.001, lmMaxY = lm.h - 1.001;
      const mw = map.w, mh = map.h, roofed = map.roofed, skyPx = sky.px;
      for (let y = 0; y < h; y++) {
        const below = y >= hz;
        const rowDist = half / (below ? y + 0.5 - hz : hz - y - 0.5);
        let wx = cx + rowDist * rayX[0], wy = cy + rowDist * rayY[0];
        const sx = (rowDist * (rayX[w] - rayX[0])) / w, sy = (rowDist * (rayY[w] - rayY[0])) / w;
        const bay = (y & 3) << 2;
        let o = y * w;
        if (!below) {
          const sr = sky.h - (hz - y);
          const skyBase = (sr < 0 ? 0 : sr) * sky.w;
          for (let x = 0; x < w; x++, o++, wx += sx, wy += sy) {
            if (y >= wallTop[x]) continue;
            const mx = wx | 0, my = wy | 0;
            if (wx < 0 || wy < 0 || mx >= mw || my >= mh || roofed[my * mw + mx] === 0) {
              buf[o] = table[skyRow | skyPx[skyBase + skyCol[x]]];
              continue;
            }
            const idx = rafters[(((wy - my) * TEX) | 0) * TEX + (((wx - mx) * TEX) | 0)];
            let l = (lightAt(lm, wx, wy) * TOP + BAYER[bay | (x & 3)]) | 0;
            if (l > TOP) l = TOP;
            buf[o] = table[(l << 8) | idx];
          }
          continue;
        }
        for (let x = 0; x < w; x++, o++, wx += sx, wy += sy) {
          if (y < wallBot[x]) continue;
          const mx = wx | 0, my = wy | 0;
          const roof = wx >= 0 && wy >= 0 && mx < mw && my < mh && roofed[my * mw + mx] === 1;
          const idx = (roof ? planks : snow)[(((wy - my) * TEX) | 0) * TEX + (((wx - mx) * TEX) | 0)];
          // lightAt, inlined: this loop covers half the screen.
          let fx = wx * RES - 0.5, fy = wy * RES - 0.5;
          if (fx < 0) fx = 0;
          else if (fx > lmMaxX) fx = lmMaxX;
          if (fy < 0) fy = 0;
          else if (fy > lmMaxY) fy = lmMaxY;
          const ix = fx | 0, iy = fy | 0, tx = fx - ix, i = iy * lmw + ix;
          const t0 = cur[i] + (cur[i + 1] - cur[i]) * tx;
          const t1 = cur[i + lmw] + (cur[i + lmw + 1] - cur[i + lmw]) * tx;
          let l = ((amb + t0 + (t1 - t0) * (fy - iy)) * TOP + BAYER[bay | (x & 3)]) | 0;
          if (l > TOP) l = TOP;
          buf[o] = table[(l << 8) | idx];
        }
      }

      // Sprites, far to near, each column hidden behind nearer walls.
      const n = Math.min(f.spriteCount, order.length);
      let m = 0;
      for (let i = 0; i < n; i++) {
        const s = f.sprites[i];
        const rx = s.x - cx, ry = s.y - cy;
        const depth = rx * dirX + ry * dirY;
        if (depth < 0.1) continue;
        // insertion sort, farthest first
        let j = m++;
        while (j > 0 && depths[j - 1] < depth) {
          depths[j] = depths[j - 1];
          order[j] = order[j - 1];
          j--;
        }
        depths[j] = depth;
        order[j] = i;
      }
      for (let k = 0; k < m; k++) {
        const s = f.sprites[order[k]];
        const depth = depths[k];
        const fr = s.frame;
        const lateral = ((s.x - cx) * -dirY + (s.y - cy) * dirX);
        const sh = (s.height * focal) / depth, sw = (sh * fr.w) / fr.h;
        const centre = w / 2 + (lateral / depth) * focal;
        const bottom = hz + ((0.5 - (s.lift || 0)) * focal) / depth;
        const top = bottom - sh, left = centre - sw / 2;
        const xa = Math.max(0, Math.ceil(left - 0.5)), xb = Math.min(w, Math.ceil(left + sw - 0.5));
        const ya = Math.max(0, Math.ceil(top - 0.5)), yb = Math.min(h, Math.ceil(bottom - 0.5));
        if (xa >= xb || ya >= yb) continue;
        const light = lightAt(lm, s.x, s.y) * TOP;
        const eyes = (s.glow ?? TOP) << 8;
        const px = fr.px, fw = fr.w, fh = fr.h;
        for (let x = xa; x < xb; x++) {
          if (depth >= zbuf[x]) continue;
          let tx = (((x + 0.5 - left) / sw) * fw) | 0;
          if (tx >= fw) tx = fw - 1;
          if (s.flip) tx = fw - 1 - tx;
          const col = tx * fh, last = col + fh - 1, step = fh / sh;
          let pos = (ya + 0.5 - top) * step;
          for (let y = ya, o = ya * w + x; y < yb; y++, o += w, pos += step) {
            let ti = col + (pos | 0);
            if (ti > last) ti = last;
            const idx = px[ti];
            if (idx === 0) continue;
            if (emissive[idx]) {
              buf[o] = fade[eyes | idx];
              continue;
            }
            let l = (light + BAYER[((y & 3) << 2) | (x & 3)]) | 0;
            if (l > TOP) l = TOP;
            buf[o] = table[(l << 8) | idx];
          }
        }
      }

      // The spray from hits.
      if (f.drops) for (const d of f.drops) if (d.t > 0) point(d.x, d.y, d.z, art.ichor);

      // Falling snow: a box of flakes that drifts with you, drawn as single pixels, hidden by walls
      // and by the cabin roof.
      if (f.snow) {
        const t = f.time;
        for (let i = 0; i < FLAKES; i++) {
          const b = i * 4;
          let fx = (flakes[b] + t * 0.35 - cx) % SNOW_BOX;
          if (fx < 0) fx += SNOW_BOX;
          let fy = (flakes[b + 1] + t * 0.12 - cy) % SNOW_BOX;
          if (fy < 0) fy += SNOW_BOX;
          const wx = cx + fx - SNOW_BOX / 2, wy = cy + fy - SNOW_BOX / 2;
          const z = SNOW_TOP - ((flakes[b + 2] + t * flakes[b + 3]) % 1) * SNOW_TOP;
          const rx = wx - cx, ry = wy - cy;
          const depth = rx * dirX + ry * dirY;
          if (depth < 0.2) continue;
          const sxp = (w / 2 + ((rx * -dirY + ry * dirX) / depth) * focal) | 0;
          const syp = (hz + ((0.5 - z) * focal) / depth) | 0;
          if (sxp < 0 || sxp >= w || syp < 0 || syp >= h || depth >= zbuf[sxp]) continue;
          const mx = wx | 0, my = wy | 0;
          if (mx >= 0 && my >= 0 && mx < map.w && my < map.h && map.roofed[my * map.w + mx]) continue;
          let l = (lightAt(lm, wx, wy) * TOP + 0.5) | 0;
          if (l > TOP) l = TOP;
          if (l > 0) buf[syp * w + sxp] = table[(l << 8) | art.flake];
        }
      }
    },
  };
  return r;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 50 tests.

- [ ] **Step 5: Write the bench and run it**

`last-light/bench.js`:
```js
// Times the renderer on a busy late-night frame at 480x270 in Node: 30 creatures, 3 flares, the
// lantern, falling snow. `npm run bench`. The target is under 4 ms a frame. Not a test, because
// timings vary from machine to machine.
import { parseMap } from './src/map.js';
import { chooseView } from './src/view.js';
import { buildShades } from './src/shade.js';
import { createLightmap, bakeStatic, beginLight, addLight } from './src/lightmap.js';
import { createRenderer, TEX } from './src/render.js';
import { LIGHT } from './src/tuning.js';

const map = parseMap();
const colors = Array.from({ length: 48 }, (_, i) => `#${((i * 2654435761) >>> 8).toString(16).padStart(6, '0').slice(0, 6)}`);
const shades = buildShades(colors, new Set([47, 48]));
const tex = (seed) => Uint8Array.from({ length: TEX * TEX }, (_, i) => 1 + ((i * 31 + seed * 17) % 46));
const art = {
  shades,
  walls: { trunks: tex(1), logs: tex(2), window: tex(3), woodpile: tex(4), wagonSide: tex(5), wagonEnd: tex(6) },
  floors: { snow: tex(7), planks: tex(8), rafters: tex(9) },
  sky: { w: 1024, h: 120, px: Uint8Array.from({ length: 1024 * 120 }, (_, i) => 1 + (i % 40)) },
  flake: 40,
};
const frame = { w: 28, h: 40, px: Uint8Array.from({ length: 28 * 40 }, (_, i) => (i % 7 === 0 ? 0 : i % 13 === 0 ? 47 : 1 + (i % 40))) };
const view = chooseView(480, 270, 1);
const renderer = createRenderer(art, map);
renderer.resize(view);
const lm = createLightmap(map);
const stove = map.props.find((p) => p.kind === 'stove');
bakeStatic(lm, map, [{ x: stove.x, y: stove.y, ...LIGHT.stove }]);

const sprites = [];
for (let i = 0; i < 30; i++) {
  const a = -0.7 + (i / 30) * 1.4, d = 2 + (i % 7);
  sprites.push({ x: 19.5 + Math.cos(Math.PI / 2 + a) * d, y: 22 + Math.sin(Math.PI / 2 + a) * d, height: 1, frame, flip: i % 2 === 0, glow: 15 });
}
const flares = [[17, 26], [22, 25], [20, 30]];
const f = { x: 19.5, y: 21, facing: Math.PI / 2, bob: 0, map, lightmap: lm, skyLevel: 3, time: 0, sprites, spriteCount: sprites.length, snow: true };

function one(t) {
  f.time = t;
  f.facing = Math.PI / 2 + Math.sin(t) * 0.3;
  beginLight(lm, 0.04);
  addLight(lm, f.x, f.y, LIGHT.lantern.full, LIGHT.lantern.dark, LIGHT.lantern.intensity);
  for (const [x, y] of flares) addLight(lm, x, y, LIGHT.flare.full, LIGHT.flare.dark, LIGHT.flare.intensity);
  renderer.draw(f);
}
for (let i = 0; i < 100; i++) one(i / 60);
const N = 600;
const t0 = performance.now();
for (let i = 0; i < N; i++) one(i / 60);
const ms = (performance.now() - t0) / N;
console.log(`${view.w}x${view.h}: ${ms.toFixed(2)} ms a frame (target under 4 ms)`);
```

Run: `cd /Users/nathan/Documents/code/games/last-light && npm run bench`
Expected: a line like `480x270: 3.1 ms a frame (target under 4 ms)`. The prototype measured 2.9–3.3 ms on this Mac. If it's over 4 ms, check that `render.js` was copied exactly (hoisted locals, the split floor and sky loops, and the inlined light), and report the number.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test last-light/bench.js
git commit -m "Last Light: the raycaster, lit through palette tables and a light grid, with its bench"
```

---

### Task 4: The Hungry, your guns, and the night

**Files:**
- Create: `last-light/src/flowfield.js`, `last-light/src/creatures.js`, `last-light/src/weapons.js`, `last-light/src/night.js`, `last-light/src/sim.js`
- Modify: `last-light/test/helpers.js` (full replacement: adds `quietState`, `run` and `runCollecting`)
- Test: `last-light/test/flowfield.test.js`, `last-light/test/creatures.test.js`, `last-light/test/weapons.test.js`, `last-light/test/night.test.js`

**Interfaces:**
- Consumes:
  - From Task 1: `tuning.js` and `rng.js`.
  - From Task 2: `map.js`, `events.js`, `collide.js` and `player.js` (including `hurtPlayer`).
  - From Task 3: `castRay`, `createHit` and `canSee`.
- Produces:
  - `flowfield.js`: `createField(map)`, `updateField(field, map, x, y) → rebuilt` and `flowDir(field, map, x, y, out) → bool`.
  - `creatures.js`:
    - The kinds: `KINDS`, and `CRAWLER` 0, `GAUNT` 1, `LEAPER` 2 and `MOTHER` 3.
    - `createCreatures(n?)` and `spawnCreature(state, kind, x, y) → creature|null`.
    - `aliveCount(state)`, `inFlare(state, x, y)`, `damageCreature(state, c, amount) → killed` and `updateCreatures(state, dt)`.
    - A creature's fields: `alive, dying, kind, x, y, px, py, radius, hp, heading, moving, walked, mode ('chase'|'windup'|'circle'|'crouch'|'leap'|'land'), t, attackT, flinch, hurtT, lift, struck, …`.
  - `weapons.js`:
    - `RIFLE_ID` 0, `SHOTGUN_ID` 1, `MAX_FLARES`, `createGun()` and `createFlares()`.
    - `traceShot(state, ox, oy, angle, range) → { creature, dist }` (the object is reused).
    - `updateGun(state, intents, dt)`, `updateFlares(state, dt)` and `giveShotgun(state)`.
    - Gun fields: `current, next, switching, cooldown, reloading, reloadT, rifle, hasShotgun, shells, spare, flares, flareT, kick, shotT`.
  - `night.js`:
    - `LAST_WAVE` (7), and `FLARE_PICKUP`, `SHELLS_PICKUP` and `SHOTGUN_PICKUP`.
    - `createNight()` and `createPickups(map)`.
    - `startWave(state, i)` and `updateNight(state, dt)`.
    - `ambientFor(night)`, `skyLevelFor(night)` and `hourLabel(night)`.
    - Night fields: `phase ('dusk'|'wave'|'lull'|'dawn'|'dead'), wave, t, queue, qn, qi, spawnT, reached, dawnT`.
  - `sim.js`:
    - `createState({ seed, wave, god, map }?)` and `step(state, intents) → state`.
    - The state's fields: `seed, rng, tick, time, god, map, field, player, maxHealth, gun, flares, creatures, pickups, stove, night, events, eventCount, flash, hurt, shake, stats: { kills }`.
  - `test/helpers.js`: adds `quietState(over?)` (a night held at dusk, with you on the porch at (19.5, 20.5) facing south), `run(state, seconds, intents?)` and `runCollecting(state, seconds, intents?) → events`.
- The modules import each other in a cycle: `creatures.js` imports `player.js`, `weapons.js` imports `creatures.js`, and `night.js` imports both. That's fine in ES modules, because nothing runs at import time except constant tables.

- [ ] **Step 1: Replace the test helpers, and write the failing tests**

`last-light/test/helpers.js` (the full file now):
```js
// Shared test helpers.
import { parseMap } from '../src/map.js';
import { createState, step } from '../src/sim.js';
import { DT } from '../src/tuning.js';

// A small map from rows; by default an open 12x12 room with the start in the middle.
export function room(rows) {
  return parseMap(
    rows ?? [
      '############',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#.....@....#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '#..........#',
      '############',
    ],
  );
}

export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Intents for one update, all idle; override what a test needs.
export function intents(over = {}) {
  return { facing: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0, ...over };
}

// A night on the real map, held in its dusk so nothing spawns unless a test starts it. You're on the
// porch at (19.5, 20.5), facing south.
export function quietState(over = {}) {
  const state = createState({ seed: 1, ...over });
  state.night.t = Infinity;
  return state;
}

// Runs `seconds` of updates with the same intents.
export function run(state, seconds, it = intents()) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(state, it);
}

// Runs `seconds` of updates and returns every event, as plain objects.
export function runCollecting(state, seconds, it = intents()) {
  const seen = [];
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    step(state, it);
    for (let k = 0; k < state.eventCount; k++) seen.push({ ...state.events[k] });
  }
  return seen;
}
```

`last-light/test/flowfield.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createField, updateField, flowDir } from '../src/flowfield.js';
import { parseMap } from '../src/map.js';

const map = parseMap();

test('the field counts steps to your cell, and only rebuilds when you change cell', () => {
  const f = createField(map);
  assert.ok(updateField(f, map, 19.5, 20.5));
  assert.equal(f.dist[20 * 40 + 19], 0);
  assert.equal(f.dist[20 * 40 + 22], 3);
  assert.equal(f.dist[0], -1, 'walls are never reached');
  assert.ok(!updateField(f, map, 19.9, 20.1));
  assert.ok(updateField(f, map, 20.1, 20.1));
});

test('from behind the cabin, the way to you leads round it, not into the back wall', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 20.5); // on the porch, south of the cabin
  const out = { x: 0, y: 0 };
  // Walk a point downhill from behind the cabin (north side) and check it arrives.
  let x = 19.5, y = 11.5;
  for (let i = 0; i < 60 && flowDir(f, map, x, y, out); i++) {
    x += out.x * 0.5;
    y += out.y * 0.5;
    const c = map.blocked[Math.floor(y) * 40 + Math.floor(x)];
    assert.equal(c, 0, `stepped into a wall at ${x.toFixed(2)},${y.toFixed(2)}`);
  }
  assert.ok(Math.floor(x) === 19 && Math.floor(y) === 20, `ended at ${x},${y}`);
});

test('into the cabin through the doorway', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 15.5); // by the stove
  const out = { x: 0, y: 0 };
  let x = 25.5, y = 21.5, throughDoor = false;
  for (let i = 0; i < 80 && flowDir(f, map, x, y, out); i++) {
    x += out.x * 0.4;
    y += out.y * 0.4;
    if (Math.floor(x) === 19 && Math.floor(y) === 18) throughDoor = true;
  }
  assert.ok(throughDoor);
  assert.equal(Math.floor(y), 15);
});

test('no corner cutting: diagonals only where both sides are open', () => {
  const f = createField(map);
  updateField(f, map, 24.5, 17.5); // just east of the cabin's south-east corner
  const out = { x: 0, y: 0 };
  // From inside the corner pocket north-east of the cabin's corner cell (23, 18): never straight through it.
  assert.ok(flowDir(f, map, 24.5, 19.5, out));
  assert.ok(!(out.x < 0 && out.y < 0) || !map.blocked[18 * 40 + 23]);
});

test('in your own cell there is no flow (head straight for you)', () => {
  const f = createField(map);
  updateField(f, map, 19.5, 20.5);
  assert.equal(flowDir(f, map, 19.2, 20.8, { x: 0, y: 0 }), false);
});
```

`last-light/test/creatures.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnCreature, damageCreature, aliveCount, CRAWLER, GAUNT, LEAPER, MOTHER } from '../src/creatures.js';
import { CREATURES, DT, FLARE } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

const types = (events) => events.map((e) => e.type);

test('a crawler runs you down and bites on a timer', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 26.5);
  const start = Math.hypot(c.x - s.player.x, c.y - s.player.y);
  run(s, 0.5);
  assert.ok(Math.hypot(c.x - s.player.x, c.y - s.player.y) < start - 1.5, 'closing at crawler speed');
  const ev = runCollecting(s, 3, intents({ facing: Math.PI / 2 }));
  const bites = ev.filter((e) => e.type === 'hurt');
  assert.ok(bites.length >= 3 && bites.length <= 5, `${bites.length} bites in 3 s`);
  assert.ok(bites.every((e) => e.a === CREATURES.crawler.damage));
});

test('a gaunt winds up before it swipes, and you can step out of the swipe', () => {
  const s = quietState();
  spawnCreature(s, GAUNT, 19.5, 21.8);
  const ev = runCollecting(s, 0.1);
  assert.ok(types(ev).includes('windup'));
  assert.ok(!types(ev).includes('hurt'), 'no damage before the wind-up ends');
  // Back away north-east, out of reach, during the wind-up: the swipe misses.
  const miss = runCollecting(s, 0.5, intents({ facing: -Math.PI / 2, forward: 1, run: true }));
  assert.ok(!types(miss).includes('hurt'));
  // Stand still next to it and it lands.
  const t = quietState();
  spawnCreature(t, GAUNT, 19.5, 21.8);
  const hit = runCollecting(t, 0.6).filter((e) => e.type === 'hurt');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].a, CREATURES.gaunt.damage);
});

test('a leaper circles, shrieks, and leaps in a straight line: sidestep it and it misses', () => {
  const s = quietState();
  const c = spawnCreature(s, LEAPER, 19.5, 26);
  const ev = runCollecting(s, 6);
  assert.ok(types(ev).includes('shriek'), 'it crouches with a shriek');
  assert.ok(types(ev).includes('leap'));
  const i = types(ev).indexOf('leap');
  assert.ok(types(ev).slice(i).includes('hurt'), 'standing still, the pounce lands');
  // Again, but sidestep as soon as it leaps.
  const t = quietState();
  const d = spawnCreature(t, LEAPER, 19.5, 26);
  let leapt = false, hurt = false;
  for (let k = 0; k < 6 / DT; k++) {
    const e = runCollecting(t, DT, intents({ facing: Math.PI / 2, strafe: leapt ? 1 : 0, run: leapt }));
    if (types(e).includes('leap')) leapt = true;
    if (leapt && types(e).includes('hurt')) hurt = true;
    if (leapt && d.mode === 'land') break;
  }
  assert.ok(leapt && !hurt, 'the sidestep dodges the pounce');
  assert.ok(c.alive);
});

test('the Mother gives birth to crawlers on her timer', () => {
  const s = quietState();
  s.night.wave = 7;
  spawnCreature(s, MOTHER, 19.5, 30);
  const ev = runCollecting(s, CREATURES.mother.birthEvery + 0.1);
  assert.equal(types(ev).filter((t) => t === 'birth').length, 1);
  assert.equal(aliveCount(s), 1 + CREATURES.mother.births);
});

test('a hit flinches a creature; enough damage kills it, and it dies over the death animation', () => {
  const s = quietState();
  const c = spawnCreature(s, GAUNT, 19.5, 30);
  assert.equal(damageCreature(s, c, 10), false);
  assert.ok(c.flinch > 0);
  assert.equal(damageCreature(s, c, 40), true);
  assert.equal(s.stats.kills, 1);
  assert.ok(c.alive && c.dying > 0);
  assert.equal(aliveCount(s), 0, 'dying creatures no longer count');
  assert.equal(damageCreature(s, c, 10), false, 'no hitting the dead');
  run(s, CREATURES.die + 0.05);
  assert.equal(c.alive, false);
});

test('in flare light creatures move at half speed and take more damage', () => {
  const s = quietState();
  const a = spawnCreature(s, CRAWLER, 12.5, 20.5);
  run(s, 0.25);
  const free = Math.hypot(a.x - 12.5, a.y - 20.5);
  const t = quietState();
  t.flares[0].x = 12.5;
  t.flares[0].y = 20.5;
  t.flares[0].t = FLARE.burn;
  const b = spawnCreature(t, CRAWLER, 12.5, 20.5);
  run(t, 0.25);
  const slowed = Math.hypot(b.x - 12.5, b.y - 20.5);
  assert.ok(Math.abs(slowed - free * FLARE.slow) < 0.05, `${slowed} vs ${free}`);
  const g = spawnCreature(t, GAUNT, 12.5, 20.5);
  damageCreature(t, g, 10);
  assert.equal(g.hp, CREATURES.gaunt.health - 10 * FLARE.damage);
});

test('a pack never piles into one spot, and never into you', () => {
  const s = quietState();
  for (let i = 0; i < 8; i++) spawnCreature(s, CRAWLER, 19.5 + (i % 3) * 0.01, 25.5);
  run(s, 2);
  const cs = s.creatures.filter((c) => c.alive);
  for (let i = 0; i < cs.length; i++) {
    const di = Math.hypot(cs[i].x - s.player.x, cs[i].y - s.player.y);
    assert.ok(di >= cs[i].radius + s.player.radius - 1e-6, 'not inside you');
    for (let j = i + 1; j < cs.length; j++) {
      const d = Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y);
      assert.ok(d >= cs[i].radius + cs[j].radius - 0.05, `crawlers ${i} and ${j} overlap: ${d}`);
    }
  }
});

test('a creature that cannot see you comes round the cabin to reach you', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 11.5); // behind the cabin
  run(s, 6);
  assert.ok(Math.hypot(c.x - s.player.x, c.y - s.player.y) < 1, `still at ${c.x},${c.y}`);
});

test('the Mother fits through the doorway', () => {
  const s = quietState();
  s.player.x = s.player.px = 19.5;
  s.player.y = s.player.py = 15.5;
  const m = spawnCreature(s, MOTHER, 19.5, 24.5);
  run(s, 12);
  assert.ok(m.y < 18, `stuck at ${m.x.toFixed(2)},${m.y.toFixed(2)}`);
});
```

`last-light/test/weapons.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceShot, RIFLE_ID, SHOTGUN_ID, giveShotgun } from '../src/weapons.js';
import { spawnCreature, CRAWLER, GAUNT } from '../src/creatures.js';
import { RIFLE, SHOTGUN, FLARE, SWITCH_TIME, CREATURES, DT } from '../src/tuning.js';
import { quietState, run, runCollecting, intents } from './helpers.js';

const south = Math.PI / 2;
const shots = (ev) => ev.filter((e) => e.type === 'shot').length;

test('the shot hits the nearest creature on the line, and walls stop it', () => {
  const s = quietState();
  const far = spawnCreature(s, GAUNT, 19.5, 28.5);
  const near = spawnCreature(s, GAUNT, 19.6, 24.5);
  assert.equal(traceShot(s, 19.5, 20.5, south, 40).creature, near);
  near.alive = false;
  assert.equal(traceShot(s, 19.5, 20.5, south, 40).creature, far);
  const behind = spawnCreature(s, CRAWLER, 19.5, 12.5); // behind the cabin's back wall
  assert.equal(traceShot(s, 19.5, 20.5, -Math.PI / 2, 40).creature, null);
  assert.ok(behind.alive);
});

test('holding fire shoots the rifle at its lever rate, 8 rounds, then it reloads by itself', () => {
  const s = quietState();
  const ev = runCollecting(s, RIFLE.interval * 7 + 0.01, intents({ facing: south, fire: true }));
  assert.equal(shots(ev), 8);
  assert.equal(s.gun.rifle, 0);
  assert.ok(s.gun.reloading);
  run(s, RIFLE.reloadPerRound * 8 + 0.02, intents({ facing: south }));
  assert.equal(s.gun.rifle, 8);
  assert.equal(s.gun.reloading, false);
});

test('reloading goes a round at a time, and firing interrupts it', () => {
  const s = quietState();
  run(s, RIFLE.interval * 3 + 0.01, intents({ facing: south, fire: true })); // 4 shots: 4 left
  assert.equal(s.gun.rifle, 4);
  run(s, DT, intents({ facing: south, reload: 1 }));
  run(s, RIFLE.reloadPerRound * 2 + 0.01, intents({ facing: south }));
  assert.equal(s.gun.rifle, 6);
  const ev = runCollecting(s, DT, intents({ facing: south, fire: true }));
  assert.equal(shots(ev), 1);
  assert.equal(s.gun.reloading, false);
  assert.equal(s.gun.rifle, 5);
});

test('a rifle shot kills a crawler, and a gaunt takes five', () => {
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 26.5);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.ok(c.dying > 0);
  const t = quietState();
  const g = spawnCreature(t, GAUNT, 19.5, 30.5);
  let n = 0;
  while (!g.dying && n < 8) {
    run(t, RIFLE.interval, intents({ facing: south, fire: true }));
    n++;
  }
  assert.equal(n, Math.ceil(CREATURES.gaunt.health / RIFLE.damage));
});

test('the shotgun: 8 pellets, both barrels, full damage close and half past 4 cells', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME + DT);
  assert.equal(s.gun.current, SHOTGUN_ID);
  assert.deepEqual([s.gun.shells, s.gun.spare], [2, SHOTGUN.foundWith - 2]);
  const near = spawnCreature(s, GAUNT, 19.5, 22.5);
  run(s, DT, intents({ facing: south, fire: true }));
  assert.ok(near.dying > 0, 'a point-blank blast kills a gaunt');
  const t = quietState();
  giveShotgun(t);
  run(t, SWITCH_TIME + DT);
  const far = spawnCreature(t, GAUNT, 19.5, 26.5);
  run(t, DT, intents({ facing: south, fire: true }));
  const taken = CREATURES.gaunt.health - far.hp;
  assert.ok(taken > 0 && taken <= (SHOTGUN.pellets * SHOTGUN.damage) / 2, `took ${taken}`);
});

test('an empty shotgun reloads both shells from the spares; with none left it goes back to the rifle', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME + DT);
  run(s, SHOTGUN.interval * 2, intents({ facing: south, fire: true }));
  assert.equal(s.gun.shells, 0);
  assert.ok(s.gun.reloading);
  run(s, SHOTGUN.reload + 0.02);
  assert.deepEqual([s.gun.shells, s.gun.spare], [2, SHOTGUN.foundWith - 4]);
  s.gun.shells = 0;
  s.gun.spare = 0;
  s.gun.reloading = false;
  run(s, SWITCH_TIME + 0.05, intents({ facing: south, fire: true }));
  assert.equal(s.gun.current, RIFLE_ID);
});

test('switching takes a moment, you cannot fire during it, and pressing again does not restart it', () => {
  const s = quietState();
  giveShotgun(s);
  run(s, SWITCH_TIME / 2, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.current, RIFLE_ID);
  const ev = runCollecting(s, SWITCH_TIME / 2 - 2 * DT, intents({ facing: south, weapon: 2, fire: true }));
  assert.equal(shots(ev), 0);
  run(s, 3 * DT, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.current, SHOTGUN_ID);
  run(s, DT, intents({ facing: south, weapon: 2 }));
  assert.equal(s.gun.switching, 0, 'asking for the gun you hold does nothing');
});

test('a flare lands ahead of you, or just short of a wall, and burns out', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, flare: 1 }));
  const f = s.flares.find((x) => x.t > 0);
  assert.ok(Math.abs(f.y - (20.5 + FLARE.throw)) < 1e-9);
  assert.equal(s.gun.flares, FLARE.start - 1);
  const t = quietState();
  t.player.x = t.player.px = 17.5; // facing the window, 1.5 cells away
  run(t, DT, intents({ facing: -Math.PI / 2, flare: 1 }));
  const g = t.flares.find((x) => x.t > 0);
  assert.ok(Math.abs(g.y - 19.3) < 1e-6, `landed at ${g.y}`);
  const ev = runCollecting(s, FLARE.burn);
  assert.ok(ev.some((e) => e.type === 'flareOut'));
});

test('no flares, no throw; and one throw per press, however long the button is held', () => {
  const s = quietState();
  s.gun.flares = 0;
  run(s, DT, intents({ flare: 1 }));
  assert.ok(s.flares.every((f) => f.t <= 0));
});

test('every shot kicks the view, and the kick springs back', () => {
  const s = quietState();
  run(s, DT, intents({ facing: south, fire: true }));
  const k = s.gun.kick;
  assert.ok(k > 0);
  run(s, 0.4, intents({ facing: south }));
  assert.ok(s.gun.kick < k * 0.02);
});
```

`last-light/test/night.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { startWave, ambientFor, hourLabel, LAST_WAVE } from '../src/night.js';
import { aliveCount, KINDS } from '../src/creatures.js';
import { NIGHT, DT, LIGHT, FLARE, SHOTGUN, SHELL_BOX } from '../src/tuning.js';
import { run, runCollecting, intents } from './helpers.js';

const killAll = (s) => s.creatures.forEach((c) => (c.alive = false));

test('dusk lasts a few seconds, then the 9 PM wave starts', () => {
  const s = createState({ seed: 2 });
  assert.equal(hourLabel(s.night), '8 PM');
  const ev = runCollecting(s, NIGHT.dusk + DT);
  assert.ok(ev.some((e) => e.type === 'wave' && e.a === 0));
  assert.equal(s.night.phase, 'wave');
  assert.equal(hourLabel(s.night), '9 PM');
});

test('each wave queues exactly its row of the table', () => {
  for (let i = 0; i <= LAST_WAVE; i++) {
    const s = createState({ seed: 3 });
    startWave(s, i);
    const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
    for (let j = 0; j < s.night.qn; j++) counts[KINDS[s.night.queue[j]]]++;
    assert.deepEqual(counts, NIGHT.waves[i], `wave ${i}`);
  }
});

test('the Mother comes early in her wave', () => {
  const s = createState({ seed: 4 });
  startWave(s, LAST_WAVE);
  const at = [...s.night.queue.subarray(0, s.night.qn)].indexOf(3);
  assert.ok(at >= 0 && at <= 3);
});

test('creatures trickle out under the alive cap, from trails away from you', () => {
  const s = createState({ seed: 5, god: true });
  startWave(s, 6); // 36 creatures, cap 22
  let most = 0;
  for (let i = 0; i < 20 / DT; i++) {
    step(s, intents());
    most = Math.max(most, aliveCount(s));
  }
  assert.equal(most, NIGHT.aliveCap(7));
});

test('spawns come from trails at least 8 cells from you when there are any', () => {
  const s = createState({ seed: 6 });
  startWave(s, 5);
  const ev = runCollecting(s, 5).filter((e) => e.type === 'spawn');
  assert.ok(ev.length > 3);
  for (const e of ev) assert.ok(Math.hypot(e.x - s.player.x, e.y - s.player.y) >= NIGHT.spawnAway - 0.3);
});

test('clearing a wave starts a lull: the clock moves on, a flare turns up, the stove heals', () => {
  const s = createState({ seed: 7 });
  startWave(s, 0);
  s.night.qi = s.night.qn;
  killAll(s);
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'lull' && e.a === 1));
  assert.equal(hourLabel(s.night), '10 PM');
  assert.ok(s.pickups[0].active);
  assert.ok(!s.pickups[1].active, 'no shells before the shotgun');
  s.player.health = 50;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  run(s, 1);
  assert.ok(Math.abs(s.player.health - (50 + NIGHT.stoveHeal)) < 0.5);
  run(s, NIGHT.lull);
  assert.equal(s.night.phase, 'wave');
  assert.equal(s.night.wave, 1);
});

test('the stove does not heal during a wave', () => {
  const s = createState({ seed: 8 });
  startWave(s, 0);
  s.night.spawnT = Infinity;
  s.player.health = 50;
  s.player.x = s.stove.x;
  s.player.y = s.stove.y + 1;
  run(s, 1);
  assert.equal(s.player.health, 50);
});

test('the shotgun appears before 11 PM; walking onto it gives it to you, loaded', () => {
  const s = createState({ seed: 9 });
  startWave(s, 1);
  s.night.qi = s.night.qn;
  killAll(s);
  run(s, DT);
  const gun = s.pickups[2];
  assert.ok(gun.active);
  s.player.x = gun.x;
  s.player.y = gun.y;
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'pickup' && e.a === 2));
  assert.ok(s.gun.hasShotgun && s.gun.shells === SHOTGUN.shells);
  assert.equal(s.gun.shells + s.gun.spare, SHOTGUN.foundWith);
});

test('pickups: a flare up to the carry limit; a shell box', () => {
  const s = createState({ seed: 10, wave: 3 });
  s.gun.flares = FLARE.max;
  s.pickups[0].active = true;
  s.player.x = s.pickups[0].x;
  s.player.y = s.pickups[0].y;
  run(s, DT);
  assert.ok(s.pickups[0].active, 'left there when you carry the most');
  s.gun.spare = 0;
  s.pickups[1].active = true;
  s.player.x = s.pickups[1].x;
  s.player.y = s.pickups[1].y;
  run(s, DT);
  assert.equal(s.gun.spare, SHELL_BOX);
});

test('clearing 4 AM brings the dawn; the light rises to day', () => {
  const s = createState({ seed: 11, wave: LAST_WAVE });
  startWave(s, LAST_WAVE);
  s.night.qi = s.night.qn;
  killAll(s);
  const ev = runCollecting(s, DT);
  assert.ok(ev.some((e) => e.type === 'dawn'));
  assert.equal(s.night.reached, LAST_WAVE + 1);
  const before = ambientFor(s.night);
  run(s, LIGHT.dawnTime);
  assert.ok(ambientFor(s.night) > before);
  assert.ok(Math.abs(ambientFor(s.night) - LIGHT.dawn) < 1e-9);
});

test('running out of health ends the night at the hour you reached', () => {
  const s = createState({ seed: 12 });
  startWave(s, 2);
  s.player.health = 1;
  s.player.x = 19.5;
  s.player.y = 20.5;
  const ev = [];
  for (let i = 0; i < 60 / DT && s.night.phase !== 'dead'; i++) {
    step(s, intents());
    for (let k = 0; k < s.eventCount; k++) ev.push(s.events[k].type);
  }
  assert.equal(s.night.phase, 'dead');
  assert.ok(ev.includes('dead'));
  assert.equal(s.night.reached, 2);
  const x = s.player.x;
  run(s, 1, intents({ forward: 1 }));
  assert.equal(s.player.x, x, 'nothing moves after death');
});

test('?wave= starts you at that wave, with the shotgun from 11 PM', () => {
  const s = createState({ seed: 13, wave: 5 });
  assert.equal(s.night.wave, 5);
  assert.ok(s.gun.hasShotgun);
  run(s, NIGHT.dusk + DT);
  assert.equal(s.night.wave, 5);
  assert.equal(s.night.phase, 'wave');
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL with `Cannot find module .../src/sim.js` and the others. The earlier 50 tests still pass.

- [ ] **Step 3: Write the modules**

`last-light/src/flowfield.js`:
```js
// A breadth-first flow field towards you over the grid: every open cell's step count to your cell.
// Creatures that can't see you follow it downhill, so they come round the cabin and through the
// doorway instead of pressing into walls. It's rebuilt only when you move into a new cell.
export function createField(map) {
  return { dist: new Int16Array(map.w * map.h).fill(-1), queue: new Int32Array(map.w * map.h), cx: -1, cy: -1 };
}

// Rebuilds the field if (x, y) is in a different cell from last time. Returns true if it did.
export function updateField(field, map, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx === field.cx && cy === field.cy) return false;
  field.cx = cx;
  field.cy = cy;
  const { w, h, blocked } = map;
  const dist = field.dist, q = field.queue;
  dist.fill(-1);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return true;
  let head = 0, tail = 0;
  const start = cy * w + cx;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++], d = dist[i] + 1, x0 = i % w;
    if (x0 > 0 && dist[i - 1] < 0 && !blocked[i - 1]) (dist[i - 1] = d), (q[tail++] = i - 1);
    if (x0 < w - 1 && dist[i + 1] < 0 && !blocked[i + 1]) (dist[i + 1] = d), (q[tail++] = i + 1);
    if (i >= w && dist[i - w] < 0 && !blocked[i - w]) (dist[i - w] = d), (q[tail++] = i - w);
    if (i < w * (h - 1) && dist[i + w] < 0 && !blocked[i + w]) (dist[i + w] = d), (q[tail++] = i + w);
  }
  return true;
}

// The eight neighbours, as (dx, dy) pairs: sides first, then diagonals.
const DIRS = Int8Array.from([1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1]);

// The way downhill from (x, y): a unit vector in `out` towards the centre of the neighbouring cell
// nearest you (diagonals only where both sides are open, so nothing cuts a corner). Returns false if
// (x, y) is in your cell, or has no way to you.
export function flowDir(field, map, x, y, out) {
  const { w, h } = map, dist = field.dist;
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
  const here = dist[cy * w + cx];
  if (here === 0) return false;
  let best = here < 0 ? 32767 : here, bx = 0, by = 0, found = false;
  for (let k = 0; k < 16; k += 2) {
    const dx = DIRS[k], dy = DIRS[k + 1];
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (dx !== 0 && dy !== 0 && (dist[cy * w + nx] < 0 || dist[ny * w + cx] < 0)) continue;
    const d = dist[ny * w + nx];
    if (d >= 0 && d < best) {
      best = d;
      bx = nx;
      by = ny;
      found = true;
    }
  }
  if (!found) return false;
  const vx = bx + 0.5 - x, vy = by + 0.5 - y, l = Math.hypot(vx, vy) || 1;
  out.x = vx / l;
  out.y = vy / l;
  return true;
}
```

`last-light/src/creatures.js`:
```js
// The Hungry. Every creature lives in a fixed pool (no allocation mid-night) and runs a small state
// machine each update:
//   crawler  chases and bites
//   gaunt    chases, winds up, swipes
//   leaper   closes in, circles at the edge of your light, crouches with a shriek, leaps in a straight
//            line (sidestep it or shoot it mid-air), lands, and goes round again. Where it can't see
//            you (you're in the cabin) it chases and bites like a crawler.
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
    circleDir: 1, circleT: 0, leapX: 0, leapY: 0, leapHit: false, lift: 0, birthT: 0, struck: 0,
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
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1;
  dir.x = dx / d;
  dir.y = dy / d;
  return true;
}

function walk(state, c, vx, vy, dt) {
  const hitWall = moveBody(state.map, c, vx * dt, vy * dt);
  for (const prop of state.map.props) pushOutOfCircle(c, prop.x, prop.y, prop.radius);
  const moved = Math.hypot(c.x - c.px, c.y - c.py);
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
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
  const touch = d - c.radius - p.radius; // gap between the two circles
  const sees = d < CREATURES.sightRange && canSee(state.map, c.x, c.y, p.x, p.y);
  const slow = inFlare(state, c.x, c.y) ? FLARE.slow : 1;
  if (c.flinch > 0) {
    c.flinch -= dt;
    if (c.mode !== 'leap') return;
  }

  if (c.kind === LEAPER) {
    if (c.mode === 'chase' || c.mode === 'circle') {
      if (!sees) {
        c.mode = 'chase';
      } else if (c.mode === 'chase' && d <= t.circleAt + 0.5) {
        c.mode = 'circle';
        c.circleT = randomBetween(state.rng, t.circleMin, t.circleMax);
      }
    }
    switch (c.mode) {
      case 'chase':
        if (!sees && touch <= t.reach) return bite(state, c, t, dt, dx, dy);
        c.attackT = t.interval;
        heading(state, c, sees);
        walk(state, c, dir.x * t.speed * slow, dir.y * t.speed * slow, dt);
        return;
      case 'circle': {
        c.circleT -= dt;
        if (c.circleT <= 0 || d < t.closeLeap) {
          c.mode = 'crouch';
          c.t = t.crouch;
          c.heading = Math.atan2(dy, dx);
          emit(state, 'shriek', c.x, c.y);
          return;
        }
        const ux = dx / d, uy = dy / d;
        const radial = Math.max(-1, Math.min(1, d - t.circleAt));
        let vx = -uy * c.circleDir + ux * radial, vy = ux * c.circleDir + uy * radial;
        const l = Math.hypot(vx, vy) || 1;
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
        const gap = Math.hypot(p.x - c.x, p.y - c.y) - c.radius - p.radius;
        if (!c.leapHit && gap <= 0.15) {
          c.leapHit = true;
          strike(state, c, t.pounce);
        }
        if (wall || c.t <= 0) {
          c.mode = 'land';
          c.t = t.land;
          c.lift = 0;
        }
        return;
      }
      case 'land':
        c.t -= dt;
        if (c.t <= 0) {
          c.mode = 'chase';
          c.attackT = t.interval;
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

  // Gaunt and Mother: chase, wind up, strike.
  if (c.attackT > 0) c.attackT -= dt;
  if (c.mode === 'windup') {
    c.heading = Math.atan2(dy, dx);
    c.t -= dt;
    if (c.t <= 0) {
      c.mode = 'chase';
      c.attackT = t.interval;
      if (touch <= t.reach + 0.2) strike(state, c, t.damage);
    }
    return;
  }
  if (touch <= t.reach) {
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
```

`last-light/src/weapons.js`:
```js
// Your guns and flares. Shots are instant (hitscan): a ray from you along your facing, stopped by the
// first wall, hits the nearest creature it passes through. Aiming is left and right only, as in Doom,
// so a creature is hit if the ray passes within its `hit` width.
//
// The rifle holds 8 and reloads a round at a time; firing interrupts a reload, and an empty rifle
// starts reloading by itself. The shotgun fires 8 pellets in a spread from 2 barrels, and reloads both
// at once from limited spare shells. Holding the trigger keeps firing as fast as each gun allows.
import { RIFLE, SHOTGUN, SWITCH_TIME, FLARE, FEEL, CREATURES, LIGHT } from './tuning.js';
import { castRay, createHit } from './raycast.js';
import { damageCreature, KINDS } from './creatures.js';
import { randomBetween } from './rng.js';
import { emit } from './events.js';

export const RIFLE_ID = 0, SHOTGUN_ID = 1;
const HIT_R = KINDS.map((k) => CREATURES[k].hit);
export const MAX_FLARES = 8; // burning on the ground at once

export function createGun() {
  return {
    current: RIFLE_ID, next: RIFLE_ID, switching: 0,
    cooldown: 0, reloading: false, reloadT: 0,
    rifle: RIFLE.rounds,
    hasShotgun: false, shells: 0, spare: 0,
    flares: FLARE.start, flareT: 0,
    kick: 0, // view kick, radians, springing back
    shotT: 0, // seconds since the last shot, for the gun's animation
  };
}

export function createFlares() {
  return Array.from({ length: MAX_FLARES }, () => ({ x: 0, y: 0, t: 0 }));
}

const wallHit = createHit();
const shot = { creature: null, dist: 0 };

// The nearest creature along a ray from (ox, oy) at `angle`, before any wall and within `range`.
// Returns the reusable `shot` ({ creature, dist }), with creature null for a miss.
export function traceShot(state, ox, oy, angle, range) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const wall = castRay(state.map, ox, oy, dx, dy, wallHit, range) ? wallHit.dist : range;
  shot.creature = null;
  shot.dist = wall;
  for (const c of state.creatures) {
    if (!c.alive || c.dying) continue;
    const rx = c.x - ox, ry = c.y - oy;
    const along = rx * dx + ry * dy;
    if (along <= 0 || along >= shot.dist) continue;
    const across = Math.abs(rx * dy - ry * dx);
    if (across <= HIT_R[c.kind]) {
      shot.creature = c;
      shot.dist = along;
    }
  }
  return shot;
}

function startSwitch(state, to) {
  const g = state.gun;
  if (to === (g.switching > 0 ? g.next : g.current)) return; // already there, or on the way
  if (to === SHOTGUN_ID && !g.hasShotgun) return;
  g.next = to;
  g.switching = SWITCH_TIME;
  g.reloading = false;
  emit(state, 'switch', state.player.x, state.player.y, to);
}

function startReload(state) {
  const g = state.gun;
  if (g.reloading || g.switching > 0) return;
  if (g.current === RIFLE_ID && g.rifle < RIFLE.rounds) {
    g.reloading = true;
    g.reloadT = RIFLE.reloadPerRound;
  } else if (g.current === SHOTGUN_ID && g.shells < SHOTGUN.shells && g.spare > 0) {
    g.reloading = true;
    g.reloadT = SHOTGUN.reload;
  }
}

function fire(state) {
  const g = state.gun, p = state.player;
  if (g.current === RIFLE_ID) {
    if (g.rifle === 0) {
      if (!g.reloading) {
        emit(state, 'dry', p.x, p.y, RIFLE_ID);
        startReload(state);
      }
      return;
    }
    g.reloading = false;
    g.rifle--;
    g.cooldown = RIFLE.interval;
    const s = traceShot(state, p.x, p.y, p.facing, RIFLE.range);
    if (s.creature) damageCreature(state, s.creature, RIFLE.damage);
    g.kick += FEEL.kick.rifle;
    emit(state, 'shot', p.x, p.y, RIFLE_ID);
    if (g.rifle === 0) startReload(state);
  } else {
    if (g.shells === 0) {
      emit(state, 'dry', p.x, p.y, SHOTGUN_ID);
      if (g.spare > 0) startReload(state);
      else startSwitch(state, RIFLE_ID);
      g.cooldown = SHOTGUN.interval;
      return;
    }
    g.reloading = false;
    g.shells--;
    g.cooldown = SHOTGUN.interval;
    const n = SHOTGUN.pellets;
    for (let i = 0; i < n; i++) {
      const spread = SHOTGUN.spread * (((i + 0.5) / n) * 2 - 1);
      const jitter = randomBetween(state.rng, -0.3, 0.3) * (SHOTGUN.spread / n);
      const s = traceShot(state, p.x, p.y, p.facing + spread + jitter, SHOTGUN.range);
      if (s.creature) damageCreature(state, s.creature, s.dist > SHOTGUN.falloff ? SHOTGUN.damage / 2 : SHOTGUN.damage);
    }
    g.kick += FEEL.kick.shotgun;
    state.shake = FEEL.shakeTime;
    emit(state, 'shot', p.x, p.y, SHOTGUN_ID);
    if (g.shells === 0 && g.spare > 0) startReload(state);
  }
  g.shotT = 0;
  state.flash = LIGHT.muzzle.time;
}

const flareHit = createHit();

function throwFlare(state) {
  const g = state.gun, p = state.player;
  if (g.flares <= 0 || g.flareT > 0) return;
  let slot = null;
  for (const f of state.flares) {
    if (f.t <= 0) {
      slot = f;
      break;
    }
  }
  if (!slot) return;
  const dx = Math.cos(p.facing), dy = Math.sin(p.facing);
  const d = castRay(state.map, p.x, p.y, dx, dy, flareHit, FLARE.throw) ? Math.max(0, flareHit.dist - 0.3) : FLARE.throw;
  slot.x = p.x + dx * d;
  slot.y = p.y + dy * d;
  slot.t = FLARE.burn;
  g.flares--;
  g.flareT = FLARE.cooldown;
  emit(state, 'flareThrow', slot.x, slot.y);
}

// intents: { fire (held), reload (presses), weapon (0 none, 1 rifle, 2 shotgun), weaponStep (-1, 0, 1), flare (presses) }
export function updateGun(state, intents, dt) {
  const g = state.gun;
  g.shotT += dt;
  if (g.cooldown > 0) g.cooldown -= dt;
  if (g.flareT > 0) g.flareT -= dt;
  g.kick -= g.kick * Math.min(1, FEEL.kickReturn * dt);

  if (intents.weapon === 1) startSwitch(state, RIFLE_ID);
  else if (intents.weapon === 2) startSwitch(state, SHOTGUN_ID);
  else if (intents.weaponStep) startSwitch(state, (g.switching > 0 ? g.next : g.current) === RIFLE_ID ? SHOTGUN_ID : RIFLE_ID);
  if (g.switching > 0) {
    g.switching -= dt;
    if (g.switching <= 0) {
      g.switching = 0;
      g.current = g.next;
    }
  }
  if (intents.reload) startReload(state);
  if (g.reloading) {
    g.reloadT -= dt;
    if (g.reloadT <= 0) {
      if (g.current === RIFLE_ID) {
        g.rifle++;
        emit(state, 'reload', state.player.x, state.player.y, RIFLE_ID);
        if (g.rifle < RIFLE.rounds) g.reloadT += RIFLE.reloadPerRound;
        else g.reloading = false;
      } else {
        const load = Math.min(SHOTGUN.shells - g.shells, g.spare);
        g.shells += load;
        g.spare -= load;
        g.reloading = false;
        emit(state, 'reload', state.player.x, state.player.y, SHOTGUN_ID);
      }
    }
  }
  if (intents.fire && g.cooldown <= 0 && g.switching <= 0) fire(state);
  if (intents.flare) throwFlare(state);
}

export function updateFlares(state, dt) {
  for (const f of state.flares) {
    if (f.t <= 0) continue;
    f.t -= dt;
    if (f.t <= 0) {
      f.t = 0;
      emit(state, 'flareOut', f.x, f.y);
    }
  }
}

// Gives you the shotgun, loaded, with its spare shells, and raises it.
export function giveShotgun(state) {
  const g = state.gun;
  g.hasShotgun = true;
  g.shells = SHOTGUN.shells;
  g.spare = SHOTGUN.foundWith - SHOTGUN.shells;
  startSwitch(state, SHOTGUN_ID);
}
```

`last-light/src/night.js`:
```js
// The night: dusk, then one wave an hour from 9 PM to 4 AM, with a lull between. A wave's creatures
// come out of the trails a few at a time, never more alive than the wave's cap, from trails away from
// you. A wave ends when all of its creatures (and the Mother's brood) are dead. In a lull the stove
// heals you, and supplies turn up: a flare, shells once you have the shotgun, and the shotgun itself
// before 11 PM. Clearing 4 AM brings the dawn; running out of health ends the night.
import { NIGHT, FLARE, SHOTGUN, SHELL_BOX, LIGHT } from './tuning.js';
import { spawnCreature, aliveCount, KINDS, MOTHER } from './creatures.js';
import { nextRandom } from './rng.js';
import { emit } from './events.js';
import { giveShotgun } from './weapons.js';

export const LAST_WAVE = NIGHT.waves.length - 1;
export const FLARE_PICKUP = 0, SHELLS_PICKUP = 1, SHOTGUN_PICKUP = 2;

export function createNight() {
  return { phase: 'dusk', wave: 0, t: NIGHT.dusk, queue: new Uint8Array(128), qn: 0, qi: 0, spawnT: 0, reached: 0, dawnT: 0 };
}

export function createPickups(map) {
  return [
    { kind: FLARE_PICKUP, x: map.spots.flare.x, y: map.spots.flare.y, active: false },
    { kind: SHELLS_PICKUP, x: map.spots.shells.x, y: map.spots.shells.y, active: false },
    { kind: SHOTGUN_PICKUP, x: map.spots.shotgun.x, y: map.spots.shotgun.y, active: false },
  ];
}

export function startWave(state, i) {
  const n = state.night, row = NIGHT.waves[i];
  n.phase = 'wave';
  n.wave = i;
  n.reached = Math.max(n.reached, i);
  n.qn = 0;
  n.qi = 0;
  n.spawnT = 0;
  for (let k = 0; k < KINDS.length; k++) for (let j = 0; j < row[KINDS[k]]; j++) n.queue[n.qn++] = k;
  // Shuffle, then bring the Mother forward so she arrives early in her wave.
  for (let j = n.qn - 1; j > 0; j--) {
    const r = Math.floor(nextRandom(state.rng) * (j + 1));
    const t = n.queue[j];
    n.queue[j] = n.queue[r];
    n.queue[r] = t;
  }
  const m = n.queue.subarray(0, n.qn).indexOf(MOTHER);
  const early = Math.min(3, n.qn - 1);
  if (m > early) {
    n.queue[m] = n.queue[early];
    n.queue[early] = MOTHER;
  }
  emit(state, 'wave', 0, 0, i);
}

function spawnNext(state) {
  const n = state.night, p = state.player, spawns = state.map.spawns;
  let far = 0;
  for (const s of spawns) if (Math.hypot(s.x - p.x, s.y - p.y) >= NIGHT.spawnAway) far++;
  let pick = Math.floor(nextRandom(state.rng) * (far || spawns.length));
  let trail = spawns[0];
  for (const s of spawns) {
    if (far && Math.hypot(s.x - p.x, s.y - p.y) < NIGHT.spawnAway) continue;
    if (pick-- === 0) {
      trail = s;
      break;
    }
  }
  spawnCreature(state, n.queue[n.qi++], trail.x + (nextRandom(state.rng) - 0.5) * 0.4, trail.y + (nextRandom(state.rng) - 0.5) * 0.4);
}

function endWave(state) {
  const n = state.night;
  if (n.wave === LAST_WAVE) {
    n.phase = 'dawn';
    n.dawnT = 0;
    n.reached = LAST_WAVE + 1;
    emit(state, 'dawn');
    return;
  }
  n.phase = 'lull';
  n.t = NIGHT.lull;
  const [flare, shells, shotgun] = state.pickups;
  flare.active = true;
  if (state.gun.hasShotgun) shells.active = true;
  if (n.wave + 1 === NIGHT.shotgunBefore && !state.gun.hasShotgun) shotgun.active = true;
  emit(state, 'lull', 0, 0, n.wave + 1);
}

function collect(state) {
  const p = state.player, g = state.gun;
  for (const k of state.pickups) {
    if (!k.active || Math.hypot(k.x - p.x, k.y - p.y) > NIGHT.pickupReach) continue;
    if (k.kind === FLARE_PICKUP) {
      if (g.flares >= FLARE.max) continue;
      g.flares++;
    } else if (k.kind === SHELLS_PICKUP) {
      if (g.spare >= SHOTGUN.maxSpare) continue;
      g.spare = Math.min(SHOTGUN.maxSpare, g.spare + SHELL_BOX);
    } else {
      giveShotgun(state);
    }
    k.active = false;
    emit(state, 'pickup', k.x, k.y, k.kind);
  }
}

export function updateNight(state, dt) {
  const n = state.night, p = state.player;
  if (n.phase === 'dead') return;
  if (n.phase === 'dawn') {
    n.dawnT += dt;
    return;
  }
  collect(state);
  if (n.phase === 'dusk') {
    n.t -= dt;
    if (n.t <= 0) startWave(state, n.wave);
  } else if (n.phase === 'lull') {
    const stove = state.stove;
    if (stove && Math.hypot(stove.x - p.x, stove.y - p.y) <= NIGHT.stoveReach) {
      p.health = Math.min(state.maxHealth, p.health + NIGHT.stoveHeal * dt);
    }
    n.t -= dt;
    if (n.t <= 0) startWave(state, n.wave + 1);
  } else if (n.phase === 'wave') {
    const alive = aliveCount(state);
    n.spawnT -= dt;
    if (n.qi < n.qn && n.spawnT <= 0 && alive < NIGHT.aliveCap(n.wave + 1)) {
      spawnNext(state);
      n.spawnT = NIGHT.spawnEvery;
    }
    if (n.qi >= n.qn && alive === 0) endWave(state);
  }
}

// The sky's light for the current hour, rising to daylight over the dawn.
export function ambientFor(night) {
  const base = LIGHT.night[Math.min(night.wave, LIGHT.night.length - 1)];
  if (night.phase !== 'dawn') return base;
  const k = Math.min(1, night.dawnT / LIGHT.dawnTime);
  return base + (LIGHT.dawn - base) * k * k;
}

// The sky panorama's light level (0-15): dim all night, full at sunrise.
export function skyLevelFor(night) {
  if (night.phase === 'dawn') return Math.round(4 + 11 * Math.min(1, night.dawnT / LIGHT.dawnTime));
  return night.wave >= 6 ? 4 : 3;
}

// What the HUD clock shows: the hour of the wave being fought, or the one coming.
export function hourLabel(night) {
  if (night.phase === 'dawn') return '5 AM';
  if (night.phase === 'dusk') return '8 PM';
  if (night.phase === 'lull') return NIGHT.hours[Math.min(night.wave + 1, LAST_WAVE)];
  return NIGHT.hours[night.wave];
}
```

`last-light/src/sim.js`:
```js
// One night's state, and step(): a single 120 Hz update of the whole game world. step never touches
// the DOM, the canvas, the clock or Math.random, and allocates nothing, so a night replays exactly
// from its seed and intents, and every rule is tested in Node.
import { DT, PLAYER, NIGHT } from './tuning.js';
import { parseMap } from './map.js';
import { createRng } from './rng.js';
import { createPlayer, movePlayer } from './player.js';
import { createField, updateField } from './flowfield.js';
import { createCreatures, updateCreatures } from './creatures.js';
import { createGun, createFlares, updateGun, updateFlares, giveShotgun } from './weapons.js';
import { createNight, createPickups, updateNight } from './night.js';
import { createEvents, emit } from './events.js';

// seed: the night's random seed. wave: start at this wave index (the ?wave= debug mode; from 11 PM on
// you start with the shotgun). god: you can't die.
export function createState({ seed = 1, wave = 0, god = false, map = parseMap() } = {}) {
  const state = {
    seed, rng: createRng(seed), tick: 0, time: 0, god,
    map, field: createField(map),
    player: createPlayer(map.start), maxHealth: PLAYER.health,
    gun: createGun(), flares: createFlares(), creatures: createCreatures(), pickups: createPickups(map),
    stove: map.props.find((p) => p.kind === 'stove') ?? null,
    night: createNight(),
    events: createEvents(), eventCount: 0,
    flash: 0, hurt: 0, shake: 0,
    stats: { kills: 0 },
  };
  state.night.wave = wave;
  state.night.reached = wave;
  if (wave >= NIGHT.shotgunBefore) {
    giveShotgun(state);
    state.gun.current = state.gun.next;
    state.gun.switching = 0;
  }
  state.eventCount = 0;
  updateField(state.field, map, state.player.x, state.player.y);
  return state;
}

export function step(state, intents) {
  state.eventCount = 0;
  state.tick++;
  state.time += DT;
  if (state.flash > 0) state.flash -= DT;
  if (state.hurt > 0) state.hurt -= DT;
  if (state.shake > 0) state.shake -= DT;
  const phase = state.night.phase;
  if (phase === 'dead') return state;
  const p = state.player;
  movePlayer(state.map, p, intents, DT);
  updateField(state.field, state.map, p.x, p.y);
  if (phase !== 'dawn') updateGun(state, intents, DT);
  updateCreatures(state, DT);
  updateFlares(state, DT);
  updateNight(state, DT);
  if (p.health <= 0 && state.night.phase !== 'dead') {
    p.health = 0;
    state.night.phase = 'dead';
    emit(state, 'dead');
  }
  return state;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 86 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test
git commit -m "Last Light: the Hungry, the rifle, shotgun and flares, and the night's waves"
```

---

### Task 5: The bot, and whole nights in Node

**Files:**
- Create: `last-light/src/bot.js`
- Test: `last-light/test/sim.test.js`

**Interfaces:**
- Consumes:
  - From Task 4: the state, `KINDS`, `MOTHER`, `RIFLE_ID` and `SHOTGUN_ID`.
  - From Task 3: `canSee`.
- Produces:
  - `bot.js`: `createBot() → { facing, out }` and `botIntents(state, bot, dt) → intents`. The intents object is reused; the facing turns at a human-ish 7 rad/s.
  - Used by `?debug=bot` in Task 10, and by the browser checks.
- The prototype ran this bot through 24 nights:
  - With `god`, it reached dawn in 12 of 12, in 5–9 minutes of game time.
  - Without `god`, it died between 1 AM and 4 AM.

  That's a sensible first difficulty. Don't tune it here.

- [ ] **Step 1: Write the failing test**

`last-light/test/sim.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { createBot, botIntents } from '../src/bot.js';
import { DT } from '../src/tuning.js';

// Everything that matters about a night, as one string.
function snapshot(s) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return JSON.stringify({
    t: s.tick, p: [r(s.player.x), r(s.player.y), r(s.player.health)], n: [s.night.phase, s.night.wave, s.night.qi],
    c: s.creatures.filter((c) => c.alive).map((c) => [c.id, c.kind, r(c.x), r(c.y), r(c.hp), c.mode]),
    g: [s.gun.current, s.gun.rifle, s.gun.shells, s.gun.spare, s.gun.flares], k: s.stats.kills,
  });
}

function playMinute(seed) {
  const s = createState({ seed });
  const bot = createBot();
  for (let i = 0; i < 60 / DT; i++) step(s, botIntents(s, bot, DT));
  return snapshot(s);
}

test('the same seed and intents give the same night', () => {
  assert.equal(playMinute(21), playMinute(21));
  assert.notEqual(playMinute(21), playMinute(22));
});

test('the bot, unable to die, plays a whole night to the dawn', () => {
  const s = createState({ seed: 2, god: true });
  const bot = createBot();
  for (let i = 0; i < (20 * 60) / DT && s.night.phase !== 'dawn'; i++) step(s, botIntents(s, bot, DT));
  assert.equal(s.night.phase, 'dawn');
  assert.ok(s.stats.kills > 150);
});

test('an update allocates nothing that lasts: the pools keep their objects', () => {
  const s = createState({ seed: 3, god: true });
  const bot = createBot();
  const creatures = s.creatures, events = s.events, first = s.creatures[0], flares = s.flares;
  for (let i = 0; i < 90 / DT; i++) step(s, botIntents(s, bot, DT));
  assert.equal(s.creatures, creatures);
  assert.equal(s.creatures[0], first);
  assert.equal(s.events, events);
  assert.equal(s.flares, flares);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL with `Cannot find module .../src/bot.js`.

- [ ] **Step 3: Write the bot**

`last-light/src/bot.js`:
```js
// ?debug=bot: the game plays itself, for testing whole nights. It turns (at a human-ish rate) towards
// the nearest creature it can see and fires once on target, backs off from anything close, takes the
// shotgun to close quarters, throws a flare into a crowd, reloads in quiet moments, and in a lull goes
// for supplies and then warms up at the stove. It produces the same intents as the keyboard and mouse.
import { canSee } from './raycast.js';
import { KINDS, MOTHER } from './creatures.js';
import { SHOTGUN_ID, RIFLE_ID } from './weapons.js';
import { CREATURES as TUNED } from './tuning.js';

const TURN = 7; // radians per second
const HIT_R = KINDS.map((k) => TUNED[k].hit);

export function createBot() {
  return { facing: null, out: { facing: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0 } };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function steer(out, facing, wx, wy) {
  const c = Math.cos(facing), s = Math.sin(facing);
  out.forward = Math.max(-1, Math.min(1, wx * c + wy * s));
  out.strafe = Math.max(-1, Math.min(1, -wx * s + wy * c));
}

export function botIntents(state, bot, dt) {
  const p = state.player, g = state.gun, out = bot.out, n = state.night;
  if (bot.facing === null) bot.facing = p.facing;
  out.fire = false;
  out.flare = 0;
  out.reload = 0;
  out.weapon = 0;
  out.forward = 0;
  out.strafe = 0;
  out.run = false;

  // The nearest creature in sight, except that the Mother comes first when nothing is close.
  let target = null, best = Infinity, crowd = 0, mother = null, motherD = 0;
  for (const c of state.creatures) {
    if (!c.alive || c.dying) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < 4) crowd++;
    if (!canSee(state.map, p.x, p.y, c.x, c.y)) continue;
    if (c.kind === MOTHER) {
      mother = c;
      motherD = d;
    }
    if (d < best) {
      best = d;
      target = c;
    }
  }
  if (mother && best > 2.5) {
    target = mother;
    best = motherD;
  }

  let want = bot.facing;
  if (target) {
    want = Math.atan2(target.y - p.y, target.x - p.x);
    const err = Math.abs(wrap(want - bot.facing));
    out.fire = err < Math.asin(Math.min(1, (HIT_R[target.kind] * 0.8) / Math.max(best, 0.01)));
    const close = best < 3;
    out.weapon = close && g.hasShotgun && g.shells + g.spare > 0 ? 2 : !close || !g.hasShotgun ? 1 : 0;
    if (crowd >= 4 && g.flares > 0 && err < 0.3) out.flare = 1;
    if (best < 2.5) {
      // Back off, sliding sideways so we don't back into a corner.
      const ax = (p.x - target.x) / best, ay = (p.y - target.y) / best;
      steer(out, bot.facing, ax - ay * 0.5, ay + ax * 0.5);
      out.run = true;
    }
  } else if (n.phase === 'lull') {
    const pick = state.pickups.find((k) => k.active);
    const porch = state.map.start;
    let gx, gy;
    if (pick && !(pick.kind === 0 && g.flares >= 5)) {
      gx = pick.x;
      gy = pick.y;
    } else if (p.health < state.maxHealth && state.stove) {
      // Through the doorway: line up on the porch first.
      const inside = p.y < porch.y - 1.2;
      gx = inside || Math.abs(p.x - porch.x) < 0.3 ? state.stove.x : porch.x;
      gy = inside || Math.abs(p.x - porch.x) < 0.3 ? state.stove.y + 0.9 : porch.y;
    } else {
      gx = porch.x;
      gy = porch.y + 2;
    }
    const d = Math.hypot(gx - p.x, gy - p.y);
    if (d > 0.2) {
      want = Math.atan2(gy - p.y, gx - p.x);
      steer(out, bot.facing, (gx - p.x) / d, (gy - p.y) / d);
    }
    if (g.current === RIFLE_ID && g.rifle < 8) out.reload = 1;
  } else {
    // Nothing in sight: turn slowly, and top up the rifle.
    want = bot.facing + 1.5 * dt * 4;
    if (g.current === RIFLE_ID && g.rifle < 6) out.reload = 1;
    if (g.current === SHOTGUN_ID && g.shells < 2) out.reload = 1;
    const cx = state.map.start.x, cy = state.map.start.y + 3, d = Math.hypot(cx - p.x, cy - p.y);
    if (d > 3) steer(out, bot.facing, (cx - p.x) / d, (cy - p.y) / d);
  }
  const turn = wrap(want - bot.facing);
  bot.facing = wrap(bot.facing + Math.max(-TURN * dt, Math.min(TURN * dt, turn)));
  out.facing = bot.facing;
  return out;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 89 tests. The whole-night test takes a few seconds.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src/bot.js last-light/test/sim.test.js
git commit -m "Last Light: a bot that plays whole nights, and determinism tests"
```

---

## Phase 2: The art, and the code that shows it

### Task 6: The art pipeline and the style test

**Files:**
- Create: `art/last-light/.gitignore`, `art/last-light/palette.lua`, `art/last-light/lib.lua`, `art/last-light/textures.lua`, `art/last-light/sky.lua`, `art/last-light/sprites.lua` (the crawler and gaunt for now), `art/last-light/style-test.lua`
- Generated (committed):
  - `last-light/assets/palette.json`, `textures.png`, `textures.json`, `sky.png`, `sprites.png` and `sprites.json`
  - `art/last-light/textures.aseprite` and `sprites.aseprite`
- Generated (not committed): `art/last-light/preview-style.png`

**Interfaces:**
- Consumes: nothing from the game code. The contracts below are what `assets.js` (Task 7) and `test/art.test.js` (Task 8) read.
- Produces:
  - **`lib.lua`** (`L`):
    - the drawing helpers from `art/site/lib.lua`, plus `L.ramp(list, t, x, y)` (a dithered pick from a ramp) and `L.line`;
    - `L.palette()` returns `P`, with `P.index[hex]` added;
    - the writers `L.writePalette(P)`, `L.checkPalette(buf, P, what)`, `L.writeTextures(P, { {name, buf}, ... })`, `L.writeSprites(P, { {name, frames, height, anims, stride?, ms?}, ... })` and `L.writePieces(kind, pieces)`;
    - the paths `L.ASSETS` ("last-light/assets/") and `L.ART` ("art/last-light/").
  - **`palette.lua`** (`P`):
    - `order`, the names in index order (59 colours);
    - `hex` (name to "#rrggbb"), with `c` as a shorthand for it;
    - `glow`, the names that ignore light;
    - `names`, the named colours the game uses: flake, ichor, ui, uiDim, hurt, night.
  - **`palette.json`**: `{ colors: [...], glow: [indices], names: { flake, ichor, ui, uiDim, hurt, night } }`. Indices count from 1.
  - **`textures.json`**: `{ size: 32, names: ["trunks", "logs", "window", "woodpile", "wagonSide", "wagonEnd", "snow", "planks", "rafters"] }`, in exactly this order. `textures.png` is those nine 32×32 tiles side by side, 288×32.
  - **`sky.png`**: 1024×128, wrapping left to right. Its bottom row sits on the horizon.
  - **`sprites.json`**: `{ sprites: { name: { x, y, w, h, count, height, stride?, ms?, anims } } }`. For now it holds only the crawler and the gaunt; Task 8 adds the rest.

**How the game uses the art:**
- **Colours.** The game shades every world pixel through tables built from the palette, so textures, the sky and sprites must use palette colours exactly, at full opacity. The writers enforce this. `glow` colours stay full-bright in the dark: stars, fire, the window, the eyes, the flare.
- **Light levels.** The game shows each colour at 16 light levels. The top level is warm lantern amber and the bottom is the blue-black fog, so paint every texture and sprite as if lit neutrally and evenly (the game adds the warmth and the darkness). Keep values readable: at night most of the world is seen at levels 4–10.
- **Textures** are 32×32 and repeat along walls, so each must tile seamlessly left to right. `snow`, `planks` and `rafters` are floors and ceilings, so they must tile both ways.
- **Sprites** stand on the floor at their frame's bottom row. `height` is how tall the frame is in world units: a wall is 1.0 unit, about 2 m. Aim for about 44 px per world unit.
- **Side views** face right; the game mirrors them.
- **Walking.** `stride` is how many cells of walking move one frame on. The walk frames loop.

**The pieces for this task:**

`textures.lua` writes `palette.json` (with `L.writePalette(P)`), and then these nine tiles, in this order:
1. **trunks.** The forest wall: pine trunks shoulder to shoulder. Vertical bark columns 5–7 px wide in `bark0`–`bark3`, lit a little from the left, with deep gaps (`void`, `bark0`) between trunks. Low boughs (`needle1`–`needle3`) cross the top 6 rows, and snow (`snow2`–`snow3`) is caught on a few ledges.
2. **logs.** The cabin wall: four horizontal logs, 8 px each. Each log's top edge is lit (`wood4`–`wood5`), its body is in `wood2`–`wood3`, and its underside is dark (`wood1`). The chinking between logs is `wood0`. Add a few knots and cracks.
3. **window.** The logs tile with a four-pane window in the middle, about 16×14. The frame is `wood1`–`wood2`, and the panes are `window` with `fire3`/`fire4` highlights. These are glow colours, so the window shines at night.
4. **woodpile.** Split log ends stacked in rows: round faces (`wood3`–`wood5`, with a ring or two), bark rims (`wood1`), dark gaps (`void`), and a snow cap on the top rows.
5. **wagonSide.** A covered wagon, seen side-on:
   - the lower third is the planked bed (`wood2`–`wood4`), with a spoked wheel (an `iron1`/`iron2` rim and a `wood` hub) straddling the bottom edge;
   - the upper two thirds is the canvas bonnet (`stone2`–`stone3` and `snow2`), with hoop ribs and sagging folds;
   - there's snow along the top.
6. **wagonEnd.** The wagon's rear: the tailgate planks below, and above them the bonnet puckered round a dark oval opening (`void`). Something could be in there.
7. **snow.** The ground: soft, low-contrast snow (`snow1`–`snow3`), with a few `snow4` glints and faint drift ripples. It covers half the screen at a glancing angle, so keep it calm: busy detail shimmers.
8. **planks.** The cabin floor: boards running one way (`wood2`–`wood4`), `wood0` seams, and a nail or two (`iron2`).
9. **rafters.** The ceiling seen from below: dark boards (`wood1`–`wood2`) with one crossing beam (`wood3`).

`sky.lua` writes `sky.png`, 1024×128, which must wrap: column 0 continues from column 1023.
- **The sky.** A night gradient from `night1` at the top to `night3`/`night4` near the horizon, dithered with `L.ramp`.
- **Stars.** Sparse (`star`, 1 px, denser towards the top).
- **The treeline.** A jagged pine silhouette along the bottom 20–56 px, in `void` and `night1`, with varied heights, a few tall spires and a gap or two.
- **Rules.** Use only `L.rnd` for placement, and check the whole image with `L.checkPalette`.

`sprites.lua` (this task: the crawler and the gaunt) writes them with `L.writeSprites(P, sprites)`. Task 8 adds the rest to the same list.
- **The Hungry's look.** Pale, starved, too-long things. Their bone-white flesh (`flesh0`–`flesh4`) is lit from the front (your lantern is behind you), with `flesh0` rims on the silhouette's edge so they read against the dark. Their mouths are dark (`mouth`, `gum`), and their eyes glow sickly yellow-green (`eye1` rim, `eye2` core), 1–2 px each. In the dark the eyes are all you'll see, so place them carefully on every frame. No colour outside the palette, and no outline colour is needed.
- **crawler.** 32×20 per frame, height 0.45, stride 0.35.
  - It crawls on all fours, low and spidery, head forward, jaw open.
  - The frames, numbered from 0: 0–3 `walk` (front, with the legs scuttling in alternation), 4–7 `side-walk` (facing right), 8–9 `attack` (lunging bite), 10 `hurt` (recoiling), 11–15 `die` (collapsing, ending as a low heap).
  - The anims are `walk` [0,1,2,3], `side-walk` [4,5,6,7], `attack` [8,9], `hurt` [10], `die` [11,12,13,14,15].
- **gaunt.** 24×56 per frame, height 1.25, stride 0.5.
  - It's tall and stooped, with a visible ribcage and arms hanging to its knees ending in long fingers.
  - The frames: 0–3 `walk`, 4–7 `side-walk`, 8 `windup` (both arms raised high, the tell), 9–10 `attack` (the swipe coming down), 11 `hurt`, 12–16 `die` (folding to a heap).

`style-test.lua` is given below. It's a review sheet, and not in the rebuild loop.

- [ ] **Step 1: Write the palette, the helpers and the ignore file**

`art/last-light/.gitignore`:
```
preview-*.png
```

`art/last-light/palette.lua`:
```lua
-- Every colour in Last Light, defined once. The game draws the world through pre-shaded tables built
-- from this list (last-light/src/shade.js), so every pixel of a texture, the sky or a sprite must be
-- one of these colours exactly. The order is the palette index (1 up), so only ever add colours at the
-- end. Ramps run dark -> light. `glow` colours ignore the light: eyes, embers, the window, the flare.
local P = {}

P.order = {
  -- the night: sky and fog
  "void", "night1", "night2", "night3", "night4", "star",
  -- snow
  "snow0", "snow1", "snow2", "snow3", "snow4",
  -- wood: logs, planks, wagon, woodpile
  "wood0", "wood1", "wood2", "wood3", "wood4", "wood5",
  -- pine bark and needles
  "bark0", "bark1", "bark2", "bark3", "needle0", "needle1", "needle2", "needle3",
  -- stone and iron: the well, the stove, gun metal
  "stone0", "stone1", "stone2", "stone3", "iron0", "iron1", "iron2",
  -- fire: embers, the lantern, the muzzle flash, the window's glow
  "ember0", "fire1", "fire2", "fire3", "fire4", "window",
  -- the Hungry: bone-pale flesh, mouths, glowing eyes, dark ichor
  "flesh0", "flesh1", "flesh2", "flesh3", "flesh4", "mouth", "gum", "eye1", "eye2", "ichor0", "ichor1",
  -- the flare's red
  "flare1", "flare2",
  -- your hands, and brass
  "skin0", "skin1", "skin2", "brass0", "brass1",
  -- the HUD
  "ui", "uiDim", "hurt",
}

P.hex = {
  void = "#05070c", night1 = "#0b0f1a", night2 = "#121a2b", night3 = "#1c2740", night4 = "#2a3a58", star = "#dfe6f5",
  snow0 = "#3b4660", snow1 = "#5d6b88", snow2 = "#8a98b4", snow3 = "#b9c5da", snow4 = "#e6edf6",
  wood0 = "#1e140e", wood1 = "#34221a", wood2 = "#4e3324", wood3 = "#6b4a31", wood4 = "#8d6844", wood5 = "#b08a5c",
  bark0 = "#15110f", bark1 = "#262019", bark2 = "#3a3026", bark3 = "#544536",
  needle0 = "#0e1712", needle1 = "#182a20", needle2 = "#26402f", needle3 = "#3a5a40",
  stone0 = "#2a2c33", stone1 = "#454852", stone2 = "#676b77", stone3 = "#8e929e",
  iron0 = "#121317", iron1 = "#23252c", iron2 = "#3a3d47",
  ember0 = "#5c1f0a", fire1 = "#a8400f", fire2 = "#e87a1e", fire3 = "#ffb347", fire4 = "#ffe29a", window = "#ffcf7a",
  flesh0 = "#3b3438", flesh1 = "#6d6268", flesh2 = "#a0949a", flesh3 = "#cfc5c6", flesh4 = "#efe9e6",
  mouth = "#2a0f14", gum = "#6e2230", eye1 = "#b8d63a", eye2 = "#f2ff8a", ichor0 = "#140a10", ichor1 = "#3a1224",
  flare1 = "#ff3b2f", flare2 = "#ff9c8a",
  skin0 = "#4a2e22", skin1 = "#7a4c36", skin2 = "#a8704f", brass0 = "#8a6a2a", brass1 = "#c9a045",
  ui = "#e6dcc6", uiDim = "#8f8a7c", hurt = "#b3121e",
}

P.glow = { "star", "fire2", "fire3", "fire4", "window", "eye1", "eye2", "flare1", "flare2" }

-- The colours the game looks up by name.
P.names = { flake = "snow4", ichor = "ichor1", ui = "ui", uiDim = "uiDim", hurt = "hurt", night = "void" }

-- Shorthand: P.c.snow2 is "#8a98b4".
P.c = P.hex

return P
```

`art/last-light/lib.lua`:
```lua
-- Shared helpers for Last Light's art scripts: repo paths, JSON, pixel buffers, deterministic noise,
-- ordered dither, simple drawing, alpha blitting, outlines, saving, and the writers for each kind of
-- sheet the game loads. Buffers hold "#rrggbb" or "#rrggbbaa" strings (nil is transparent), indexed
-- buf[y][x] from 0. (The drawing helpers are the same as art/site/lib.lua's; the art for each part of
-- the site keeps its own copy, so no part depends on another's scripts.)
local M = {}

local here = debug.getinfo(1, "S").source:sub(2)
M.ROOT = here:match("^(.-)art/last%-light/[^/]+$") or ""
M.ASSETS = "last-light/assets/"
M.ART = "art/last-light/"

function M.path(rel) return M.ROOT .. rel end

function M.readJson(rel)
  local f = assert(io.open(M.path(rel), "r"), "can't open " .. M.path(rel))
  local text = f:read("a")
  f:close()
  return json.decode(text)
end

-- Makes sure the folder that will hold a repo-relative file exists.
function M.ensureDir(rel)
  app.fs.makeAllDirectories(app.fs.filePath(M.path(rel)))
end

function M.writeText(rel, text)
  M.ensureDir(rel)
  local f = assert(io.open(M.path(rel), "w"), "can't write " .. M.path(rel))
  f:write(text)
  f:close()
end

function M.channels(hex)
  return tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16),
    (#hex >= 9) and tonumber(hex:sub(8, 9), 16) or 255
end

function M.rgba(hex)
  local r, g, b, a = M.channels(hex)
  return app.pixelColor.rgba(r, g, b, a)
end

function M.buffer(w, h)
  local b = { w = w, h = h }
  for y = 0, h - 1 do b[y] = {} end
  return b
end

function M.set(b, x, y, c)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then b[y][x] = c end
end

function M.get(b, x, y)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then return b[y][x] end
  return nil
end

-- Deterministic noise in [0, 1), so every run draws identical pixels.
function M.rnd(x, y, seed)
  local n = (math.floor(x) * 374761393 + math.floor(y) * 668265263 + math.floor(seed or 0) * 1442695041) % 2147483647
  n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
  return (n % 10007) / 10007
end

local BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }
-- 4x4 ordered-dither threshold in (0, 1).
function M.bayer(x, y)
  return (BAYER[(math.floor(y) % 4) * 4 + (math.floor(x) % 4) + 1] + 0.5) / 16
end

-- Picks from a ramp (a list of colours, dark -> light) at t in [0, 1], dithered at (x, y).
function M.ramp(list, t, x, y)
  local f = math.max(0, math.min(1, t)) * (#list - 1)
  local i = math.floor(f)
  if f - i > M.bayer(x, y) then i = i + 1 end
  return list[math.min(#list, i + 1)]
end

function M.fillRect(b, x0, y0, x1, y1, c)
  for y = y0, y1 do for x = x0, x1 do M.set(b, x, y, c) end end
end

function M.disc(b, cx, cy, r, c)
  for y = math.floor(cy - r), math.ceil(cy + r) do
    for x = math.floor(cx - r), math.ceil(cx + r) do
      local dx, dy = x + 0.5 - cx, y + 0.5 - cy
      if dx * dx + dy * dy <= r * r then M.set(b, x, y, c) end
    end
  end
end

-- A line of `c` from (x0, y0) to (x1, y1), `w` pixels thick.
function M.line(b, x0, y0, x1, y1, c, w)
  local n = math.max(1, math.ceil(math.max(math.abs(x1 - x0), math.abs(y1 - y0)) * 2))
  for i = 0, n do
    local t = i / n
    local x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    if (w or 1) <= 1 then M.set(b, x, y, c) else M.disc(b, x, y, w / 2, c) end
  end
end

-- Draws src onto dst at (ox, oy); translucent pixels are blended over what's already there.
function M.blit(dst, src, ox, oy)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then
        local r, g, bl, a = M.channels(c)
        local under = M.get(dst, ox + x, oy + y)
        if a < 255 and under then
          local r2, g2, b2 = M.channels(under)
          local k = a / 255
          c = string.format("#%02x%02x%02x", math.floor(r * k + r2 * (1 - k) + 0.5),
            math.floor(g * k + g2 * (1 - k) + 0.5), math.floor(bl * k + b2 * (1 - k) + 0.5))
        end
        if a > 0 then M.set(dst, ox + x, oy + y, c) end
      end
    end
  end
end

-- Mirror image. A pixel at column c lands at w - 1 - c.
function M.flip(src)
  local b = M.buffer(src.w, src.h)
  for y = 0, src.h - 1 do for x = 0, src.w - 1 do b[y][src.w - 1 - x] = src[y][x] end end
  return b
end

function M.scale(src, k)
  local b = M.buffer(src.w * k, src.h * k)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then for yy = 0, k - 1 do for xx = 0, k - 1 do b[y * k + yy][x * k + xx] = c end end end
    end
  end
  return b
end

-- A copy of the w x h rectangle of src at (x, y).
function M.crop(src, x, y, w, h)
  local b = M.buffer(w, h)
  for yy = 0, h - 1 do for xx = 0, w - 1 do b[yy][xx] = M.get(src, x + xx, y + yy) end end
  return b
end

-- A 1px outline in `color` round everything opaque in b (4-neighbour), added outside the shape.
function M.outline(b, color)
  local add = {}
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      if not b[y][x] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          if M.get(b, x + d[1], y + d[2]) then add[#add + 1] = { x, y }; break end
        end
      end
    end
  end
  for _, p in ipairs(add) do b[p[2]][p[1]] = color end
end

-- Loads a PNG (path relative to the repo root) into a buffer of "#rrggbbaa" strings.
function M.load(rel)
  local img = Image{ fromFile = M.path(rel) }
  local b = M.buffer(img.width, img.height)
  local pc = app.pixelColor
  for y = 0, img.height - 1 do
    for x = 0, img.width - 1 do
      local p = img:getPixel(x, y)
      local a = pc.rgbaA(p)
      if a > 0 then b[y][x] = string.format("#%02x%02x%02x%02x", pc.rgbaR(p), pc.rgbaG(p), pc.rgbaB(p), a) end
    end
  end
  return b
end

-- Writes a buffer as a one-layer RGB sprite: the editable .aseprite and/or a PNG (either may be nil).
function M.save(b, asepriteRel, pngRel)
  local spr = Sprite(b.w, b.h, ColorMode.RGB)
  local img = spr.cels[1].image
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local c = b[y][x]
      if c then img:drawPixel(x, y, M.rgba(c)) end
    end
  end
  if asepriteRel then M.ensureDir(asepriteRel); spr:saveAs(M.path(asepriteRel)) end
  if pngRel then M.ensureDir(pngRel); spr:saveCopyAs(M.path(pngRel)) end
  spr:close()
end

-- The palette: palette.json for the game, and a check that a buffer uses only palette colours at
-- full opacity (everything the game shades must). `what` names the image in the error.
function M.palette()
  local P = dofile(M.ROOT .. M.ART .. "palette.lua")
  local index = {}
  for i, name in ipairs(P.order) do
    assert(P.hex[name], "palette: no colour for " .. name)
    assert(not index[P.hex[name]], "palette: " .. name .. " repeats " .. P.hex[name])
    index[P.hex[name]] = i
  end
  P.index = index
  return P
end

function M.writePalette(P)
  local colors, glow, names = {}, {}, {}
  for i, name in ipairs(P.order) do colors[i] = P.hex[name] end
  for _, name in ipairs(P.glow) do glow[#glow + 1] = P.index[P.hex[name]] end
  for key, name in pairs(P.names) do names[key] = P.index[P.hex[name]] end
  M.writeText(M.ASSETS .. "palette.json", json.encode({ colors = colors, glow = glow, names = names }))
end

function M.checkPalette(b, P, what)
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local c = b[y][x]
      if c then
        local hex, a = c:sub(1, 7), (#c >= 9) and tonumber(c:sub(8, 9), 16) or 255
        assert(a == 255, string.format("%s: the pixel at %d,%d is see-through (alpha %d)", what, x, y, a))
        assert(P.index[hex], string.format("%s: the pixel at %d,%d is %s, which isn't in palette.lua", what, x, y, hex))
      end
    end
  end
end

-- textures.png and textures.json: 32x32 tiles side by side, in the order given ({ name, buffer }).
function M.writeTextures(P, tiles)
  local size = 32
  local out, names = M.buffer(size * #tiles, size), {}
  for i, t in ipairs(tiles) do
    assert(t[2].w == size and t[2].h == size, "texture " .. t[1] .. " isn't 32x32")
    M.checkPalette(t[2], P, "texture " .. t[1])
    M.blit(out, t[2], (i - 1) * size, 0)
    names[i] = t[1]
  end
  M.save(out, M.ART .. "textures.aseprite", M.ASSETS .. "textures.png")
  M.writeText(M.ASSETS .. "textures.json", json.encode({ size = size, names = names }))
  return out
end

-- sprites.png and sprites.json. Each sprite is { name, frames = { buffers, all one size }, height (world
-- units tall), anims = { anim = { frame numbers from 0 } }, stride? (cells walked per frame), ms? (per
-- frame, for looping props) }. Each sprite's frames go left to right on their own row.
function M.writeSprites(P, sprites)
  local width, height = 0, 0
  for _, s in ipairs(sprites) do
    width = math.max(width, s.frames[1].w * #s.frames)
    height = height + s.frames[1].h
  end
  local out, meta, y = M.buffer(width, height), {}, 0
  for _, s in ipairs(sprites) do
    local fw, fh = s.frames[1].w, s.frames[1].h
    for i, f in ipairs(s.frames) do
      assert(f.w == fw and f.h == fh, s.name .. ": frame " .. i .. " is a different size")
      M.checkPalette(f, P, s.name .. " frame " .. (i - 1))
      M.blit(out, f, (i - 1) * fw, y)
    end
    for anim, list in pairs(s.anims) do
      for _, n in ipairs(list) do assert(n >= 0 and n < #s.frames, s.name .. "." .. anim .. " names frame " .. n) end
    end
    meta[s.name] = { x = 0, y = y, w = fw, h = fh, count = #s.frames, height = s.height, stride = s.stride, ms = s.ms, anims = s.anims }
    y = y + fh
  end
  M.save(out, M.ART .. "sprites.aseprite", M.ASSETS .. "sprites.png")
  M.writeText(M.ASSETS .. "sprites.json", json.encode({ sprites = meta }))
  return out
end

-- A sheet of named pieces packed left to right: hands.png/.json ({ name, buffer, ox, oy } each, where
-- (ox, oy) places the frame's top-left relative to the bottom centre of the view) or hud.png/.json
-- ({ name, buffer } each). These are drawn as images, so they may use any colour and alpha.
function M.writePieces(kind, pieces)
  local width, height = 0, 0
  for _, p in ipairs(pieces) do
    width = width + p[2].w + 1
    height = math.max(height, p[2].h)
  end
  local out, meta, x = M.buffer(width, height), {}, 0
  for _, p in ipairs(pieces) do
    M.blit(out, p[2], x, 0)
    meta[p[1]] = kind == "hands" and { x, 0, p[2].w, p[2].h, p[3], p[4] } or { x, 0, p[2].w, p[2].h }
    x = x + p[2].w + 1
  end
  M.save(out, M.ART .. kind .. ".aseprite", M.ASSETS .. kind .. ".png")
  M.writeText(M.ASSETS .. kind .. ".json", json.encode(kind == "hands" and { frames = meta } or { icons = meta }))
  return out
end

return M
```

- [ ] **Step 2: Check the helpers in Aseprite**

Write this throwaway script to the scratchpad as `lib-check.lua` (not the repo):
```lua
local L = dofile("/Users/nathan/Documents/code/games/art/last-light/lib.lua")
local P = L.palette()
print("root", L.ROOT, "colours", #P.order, "glow", #P.glow)
local bad = L.buffer(2, 2)
L.set(bad, 1, 1, "#123456")
print(pcall(L.checkPalette, bad, P, "check"))
print(L.ramp({ "a", "b", "c" }, 1, 0, 0))
```
Run: `cd /Users/nathan/Documents/code/games && /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script <scratchpad>/lib-check.lua`
Expected:
- `root /Users/nathan/Documents/code/games/  colours 59  glow 9`;
- then `false` and an error naming `check: the pixel at 1,1 is #123456, which isn't in palette.lua`;
- then `c`.

- [ ] **Step 3: Paint the textures and the sky**

Write `art/last-light/textures.lua` and `art/last-light/sky.lua` to the briefs above, starting each like this:
```lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
```
- `textures.lua` ends with `L.writePalette(P)` and `L.writeTextures(P, { { "trunks", trunks }, …in the order above… })`.
- `sky.lua` ends with `L.checkPalette(sky, P, "sky")` and `L.save(sky, nil, L.ASSETS .. "sky.png")`.
- Give each tile its own function that returns a 32×32 buffer.

Run from the repo root:
```bash
cd /Users/nathan/Documents/code/games
for s in textures sky; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done
```
Expected: `last-light/assets/palette.json`, `textures.png` (288×32), `textures.json` and `sky.png` (1024×128), with no errors. Run it twice: `git status` must show no change from the second run (determinism).

- [ ] **Step 4: Draw the crawler and the gaunt**

Write `art/last-light/sprites.lua` to the brief. Give each creature a function returning its list of frames. Build the frames from shared body parts (head, torso, limbs posed by a few joint angles) rather than 16 hand-placed drawings, so that a later change reaches every frame. End with:
```lua
L.writeSprites(P, {
  { name = "crawler", frames = crawler(), height = 0.45, stride = 0.35,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, attack = { 8, 9 }, hurt = { 10 }, die = { 11, 12, 13, 14, 15 } } },
  { name = "gaunt", frames = gaunt(), height = 1.25, stride = 0.5,
    anims = { walk = { 0, 1, 2, 3 }, ["side-walk"] = { 4, 5, 6, 7 }, windup = { 8 }, attack = { 9, 10 }, hurt = { 11 }, die = { 12, 13, 14, 15, 16 } } },
})
```
Run: `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/sprites.lua` from the repo root.
Expected: `sprites.png` and `sprites.json` are written. Running it a second time changes nothing.

- [ ] **Step 5: The style test**

`art/last-light/style-test.lua`:
```lua
-- The style test: one review sheet of Last Light's art, scaled 3x into
-- art/last-light/preview-style.png (not committed). Top to bottom: the palette; every texture at
-- three light levels (full lantern light, half, and the dim edge of the light), shaded the way the
-- game shades them (last-light/src/shade.js); a slice of the sky; and every sprite's frames, at full
-- light and dim. Run it after the other scripts:
--   aseprite -b --script art/last-light/style-test.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()

-- shade.js's light tables, for one colour at level l (0-15).
local FOG, COLD, WARM = { 6, 8, 14 }, { 0.7, 0.8, 1.0 }, { 1.08, 0.92, 0.72 }
local glow = {}
for _, n in ipairs(P.glow) do glow[P.hex[n]] = true end
local function shade(hex, l)
  if glow[hex] then return hex end
  local k = l / 15
  local t = k ^ 1.4
  local r, g, b = L.channels(hex)
  local out = {}
  for i, v in ipairs({ r, g, b }) do
    local tint = COLD[i] + (WARM[i] - COLD[i]) * k
    out[i] = math.max(0, math.min(255, math.floor(FOG[i] + (v * tint - FOG[i]) * t + 0.5)))
  end
  return string.format("#%02x%02x%02x", out[1], out[2], out[3])
end
local function lit(src, l)
  local b = L.buffer(src.w, src.h)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then b[y][x] = shade(c:sub(1, 7), l) end
    end
  end
  return b
end

local tex = L.load(L.ASSETS .. "textures.png")
local texMeta = L.readJson(L.ASSETS .. "textures.json")
local sky = L.load(L.ASSETS .. "sky.png")
local spr = L.load(L.ASSETS .. "sprites.png")
local sprMeta = L.readJson(L.ASSETS .. "sprites.json").sprites
local names = {}
for name in pairs(sprMeta) do names[#names + 1] = name end
table.sort(names)

local LEVELS = { 15, 9, 4 }
local W = math.max(#texMeta.names * 34, 520)
local H = 12 + 3 * 34 + 72 + 8
for _, n in ipairs(names) do H = H + sprMeta[n].h * 2 + 6 end
local out = L.buffer(W, H)
L.fillRect(out, 0, 0, W - 1, H - 1, P.hex.void)
-- The palette, in index order.
for i, n in ipairs(P.order) do L.fillRect(out, (i - 1) * 8, 0, (i - 1) * 8 + 7, 7, P.hex[n]) end
-- The textures at three light levels.
local y = 12
for row, l in ipairs(LEVELS) do
  for i = 1, #texMeta.names do
    L.blit(out, lit(L.crop(tex, (i - 1) * 32, 0, 32, 32), l), (i - 1) * 34, y + (row - 1) * 34)
  end
end
y = y + 3 * 34
-- A slice of the sky at the night's level.
L.blit(out, lit(L.crop(sky, 0, math.max(0, sky.h - 72), math.min(W, sky.w), math.min(72, sky.h)), 4), 0, y)
y = y + 72 + 8
-- Every sprite: all frames lit, then dim.
for _, n in ipairs(names) do
  local s = sprMeta[n]
  local strip = L.crop(spr, s.x, s.y, s.w * s.count, s.h)
  L.blit(out, lit(strip, 15), 0, y)
  L.blit(out, lit(strip, 6), 0, y + s.h + 2)
  y = y + s.h * 2 + 6
end
L.save(L.scale(out, 3), nil, L.ART .. "preview-style.png")
print("style test written: " .. L.ART .. "preview-style.png")
```

Run: `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/style-test.lua`
Expected: `style test written: art/last-light/preview-style.png`. Look at it (Read the PNG).
- The three texture rows should read as lamplit, half-lit and nearly dark.
- The crawler and gaunt should be clear at full light, and still readable as shapes when dim, with their eyes glowing in both.
- If anything is muddy, fix it now: the whole game is judged on this.

- [ ] **Step 6: Commit, and hand over the preview**

```bash
cd /Users/nathan/Documents/code/games
git add art/last-light last-light/assets
git commit -m "Last Light: the palette, art helpers, textures, sky, crawler and gaunt, and the style test"
```
Report the path of `art/last-light/preview-style.png` in your report. The controller sends it to Nathan as a preview and carries on (Refinement 2).

---

### Task 7: Loading the art, the scene and the HUD

**Files:**
- Create: `last-light/src/assets.js`, `last-light/src/effects.js`, `last-light/src/scene.js`, `last-light/src/hud.js`
- Test: `last-light/test/fake-art.js`, `last-light/test/assets.test.js`, `last-light/test/scene.test.js`, `last-light/test/hud.test.js`

**Interfaces:**
- Consumes:
  - From Tasks 1–5: the state and `tuning.js`.
  - From Task 3: `lightmap.js`, `shade.js` and `render.js`'s `TEX` and frame shape.
  - The asset contracts from Task 6.
- Produces:
  - `assets.js`:
    - `FLOORS`, `loadJson`, `loadImage`, `imagePixels(img)` (browser only), `indexPixels`, `cut` and `unpackArt(json, images, pixels)`.
    - `loadArt(base?, io?) → art`.
    - `art` is `{ palette, shades, walls, floors, sky, sprites, flake, ichor, hands: {image, frames}, hud: {image, icons}, ui: {text, dim, hurt, night} }`.
  - `effects.js`: `createEffects()`, `spray(fx, x, y, z, fromX, fromY, count?)` and `updateEffects(fx, dt)`.
  - `scene.js`:
    - `SPRITE_ANIMS` (every sprite and the animations it must have) and `createScene(art)`, which throws if art is missing anything.
    - `creatureFrame(art, c, camX, camY, camRightX, camRightY, out)` and `sceneEvents(scene, state)` (a hit throws the spray).
    - `buildFrame(scene, state, lightmap, view) → frame`, where `view` is `{ facing, alpha, time, dt, reducedMotion, h, focal }`. `scene.shakeX` and `scene.shakeY` are in internal pixels.
  - `hud.js`:
    - `HAND_FRAMES` (16 names) and `HUD_ICONS` (8 names).
    - `gunFrame(gun) → { name, drop }` (the object is reused) and `handFrame(gun, time)`.
    - `drawHud(ctx, art, state, view, info)` and `drawScreen(ctx, art, view, screen, info)`.
  - `test/fake-art.js`: `fakeArt()`, `fakeContext()`, `HANDS` and `ICONS`.
- Sprite frames and animation names (`SPRITE_ANIMS`) are the contract Task 8's art must meet. `test/art.test.js` (Task 8) checks the committed files against these exports.

- [ ] **Step 1: Write the fake art and the failing tests**

`last-light/test/fake-art.js`:
```js
// A complete, tiny art set in the shapes assets.js produces, for testing the scene and the HUD
// without the real PNGs.
import { buildShades } from '../src/shade.js';
import { TEX } from '../src/render.js';
import { HAND_FRAMES, HUD_ICONS } from '../src/hud.js';

const frame = (w, h, v = 1) => ({ w, h, px: new Uint8Array(w * h).fill(v) });
const sprite = (height, anims, count) => ({ height, stride: 0.35, ms: 120, anims, frames: Array.from({ length: count }, (_, i) => frame(4, 6, 1 + (i % 5))) });
const creature = (extra = {}, n = 15) => sprite(0.8, { walk: [0, 1, 2, 3], 'side-walk': [4, 5, 6, 7], attack: [8, 9], hurt: [10], die: [11, 12, 13, 14], ...extra }, n);

export const HANDS = HAND_FRAMES;
export const ICONS = HUD_ICONS;

export function fakeArt() {
  const flat = () => new Uint8Array(TEX * TEX).fill(2);
  return {
    shades: buildShades(['#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#402010']),
    walls: { trunks: flat(), logs: flat(), window: flat(), woodpile: flat(), wagonSide: flat(), wagonEnd: flat() },
    floors: { snow: flat(), planks: flat(), rafters: flat() },
    sky: { w: 16, h: 8, px: new Uint8Array(128).fill(1) },
    flake: 1,
    ichor: 7,
    sprites: {
      crawler: creature(),
      gaunt: creature({ windup: [15] }, 16),
      leaper: creature({ crouch: [15], leap: [16], 'side-leap': [17] }, 18),
      mother: creature({ windup: [15] }, 16),
      stove: sprite(0.6, { idle: [0, 1] }, 2),
      well: sprite(0.5, { idle: [0] }, 1),
      pine: sprite(2.5, { idle: [0] }, 1),
      flare: sprite(0.2, { idle: [0, 1, 2] }, 3),
      'pickup-flare': sprite(0.2, { idle: [0] }, 1),
      'pickup-shells': sprite(0.2, { idle: [0] }, 1),
      'pickup-shotgun': sprite(0.2, { idle: [0] }, 1),
    },
    hands: { image: { name: 'hands' }, frames: Object.fromEntries(HANDS.map((n, i) => [n, [i * 10, 0, 10, 10, -5, -10]])) },
    hud: { image: { name: 'hud' }, icons: Object.fromEntries(ICONS.map((n, i) => [n, [i * 8, 0, 6, 8]])) },
    ui: { text: '#eeeeee', dim: '#888888', hurt: '#aa0000', night: '#05070c' },
  };
}

// A stand-in 2D context that records what's drawn.
export function fakeContext() {
  const calls = { images: [], texts: [], rects: [] };
  return {
    calls,
    globalAlpha: 1, fillStyle: '', font: '', textAlign: 'left', textBaseline: 'top',
    drawImage(img, ...args) {
      calls.images.push({ img, args });
    },
    fillText(str, x, y) {
      calls.texts.push({ str, x, y, color: this.fillStyle });
    },
    fillRect(x, y, w, h) {
      calls.rects.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha });
    },
  };
}
```

`last-light/test/assets.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexPixels, cut, unpackArt } from '../src/assets.js';

// RGBA for a w x h image from a function of (x, y) giving "#rrggbb" or null (transparent).
function rgba(w, h, at) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (!c) continue;
      const i = (y * w + x) * 4;
      data[i] = parseInt(c.slice(1, 3), 16);
      data[i + 1] = parseInt(c.slice(3, 5), 16);
      data[i + 2] = parseInt(c.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}

test('pixels become palette indices, transparent is 0, and a stray colour is named', () => {
  const colors = ['#000000', '#ffffff'];
  const idx = indexPixels(rgba(2, 1, (x) => (x ? '#ffffff' : null)), colors, 't');
  assert.deepEqual([...idx], [0, 2]);
  assert.throws(() => indexPixels(rgba(1, 1, () => '#123456'), colors, 'sky.png'), /sky\.png: the pixel at 0,0 is #123456/);
});

test('cut: rows for floors, columns for walls and sprites', () => {
  const img = Uint8Array.from([1, 2, 3, 4]); // 2x2
  assert.deepEqual([...cut(img, 2, 0, 0, 2, 2, false)], [1, 2, 3, 4]);
  assert.deepEqual([...cut(img, 2, 0, 0, 2, 2, true)], [1, 3, 2, 4]);
});

test('unpackArt: textures by name, the sky, sprite frames, named colours', () => {
  const colors = ['#101010', '#202020', '#303030'];
  const json = {
    palette: { colors, glow: [3], names: { flake: 2, ichor: 1, ui: 2, uiDim: 1, hurt: 3, night: 1 } },
    textures: { size: 2, names: ['trunks', 'snow'] },
    sprites: { sprites: { well: { x: 0, y: 0, w: 1, h: 2, count: 2, height: 0.5, anims: { idle: [0, 1] } } } },
    hands: { frames: {} },
    hud: { icons: {} },
  };
  const images = { textures: 'tex', sky: 'sky', sprites: 'spr', hands: 'hands', hud: 'hud' };
  const pixels = (img) =>
    ({
      tex: rgba(4, 2, (x, y) => colors[(x + y) % 2]),
      sky: rgba(3, 1, () => colors[2]),
      spr: rgba(2, 2, (x, y) => (x === 0 ? colors[y] : null)),
    })[img];
  const art = unpackArt(json, images, pixels);
  assert.deepEqual(Object.keys(art.walls), ['trunks']);
  assert.deepEqual(Object.keys(art.floors), ['snow']);
  assert.deepEqual([...art.walls.trunks], [1, 2, 2, 1]);
  assert.deepEqual([art.sky.w, art.sky.h, art.sky.px[0]], [3, 1, 3]);
  assert.deepEqual([...art.sprites.well.frames[0].px], [1, 2]);
  assert.deepEqual([...art.sprites.well.frames[1].px], [0, 0]);
  assert.equal(art.shades.emissive[3], 1);
  assert.deepEqual(art.ui, { text: '#202020', dim: '#101010', hurt: '#303030', night: '#101010' });
  assert.equal(art.flake, 2);
});
```

`last-light/test/scene.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScene, buildFrame, creatureFrame, sceneEvents } from '../src/scene.js';
import { spawnCreature, CRAWLER, LEAPER, GAUNT } from '../src/creatures.js';
import { createLightmap, lightAt } from '../src/lightmap.js';
import { emit } from '../src/events.js';
import { LIGHT } from '../src/tuning.js';
import { fakeArt } from './fake-art.js';
import { quietState } from './helpers.js';

const view = (over = {}) => ({ facing: Math.PI / 2, alpha: 1, time: 0, dt: 1 / 60, reducedMotion: false, h: 270, focal: 240, ...over });

test('the camera blends between the last two updates', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.player.px = 10;
  s.player.x = 11;
  const f = buildFrame(scene, s, createLightmap(s.map), view({ alpha: 0.25 }));
  assert.equal(f.x, 10.25);
});

test('every creature, prop, active pickup and burning flare becomes a sprite', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  spawnCreature(s, CRAWLER, 19.5, 25.5);
  spawnCreature(s, GAUNT, 21.5, 25.5);
  s.pickups[0].active = true;
  s.flares[0].t = 5;
  const f = buildFrame(scene, s, createLightmap(s.map), view());
  assert.equal(f.spriteCount, 2 + s.map.props.length + 1 + 1);
});

test('a creature walking across your view shows its side, flipped by direction; towards you, its front', () => {
  const art = fakeArt();
  const s = quietState();
  const c = spawnCreature(s, CRAWLER, 19.5, 25.5);
  const out = { frame: null, flip: false };
  const rx = -1, ry = 0; // camera facing south: its right is west
  c.heading = -Math.PI / 2; // straight at you
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.ok(art.sprites.crawler.anims.walk.map((i) => art.sprites.crawler.frames[i]).includes(out.frame));
  c.heading = 0; // east: to your left
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.ok(art.sprites.crawler.anims['side-walk'].map((i) => art.sprites.crawler.frames[i]).includes(out.frame));
  const eastFlip = out.flip;
  c.heading = Math.PI;
  creatureFrame(art, c, 19.5, 20.5, rx, ry, out);
  assert.notEqual(out.flip, eastFlip);
});

test('crouching and leaping leapers, winding-up gaunts, and the dying show those frames', () => {
  const art = fakeArt();
  const s = quietState();
  const out = { frame: null, flip: false };
  const l = spawnCreature(s, LEAPER, 19.5, 25.5);
  l.mode = 'crouch';
  creatureFrame(art, l, 19.5, 20.5, -1, 0, out);
  assert.equal(out.frame, art.sprites.leaper.frames[art.sprites.leaper.anims.crouch[0]]);
  const g = spawnCreature(s, GAUNT, 19.5, 25.5);
  g.mode = 'windup';
  creatureFrame(art, g, 19.5, 20.5, -1, 0, out);
  assert.equal(out.frame, art.sprites.gaunt.frames[art.sprites.gaunt.anims.windup[0]]);
  g.dying = 0.01;
  creatureFrame(art, g, 19.5, 20.5, -1, 0, out);
  const die = art.sprites.gaunt.anims.die;
  assert.equal(out.frame, art.sprites.gaunt.frames[die[die.length - 1]]);
});

test('eyes fade out with distance', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  spawnCreature(s, CRAWLER, 19.5, 22.5);
  spawnCreature(s, CRAWLER, 19.5, 20.5 + LIGHT.eyes.dark + 1);
  const f = buildFrame(scene, s, createLightmap(s.map), view());
  const glows = f.sprites.slice(0, 2).map((x) => x.glow);
  assert.deepEqual(glows, [15, 0]);
});

test('the lantern lights where you stand, and the muzzle flash adds to it', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  const lm = createLightmap(s.map);
  buildFrame(scene, s, lm, view());
  const plain = lightAt(lm, s.player.x, s.player.y);
  assert.ok(plain > 0.9);
  s.flash = 0.04;
  buildFrame(scene, s, lm, view());
  assert.ok(lightAt(lm, s.player.x, s.player.y) > plain + 0.5);
});

test('reduced motion: no head bob, no shake', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.player.vx = 3;
  s.player.walked = 0.2;
  s.shake = 0.1;
  let f = buildFrame(scene, s, createLightmap(s.map), view({ reducedMotion: true, time: 1.3 }));
  assert.equal(f.bob, 0);
  assert.deepEqual([scene.shakeX, scene.shakeY], [0, 0]);
  f = buildFrame(scene, s, createLightmap(s.map), view({ time: 1.3 }));
  assert.notEqual(f.bob, 0);
});

test('a hit throws a spray of droplets that fall to the snow', () => {
  const art = fakeArt();
  const scene = createScene(art);
  const s = quietState();
  s.eventCount = 0;
  emit(s, 'hit', 19.5, 25.5, 1, 1);
  sceneEvents(scene, s);
  const live = scene.fx.drops.filter((d) => d.t > 0);
  assert.equal(live.length, 14);
  for (let i = 0; i < 10; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.y > 25.5), 'thrown away from you');
  for (let i = 0; i < 60; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.t > 0 && d.z === 0), 'landed, and still lying there');
  for (let i = 0; i < 30; i++) buildFrame(scene, s, createLightmap(s.map), view());
  assert.ok(live.every((d) => d.t <= 0), 'gone');
});
```

`last-light/test/hud.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunFrame, handFrame, drawHud, drawScreen } from '../src/hud.js';
import { createGun, giveShotgun, RIFLE_ID, SHOTGUN_ID } from '../src/weapons.js';
import { SWITCH_TIME, RIFLE, FLARE } from '../src/tuning.js';
import { fakeArt, fakeContext, HANDS } from './fake-art.js';
import { quietState } from './helpers.js';

test('the rifle: flash, idle, the lever working, reloading', () => {
  const g = createGun();
  g.shotT = 0.03;
  assert.equal(gunFrame(g).name, 'rifle-fire');
  g.shotT = 0.25;
  assert.equal(gunFrame(g).name, 'rifle-lever-1');
  g.shotT = 0.35;
  assert.equal(gunFrame(g).name, 'rifle-lever-2');
  g.shotT = 5;
  g.reloading = true;
  g.reloadT = RIFLE.reloadPerRound * 0.1;
  assert.equal(gunFrame(g).name, 'rifle-reload-3');
  g.reloading = false;
  assert.equal(gunFrame(g).name, 'rifle-idle');
});

test('switching lowers one gun and raises the other', () => {
  const g = createGun();
  g.shotT = 5;
  g.next = SHOTGUN_ID;
  g.switching = SWITCH_TIME * 0.75;
  let f = gunFrame(g);
  assert.equal(f.name, 'rifle-idle');
  assert.ok(f.drop > 0.4 && f.drop < 0.6);
  g.switching = SWITCH_TIME * 0.25;
  f = gunFrame(g);
  assert.equal(f.name, 'shotgun-idle');
  assert.ok(f.drop > 0.4 && f.drop < 0.6);
});

test('every frame name the HUD can ask for exists in the hands art', () => {
  const g = createGun();
  const names = new Set();
  for (const current of [RIFLE_ID, SHOTGUN_ID]) {
    g.current = current;
    for (const reloading of [false, true]) {
      g.reloading = reloading;
      for (let t = 0; t < 1.3; t += 0.01) {
        g.shotT = t;
        g.reloadT = t;
        names.add(gunFrame(g).name);
      }
    }
  }
  for (const t of [0, 0.1, FLARE.cooldown - 0.05, FLARE.cooldown - 0.2]) {
    g.flareT = t;
    names.add(handFrame(g, 0));
    names.add(handFrame(g, 0.125));
  }
  for (const n of names) assert.ok(HANDS.includes(n), n);
});

test('the HUD shows your health, the hour, rounds and flares', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  s.player.health = 64.2;
  s.gun.rifle = 5;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  const texts = ctx.calls.texts.map((t) => t.str);
  assert.ok(texts.includes('65'));
  assert.ok(texts.includes('8 PM'));
  const icons = ctx.calls.images.filter((i) => i.img === art.hud.image).map((i) => i.args[0]);
  const at = (name) => art.hud.icons[name][0];
  assert.equal(icons.filter((x) => x === at('round')).length, 5);
  assert.equal(icons.filter((x) => x === at('roundEmpty')).length, 3);
  assert.equal(icons.filter((x) => x === at('flare')).length, FLARE.start);
});

test('with the shotgun: shells loaded, and the spares as a number', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  giveShotgun(s);
  s.gun.current = SHOTGUN_ID;
  s.gun.switching = 0;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  assert.ok(ctx.calls.texts.map((t) => t.str).includes('6'));
});

test('hurt: the edges glow red', () => {
  const art = fakeArt();
  const ctx = fakeContext();
  const s = quietState();
  s.hurt = 0.3;
  drawHud(ctx, art, s, { w: 480, h: 270 }, { time: 0, hitT: 9, banner: { t: 0 }, reducedMotion: false });
  assert.equal(ctx.calls.rects.filter((r) => r.color === art.ui.hurt).length, 4);
});

test('the title shows your best night; the death screen the hour it ended', () => {
  const art = fakeArt();
  let ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'title', { time: 0, best: { hour: 5, dawns: 0 }, reached: 0, kills: 0 });
  assert.ok(ctx.calls.texts.some((t) => t.str === 'Best night: 2 AM'));
  ctx = fakeContext();
  drawScreen(ctx, art, { w: 480, h: 270 }, 'dead', { time: 0, best: { hour: 5, dawns: 0 }, reached: 3, kills: 40 });
  assert.ok(ctx.calls.texts.some((t) => t.str.startsWith('It was 12 AM.')));
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL, with `Cannot find module` for `assets.js`, `scene.js` and `hud.js`. The 89 earlier tests pass.

- [ ] **Step 3: Write the modules**

`last-light/src/assets.js`:
```js
// Loads the art that the scripts in art/last-light/ write to last-light/assets/, and unpacks the
// world's images (textures, sky, sprites) into palette indices for the renderer. The guns in your
// hands and the HUD icons stay as images, drawn with the canvas.
//
//   palette.json   { colors: ["#rrggbb", ...] (index 1 up), glow: [indices], names: { flake, ichor, ui, uiDim, hurt, night } }
//   textures.json  { size: 32, names: [...] }, textures.png: the tiles side by side in that order
//   sky.png        the panorama; its bottom row sits on the horizon, and it wraps round
//   sprites.json   { sprites: { name: { x, y, w, h, count, height, stride?, ms?, anims: { anim: [frame...] } } } }
//                  sprites.png: each sprite's frames left to right from (x, y)
//   hands.json     { frames: { name: [x, y, w, h, ox, oy] } }: (ox, oy) places the frame's top-left
//                  relative to the bottom centre of the view
//   hud.json       { icons: { name: [x, y, w, h] } }
import { buildShades } from './shade.js';

export const FLOORS = new Set(['snow', 'planks', 'rafters']);
const JSON_FILES = ['palette', 'textures', 'sprites', 'hands', 'hud'];
const IMAGE_FILES = ['textures', 'sky', 'sprites', 'hands', 'hud'];

export async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`couldn't load ${url}`));
    img.src = url;
  });
}

export function imagePixels(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data };
}

// RGBA pixels to palette indices (0 where transparent). A colour not in the palette is an art bug,
// and is reported with where it is.
export function indexPixels({ w, h, data }, colors, name) {
  const lookup = new Map(colors.map((hex, i) => [parseInt(hex.slice(1), 16), i + 1]));
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] === 0) continue;
    const rgb = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    const idx = lookup.get(rgb);
    if (idx === undefined) {
      throw new Error(`${name}: the pixel at ${i % w},${Math.floor(i / w)} is #${rgb.toString(16).padStart(6, '0')}, which isn't in the palette`);
    }
    out[i] = idx;
  }
  return out;
}

// The w x h piece of an indexed image at (x, y), row by row, or column by column if `columns`.
export function cut(indexed, imgW, x, y, w, h, columns) {
  const out = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) out[columns ? xx * h + yy : yy * w + xx] = indexed[(y + yy) * imgW + x + xx];
  }
  return out;
}

// json: { palette, textures, sprites, hands, hud }; images: { textures, sky, sprites, hands, hud };
// pixels(image) -> { w, h, data (RGBA) }.
export function unpackArt(json, images, pixels) {
  const { palette } = json;
  const shades = buildShades(palette.colors, new Set(palette.glow));
  const tex = pixels(images.textures);
  const texIdx = indexPixels(tex, palette.colors, 'textures.png');
  const size = json.textures.size;
  const walls = {}, floors = {};
  json.textures.names.forEach((name, i) => {
    const floor = FLOORS.has(name);
    (floor ? floors : walls)[name] = cut(texIdx, tex.w, i * size, 0, size, size, !floor);
  });
  const skyPx = pixels(images.sky);
  const sky = { w: skyPx.w, h: skyPx.h, px: indexPixels(skyPx, palette.colors, 'sky.png') };
  const spr = pixels(images.sprites);
  const sprIdx = indexPixels(spr, palette.colors, 'sprites.png');
  const sprites = {};
  for (const [name, s] of Object.entries(json.sprites.sprites)) {
    sprites[name] = {
      height: s.height, stride: s.stride, ms: s.ms, anims: s.anims,
      frames: Array.from({ length: s.count }, (_, i) => ({ w: s.w, h: s.h, px: cut(sprIdx, spr.w, s.x + i * s.w, s.y, s.w, s.h, true) })),
    };
  }
  const color = (n) => palette.colors[palette.names[n] - 1];
  return {
    palette, shades, walls, floors, sky, sprites,
    flake: palette.names.flake,
    ichor: palette.names.ichor,
    hands: { image: images.hands, frames: json.hands.frames },
    hud: { image: images.hud, icons: json.hud.icons },
    ui: { text: color('ui'), dim: color('uiDim'), hurt: color('hurt'), night: color('night') },
  };
}

export async function loadArt(base = new URL('../assets/', import.meta.url), io = { json: loadJson, image: loadImage, pixels: imagePixels }) {
  const at = (f) => new URL(f, base).href;
  const jsons = await Promise.all(JSON_FILES.map((f) => io.json(at(`${f}.json`))));
  const imgs = await Promise.all(IMAGE_FILES.map((f) => io.image(at(`${f}.png`))));
  const json = Object.fromEntries(JSON_FILES.map((f, i) => [f, jsons[i]]));
  const images = Object.fromEntries(IMAGE_FILES.map((f, i) => [f, imgs[i]]));
  return unpackArt(json, images, io.pixels);
}
```

`last-light/src/effects.js`:
```js
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
```

`last-light/src/scene.js`:
```js
// Turns the game state into what the renderer draws this frame: the camera (blended between the last
// two updates, with the head bob and the gun's kick), the lights, and every sprite with its animation
// frame. Allocates nothing per frame: the sprite list is a fixed pool.
//
// art.sprites[name] = { height, stride?, ms?, frames: [{ w, h, px }], anims: { name: [frame indices] } },
// with the animations SPRITE_ANIMS lists.
import { VIEW, LIGHT, FEEL, CREATURES } from './tuning.js';
import { KINDS, LEAPER } from './creatures.js';
import { beginLight, addLight, falloff } from './lightmap.js';
import { ambientFor, skyLevelFor } from './night.js';
import { createEffects, spray, updateEffects } from './effects.js';

// Every sprite the game draws, and the animations each must have.
export const SPRITE_ANIMS = {
  crawler: ['walk', 'side-walk', 'attack', 'hurt', 'die'],
  gaunt: ['walk', 'side-walk', 'windup', 'attack', 'hurt', 'die'],
  leaper: ['walk', 'side-walk', 'crouch', 'leap', 'side-leap', 'attack', 'hurt', 'die'],
  mother: ['walk', 'side-walk', 'windup', 'attack', 'hurt', 'die'],
  stove: ['idle'],
  well: ['idle'],
  pine: ['idle'],
  flare: ['idle'],
  'pickup-flare': ['idle'],
  'pickup-shells': ['idle'],
  'pickup-shotgun': ['idle'],
};
const MAX_SPRITES = 128;
const SPRAY_Z = [0.25, 0.85, 0.4, 1.3]; // where on each kind the spray comes from
const PICKUP_SPRITE = ['pickup-flare', 'pickup-shells', 'pickup-shotgun'];
const SIDE_FROM = (50 * Math.PI) / 180, SIDE_TO = (130 * Math.PI) / 180;

export function createScene(art) {
  for (const [name, anims] of Object.entries(SPRITE_ANIMS)) {
    if (!art.sprites[name]) throw new Error(`no sprite "${name}"`);
    for (const a of anims) if (!art.sprites[name].anims[a]?.length) throw new Error(`sprite "${name}" has no "${a}" animation`);
  }
  const sprites = Array.from({ length: MAX_SPRITES }, () => ({ x: 0, y: 0, height: 1, lift: 0, frame: null, flip: false, glow: 15 }));
  return {
    art, sprites,
    frame: { x: 0, y: 0, facing: 0, bob: 0, map: null, lightmap: null, skyLevel: 0, time: 0, sprites, spriteCount: 0, snow: true, drops: null },
    shakeX: 0, shakeY: 0, count: 0,
    fx: createEffects(),
  };
}

// Reacts to one update's events: a hit throws a spray away from you (more for a kill).
export function sceneEvents(scene, state) {
  const p = state.player;
  for (let i = 0; i < state.eventCount; i++) {
    const e = state.events[i];
    if (e.type === 'hit') spray(scene.fx, e.x, e.y, SPRAY_Z[e.a], p.x, p.y, e.b ? 14 : 7);
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a, b, t) => a + (b - a) * t;

// The frame of a looping animation `ms` per frame at `time` seconds, or of a one-shot at progress p.
function loopFrame(spr, anim, time) {
  const list = spr.anims[anim];
  return spr.frames[list[Math.floor((time * 1000) / (spr.ms ?? 150)) % list.length]];
}
function progressFrame(spr, anim, p) {
  const list = spr.anims[anim];
  return spr.frames[list[Math.min(list.length - 1, Math.floor(p * list.length))]];
}

// Which animation frame a creature shows, seen from (camX, camY), written into `out` ({ frame, flip }).
export function creatureFrame(art, c, camX, camY, camRightX, camRightY, out) {
  const spr = art.sprites[KINDS[c.kind]];
  let flip = false;
  const toCam = Math.atan2(camY - c.y, camX - c.x);
  const rel = Math.abs(wrap(c.heading - toCam));
  const side = rel > SIDE_FROM && rel < SIDE_TO;
  if (side) flip = Math.cos(c.heading) * camRightX + Math.sin(c.heading) * camRightY < 0;
  let frame;
  if (c.dying) frame = progressFrame(spr, 'die', 1 - c.dying / CREATURES.die);
  else if (c.hurtT > 0) frame = spr.frames[spr.anims.hurt[0]];
  else if (c.kind === LEAPER && c.mode === 'crouch') frame = spr.frames[spr.anims.crouch[0]];
  else if (c.kind === LEAPER && c.mode === 'leap') frame = spr.frames[spr.anims[side ? 'side-leap' : 'leap'][0]];
  else if (c.mode === 'windup' && spr.anims.windup) frame = spr.frames[spr.anims.windup[0]];
  else if (c.struck > 0) frame = progressFrame(spr, 'attack', 1 - c.struck / 0.25);
  else {
    const list = spr.anims[side ? 'side-walk' : 'walk'];
    const i = c.moving || c.walked > 0 ? Math.floor(c.walked / (spr.stride ?? 0.4)) % list.length : 0;
    frame = spr.frames[list[i]];
  }
  out.frame = frame;
  out.flip = side && flip;
  return out;
}

function put(scene, sx, sy, spr, frame, lift, flip, glow) {
  if (scene.count >= MAX_SPRITES) return;
  const s = scene.sprites[scene.count++];
  s.x = sx;
  s.y = sy;
  s.height = spr.height;
  s.frame = frame;
  s.lift = lift;
  s.flip = flip;
  s.glow = glow;
}

const shown = { frame: null, flip: false };

// view: { facing (from input), alpha (clock blend), time (seconds), dt (seconds since the last frame),
//        reducedMotion, h (view height), focal }
export function buildFrame(scene, state, lightmap, view) {
  const { art } = scene;
  const f = scene.frame, p = state.player, t = view.time;
  const x = lerp(p.px, p.x, view.alpha), y = lerp(p.py, p.y, view.alpha);
  f.x = x;
  f.y = y;
  f.facing = view.facing;
  f.map = state.map;
  f.lightmap = lightmap;
  f.time = t;
  f.skyLevel = skyLevelFor(state.night);
  updateEffects(scene.fx, view.dt ?? 0);
  f.drops = scene.fx.drops;
  // Head bob: a step every 0.9 cells walked, scaled by how fast you're going; the kick lifts the view.
  const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 3);
  const px = view.h / VIEW.targetHeight;
  const bob = view.reducedMotion ? 0 : Math.sin((p.walked / 0.9) * Math.PI * 2) * VIEW.bobPixels * px * speed;
  f.bob = bob + state.gun.kick * view.focal;
  const shake = !view.reducedMotion && state.shake > 0 ? (FEEL.shake.shotgun * px * state.shake) / FEEL.shakeTime : 0;
  scene.shakeX = shake ? Math.round(Math.sin(t * 97) * shake) : 0;
  scene.shakeY = shake ? Math.round(Math.cos(t * 83) * shake) : 0;

  // Lights: the sky, your lantern (flickering), burning flares, and the muzzle flash.
  beginLight(lightmap, ambientFor(state.night));
  const L = LIGHT;
  const flick = 0.95 + 0.05 * Math.sin(t * 13.1) * Math.sin(t * 7.3);
  addLight(lightmap, x, y, L.lantern.full, L.lantern.dark, L.lantern.intensity * flick);
  for (const fl of state.flares) {
    if (fl.t <= 0) continue;
    const dying = Math.min(1, fl.t); // fades over its last second
    addLight(lightmap, fl.x, fl.y, L.flare.full, L.flare.dark, L.flare.intensity * dying * (0.85 + 0.15 * Math.sin(t * 31 + fl.x)));
  }
  if (state.flash > 0) addLight(lightmap, x, y, L.muzzle.full, L.muzzle.dark, L.muzzle.intensity);

  // Sprites.
  scene.count = 0;
  const rightX = -Math.sin(view.facing), rightY = Math.cos(view.facing);
  for (const c of state.creatures) {
    if (!c.alive) continue;
    const cx = lerp(c.px, c.x, view.alpha), cy = lerp(c.py, c.y, view.alpha);
    creatureFrame(art, c, x, y, rightX, rightY, shown);
    const glow = Math.round(15 * falloff(Math.hypot(cx - x, cy - y), L.eyes.full, L.eyes.dark));
    put(scene, cx, cy, art.sprites[KINDS[c.kind]], shown.frame, c.lift, shown.flip, glow);
  }
  for (const prop of state.map.props) {
    const spr = art.sprites[prop.kind];
    put(scene, prop.x, prop.y, spr, loopFrame(spr, 'idle', t), 0, false, 15);
  }
  for (const k of state.pickups) {
    if (!k.active) continue;
    const spr = art.sprites[PICKUP_SPRITE[k.kind]];
    put(scene, k.x, k.y, spr, loopFrame(spr, 'idle', t), 0.04 + 0.03 * Math.sin(t * 3), false, 15);
  }
  const flareSpr = art.sprites.flare;
  for (const fl of state.flares) if (fl.t > 0) put(scene, fl.x, fl.y, flareSpr, loopFrame(flareSpr, 'idle', t), 0, false, 15);
  f.spriteCount = scene.count;
  return f;
}
```

`last-light/src/hud.js`:
```js
// Everything drawn over the world with the canvas 2D context, at internal resolution: the guns and
// lantern in your hands, the crosshair and hit tick, health, ammo, flares, the hour, the hurt glow,
// banners, and the title, death and dawn screens. Text is Silkscreen.
import { RIFLE, SHOTGUN, SWITCH_TIME, FLARE, FEEL, NIGHT } from './tuning.js';
import { RIFLE_ID } from './weapons.js';
import { hourLabel } from './night.js';

// Every frame of the hands art, and every HUD icon, the HUD draws.
export const HAND_FRAMES = [
  'rifle-idle', 'rifle-fire', 'rifle-lever-1', 'rifle-lever-2', 'rifle-reload-1', 'rifle-reload-2', 'rifle-reload-3',
  'shotgun-idle', 'shotgun-fire', 'shotgun-reload-1', 'shotgun-reload-2', 'shotgun-reload-3',
  'lantern-1', 'lantern-2', 'throw-1', 'throw-2',
];
export const HUD_ICONS = ['heart', 'round', 'roundEmpty', 'shell', 'shellEmpty', 'flare', 'crosshair', 'hitTick'];

const FONTS = { 8: '8px Silkscreen, monospace', 16: '16px Silkscreen, monospace', 24: '24px Silkscreen, monospace' };
const HOURS = ['9 PM', '10 PM', '11 PM', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', 'dawn'];
const RIFLE_RELOAD = ['rifle-reload-1', 'rifle-reload-2', 'rifle-reload-3'];
const SHOTGUN_RELOAD = ['shotgun-reload-1', 'shotgun-reload-2', 'shotgun-reload-3'];
// Numbers as text, made once, so the HUD doesn't build new strings every frame.
const NUMBERS = Array.from({ length: 201 }, (_, i) => String(i));
const num = (n) => NUMBERS[Math.max(0, Math.min(200, Math.ceil(n)))];

const shown = { name: '', drop: 0 };
const third = (t, whole) => Math.min(2, Math.max(0, Math.floor((1 - t / whole) * 3)));

// Which frame of the gun in your hand to show, and how far it's lowered (0 up, 1 down). Returns a
// reused { name, drop }.
export function gunFrame(gun) {
  let drop = 0, id = gun.current, name;
  if (gun.switching > 0) {
    const half = SWITCH_TIME / 2;
    if (gun.switching > half) drop = 1 - (gun.switching - half) / half;
    else {
      id = gun.next;
      drop = gun.switching / half;
    }
    name = id === RIFLE_ID ? 'rifle-idle' : 'shotgun-idle';
  } else if (id === RIFLE_ID) {
    if (gun.shotT < 0.06) name = 'rifle-fire';
    else if (gun.shotT < 0.2) name = 'rifle-idle';
    else if (gun.shotT < 0.3) name = 'rifle-lever-1';
    else if (gun.shotT < RIFLE.interval) name = 'rifle-lever-2';
    else if (gun.reloading) name = RIFLE_RELOAD[third(gun.reloadT, RIFLE.reloadPerRound)];
    else name = 'rifle-idle';
  } else if (gun.shotT < 0.06) name = 'shotgun-fire';
  else if (gun.reloading) name = SHOTGUN_RELOAD[third(gun.reloadT, SHOTGUN.reload)];
  else name = 'shotgun-idle';
  shown.name = name;
  shown.drop = drop;
  return shown;
}

// The lantern hand's frame: a two-frame flicker, or the throw while a flare leaves your hand.
export function handFrame(gun, time) {
  const since = FLARE.cooldown - gun.flareT;
  if (gun.flareT > 0 && since < 0.3) return since < 0.15 ? 'throw-1' : 'throw-2';
  return Math.floor(time * 8) % 2 ? 'lantern-2' : 'lantern-1';
}

function frame(ctx, art, name, x, y) {
  const f = art.hands.frames[name];
  if (!f) throw new Error(`no hands frame "${name}"`);
  ctx.drawImage(art.hands.image, f[0], f[1], f[2], f[3], Math.round(x + f[4]), Math.round(y + f[5]), f[2], f[3]);
}

function icon(ctx, art, name, x, y) {
  const i = art.hud.icons[name];
  ctx.drawImage(art.hud.image, i[0], i[1], i[2], i[3], Math.round(x), Math.round(y), i[2], i[3]);
  return i[2];
}

function text(ctx, str, x, y, color, px = 8, align = 'left') {
  ctx.font = FONTS[px];
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// info: { time, hitT (seconds since you last hit something), banner: { text, sub, t }, reducedMotion }
export function drawHud(ctx, art, state, view, info) {
  const { w, h } = view, g = state.gun, p = state.player, ui = art.ui;
  // The hands, bobbing as you walk.
  const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 3);
  const phase = (p.walked / 0.9) * Math.PI;
  const bx = info.reducedMotion ? 0 : Math.sin(phase) * 3 * speed;
  const by = info.reducedMotion ? 0 : Math.abs(Math.cos(phase)) * 2 * speed;
  if (state.night.phase !== 'dead') {
    frame(ctx, art, handFrame(g, info.time), w / 2 - bx, h + by);
    const gf = gunFrame(g);
    frame(ctx, art, gf.name, w / 2 + bx, h + by + gf.drop * 60 + g.kick * 120);
  }
  // Crosshair and hit tick.
  icon(ctx, art, info.hitT < 0.15 ? 'hitTick' : 'crosshair', Math.floor(w / 2) - 3, Math.floor(h / 2) - 3);
  // Hurt: the edges glow red, and pulse when you're low.
  let hurt = state.hurt > 0 ? (state.hurt / FEEL.hurtTime) * 0.55 : 0;
  if (p.health > 0 && p.health <= FEEL.lowHealth) hurt = Math.max(hurt, 0.18 + 0.12 * Math.sin(info.time * 7));
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(1, hurt);
    ctx.fillStyle = ui.hurt;
    const e = Math.round(h / 14);
    ctx.fillRect(0, 0, w, e);
    ctx.fillRect(0, h - e, w, e);
    ctx.fillRect(0, e, e, h - 2 * e);
    ctx.fillRect(w - e, e, e, h - 2 * e);
    ctx.globalAlpha = 1;
  }
  // Health, bottom left.
  const hx = 6, hy = h - 14;
  const hw = icon(ctx, art, 'heart', hx, hy);
  text(ctx, num(p.health), hx + hw + 3, hy + 1, p.health <= FEEL.lowHealth ? ui.hurt : ui.text);
  // Ammo and flares, bottom right.
  let x = w - 6;
  if (g.current === RIFLE_ID) {
    for (let i = RIFLE.rounds - 1; i >= 0; i--) x -= icon(ctx, art, i < g.rifle ? 'round' : 'roundEmpty', x - 4, hy) + 1;
  } else {
    text(ctx, num(g.spare), x, hy + 1, ui.dim, 8, 'right');
    x -= 14;
    for (let i = SHOTGUN.shells - 1; i >= 0; i--) x -= icon(ctx, art, i < g.shells ? 'shell' : 'shellEmpty', x - 5, hy) + 2;
  }
  x -= 8;
  for (let i = 0; i < g.flares; i++) x -= icon(ctx, art, 'flare', x - 5, hy) + 1;
  // The hour, top centre.
  text(ctx, hourLabel(state.night), w / 2, 6, ui.dim, 8, 'center');
  // A banner: the new hour, a supply, a warning.
  const b = info.banner;
  if (b && b.t > 0) {
    ctx.globalAlpha = Math.min(1, b.t);
    if (b.text) text(ctx, b.text, w / 2, h * 0.28, ui.text, 16, 'center');
    if (b.sub) text(ctx, b.sub, w / 2, h * 0.28 + 22, ui.dim, 8, 'center');
    ctx.globalAlpha = 1;
  }
}

// The title, death and dawn screens, drawn over the world. info: { best: { hour, dawns }, reached, kills, time }
export function drawScreen(ctx, art, view, screen, info) {
  const { w, h } = view, ui = art.ui;
  ctx.globalAlpha = screen === 'title' ? 0.35 : 0.55;
  ctx.fillStyle = ui.night;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const blink = Math.floor(info.time * 2) % 2 === 0;
  if (screen === 'title') {
    text(ctx, 'LAST LIGHT', w / 2, h * 0.3, ui.text, 24, 'center');
    text(ctx, 'Hold the cabin until dawn.', w / 2, h * 0.3 + 32, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click to start', w / 2, h * 0.62, ui.text, 8, 'center');
    const best = info.best.dawns > 0 ? `Dawns seen: ${info.best.dawns}` : info.best.hour > 0 ? `Best night: ${HOURS[info.best.hour]}` : '';
    if (best) text(ctx, best, w / 2, h * 0.62 + 14, ui.dim, 8, 'center');
    text(ctx, 'WASD move  Mouse aim  Click shoot  R reload', w / 2, h - 30, ui.dim, 8, 'center');
    text(ctx, '1/2 guns  F flare  Shift run  Esc pause  M mute', w / 2, h - 18, ui.dim, 8, 'center');
  } else if (screen === 'dead') {
    text(ctx, "You didn't see the dawn", w / 2, h * 0.32, ui.hurt, 16, 'center');
    text(ctx, `It was ${NIGHT.hours[Math.min(info.reached, NIGHT.hours.length - 1)]}.  ${info.kills} of them fell.`, w / 2, h * 0.32 + 24, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click to try again', w / 2, h * 0.62, ui.text, 8, 'center');
  } else if (screen === 'dawn') {
    text(ctx, 'Dawn', w / 2, h * 0.3, ui.text, 24, 'center');
    text(ctx, `You held the cabin.  ${info.kills} of them fell.`, w / 2, h * 0.3 + 30, ui.dim, 8, 'center');
    if (blink) text(ctx, 'Click for another night', w / 2, h * 0.62, ui.text, 8, 'center');
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 107 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test
git commit -m "Last Light: loading the art, the scene builder, the hit spray, and the HUD"
```

---

### Task 8: The rest of the art

**Files:**
- Modify: `art/last-light/sprites.lua` (adds the leaper, the Mother, the props, the pickups and the flare)
- Create: `art/last-light/hands.lua`, `art/last-light/hud.lua`, `art/last-light/icon.lua`
- Generated (committed):
  - `last-light/assets/sprites.png` and `sprites.json` (complete now), `hands.png`, `hands.json`, `hud.png` and `hud.json`
  - `last-light/icon.png`
  - the matching `.aseprite` files in `art/last-light/`
- Test: `last-light/test/art.test.js`

**Interfaces:**
- Consumes:
  - The `L` and `P` helpers from Task 6.
  - `SPRITE_ANIMS` (in `scene.js`) and `HAND_FRAMES` and `HUD_ICONS` (in `hud.js`), from Task 7. The art must provide exactly these names.
- Produces: the full art set that `loadArt()` loads. After this task, `test/art.test.js` passes against the committed files.

**Before painting:** if Nathan has replied about the style test, apply what he said first, to the textures, sky, crawler and gaunt too. The controller puts any notes in your dispatch.

**sprites.lua, the additions.** Keep the crawler and gaunt entries, and add these to the list in this order. Pixel sizes are per frame; frame numbers count from 0.
- **leaper** (32×32, height 0.7, stride 0.4). Hunched and frog-legged, with long arms and spines along its back.
  - The frames: 0–3 `walk`, 4–7 `side-walk`, 8 `crouch` (compressed low, coiled), 9 `leap` (front: stretched out mid-air, arms reaching for you), 10 `side-leap` (horizontal, facing right), 11–12 `attack`, 13 `hurt`, 14–18 `die`.
  - The anims are `walk`, `side-walk`, `crouch` [8], `leap` [9], `side-leap` [10], `attack` [11,12], `hurt` [13] and `die` [14..18].
- **mother** (64×96, height 2.2, stride 0.7). A towering, swollen mass of the same pale flesh on too many limbs, with a gaunt head and a crown of 4–6 glowing eyes (so she reads from far away).
  - The frames: 0–3 `walk`, 4–7 `side-walk`, 8 `windup` (rearing up, arms high), 9–10 `attack` (the slam), 11 `hurt`, 12–16 `die`.
- **stove** (24×28, height 0.65, `ms` 120, `idle` [0,1]). A black iron pot-belly stove (`iron0`–`iron2`) with a pipe going up, and a fire door glowing `fire2`–`fire4`/`ember0`. It flickers between its 2 frames.
- **well** (32×24, height 0.55, `idle` [0]). A low ring of fieldstones (`stone0`–`stone3`) capped with snow (`snow3`–`snow4`), with a wooden crank post on one side.
- **pine** (40×96, height 2.6, `idle` [0]). A lone pine: layered boughs (`needle0`–`needle3`) weighed down with snow (`snow2`–`snow4`), and a short trunk at the base.
- **flare** (8×12, height 0.25, `ms` 80, `idle` [0,1,2]). A road flare stuck in the snow, burning: the stick is `flare1` with a dark cap, and the sparks and flame (`flare2`, `fire4`) flicker across 3 frames. These are glow colours, so it's visible across the clearing.
- **pickup-flare** (12×8, height 0.2, `idle` [0]). A spare flare lying in the snow. Use `flare1` so it can be spotted in the dark.
- **pickup-shells** (16×10, height 0.2, `idle` [0]). A small cardboard box of shells (`wood3`–`wood5`), with red shell ends (`hurt`) and brass bases (`brass1`) showing.
- **pickup-shotgun** (28×8, height 0.2, `idle` [0]). A double-barrel shotgun lying flat: `iron1`–`iron2` barrels and a `wood3`–`wood5` stock.

**hands.lua: the guns and lantern in your hands.**
- **How they're drawn.** These are drawn over the view as images, so they may use alpha (use palette colours anyway, for one look). Paint them as lit by the lantern: warm and bright.
- **Writing them.** Write each frame with `L.writePieces("hands", { { name, buffer, ox, oy }, ... })`. `(ox, oy)` places the frame's top-left relative to the bottom centre of the view, and the view is about 270 px tall at 4×.
- **The rifle frames** (about 110×100). A lever-action rifle held low on the right, pointing towards the crosshair: the muzzle ends about 20 px below and right of the view's centre.
  - The frames are `rifle-idle`, `rifle-fire` (with a muzzle flash in `fire3`/`fire4`/`window`), `rifle-lever-1` and `rifle-lever-2` (the hand working the lever down and back), and `rifle-reload-1` to `rifle-reload-3` (the rifle tilted, a brass round going into the gate).
  - Place them at about `ox = 10, oy = -100`.
- **The shotgun frames** (about 110×100), placed the same way:
  - `shotgun-idle`;
  - `shotgun-fire` (a flash from both barrels);
  - `shotgun-reload-1` to `shotgun-reload-3` (broken open, shells in, snapped shut).
- **The lantern frames** (about 70×90). The left hand holds a tin lantern (`iron1`–`iron2` frame, with a `fire3`/`fire4` flame) at the lower left, at about `ox = -160, oy = -90`.
  - `lantern-1` and `lantern-2` are two flicker frames.
  - `throw-1` has the hand drawn back with a lit flare, and `throw-2` has the arm forward and the hand empty.

**hud.lua: the icons**, written with `L.writePieces("hud", { { name, buffer }, ... })`:
- `heart` 7×7 (`hurt`), `round` 3×8 (`brass1`/`brass0`), `roundEmpty` 3×8 (a `uiDim` outline), `shell` 5×8 (`hurt` with a `brass1` base), `shellEmpty` 5×8 (a `uiDim` outline) and `flare` 5×8 (`flare1`).
- `crosshair` 7×7 is a single `ui` dot in the centre, with faint 1 px `uiDim` ticks two pixels out.
- `hitTick` 7×7 is four short diagonal `ui` ticks round the centre.

**icon.lua: the 48×48 tab icon.** Save it with `L.save(buf, L.ART .. "icon.aseprite", "last-light/icon.png")`. It shows:
- the cabin under the night sky;
- its window lit in `window`;
- snow on the roof;
- two pairs of `eye2` eyes in the black treeline behind it.

- [ ] **Step 1: Write the failing art test**

`last-light/test/art.test.js`:
```js
// Checks the committed art (last-light/assets/, written by the scripts in art/last-light/) against
// everything the code expects: every texture the map uses, every sprite and animation the scene draws,
// every frame and icon the HUD draws, and image sizes that hold them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WALLS } from '../src/map.js';
import { FLOORS } from '../src/assets.js';
import { SPRITE_ANIMS } from '../src/scene.js';
import { HAND_FRAMES, HUD_ICONS } from '../src/hud.js';

const file = (f) => new URL(`../${f}`, import.meta.url);
const json = (f) => JSON.parse(readFileSync(file(`assets/${f}`), 'utf8'));
// A PNG's width and height, from its header.
function pngSize(f) {
  const b = readFileSync(file(f));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${f} is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
const inside = (rect, [w, h]) => rect[0] >= 0 && rect[1] >= 0 && rect[0] + rect[2] <= w && rect[1] + rect[3] <= h;

test('the palette: up to 255 colours, with glow indices and the named colours the game uses', () => {
  const p = json('palette.json');
  assert.ok(p.colors.length > 0 && p.colors.length <= 255);
  for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(p.colors).size, p.colors.length, 'no colour twice');
  for (const i of p.glow) assert.ok(i >= 1 && i <= p.colors.length);
  for (const n of ['flake', 'ichor', 'ui', 'uiDim', 'hurt', 'night']) assert.ok(p.names[n] >= 1 && p.names[n] <= p.colors.length, n);
});

test('a texture for every wall kind and floor, 32x32 each, side by side', () => {
  const t = json('textures.json');
  assert.equal(t.size, 32);
  const need = new Set([...FLOORS]);
  for (const k of Object.values(WALLS)) (need.add(k.ns), need.add(k.ew));
  for (const n of need) assert.ok(t.names.includes(n), `texture ${n}`);
  assert.deepEqual(pngSize('assets/textures.png'), [32 * t.names.length, 32]);
});

test('the sky is a wide panorama', () => {
  const [w, h] = pngSize('assets/sky.png');
  assert.ok(w >= 512 && h >= 64 && h <= 256, `${w}x${h}`);
});

test('every sprite, with every animation, inside sprites.png', () => {
  const { sprites } = json('sprites.json');
  const size = pngSize('assets/sprites.png');
  for (const [name, anims] of Object.entries(SPRITE_ANIMS)) {
    const s = sprites[name];
    assert.ok(s, `sprite ${name}`);
    assert.ok(s.height > 0 && s.count > 0, name);
    assert.ok(inside([s.x, s.y, s.w * s.count, s.h], size), `${name} fits in sprites.png`);
    for (const a of anims) {
      assert.ok(s.anims[a]?.length > 0, `${name}.${a}`);
      for (const f of s.anims[a]) assert.ok(f >= 0 && f < s.count, `${name}.${a} frame ${f}`);
    }
    if (['crawler', 'gaunt', 'leaper', 'mother'].includes(name)) {
      assert.equal(s.anims.walk.length, 4, `${name} walks in 4 frames`);
      assert.ok(s.stride > 0, `${name} has a stride`);
    }
  }
});

test('every hands frame and HUD icon, inside their sheets', () => {
  const hands = json('hands.json').frames, hud = json('hud.json').icons;
  const hs = pngSize('assets/hands.png'), is = pngSize('assets/hud.png');
  for (const n of HAND_FRAMES) assert.ok(hands[n] && hands[n].length === 6 && inside(hands[n], hs), n);
  for (const n of HUD_ICONS) assert.ok(hud[n] && inside(hud[n], is), n);
});

test('the tab icon is 48x48', () => {
  assert.ok(existsSync(file('icon.png')));
  assert.deepEqual(pngSize('icon.png'), [48, 48]);
});
```

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL. `sprites.json` lacks the leaper and the rest, `hands.json` and `hud.json` don't exist, and there's no `icon.png`.

- [ ] **Step 2: Paint the leaper and the Mother, then the props, pickups and flare**

Extend `sprites.lua` as briefed (keep the list order above), and rerun it:
`/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/sprites.lua`

- [ ] **Step 3: Paint the hands, the HUD icons and the tab icon**

Write `hands.lua`, `hud.lua` and `icon.lua`, then run the whole rebuild loop from the repo root:
```bash
cd /Users/nathan/Documents/code/games
for s in textures sky sprites hands hud icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done
```
Run it a second time: `git status` must show no changes (determinism).

- [ ] **Step 4: Look at it all, then run the tests**

Run `style-test.lua` again and read `preview-style.png`. Every sprite should be there, lit and dim. Also look at `hands.png` and `hud.png`.

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 113 tests. The 6 art tests name anything missing.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add art/last-light last-light/assets last-light/icon.png last-light/test/art.test.js
git commit -m "Last Light: the leaper, the Mother, props, pickups, the guns in your hands, the HUD and the tab icon"
```

---

## Phase 3: The browser

### Task 9: Input, the score and sound

**Files:**
- Create: `last-light/src/input.js`, `last-light/src/music.js`, `last-light/src/audio.js`
- Test: `last-light/test/fake-audio.js`, `last-light/test/input.test.js`, `last-light/test/music.test.js`, `last-light/test/audio.test.js`

**Interfaces:**
- Consumes:
  - From Task 1: `KEYS`, `MOUSE` and `FEEL`.
  - From Task 4: the state and its events.
  - From `test/helpers.js`: `quietState`.
- Produces:
  - `input.js`:
    - `createInput(target?, doc?, bindings?)` returns `{ facing, sensitivity, locked, element, releaseAll(), lock() → Promise<bool>, sample() → intents, takeUI() → { mute } }`. The intents object is reused, and so is the `takeUI()` object.
    - Clicks while unlocked are left to `main.js`.
  - `music.js`: `BPM`, `STEP`, `BAR`, `CHORDS`, `LAYERS`, `layersFor(phase, wave)`, `midiToHz(n)`, `notesAt(layer, step)` and `DAWN`.
  - `audio.js`: `createAudio(storage)` returns `{ start(), events(state), update(state, facing, screen), muted, volume, setVolume(v), toggleMute(), suspend(), resume() }`.
    - It's a silent no-op until `start()` is called from a click, and silent for good where there's no Web Audio.
    - Its storage keys are `last-light-muted` and `last-light-volume`.
  - `test/fake-audio.js`: `fakeAudioContext()`.
- **Review Focus items 1, 2 and 4** are pinned here: the mouse glitch, the release on focus and pointer-lock loss (which also forgets pending presses), and the one-per-fling wheel throttle.

- [ ] **Step 1: Write the failing tests**

`last-light/test/fake-audio.js`:
```js
// A stand-in for Web Audio in Node, enough for audio.js to build and play everything. It counts the
// nodes started, so tests can see that sounds were made.
function param(value = 0) {
  return {
    value,
    setValueAtTime(v) {
      this.value = v;
    },
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime(v) {
      this.value = v;
    },
  };
}

export function fakeAudioContext() {
  const started = [];
  const node = (extra = {}) => ({
    connect: (to) => to,
    disconnect() {},
    ...extra,
  });
  const ctx = {
    started,
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    listener: {
      positionX: param(), positionY: param(), positionZ: param(),
      forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param(),
    },
    resume() {
      ctx.state = 'running';
    },
    suspend() {
      ctx.state = 'suspended';
    },
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createDelay: () => node({ delayTime: param() }),
    createPanner: () => node({ positionX: param(), positionY: param(), positionZ: param() }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => node({ buffer: null, loop: false, start: () => started.push('buffer'), stop() {} }),
    createOscillator: () => node({ type: 'sine', frequency: param(440), start: () => started.push('osc'), stop() {} }),
  };
  return ctx;
}
```

`last-light/test/input.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { MOUSE } from '../src/tuning.js';

// A stand-in for window and document: dispatches events to listeners.
function fakeTarget() {
  const ls = {};
  return {
    addEventListener: (t, f) => (ls[t] ??= []).push(f),
    fire: (t, e = {}) => (ls[t] ?? []).forEach((f) => f({ preventDefault() {}, ...e })),
  };
}

function setup() {
  const win = fakeTarget(), doc = fakeTarget();
  const input = createInput(win, doc);
  const canvas = {};
  input.element = canvas;
  doc.pointerLockElement = canvas;
  doc.fire('pointerlockchange');
  return { win, doc, input };
}

test('WASD gives forward and strafe; Shift runs', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('keydown', { code: 'KeyD' });
  win.fire('keydown', { code: 'ShiftLeft' });
  let s = input.sample();
  assert.deepEqual([s.forward, s.strafe, s.run], [1, 1, true]);
  win.fire('keyup', { code: 'KeyW' });
  win.fire('keydown', { code: 'KeyS' });
  s = input.sample();
  assert.equal(s.forward, -1);
});

test('the mouse turns you at once, scaled by sensitivity, while the pointer is locked', () => {
  const { win, doc, input } = setup();
  win.fire('mousemove', { movementX: 100 });
  assert.ok(Math.abs(input.facing - 100 * MOUSE.sensitivity) < 1e-12);
  input.sensitivity = 2;
  win.fire('mousemove', { movementX: -50 });
  assert.ok(Math.abs(input.facing) < 1e-12);
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('mousemove', { movementX: 100 });
  assert.ok(Math.abs(input.facing) < 1e-12, 'unlocked: no turning');
});

test('a single huge mouse jump is a browser glitch and is ignored', () => {
  const { win, input } = setup();
  win.fire('mousemove', { movementX: MOUSE.spike + 1 });
  assert.equal(input.facing, 0);
});

test('a click shorter than an update still fires once; holding keeps firing', () => {
  const { win, input } = setup();
  win.fire('mousedown', { button: 0 });
  win.fire('mouseup', { button: 0 });
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().fire, false);
  win.fire('mousedown', { button: 0 });
  assert.equal(input.sample().fire, true);
  assert.equal(input.sample().fire, true);
});

test('presses are latched once: reload, flare (F or right click), weapon keys', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyR' });
  win.fire('keydown', { code: 'KeyR', repeat: true });
  win.fire('mousedown', { button: 2 });
  win.fire('keydown', { code: 'Digit2' });
  let s = input.sample();
  assert.deepEqual([s.reload, s.flare, s.weapon], [1, 1, 2]);
  s = input.sample();
  assert.deepEqual([s.reload, s.flare, s.weapon], [0, 0, 0]);
  win.fire('keyup', { code: 'KeyR' });
  win.fire('keydown', { code: 'KeyR' });
  assert.equal(input.sample().reload, 1);
});

test('the wheel steps weapons, once per fling', () => {
  const { win, input } = setup();
  win.fire('wheel', { deltaY: 5, timeStamp: 1000 });
  win.fire('wheel', { deltaY: 5, timeStamp: 1020 });
  assert.equal(input.sample().weaponStep, 1);
  win.fire('wheel', { deltaY: -5, timeStamp: 1300 });
  assert.equal(input.sample().weaponStep, -1);
  assert.equal(input.sample().weaponStep, 0);
});

test('losing focus or the pointer lock releases every key and the trigger', () => {
  const { win, doc, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('mousedown', { button: 0 });
  win.fire('blur');
  let s = input.sample();
  assert.deepEqual([s.forward, s.fire], [0, false]);
  win.fire('keydown', { code: 'KeyW' });
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  s = input.sample();
  assert.equal(s.forward, 0);
});

test('Cmd shortcuts are left to the browser, and Cmd releases held keys', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyW' });
  win.fire('keydown', { code: 'MetaLeft' });
  assert.equal(input.sample().forward, 0);
  win.fire('keydown', { code: 'KeyR', metaKey: true });
  assert.equal(input.sample().reload, 0);
});

test('unlocked, a click is not a shot', () => {
  const { win, doc, input } = setup();
  doc.pointerLockElement = null;
  doc.fire('pointerlockchange');
  win.fire('mousedown', { button: 0 });
  assert.equal(input.sample().fire, false);
});

test('releaseAll also forgets presses not yet taken', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyR' });
  input.releaseAll();
  assert.equal(input.sample().reload, 0);
});

test('M is a page press: taken once', () => {
  const { win, input } = setup();
  win.fire('keydown', { code: 'KeyM' });
  assert.equal(input.takeUI().mute, 1);
  assert.equal(input.takeUI().mute, 0);
});

test('lock() asks for raw input, and falls back to plain pointer lock', async () => {
  const { input } = setup();
  const asked = [];
  input.element = {
    requestPointerLock(opts) {
      asked.push(opts ?? null);
      return opts ? Promise.reject(new Error('unsupported')) : Promise.resolve();
    },
  };
  assert.equal(await input.lock(), true);
  assert.deepEqual(asked, [{ unadjustedMovement: true }, null]);
  input.element = { requestPointerLock: () => Promise.reject(new Error('too soon')) };
  assert.equal(await input.lock(), false);
});
```

`last-light/test/music.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layersFor, notesAt, LAYERS, STEP, BAR, DAWN, midiToHz } from '../src/music.js';

test('a layer joins every hour, from the drone at 9 PM to all eight at 4 AM', () => {
  assert.deepEqual(layersFor('wave', 0), ['drone']);
  assert.equal(layersFor('wave', 3).length, 4);
  assert.deepEqual(layersFor('wave', 7), LAYERS);
});

test('the lulls thin to the drone and the music box; nothing plays after death', () => {
  assert.deepEqual(layersFor('lull', 5), ['drone', 'musicbox']);
  assert.deepEqual(layersFor('dead', 5), []);
});

test('the notes are the same every night', () => {
  for (const layer of LAYERS) {
    for (let step = 0; step < 64; step++) assert.deepEqual(notesAt(layer, step), notesAt(layer, step));
  }
});

test('the music box plays a few notes a bar, from the chord', () => {
  let n = 0;
  for (let step = 0; step < BAR * 16; step++) n += notesAt('musicbox', step).length;
  assert.ok(n >= 16 && n <= 64, `${n} notes in 16 bars`);
});

test('66 beats a minute in eighths; A4 is 440 Hz; the dawn theme is about 12 seconds', () => {
  assert.ok(Math.abs(STEP - 60 / 66 / 2) < 1e-12);
  assert.equal(midiToHz(69), 440);
  const end = Math.max(...DAWN.map((d) => d.step + d.len));
  assert.ok(end * STEP > 10 && end * STEP < 16);
});
```

`last-light/test/audio.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';
import { fakeAudioContext } from './fake-audio.js';
import { quietState } from './helpers.js';
import { emit } from '../src/events.js';

function memoryStorage() {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, String(v)) };
}

function withAudio(fn) {
  let ctx;
  globalThis.AudioContext = function () {
    ctx = fakeAudioContext();
    return ctx;
  };
  try {
    return fn(() => ctx);
  } finally {
    delete globalThis.AudioContext;
  }
}

test('every event type makes a sound without error', () =>
  withAudio((ctx) => {
    const audio = createAudio(memoryStorage());
    audio.start();
    const s = quietState();
    const types = ['shot', 'dry', 'reload', 'switch', 'hit', 'hurt', 'windup', 'shriek', 'leap', 'birth', 'flareThrow', 'pickup', 'wave', 'dawn', 'dead', 'spawn', 'flareOut', 'lull'];
    for (const type of types) {
      s.eventCount = 0;
      emit(s, type, 20, 25, type === 'hit' ? 1 : 0, 1);
      audio.events(s);
    }
    assert.ok(ctx().started.length > 20);
  }));

test('the score and the ambience play while a night is on', () =>
  withAudio((ctx) => {
    const audio = createAudio(memoryStorage());
    audio.start();
    const s = quietState();
    s.night.phase = 'wave';
    s.night.wave = 7;
    const before = ctx().started.length;
    for (let i = 0; i < 20; i++) {
      ctx().currentTime += 0.1;
      audio.update(s, 0, 'playing');
    }
    assert.ok(ctx().started.length > before + 10);
  }));

test('mute and volume are remembered', () => {
  const storage = memoryStorage();
  const a = createAudio(storage);
  a.toggleMute();
  a.setVolume(0.3);
  const b = createAudio(storage);
  assert.equal(b.muted, true);
  assert.equal(b.volume, 0.3);
});

test('with no Web Audio at all, everything is silently a no-op', () => {
  const a = createAudio(memoryStorage());
  a.start();
  a.events(quietState());
  a.update(quietState(), 0, 'playing');
  a.toggleMute();
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL with `Cannot find module` for `input.js`, `music.js` and `audio.js`. The 113 earlier tests pass.

- [ ] **Step 3: Write the modules**

`last-light/src/input.js`:
```js
// Keyboard and mouse. The mouse turns you the moment its event arrives (input owns your facing), so
// turning never waits for an update. Pointer lock asks for raw, unaccelerated input where the browser
// has it. Everything else is sampled once per update into a reused intents object: held keys as held,
// and presses (reload, flare, weapon keys, the wheel) latched so a tap shorter than an update still
// counts exactly once. OS key auto-repeat is ignored, losing focus releases everything, and a held
// Cmd/Ctrl is left to the browser.
import { KEYS, MOUSE } from './tuning.js';

const isMeta = (code) => code === 'MetaLeft' || code === 'MetaRight';

function anyDown(down, codes) {
  for (let i = 0; i < codes.length; i++) if (down.has(codes[i])) return true;
  return false;
}
const WHEEL_GAP = 150; // ms between wheel steps, so a trackpad fling is one switch, not ten

export function createInput(target = globalThis, doc = globalThis.document, bindings = KEYS) {
  const actionOf = new Map();
  for (const [action, codes] of Object.entries(bindings)) for (const code of codes) actionOf.set(code, action);
  const down = new Set();
  const pressed = { reload: 0, flare: 0, rifle: 0, shotgun: 0, mute: 0, wheel: 0 };
  let fireHeld = false, fireTapped = false, lastWheel = -Infinity;
  const out = { facing: 0, forward: 0, strafe: 0, run: false, fire: false, flare: 0, reload: 0, weapon: 0, weaponStep: 0 };
  const ui = { mute: 0 };

  const input = {
    facing: 0,
    sensitivity: 1, // multiplier on MOUSE.sensitivity, from the pause menu's slider
    locked: false, // pointer lock held
    element: null, // the canvas that takes the pointer lock
    // Lets go of every key and the trigger, and forgets presses not yet taken (after a pause, so a
    // key pressed on the pause menu doesn't fire on resume).
    releaseAll() {
      down.clear();
      fireHeld = false;
      fireTapped = false;
      pressed.reload = pressed.flare = pressed.rifle = pressed.shotgun = pressed.wheel = 0;
    },
    // Asks for pointer lock on the canvas; call it from inside a click. Asks for raw input first, and
    // falls back to plain pointer lock where that isn't supported. Resolves true if the lock was
    // granted (or the browser doesn't say), false if it was refused: Chrome refuses for a moment
    // after Esc released it.
    async lock() {
      const el = input.element;
      if (!el?.requestPointerLock) return false;
      try {
        await el.requestPointerLock({ unadjustedMovement: true });
        return true;
      } catch {
        try {
          await el.requestPointerLock();
          return true;
        } catch {
          return false;
        }
      }
    },
    // Fills and returns the intents for one update.
    sample() {
      out.facing = input.facing;
      out.forward = (anyDown(down, bindings.forward) ? 1 : 0) - (anyDown(down, bindings.back) ? 1 : 0);
      out.strafe = (anyDown(down, bindings.right) ? 1 : 0) - (anyDown(down, bindings.left) ? 1 : 0);
      out.run = anyDown(down, bindings.run);
      out.fire = fireHeld || fireTapped;
      fireTapped = false;
      out.reload = pressed.reload;
      out.flare = pressed.flare;
      out.weapon = pressed.shotgun ? 2 : pressed.rifle ? 1 : 0;
      out.weaponStep = pressed.wheel;
      pressed.reload = pressed.flare = pressed.rifle = pressed.shotgun = pressed.wheel = 0;
      return out;
    },
    // Presses for the page itself since the last call, into a reused { mute }.
    takeUI() {
      ui.mute = pressed.mute;
      pressed.mute = 0;
      return ui;
    },
  };

  target.addEventListener('keydown', (e) => {
    if (isMeta(e.code)) return input.releaseAll();
    if (e.metaKey || e.ctrlKey) return;
    const action = actionOf.get(e.code);
    if (!action) return;
    e.preventDefault();
    if (e.repeat || down.has(e.code)) return;
    down.add(e.code);
    if (action in pressed) pressed[action] = 1;
  });
  target.addEventListener('keyup', (e) => (isMeta(e.code) ? input.releaseAll() : down.delete(e.code)));
  target.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    const dx = e.movementX || 0;
    if (Math.abs(dx) > MOUSE.spike) return; // a browser glitch, not a hand
    input.facing += dx * MOUSE.sensitivity * input.sensitivity;
    if (input.facing > Math.PI) input.facing -= 2 * Math.PI;
    else if (input.facing < -Math.PI) input.facing += 2 * Math.PI;
  });
  target.addEventListener('mousedown', (e) => {
    if (!input.locked) return; // clicks on the page (start, resume) are main.js's
    if (e.button === 0) {
      fireHeld = true;
      fireTapped = true;
    } else if (e.button === 2) pressed.flare = 1;
  });
  target.addEventListener('mouseup', (e) => {
    if (e.button === 0) fireHeld = false;
  });
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  target.addEventListener(
    'wheel',
    (e) => {
      if (!input.locked || e.deltaY === 0) return;
      e.preventDefault?.();
      const now = e.timeStamp ?? 0;
      if (now - lastWheel < WHEEL_GAP) return;
      lastWheel = now;
      pressed.wheel = e.deltaY > 0 ? 1 : -1;
    },
    { passive: false },
  );
  target.addEventListener('blur', () => input.releaseAll());
  doc?.addEventListener('visibilitychange', () => {
    if (doc.hidden) input.releaseAll();
  });
  doc?.addEventListener('pointerlockchange', () => {
    input.locked = !!doc.pointerLockElement && doc.pointerLockElement === input.element;
    if (!input.locked) input.releaseAll();
  });
  return input;
}
```

`last-light/src/music.js`:
```js
// The score, as pure data and rules: which layers play at each hour, and which notes each layer plays
// on each eighth-note step. audio.js turns these into sound. It's in A minor at 66 beats a minute,
// over a four-bar round of Am, F, Dm, E; the night adds a layer every hour, from a wind drone at 9 PM
// to a pounding score at 4 AM, and thins to the drone and the music box in the lulls. At dawn the
// sunrise theme turns to A major.
export const BPM = 66;
export const STEP = 60 / BPM / 2; // seconds per eighth note
export const BAR = 8; // steps

// MIDI notes: A3 C4 E4, F3 A3 C4, D3 F3 A3, E3 G#3 B3.
export const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];

export const LAYERS = ['drone', 'pulse', 'strings', 'musicbox', 'ticks', 'choir', 'toms', 'brass'];

// The layers playing: one more each hour during a wave; the drone and music box in a lull.
export function layersFor(phase, wave) {
  if (phase === 'wave') return LAYERS.slice(0, Math.min(LAYERS.length, wave + 1));
  if (phase === 'lull' || phase === 'dusk') return ['drone', 'musicbox'];
  return [];
}

export const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// A deterministic 0..1 value per (step, salt), so the music box's melody is the same every night.
function pick(step, salt) {
  let n = (step * 2654435761 + salt * 40503) >>> 0;
  n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0;
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

// The notes a layer starts on global step `step`: [{ note, len (steps), vel (0..1) }]. Percussion
// layers use note 0.
export function notesAt(layer, step) {
  const bar = Math.floor(step / BAR), beat = step % BAR;
  const chord = CHORDS[bar % CHORDS.length];
  switch (layer) {
    case 'drone':
      return beat === 0 && bar % 2 === 0 ? [{ note: 33, len: BAR * 2, vel: 0.5 }, { note: 40, len: BAR * 2, vel: 0.3 }] : [];
    case 'pulse':
      return beat === 0 ? [{ note: 0, len: 1, vel: 1 }] : beat === 1 ? [{ note: 0, len: 1, vel: 0.6 }] : [];
    case 'strings':
      return beat === 0 ? chord.map((n) => ({ note: n - 12, len: BAR, vel: 0.35 })) : [];
    case 'musicbox': {
      // Two or three bell notes a bar, from the chord an octave or two up.
      if (pick(step, 1) > (beat === 0 ? 0.9 : 0.3)) return [];
      const n = chord[Math.floor(pick(step, 2) * 3)] + (pick(step, 3) < 0.4 ? 24 : 12);
      return [{ note: n, len: 2, vel: 0.25 + pick(step, 4) * 0.2 }];
    }
    case 'ticks':
      return [{ note: 0, len: 1, vel: beat % 2 === 0 ? 0.5 : 0.25 }];
    case 'choir':
      return beat === 0 ? chord.map((n) => ({ note: n, len: BAR, vel: 0.2 })) : [];
    case 'toms':
      return beat === 4 || beat === 6 || (beat === 7 && bar % 2 === 1) ? [{ note: beat === 7 ? 45 : 40, len: 1, vel: 0.8 }] : [];
    case 'brass':
      return beat === 0 || beat === 3 ? [{ note: chord[0] - 24, len: 2, vel: 0.5 }] : [];
    default:
      return [];
  }
}

// The sunrise theme: A major, rising, about 12 seconds. [{ step, note, len, voice }]
export const DAWN = [
  ...[45, 52, 57, 61, 64, 69].map((note, i) => ({ step: i, note, len: 10 - i, voice: 'strings' })),
  ...[69, 73, 76, 81, 80, 76, 78, 81].map((note, i) => ({ step: 8 + i * 2, note, len: 3, voice: 'musicbox' })),
  { step: 24, note: 57, len: 8, voice: 'choir' },
  { step: 24, note: 61, len: 8, voice: 'choir' },
  { step: 24, note: 64, len: 8, voice: 'choir' },
];
```

`last-light/src/audio.js`:
```js
// All of Last Light's sound, made live with Web Audio (there are no audio files).
//   - Creatures are positional (HRTF): you hear where they are in the dark. At most 12 positional
//     voices play at once; a new sound takes a free voice, or the one playing farthest away.
//   - Around you: wind (quieter under the roof), the stove crackling near it, your footsteps.
//   - Guns crack and echo off the trees; the score (music.js) is scheduled a little ahead.
// Browsers only allow sound after a click, so start() is called from inside the click that starts a
// night (main.js). M mutes; the volume and mute are remembered.
import { layersFor, notesAt, midiToHz, STEP, DAWN } from './music.js';
import { FEEL } from './tuning.js';

const MUTE_KEY = 'last-light-muted', VOLUME_KEY = 'last-light-volume';
const VOICES = 12;
const AHEAD = 0.2; // seconds of music scheduled ahead

export function createAudio(storage) {
  let ctx = null, master = null, music = null, sfx = null, echo = null, noise = null;
  let wind = null, windGain = null, stoveGain = null;
  let voices = [];
  let muted = storage.get(MUTE_KEY) === '1';
  let volume = Number(storage.get(VOLUME_KEY) ?? 0.8);
  if (!(volume >= 0 && volume <= 1)) volume = 0.8;
  let nextStep = 0, stepAt = 0, dawnAt = -1, lastWalked = 0, heartAt = 0, idleAt = 0, crackleAt = 0;

  const level = () => (muted ? 0 : volume);

  function start() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = 0.5;
    music.connect(master);
    sfx = ctx.createGain();
    sfx.connect(master);
    // The echo off the treeline: a filtered feedback delay the guns send into.
    echo = ctx.createDelay(1);
    echo.delayTime.value = 0.21;
    const fb = ctx.createGain(), tone = ctx.createBiquadFilter();
    fb.gain.value = 0.32;
    tone.type = 'lowpass';
    tone.frequency.value = 1400;
    echo.connect(tone).connect(fb).connect(echo);
    tone.connect(sfx);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Wind: looping noise through a slowly breathing low-pass.
    wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 0.09;
    depth.gain.value = 180;
    lfo.connect(depth).connect(wf.frequency);
    wind.connect(wf).connect(windGain).connect(sfx);
    wind.start();
    lfo.start();
    stoveGain = ctx.createGain();
    stoveGain.gain.value = 0;
    stoveGain.connect(sfx);
    voices = Array.from({ length: VOICES }, () => {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.rolloffFactor = 1.3;
      panner.maxDistance = 40;
      const gain = ctx.createGain();
      gain.connect(panner).connect(sfx);
      return { panner, gain, until: 0, x: 0, y: 0 };
    });
    nextStep = 0;
    stepAt = ctx.currentTime + 0.1;
  }

  // Sets a panner or listener position (Safari only has setPosition).
  function place(node, x, y) {
    if (node.positionX) {
      node.positionX.value = x;
      node.positionY.value = 0;
      node.positionZ.value = y;
    } else node.setPosition(x, 0, y);
  }

  // A positional voice for a sound lasting `len` seconds at (x, y); null before start().
  function voiceAt(x, y, len, lx, ly) {
    if (!ctx) return null;
    const now = ctx.currentTime;
    let v = voices.find((o) => o.until <= now);
    if (!v) {
      v = voices[0];
      for (const o of voices) if (Math.hypot(o.x - lx, o.y - ly) > Math.hypot(v.x - lx, v.y - ly)) v = o;
    }
    v.until = now + len;
    v.x = x;
    v.y = y;
    place(v.panner, x, y);
    return v.gain;
  }

  // Building blocks. Each plays into `out` starting at time t.
  function burst(out, t, { len, type = 'bandpass', freq = 1000, q = 1, vol = 1, to }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + len);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5, len + 0.05);
    return g;
  }
  function tone(out, t, { len, type = 'sine', freq = 220, to, vol = 0.5, attack = 0.005, vib = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
    if (vib) {
      const l = ctx.createOscillator(), dg = ctx.createGain();
      l.frequency.value = 7;
      dg.gain.value = vib;
      l.connect(dg).connect(o.frequency);
      l.start(t);
      l.stop(t + len);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return g;
  }

  const CRY = [640, 260, 900, 140]; // death-cry pitch by kind
  const GROWL = [0, 75, 0, 48];

  // Plays the sounds for one update's events. (lx, ly) is where you are.
  function events(state) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, p = state.player, lx = p.x, ly = p.y;
    for (let i = 0; i < state.eventCount; i++) {
      const e = state.events[i];
      switch (e.type) {
        case 'shot':
          if (e.a === 0) {
            burst(sfx, t, { len: 0.09, freq: 1500, q: 0.7, vol: 0.9 }).connect(echo);
            tone(sfx, t, { len: 0.16, freq: 110, to: 38, vol: 0.9 });
            burst(sfx, t + 0.2, { len: 0.03, type: 'highpass', freq: 2800, vol: 0.4 }); // lever
            burst(sfx, t + 0.31, { len: 0.03, type: 'highpass', freq: 2200, vol: 0.4 });
          } else {
            burst(sfx, t, { len: 0.4, type: 'lowpass', freq: 1800, to: 300, vol: 1 }).connect(echo);
            tone(sfx, t, { len: 0.25, freq: 80, to: 30, vol: 1 });
          }
          break;
        case 'dry':
          burst(sfx, t, { len: 0.02, type: 'highpass', freq: 3000, vol: 0.3 });
          break;
        case 'reload':
          burst(sfx, t, { len: 0.03, freq: 2000, q: 3, vol: 0.35 });
          burst(sfx, t + 0.05, { len: 0.03, freq: 1400, q: 3, vol: 0.3 });
          break;
        case 'switch':
          burst(sfx, t, { len: 0.18, freq: 600, to: 1600, q: 0.8, vol: 0.15 });
          break;
        case 'hit': {
          const g = voiceAt(e.x, e.y, 0.9, lx, ly);
          burst(g, t, { len: 0.08, type: 'lowpass', freq: 500, vol: 0.9 });
          if (e.b) tone(g, t + 0.02, { len: 0.7, type: 'sawtooth', freq: CRY[e.a], to: CRY[e.a] * 0.35, vol: 0.35, vib: 18 });
          break;
        }
        case 'hurt':
          burst(sfx, t, { len: 0.12, type: 'lowpass', freq: 350, vol: 1 });
          tone(sfx, t, { len: 0.2, freq: 120, to: 70, vol: 0.5 });
          break;
        case 'windup': {
          const g = voiceAt(e.x, e.y, 0.7, lx, ly);
          tone(g, t, { len: 0.6, type: 'sawtooth', freq: GROWL[e.a] || 70, to: (GROWL[e.a] || 70) * 1.3, vol: 0.5, attack: 0.1, vib: 6 });
          break;
        }
        case 'shriek': {
          const g = voiceAt(e.x, e.y, 0.5, lx, ly);
          tone(g, t, { len: 0.45, type: 'sawtooth', freq: 600, to: 1500, vol: 0.4, attack: 0.03, vib: 40 });
          break;
        }
        case 'leap':
          burst(voiceAt(e.x, e.y, 0.3, lx, ly), t, { len: 0.25, freq: 400, to: 1200, vol: 0.5 });
          break;
        case 'birth':
          burst(voiceAt(e.x, e.y, 0.6, lx, ly), t, { len: 0.5, type: 'lowpass', freq: 250, to: 120, vol: 1 });
          break;
        case 'flareThrow':
          burst(sfx, t, { len: 0.2, freq: 900, to: 300, vol: 0.2 });
          burst(voiceAt(e.x, e.y, 0.6, lx, ly), t + 0.3, { len: 0.5, type: 'highpass', freq: 2500, vol: 0.6 });
          break;
        case 'pickup':
          tone(sfx, t, { len: 0.3, freq: 880, vol: 0.2 });
          tone(sfx, t + 0.08, { len: 0.4, freq: 1320, vol: 0.15 });
          break;
        case 'wave': {
          // A bell tolls the hour.
          for (const [ratio, vol] of [[1, 0.5], [2.76, 0.2], [5.4, 0.1]]) tone(sfx, t, { len: 3, freq: 98 * ratio, vol, attack: 0.01 });
          break;
        }
        case 'dawn':
          dawnAt = t + 0.5;
          break;
        case 'dead':
          tone(sfx, t, { len: 3, type: 'sawtooth', freq: 55, to: 30, vol: 0.4, attack: 0.3 });
          break;
      }
    }
  }

  function playNote(layer, n, t, len) {
    const out = music;
    switch (layer) {
      case 'drone':
        tone(out, t, { len: len * STEP, type: 'sawtooth', freq: midiToHz(n.note), vol: n.vel * 0.12, attack: 1.5 });
        break;
      case 'pulse':
        tone(out, t, { len: 0.25, freq: 55, to: 35, vol: n.vel * 0.8 });
        break;
      case 'strings':
      case 'choir':
        tone(out, t, { len: len * STEP, type: layer === 'strings' ? 'sawtooth' : 'triangle', freq: midiToHz(n.note), vol: n.vel * 0.1, attack: 0.8, vib: 2 });
        break;
      case 'musicbox':
        tone(out, t, { len: 1.6, freq: midiToHz(n.note), vol: n.vel * 0.4 });
        tone(out, t, { len: 0.8, freq: midiToHz(n.note) * 3.01, vol: n.vel * 0.06 });
        break;
      case 'ticks':
        burst(out, t, { len: 0.03, type: 'highpass', freq: 6000, vol: n.vel * 0.25 });
        break;
      case 'toms':
        tone(out, t, { len: 0.35, freq: midiToHz(n.note), to: midiToHz(n.note) * 0.6, vol: n.vel * 0.6 });
        break;
      case 'brass':
        tone(out, t, { len: len * STEP * 0.8, type: 'sawtooth', freq: midiToHz(n.note), vol: n.vel * 0.25, attack: 0.04 });
        break;
    }
  }

  // Called every frame: moves the listener, keeps the ambience right, schedules the score.
  function update(state, facing, screen) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, p = state.player, L = ctx.listener;
    place(L, p.x, p.y);
    const fx = Math.cos(facing), fz = Math.sin(facing);
    if (L.forwardX) {
      L.forwardX.value = fx;
      L.forwardY.value = 0;
      L.forwardZ.value = fz;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else L.setOrientation(fx, 0, fz, 0, 1, 0);

    const playing = screen === 'playing';
    const phase = state.night.phase;
    const indoors = state.map.roofed[Math.floor(p.y) * state.map.w + Math.floor(p.x)] === 1;
    const windTo = !playing ? 0.05 : (phase === 'lull' ? 0.5 : 0.3) * (indoors ? 0.35 : 1);
    windGain.gain.setTargetAtTime(windTo, t, 0.5);
    const sd = state.stove ? Math.hypot(state.stove.x - p.x, state.stove.y - p.y) : 99;
    stoveGain.gain.setTargetAtTime(playing ? Math.max(0, 1 - sd / 6) * 0.5 : 0, t, 0.3);
    if (!playing) return;

    // The stove's crackle, a click at a time.
    if (sd < 6 && t >= crackleAt) {
      crackleAt = t + 0.05 + Math.random() * 0.25;
      burst(stoveGain, t, { len: 0.02 + Math.random() * 0.03, type: 'highpass', freq: 1500 + Math.random() * 3000, vol: 0.3 + Math.random() * 0.5 });
    }
    // Footsteps: a crunch every 0.9 cells.
    if (p.walked - lastWalked > 0.9) {
      lastWalked = p.walked;
      burst(sfx, t, { len: 0.08, type: indoors ? 'bandpass' : 'lowpass', freq: indoors ? 300 : 700 + Math.random() * 300, vol: 0.18 });
    } else if (p.walked < lastWalked) lastWalked = p.walked;
    // A heartbeat when you're low.
    if (p.health > 0 && p.health <= FEEL.lowHealth && t >= heartAt) {
      heartAt = t + 0.9;
      tone(sfx, t, { len: 0.12, freq: 60, to: 40, vol: 0.6 });
      tone(sfx, t + 0.18, { len: 0.12, freq: 55, to: 38, vol: 0.4 });
    }
    // Now and then a nearby creature makes its sound: a skitter, a breath, a chitter, a moan.
    if (t >= idleAt) {
      idleAt = t + 0.3 + Math.random() * 0.8;
      let c = null, best = 10;
      for (const o of state.creatures) {
        if (!o.alive || o.dying) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y) + Math.random() * 4;
        if (d < best) {
          best = d;
          c = o;
        }
      }
      if (c) {
        const g = voiceAt(c.x, c.y, 0.9, p.x, p.y);
        if (c.kind === 0) for (let k = 0; k < 4; k++) burst(g, t + k * 0.05, { len: 0.02, type: 'highpass', freq: 2500, vol: 0.4 });
        else if (c.kind === 1) burst(g, t, { len: 0.8, freq: 380, q: 2, vol: 0.5 });
        else if (c.kind === 2) for (let k = 0; k < 6; k++) tone(g, t + k * 0.04, { len: 0.03, type: 'square', freq: 1800, vol: 0.08 });
        else tone(g, t, { len: 1.2, type: 'sawtooth', freq: 45, to: 38, vol: 0.5, attack: 0.3, vib: 3 });
      }
    }
    // The score: every step due in the next AHEAD seconds.
    if (stepAt < t) stepAt = t + 0.02;
    const layers = layersFor(phase, state.night.wave);
    while (stepAt < t + AHEAD) {
      for (const layer of layers) for (const n of notesAt(layer, nextStep)) playNote(layer, n, stepAt, n.len);
      if (dawnAt >= 0) {
        const since = Math.round((stepAt - dawnAt) / STEP);
        for (const d of DAWN) if (d.step === since) playNote(d.voice, { note: d.note, vel: 0.9 }, stepAt, d.len);
        if (since > 40) dawnAt = -1;
      }
      nextStep++;
      stepAt += STEP;
    }
  }

  return {
    start,
    events,
    update,
    get muted() {
      return muted;
    },
    get volume() {
      return volume;
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      storage.set(VOLUME_KEY, volume);
      if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    },
    toggleMute() {
      muted = !muted;
      storage.set(MUTE_KEY, muted ? '1' : '0');
      if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    },
    suspend() {
      ctx?.suspend();
    },
    resume() {
      if (ctx?.state === 'suspended') ctx.resume();
    },
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 134 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test
git commit -m "Last Light: keyboard and raw mouse input, the generated score, and positional sound"
```

---

### Task 10: The page, the game's flow, and the first real frames

**Files:**
- Create: `last-light/src/game.js`, `last-light/src/main.js`, `last-light/index.html`
- Test: `last-light/test/game.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces:
  - `game.js`: `createGame({ storage, map, seed?, debug? })` returns `{ screen, state, best: { hour, dawns }, banner, hitT, endT, saved, running, newNight(), pause(), resume(), quit(), tick(intents), frame(dt) }`.
    - The screens are 'title', 'playing', 'paused', 'dead' and 'dawn'.
    - Its storage keys are `last-light-best` and `last-light-dawns`.
  - `main.js`: the page's module. It exposes `window.__lastlight` (the game) and `window.__lastlightPerf` (`{ frameMs, updates }`) when any debug parameter is present.
  - `index.html`:
    - the canvas `#game`, the `← games` link, and the pause form `#pause` (`#resume`, `#sensitivity`, `#volume`, `#mute`, `#quit` and the `#pause-note`);
    - the messages `#phone`, `#message` and `#nostart`, a `<noscript>`, and the 6-second "couldn't start" fallback.

- [ ] **Step 1: Write the failing test**

`last-light/test/game.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { parseMap } from '../src/map.js';
import { NIGHT, DT, LIGHT } from '../src/tuning.js';
import { startWave, LAST_WAVE } from '../src/night.js';
import { intents } from './helpers.js';

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, String(v)) };
}
const map = parseMap();

test('title, then a night; pause and resume', () => {
  const g = createGame({ storage: memoryStorage(), map, seed: 1 });
  assert.equal(g.screen, 'title');
  g.newNight();
  assert.equal(g.screen, 'playing');
  g.pause();
  assert.equal(g.screen, 'paused');
  const t = g.state.tick;
  g.tick(intents());
  assert.equal(g.state.tick, t, 'nothing moves while paused');
  g.resume();
  g.tick(intents());
  assert.equal(g.state.tick, t + 1);
});

test('the wave banner shows the hour', () => {
  const g = createGame({ storage: memoryStorage(), map, seed: 1 });
  g.newNight();
  for (let i = 0; i < (NIGHT.dusk + 0.1) / DT; i++) g.tick(intents());
  assert.equal(g.banner.text, '9 PM');
  assert.ok(g.banner.t > 0);
});

test('dying shows the death screen after a moment, and saves the best hour', () => {
  const storage = memoryStorage();
  const g = createGame({ storage, map, seed: 1 });
  g.newNight();
  startWave(g.state, 3);
  g.state.player.health = 0.5;
  for (let i = 0; i < 90 / DT && g.screen === 'playing'; i++) g.tick(intents());
  assert.equal(g.screen, 'dead');
  assert.equal(g.best.hour, 3);
  assert.equal(storage.get('last-light-best'), '3');
});

test('the dawn counts, and a worse night never lowers the best', () => {
  const storage = memoryStorage({ 'last-light-best': '8', 'last-light-dawns': '2' });
  const g = createGame({ storage, map, seed: 1 });
  assert.deepEqual(g.best, { hour: 8, dawns: 2 });
  g.newNight();
  startWave(g.state, LAST_WAVE);
  g.state.night.qi = g.state.night.qn;
  g.state.creatures.forEach((c) => (c.alive = false));
  for (let i = 0; i < (LIGHT.dawnTime + 3) / DT; i++) g.tick(intents());
  assert.equal(g.screen, 'dawn');
  assert.deepEqual(g.best, { hour: 8, dawns: 3 });
  assert.equal(storage.get('last-light-dawns'), '3');
});

test('junk in storage is ignored', () => {
  const g = createGame({ storage: memoryStorage({ 'last-light-best': 'lots', 'last-light-dawns': '-4' }), map });
  assert.deepEqual(g.best, { hour: 0, dawns: 0 });
});

test('?wave= and ?god reach the night', () => {
  const g = createGame({ storage: memoryStorage(), map, debug: { wave: 7, god: true } });
  g.newNight();
  assert.equal(g.state.night.wave, 7);
  assert.equal(g.state.god, true);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: FAIL with `Cannot find module .../src/game.js`.

- [ ] **Step 3: Write the game flow, the page and the loop**

`last-light/src/game.js`:
```js
// The screens and the flow between them: title, playing, paused, dead, dawn. Owns the night being
// played, turns its events into banners, and remembers your best night: the latest hour you reached,
// and how many dawns you've seen.
import { createState, step } from './sim.js';
import { NIGHT, LIGHT, DT } from './tuning.js';
import { LAST_WAVE } from './night.js';

const BEST_KEY = 'last-light-best', DAWNS_KEY = 'last-light-dawns';
const DEAD_DELAY = 1.5; // seconds between dying and the death screen
const DAWN_DELAY = LIGHT.dawnTime + 2;
// A line under some hours' banners.
const WAVE_LINES = ["They're coming out of the trees.", '', 'Something leaps in the dark.', '', '', '', '', 'Something huge is coming.'];

export function createGame({ storage, map, seed = Date.now(), debug = {} }) {
  let nextSeed = seed >>> 0;
  const readInt = (k) => {
    const v = Number.parseInt(storage.get(k) ?? '0', 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const game = {
    screen: 'title',
    state: null,
    best: { hour: Math.min(readInt(BEST_KEY), LAST_WAVE + 1), dawns: readInt(DAWNS_KEY) },
    banner: { text: '', sub: '', t: 0 },
    hitT: 9,
    endT: 0,
    saved: false,

    newNight() {
      game.state = createState({ seed: nextSeed++, wave: debug.wave ?? 0, god: !!debug.god, map });
      game.screen = 'playing';
      game.endT = 0;
      game.saved = false;
      game.banner.t = 0;
    },
    pause() {
      if (game.screen === 'playing') game.screen = 'paused';
    },
    resume() {
      if (game.screen === 'paused') game.screen = 'playing';
    },
    quit() {
      game.screen = 'title';
      game.state = null;
    },
    // True while the night keeps running under the screen (playing, and the dawn's afterglow).
    get running() {
      return game.state !== null && (game.screen === 'playing' || game.screen === 'dawn');
    },

    // One 120 Hz update.
    tick(intents) {
      if (!game.running) return;
      const s = game.state;
      step(s, intents);
      for (let i = 0; i < s.eventCount; i++) {
        const e = s.events[i];
        if (e.type === 'hit') game.hitT = 0;
        else if (e.type === 'wave') show(NIGHT.hours[e.a], WAVE_LINES[e.a] ?? '', 3);
        else if (e.type === 'lull' && e.a === 1) show('', 'Warm up by the stove.', 3);
        else if (e.type === 'pickup' && e.a === 2) show('Shotgun', '1 and 2 switch guns', 3);
      }
      const phase = s.night.phase;
      if (phase === 'dead' || phase === 'dawn') {
        game.endT += DT;
        if (!game.saved) save(s);
        if (phase === 'dead' && game.endT >= DEAD_DELAY) game.screen = 'dead';
        if (phase === 'dawn' && game.endT >= DAWN_DELAY) game.screen = 'dawn';
      }
    },
    // Once a frame: timers for the banner and the hit tick.
    frame(dt) {
      if (game.banner.t > 0) game.banner.t -= dt;
      game.hitT += dt;
      if (game.screen === 'dead' && game.state) game.endT += dt;
    },
  };

  function show(text, sub, t) {
    game.banner.text = text;
    game.banner.sub = sub;
    game.banner.t = t;
  }

  function save(s) {
    game.saved = true;
    const reached = s.night.reached;
    if (reached > game.best.hour) {
      game.best.hour = reached;
      storage.set(BEST_KEY, reached);
    }
    if (s.night.phase === 'dawn') {
      game.best.dawns++;
      storage.set(DAWNS_KEY, game.best.dawns);
    }
  }

  return game;
}
```

`last-light/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Last Light</title>
  <link rel="icon" href="icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap" rel="stylesheet">
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #05070c; }
    canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; image-rendering: crisp-edges; image-rendering: pixelated; }
    body, button, input { font: 12px/1.6 Silkscreen, monospace; color: #d9d2c0; }
    a { color: #8f8a7c; }
    a.back { position: fixed; top: 8px; left: 10px; text-decoration: none; }
    a.back:hover, a.back:focus { color: #d9d2c0; }
    .note { position: fixed; inset: 0; margin: auto; height: fit-content; padding: 0 16px; text-align: center; }
    #pause { position: fixed; inset: 0; margin: auto; width: min(320px, calc(100vw - 32px)); height: fit-content; padding: 20px; box-sizing: border-box; background: #0b0e16ee; border: 2px solid #2b3040; display: grid; gap: 12px; }
    #pause[hidden], .note[hidden] { display: none; }
    #pause h2 { margin: 0; font-size: 16px; text-align: center; }
    #pause label { display: grid; gap: 4px; }
    #pause label.check { display: flex; gap: 8px; align-items: center; }
    #pause button { padding: 6px; background: #1c2130; border: 2px solid #3b4258; cursor: pointer; }
    #pause button:hover, #pause button:focus-visible { background: #2b3246; }
  </style>
</head>
<body>
  <canvas id="game" aria-label="Last Light: a first-person survival game for keyboard and mouse"></canvas>
  <a class="back" href="../">← games</a>
  <form id="pause" hidden onsubmit="return false">
    <h2>Paused</h2>
    <button id="resume" type="button">Resume</button>
    <p id="pause-note" hidden>Click Resume again in a moment.</p>
    <label>Mouse sensitivity <input id="sensitivity" type="range" min="0" max="100"></label>
    <label>Volume <input id="volume" type="range" min="0" max="100"></label>
    <label class="check"><input id="mute" type="checkbox"> Mute (M)</label>
    <button id="quit" type="button">Quit to title</button>
  </form>
  <p class="note" id="phone" hidden>Last Light needs a keyboard and mouse.<br><a href="../">Back to the games</a></p>
  <p class="note" id="message" hidden><strong></strong><br><span></span></p>
  <p class="note" id="nostart" hidden>Last Light couldn't start. It needs a current desktop browser:<br>Chrome, Firefox or Safari.</p>
  <noscript><p class="note">Last Light needs JavaScript.</p></noscript>
  <script type="module" src="./src/main.js"></script>
  <script>
    // If the game's module never starts (a browser too old for it), say so in plain text. main.js
    // removes this message the moment it runs, so a slow connection only delays it.
    setTimeout(function () {
      var m = document.getElementById('nostart');
      if (m) m.hidden = false;
    }, 6000);
  </script>
</body>
</html>
```

`last-light/src/main.js`:
```js
// Boot, the loop, and the wiring between input, the game, the renderer, the HUD and sound.
//
// The world updates at a fixed 120 Hz; frames draw on requestAnimationFrame at the display's rate,
// blending between the last two updates. The renderer draws into a pixel buffer at internal
// resolution that an ImageData shares (no copy), the HUD goes on top with the 2D context, and the
// result is scaled up by a whole number in one drawImage.
//
// Debug (URL): ?debug=fps shows frame times; ?debug=bot plays by itself (&speed=N runs N updates per
// update); ?wave=N starts at wave N (1-8); ?god means you can't die; ?seed=N fixes the night. With
// any of them, window.__lastlight exposes the game, and window.__lastlightPerf the frame timing
// ({ frameMs, updates }), for the browser checks.
import { createInput } from './input.js';
import { createClock } from './clock.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { loadArt } from './assets.js';
import { safeStorage } from './storage.js';
import { parseMap } from './map.js';
import { chooseView } from './view.js';
import { createRenderer } from './render.js';
import { createLightmap, bakeStatic } from './lightmap.js';
import { createScene, buildFrame, sceneEvents } from './scene.js';
import { drawHud, drawScreen } from './hud.js';
import { createBot, botIntents } from './bot.js';
import { createState } from './sim.js';
import { LIGHT, MOUSE, DT } from './tuning.js';

// The module is running, so the page's "couldn't start" message will never be needed.
document.getElementById('nostart')?.remove();

const params = new URLSearchParams(location.search);
const debugFlags = new Set((params.get('debug') ?? '').split(',').filter(Boolean));
const int = (v, lo, hi, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const debug = {
  fps: debugFlags.has('fps'),
  bot: debugFlags.has('bot'),
  god: params.has('god'),
  wave: int(params.get('wave'), 1, 8, 1) - 1,
};
const speed = debug.bot ? int(params.get('speed'), 1, 20, 1) : 1;
const seed = params.has('seed') ? int(params.get('seed'), 0, 2 ** 31, 1) : Date.now();
const anyDebug = debug.fps || debug.bot || debug.god || params.has('wave') || params.has('seed');

const canvas = document.getElementById('game');
const message = (title, detail) => {
  const m = document.getElementById('message');
  m.querySelector('strong').textContent = title;
  m.querySelector('span').textContent = detail;
  m.hidden = false;
};

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
if (touchOnly && !debug.bot) {
  document.getElementById('phone').hidden = false;
} else {
  boot().catch((err) => {
    console.error(err);
    message("Last Light couldn't load its art.", 'Check your connection, then reload the page.');
  });
}

async function boot() {
  const storage = safeStorage();
  const audio = createAudio(storage);
  const input = createInput(window, document);
  input.element = canvas;
  const sens = Number(storage.get('last-light-sensitivity') ?? 1);
  input.sensitivity = sens >= MOUSE.minScale && sens <= MOUSE.maxScale ? sens : 1;
  const map = parseMap();
  const game = createGame({ storage, map, seed, debug });
  if (anyDebug) window.__lastlight = game;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const [art] = await Promise.all([
    loadArt(),
    document.fonts.load('8px Silkscreen').catch((err) => console.warn('Silkscreen not loaded; using the fallback font', err)),
  ]);
  const renderer = createRenderer(art, map);
  const scene = createScene(art);
  const lightmap = createLightmap(map);
  const stove = map.props.find((p) => p.kind === 'stove');
  bakeStatic(lightmap, map, [{ x: stove.x, y: stove.y, ...LIGHT.stove }]);
  const titleState = createState({ seed: 7, map }); // the backdrop behind the title screen
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  let view, image;

  function fit() {
    view = chooseView(innerWidth, innerHeight, devicePixelRatio || 1);
    canvas.width = view.dw;
    canvas.height = view.dh;
    off.width = view.w;
    off.height = view.h;
    renderer.resize(view);
    image = new ImageData(new Uint8ClampedArray(renderer.buffer.buffer), view.w, view.h);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = art.ui.night;
    ctx.fillRect(0, 0, view.dw, view.dh);
  }
  fit();
  addEventListener('resize', fit);

  // The pause menu (a plain HTML form over the canvas).
  const pause = document.getElementById('pause');
  const sensInput = document.getElementById('sensitivity'), volInput = document.getElementById('volume');
  const muteInput = document.getElementById('mute'), note = document.getElementById('pause-note');
  // The slider runs 0-100 for 0.25x-4x, evenly in ratio (50 is 1x).
  sensInput.value = String(Math.round((Math.log(input.sensitivity / MOUSE.minScale) / Math.log(MOUSE.maxScale / MOUSE.minScale)) * 100));
  volInput.value = String(Math.round(audio.volume * 100));
  muteInput.checked = audio.muted;
  sensInput.addEventListener('input', () => {
    input.sensitivity = MOUSE.minScale * (MOUSE.maxScale / MOUSE.minScale) ** (Number(sensInput.value) / 100);
    storage.set('last-light-sensitivity', input.sensitivity.toFixed(3));
  });
  volInput.addEventListener('input', () => audio.setVolume(Number(volInput.value) / 100));
  muteInput.addEventListener('change', () => {
    if (muteInput.checked !== audio.muted) audio.toggleMute();
  });
  const showPause = (show) => {
    pause.hidden = !show;
    note.hidden = true;
    muteInput.checked = audio.muted;
  };
  const lockOrExplain = async () => {
    if (!(await input.lock())) note.hidden = false; // Chrome: too soon after Esc; the next click works
  };
  document.getElementById('resume').addEventListener('click', lockOrExplain);
  document.getElementById('quit').addEventListener('click', () => {
    game.quit();
    showPause(false);
  });

  const clock = createClock();
  let bot = createBot();
  const start = () => {
    game.newNight();
    input.facing = game.state.player.facing;
    input.releaseAll();
    bot = createBot();
    clock.reset();
  };
  // A click on the canvas starts a night (and the sound, which browsers only allow from a click).
  canvas.addEventListener('click', () => {
    audio.start();
    if (debug.bot) {
      if (game.screen !== 'playing') start();
    } else if (!input.locked) lockOrExplain();
  });
  // With the mouse still locked on the death or dawn screen, a click starts the next night.
  canvas.addEventListener('mousedown', () => {
    if (input.locked && (game.screen === 'dead' || game.screen === 'dawn') && game.endT > 2.5) start();
  });
  document.addEventListener('pointerlockchange', () => {
    if (input.locked) {
      showPause(false);
      if (game.screen === 'paused') {
        game.resume();
        input.releaseAll();
        clock.reset();
      } else if (game.screen === 'title') start();
    } else if (game.screen === 'playing') {
      game.pause();
      showPause(true);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.screen === 'playing' && !debug.bot) {
        game.pause();
        showPause(true);
      }
      audio.suspend();
    } else audio.resume();
  });
  if (debug.bot) start(); // sound waits for a click, as browsers require

  let time = 0, last = null;
  const perf = { frameMs: 0, updates: 0 };
  if (anyDebug) window.__lastlightPerf = perf;
  const frameView = { facing: 0, alpha: 0, time: 0, dt: 0, reducedMotion: false, h: 0, focal: 0 };
  const hudInfo = { time: 0, hitT: 0, banner: game.banner, reducedMotion: false };
  const screenInfo = { time: 0, best: game.best, reached: 0, kills: 0 };
  const loop = (now) => {
    try {
      const t0 = performance.now();
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      if (input.takeUI().mute) audio.toggleMute();
      const n = game.running ? clock.advance(now) * speed : 0;
      for (let i = 0; i < n; i++) {
        game.tick(debug.bot ? botIntents(game.state, bot, DT) : input.sample());
        audio.events(game.state);
        sceneEvents(scene, game.state);
      }
      perf.updates = n;
      game.frame(dt);
      draw(dt);
      perf.frameMs = perf.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    } catch (err) {
      // An error stops the loop with a message, rather than freezing without a word.
      console.error(err);
      message('Something went wrong.', 'Reload the page to play again.');
      return;
    }
    requestAnimationFrame(loop);
  };

  function draw(dt) {
    const s = game.state ?? titleState;
    const facing = !game.state ? Math.PI / 2 + Math.sin(time * 0.07) * 0.8 : debug.bot ? bot.facing : input.facing;
    const alpha = game.running ? clock.alpha : 1;
    frameView.facing = facing;
    frameView.alpha = alpha;
    frameView.time = time;
    frameView.dt = dt;
    frameView.reducedMotion = reducedMotion.matches;
    frameView.h = view.h;
    frameView.focal = view.focal;
    const f = buildFrame(scene, s, lightmap, frameView);
    renderer.draw(f);
    octx.putImageData(image, 0, 0);
    if (game.state && (game.screen === 'playing' || game.screen === 'paused')) {
      hudInfo.time = time;
      hudInfo.hitT = game.hitT;
      hudInfo.reducedMotion = frameView.reducedMotion;
      drawHud(octx, art, s, view, hudInfo);
    } else if (game.screen !== 'paused') {
      screenInfo.time = time;
      screenInfo.reached = s.night.reached;
      screenInfo.kills = s.stats.kills;
      drawScreen(octx, art, view, game.screen, screenInfo);
    }
    if (debug.fps) {
      octx.font = '8px Silkscreen, monospace';
      octx.textAlign = 'left';
      octx.textBaseline = 'top';
      octx.fillStyle = '#ffffff';
      octx.fillText(`${perf.frameMs.toFixed(2)} ms  ${perf.updates} upd  ${view.w}x${view.h} x${view.scale}`, 4, 4);
    }
    if (scene.shakeX || scene.shakeY || view.ox > 0) ctx.fillRect(0, 0, view.dw, view.dh);
    ctx.drawImage(off, view.ox + scene.shakeX * view.scale, view.oy + scene.shakeY * view.scale, view.w * view.scale, view.h * view.scale);
    audio.update(s, facing, game.screen);
  }
  requestAnimationFrame(loop);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test`
Expected: PASS, 140 tests.

- [ ] **Step 5: Check it in the browser**

Serve the repo root in the background: `cd /Users/nathan/Documents/code/games && python3 -m http.server 8000`. Then run these with the Playwright MCP. For each check, make a fresh context with `browser_run_code_unsafe`, as in this shape:
```js
async (page) => {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://localhost:8000/last-light/?debug=bot&god&speed=20&seed=2');
  // ...wait and evaluate...
  await ctx.close();
  return { errors };
}
```
Save screenshots only under `/Users/nathan/Documents/code/.playwright-mcp/`.

1. **The title.** Load `/last-light/`. Expect 0 console errors (a browser warning is fine) and the title screen over the dusk backdrop. Screenshot it as `ll-title.png`.
2. **A whole night.** Load `/last-light/?debug=bot&god&speed=20&seed=2`. Poll `window.__lastlight.screen` every 10 s for up to 3 minutes: it reaches `'dawn'`, with 0 console errors. Screenshot `ll-dawn.png`.
3. **The Mother.** Load `/last-light/?debug=bot,fps&god&wave=8&seed=4` and wait 15 s. Expect `__lastlight.state.creatures.some(c => c.alive && c.kind === 3)` to be true. Screenshot `ll-mother.png`.
4. **Smoothness.** Load `/last-light/?debug=bot,fps&god&wave=7&seed=5` and wait 20 s. Expect `__lastlightPerf.frameMs < 6`. The prototype measured 3.1 ms here, with 7–20 creatures alive. This headless number includes the software scale-up; a real browser with a GPU does better. Record the number in your report.
5. **A phone.** Make a context with `{ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }` and load `/last-light/`. Expect `#phone` to be visible and the canvas never started (`window.__lastlight` is undefined).
6. **The first real frames.** This is the style test's mock first-person frame (Refinement 2). Load `/last-light/?debug=bot&god&wave=3&seed=9` at 1280×720. Take screenshots at 10 s and at 25 s (`ll-frame-1.png`, `ll-frame-2.png`). Put both paths in your report; the controller sends them to Nathan.

If anything fails, fix it before committing, and write down what was wrong.

- [ ] **Step 6: Commit**

```bash
cd /Users/nathan/Documents/code/games
git add last-light/src last-light/test last-light/index.html
git commit -m "Last Light: the page, screens and pause menu, and the game loop"
```

---

### Task 11: The feel pass

**Files:**
- Modify, only where these checks find a problem:
  - `last-light/src/tuning.js`;
  - the art scripts' `hands.lua` offsets and `sprites.lua` heights, and the regenerated assets;
  - `last-light/src/hud.js`, for layout only.
- Test: the existing suites. Add a test for any rule you change.

**Interfaces:**
- Consumes: the whole game.
- Produces: tuning and art adjustments, each justified in the report with its before and after screenshot. No new modules.

This is a judgment task, done by looking at the real game in the browser. Work through the checks in order. For each one, record what you saw, what you changed (if anything) and why.

- [ ] **Step 1: Light and dark, across the night**

- **Screenshots.** Take a screenshot at 1280×720 of `?debug=bot&god&wave=N&seed=11` for N = 1, 4 and 8, 12 s in each.
- **What to judge:**
  - Creatures inside the lantern's circle (about 3 cells) are clearly readable.
  - Between 3 and 7 cells they're shapes.
  - Past 7 cells only their eyes show.
  - The window glows, and the snow outside the doorway catches the stove's light.
- **The dials, and their allowed ranges:**
  - `LIGHT.lantern.full` 2.5–4 and `dark` 6–9;
  - `LIGHT.night[]` 0.02–0.08;
  - `LIGHT.eyes` full 10–14 and dark 14–20.
- **Keep the night dark.** Horror needs it.

- [ ] **Step 2: The hands and sprite scale**

- **The guns and lantern.** In the screenshots, the guns sit bottom-right and the lantern bottom-left. Neither covers the crosshair, and the muzzle flash appears at the barrel tip. Adjust the `hands.lua` offsets if not.
- **Creature sizes.** Against the 1.0-unit walls, a crawler should come about knee-high, a gaunt a little taller than you, and the Mother should tower. Adjust the `height` values in `sprites.lua` if not.
- **Afterwards,** rerun the rebuild loop and the art test.

- [ ] **Step 3: Reduced motion**

With `browser_emulate_media` `{ reducedMotion: 'reduce' }`, load `?debug=bot&god&seed=3`. Evaluate over a few seconds that the screen doesn't shake and the view doesn't bob. `scene.test.js` already pins the rule; this checks the wiring (`main.js` reads the media query each frame).

- [ ] **Step 4: Sound and the pause flow, as far as a headless browser can go**

- **Sound.** Click the canvas in bot mode (`?debug=bot&god`), which starts the sound. Expect 0 console errors over 20 s.
- **The pause menu.** Show it with `document.getElementById('pause').hidden = false` and check it with `browser_snapshot`:
  - it's reachable by keyboard;
  - the sensitivity slider maps 50 to 1× (`input.sensitivity` changes, and the value is saved as `last-light-sensitivity`).

  Pointer lock itself can't run headless. Nathan tests it (listed for Task 13).

- [ ] **Step 5: Run everything, and commit if anything changed**

Run: `cd /Users/nathan/Documents/code/games/last-light && npm test && npm run bench`
Expected: 140 or more tests passing (more if you added any), and the bench under 4 ms.
```bash
cd /Users/nathan/Documents/code/games
git add -A last-light art/last-light
git commit -m "Last Light: feel pass: <what changed>"
```
If nothing needed changing, commit nothing, and say so in the report.

---

## Phase 4: The games page, and release

### Task 12: Last Light's island on the games page

**Files:**
- Create: `art/site/island-last-light.lua`
- Modify:
  - `art/site/palette.lua` (a `glow["last-light"]` colour, and a `lastLight` colour table copied from `art/last-light/palette.lua`);
  - `site/games.json` (the new entry, and new spots for every island in both layouts);
  - `index.html` (the new link);
  - `README.md`.
- Generated (committed): `site/assets/island-last-light.png` and `.json`, and `art/site/island-last-light.aseprite`.

**Interfaces:**
- Consumes:
  - The games-page contracts: `art/site/island.lua`'s `I.write(id, frames, ms, glowColor)`, and the checks in `site/islands.js` (`checkGames`).
  - The README's "Adding a game" steps.
- Produces:
  - A fourth island, id `last-light`, that `cd site && npm test` accepts in both layouts.
  - The link, in exactly this line, as the third item of the list in the root `index.html`:
    `<li><a href="./last-light/" data-game="last-light"><strong>Last Light</strong> <span class="blurb">Hold the cabin until dawn.</span> <span class="controls">Keyboard and mouse: WASD move, mouse aim, click shoot.</span></a></li>`

**The island:** a floating chunk of the snowy clearing, in Last Light's own palette, so it's the darkest, coldest island on the page. Its frames are about 120×100, and its opaque width must be 96–140 px (the site test checks this).
- **On top:**
  - snow;
  - the little log cabin with snow on its roof and one window lit warm (`window`/`fire3` in the copied colours);
  - one or two pines.
- **Underneath:** frozen earth and roots, with icicles and dangling bits, like the other islands.
- **Animation,** 8–12 frames at 150–200 ms:
  - a few flakes drift off the island's edges;
  - the window flickers faintly;
  - now and then (in 2 of the frames) a pair of small `eye2` eyes blinks open in the pines.
- **The glow colour:** `glow["last-light"] = "#ffd7a0"`. It needs the quoted key because of the dash. Pass it to `I.write`.
- **Copying the colours.** Copy them into `art/site/palette.lua` under `lastLight`, as the file does for Snake and Marrow. The site's art must not read `art/last-light/`.
- **Borrowing the structure.** Copy the structure of `art/site/island-snake.lua` (buffer painting, frames, `I.write`), change its id to `last-light`, and repaint.

**The layout:**
- **Where things stand.** The stages are nearly full: landscape is 384×216 and portrait 216×384, with Snake, Marrow and the unfinished island already there.
- **The fourth spot.** It goes where the unfinished island is now, and the unfinished island moves on to a new spot (the spec's rule).
- **Fitting it in.** Re-lay out all four islands in both layouts until `cd site && npm test` passes. The test names any overlap, runoff, title collision or bob margin.
- **Suggested start:**
  - **Landscape:** Snake bottom-left, Marrow top-right of the title, Last Light bottom-middle, and the unfinished island far right.
  - **Portrait:** Snake and the unfinished island side by side in one row, then Marrow, then Last Light.
- **Checking it.** Check each phase in the browser: `/?time=dawn|day|dusk|night` at 1280×720, and a 390×844 phone. Hovering Last Light must show its sign without covering its cabin.

**README.md.** Add a "Last Light" section after "Marrow", in the same style:
- One line on what it is, and where the spec lives (`docs/superpowers/specs/2026-09-24-last-light-design.md`).
- **Tests:** `cd last-light && npm test`. **Bench:** `npm run bench` (target under 4 ms a frame).
- **Debug:** `?debug=fps`, `?debug=bot` (`&speed=N`), `?wave=N` (1–8), `?god` and `?seed=N`.
- **Tuning:** every number is in `last-light/src/tuning.js`.
- **Art:** the scripts are in `art/last-light/`, and `palette.lua` holds every colour. Rebuild from the repo root (it's deterministic):
  `for s in textures sky sprites hands hud icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done`
  The review sheet is `aseprite -b --script art/last-light/style-test.lua`, which writes `art/last-light/preview-style.png` (not committed).

- [ ] **Step 1: Add the link, and watch the site tests fail**

Add the link line to `index.html`, then run `cd /Users/nathan/Documents/code/games/site && npm test`.
Expected: FAIL. The page test says `games.json` has no `last-light`.

- [ ] **Step 2: Paint the island**

Add the colours and glow to `art/site/palette.lua`, and write `art/site/island-last-light.lua`. Run `/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/island-last-light.lua` from the repo root. Look at `art/site/preview-island-last-light.gif`. Run it twice: no changes on the second run.

- [ ] **Step 3: Place it, and re-lay out the islands**

Add `{ "id": "last-light", "island": "island-last-light", "at": { "landscape": [x, y], "portrait": [x, y] }, "bob": { "period": 4600, "phase": 0.2 } }` to `site/games.json` as the third game, and move islands until `cd site && npm test` passes. Then run `aseprite -b --script art/site/style-test.lua`, update its `ISLANDS` list to the new spots and the fourth island, and look at `preview-style.png`.

- [ ] **Step 4: Check the page in the browser**

Serve the repo root. At 1280×720, load `/?time=night`, `/?time=day` and `/?time=dusk`; also load a 390×844 portrait page. Expect 0 console errors and all four islands visible. Hovering or focusing the Last Light link lifts its island and shows its sign; clicking goes to `/last-light/`. Screenshot `site-night.png` and `site-portrait.png`, and put their paths in the report.

- [ ] **Step 5: Write the README section, run every suite, and commit**

Run:
```bash
cd /Users/nathan/Documents/code/games/site && npm test
cd /Users/nathan/Documents/code/games/last-light && npm test
cd /Users/nathan/Documents/code/games/marrow && npm test
```
Expected:
- the site suite passes (more than 69 tests, if the new island adds cases);
- last-light passes (140 or more);
- marrow still passes 173.

```bash
cd /Users/nathan/Documents/code/games
git add art/site index.html site README.md
git commit -m "Games page: Last Light's island, and the islands re-laid out for four"
```

---

### Task 13: Release (the controller does this; there's no implementer)

Nathan pre-approved publishing when it's done (2026-09-24).

- [ ] **Step 1: The whole-branch review** comes first, per subagent-driven development, including its one fix wave.

- [ ] **Step 2: Final checks on the branch**
```bash
cd /Users/nathan/Documents/code/games
(cd last-light && npm test && npm run bench) && (cd site && npm test) && (cd marrow && npm test)
for s in textures sky sprites hands hud icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done
/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/site/island-last-light.lua
git status --short   # expected: nothing (the art rebuilds byte for byte)
```

- [ ] **Step 3: Merge into main and publish**
```bash
cd /Users/nathan/Documents/code/games
git fetch origin
git checkout main && git merge --ff-only origin/main
git merge --no-ff last-light -m "Last Light: a first-person survival horror game, and its island on the games page"
(cd last-light && npm test) && (cd site && npm test)
git push origin main
```
Never force-push. If the push is refused, fetch and merge again, and investigate.

- [ ] **Step 4: Check the live site** (it takes about a minute to deploy):
- `https://natanforestree.github.io/games/last-light/` returns 200, and so do `src/main.js` and `assets/sprites.png`.
- The title screen loads with 0 console errors.
- `https://natanforestree.github.io/games/` shows four islands, and the Last Light link goes to `/games/last-light/`.
- `?debug=bot&god&speed=20` on the live game reaches dawn.

- [ ] **Step 5: Clean up, and tell Nathan.**
- Delete the `last-light` branch and the plan's SDD workspace.
- Update the memory file `games-site-github-pages.md`: Last Light is live, and this is its main commit.
- **Ask Nathan to check what a headless browser can't:**
  - the pointer lock and mouse feel;
  - the sound (the score across the night, and the positional creatures);
  - the frame rate on his Mac with `?debug=fps`.

---

## Self-review notes (for the executor)

- **Spec coverage.** Each spec section maps to a task:
  - the place, the night and the controls: Tasks 2, 4 and 10;
  - smoothness: Tasks 1, 3, 9 and 10, with the bench and the frame-time check;
  - the renderer: Task 3;
  - sound: Task 9;
  - the look: Tasks 6 and 8;
  - code structure: every task, with the extra modules in Refinement 11;
  - the front page: Task 12;
  - testing: every task's tests, plus the browser checks in Tasks 10 and 12;
  - out of scope: nothing here builds any of it.
- **Order.** Every task's tests pass using only the files from earlier tasks. This was replayed in a clean folder.
- **The art contract.** Its single source of truth is the code: `SPRITE_ANIMS` (`scene.js`), `HAND_FRAMES` and `HUD_ICONS` (`hud.js`), the wall kinds and `FLOORS` (`map.js`, `assets.js`), and the palette names (`assets.js`). `test/art.test.js` holds the committed art to it.
- **Numbers.** Tune them in `tuning.js` only. The tuning values in the spec's table are the ones in `tuning.js`, with the refinements above: the Mother's radius, the stove's light, the leaper's bite, and the `hit` widths.
