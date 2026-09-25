// The screens and the flow between them: title, playing, paused, dead, dawn. Owns the night being
// played, turns its events into banners, and remembers your best night: the latest hour you reached,
// and how many dawns you've seen.
import { createState, step } from './sim.js';
import { NIGHT, LIGHT, DT } from './tuning.js';
import { LAST_WAVE } from './night.js';

const BEST_KEY = 'last-light-best', DAWNS_KEY = 'last-light-dawns';
const DEAD_DELAY = 1.5; // seconds between dying and the death screen
const DAWN_DELAY = LIGHT.dawnTime + 2;
const CLICK_GUARD = 2.5; // seconds the death or dawn screen is up before a click starts the next night
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
    endT: 0, // seconds of the night since you died or the sun came up: its screen follows after a delay
    shownT: 0, // seconds the death or dawn screen has been up
    saved: false,

    newNight() {
      game.state = createState({ seed: nextSeed++, wave: debug.wave ?? 0, god: !!debug.god, map });
      game.screen = 'playing';
      game.endT = 0;
      game.shownT = 0;
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
    // True once the death or dawn screen has been up long enough that a click starts the next night,
    // so a panicked click doesn't skip it.
    get canContinue() {
      return (game.screen === 'dead' || game.screen === 'dawn') && game.shownT >= CLICK_GUARD;
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
        if (phase === 'dead' && game.endT >= DEAD_DELAY) endScreen('dead');
        if (phase === 'dawn' && game.endT >= DAWN_DELAY) endScreen('dawn');
      }
    },
    // Once a frame: timers for the banner, the hit tick and the end screens.
    frame(dt) {
      if (game.banner.t > 0) game.banner.t -= dt;
      game.hitT += dt;
      if ((game.screen === 'dead' || game.screen === 'dawn') && game.state) game.shownT += dt;
    },
  };

  function endScreen(screen) {
    if (game.screen === screen) return;
    game.screen = screen;
    game.shownT = 0;
  }

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
