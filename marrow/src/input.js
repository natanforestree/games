// Keyboard input, sampled once per tick. sample() gives the six fighter buttons as held booleans (a tap
// shorter than a tick still shows up for one tick); takeUI() gives the actions pressed since the last
// call (menus, pause, mute). OS key auto-repeat is ignored, and losing focus releases every key, so
// no key ever gets stuck down.
import { KEYS } from './tuning.js';

const FIGHT = ['left', 'right', 'up', 'down', 'attack', 'jump'];

export function createInput(target = globalThis, doc = globalThis.document, bindings = KEYS) {
  const actionOf = new Map();
  for (const [action, codes] of Object.entries(bindings)) for (const code of codes) actionOf.set(code, action);
  const down = new Set(); // key codes held right now
  const tapped = new Set(); // fighter actions pressed since the last sample
  const ui = new Set(); // actions pressed since the last takeUI

  target.addEventListener('keydown', (e) => {
    const action = actionOf.get(e.code);
    if (!action) return;
    e.preventDefault();
    if (e.repeat || down.has(e.code)) return;
    down.add(e.code);
    tapped.add(action);
    ui.add(action);
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  const releaseAll = () => {
    down.clear();
    tapped.clear();
  };
  target.addEventListener('blur', releaseAll);
  doc?.addEventListener('visibilitychange', () => {
    if (doc.hidden) releaseAll();
  });

  const held = (action) => bindings[action].some((code) => down.has(code));
  return {
    sample() {
      const s = {};
      for (const a of FIGHT) s[a] = held(a) || tapped.has(a);
      tapped.clear();
      return s;
    },
    takeUI() {
      const out = new Set(ui);
      ui.clear();
      return out;
    },
  };
}
