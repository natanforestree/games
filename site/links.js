// The real links over the islands. They're the ordinary <a> elements of index.html's list, so keyboard
// focus, screen readers, hover, middle-click and "open in new tab" all just work. This lays each one
// invisibly over its island, reads the words for its sign, and keeps track of which island is hovered,
// focused from the keyboard, or (on a touch screen) tapped once.
import { toCss } from './layout.js';

// On a touch screen the first tap on an island shows its sign and a second tap on the same island plays
// it. 'arm' means show the sign and don't follow the link yet.
export function tapDecision(armed, tapped) {
  return armed === tapped ? 'go' : 'arm';
}

// The island whose sign shows: the one under the mouse, else the one tapped, else the one focused.
export function activeIsland({ hovered, armed, focused }) {
  return hovered ?? armed ?? focused ?? null;
}

export function createLinks(doc, win) {
  const byId = new Map([...doc.querySelectorAll('.games a[data-game]')].map((a) => [a.dataset.game, a]));
  let hovered = null, armed = null, lastPointer = null;
  for (const [id, a] of byId) {
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') hovered = id;
    });
    a.addEventListener('pointerleave', () => {
      if (hovered === id) hovered = null;
    });
    a.addEventListener('click', (e) => {
      // A click from the keyboard (detail 0) or from a mouse always plays.
      if (e.detail === 0 || lastPointer !== 'touch') return;
      if (tapDecision(armed, id) === 'arm') {
        e.preventDefault();
        armed = id;
      }
    });
  }
  // Every press notes what made it; a press anywhere but on a link puts an armed sign away.
  doc.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (!(e.target instanceof Element && e.target.closest('.games a'))) armed = null;
  }, true);
  doc.addEventListener('keydown', () => (lastPointer = null), true);
  // Coming back with the Back button can restore the page as it was left: start it fresh.
  win.addEventListener('pageshow', () => {
    hovered = null;
    armed = null;
  });
  return {
    info(id) {
      const a = byId.get(id);
      const text = (selector) => a?.querySelector(selector)?.textContent.trim() ?? '';
      return { name: text('strong'), blurb: text('.blurb'), controls: text('.controls') };
    },
    active() {
      const f = doc.activeElement;
      const id = f?.dataset?.game;
      const focused = id && byId.get(id) === f && f.matches(':focus-visible') ? id : null;
      return activeIsland({ hovered, armed, focused });
    },
    // Lays each game's link over its island's hit box.
    place(islands, view) {
      for (const island of islands) {
        const a = byId.get(island.id);
        if (!a) continue;
        const r = toCss(island.hit, view);
        Object.assign(a.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      }
    },
    // Clears what place() set, so the plain list isn't left with island-sized gaps if the scene fails
    // after already laying the links out (main.js's fail() calls this).
    reset() {
      for (const a of byId.values()) Object.assign(a.style, { left: '', top: '', width: '', height: '' });
    },
  };
}
