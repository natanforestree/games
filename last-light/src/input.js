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
    if (!input.locked && action !== 'mute') return; // unlocked: the page (title, pause menu) gets its own keys
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
    input.releaseAll(); // gained or lost: nothing pressed before the change carries across it
  });
  return input;
}
