// The sky follows the visitor's local time: four phases, with a half-hour crossfade centred on each
// boundary. Pure: the time is passed in.
export const PHASES = ['dawn', 'day', 'dusk', 'night'];
// The local hour each phase starts (the previous one ends there).
export const STARTS = { dawn: 5, day: 8, dusk: 17, night: 20 };
const FADE_HOURS = 0.5;

const wrapHours = (hours) => ((hours % 24) + 24) % 24;

export function phaseAt(hours) {
  const h = wrapHours(hours);
  if (h >= STARTS.night || h < STARTS.dawn) return 'night';
  if (h >= STARTS.dusk) return 'dusk';
  if (h >= STARTS.day) return 'day';
  return 'dawn';
}

// hours: local time in fractional hours. Returns { from, to, t }: draw `from`, then `to` over it at
// opacity t. Away from a boundary, from === to and t is 0.
export function skyAt(hours) {
  const h = wrapHours(hours);
  for (let i = 0; i < PHASES.length; i++) {
    const to = PHASES[i];
    const start = STARTS[to] - FADE_HOURS / 2;
    if (h >= start && h < start + FADE_HOURS) {
      return { from: PHASES[(i + PHASES.length - 1) % PHASES.length], to, t: (h - start) / FADE_HOURS };
    }
  }
  const phase = phaseAt(h);
  return { from: phase, to: phase, t: 0 };
}

// The sky for a page: `?time=dawn|day|dusk|night` in `search` pins one phase (anything else is
// ignored); otherwise it follows `date`'s local time.
export function skyFor(search, date) {
  const pinned = new URLSearchParams(search).get('time');
  if (PHASES.includes(pinned)) return { from: pinned, to: pinned, t: 0 };
  return skyAt(date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600);
}

// How much of each phase is showing; they sum to 1.
export function weights({ from, to, t }) {
  const w = Object.fromEntries(PHASES.map((p) => [p, 0]));
  w[from] += 1 - t;
  w[to] += t;
  return w;
}

// The phase that shows more, for things that don't crossfade (the title's colours).
export function dominant({ from, to, t }) {
  return t < 0.5 ? from : to;
}
