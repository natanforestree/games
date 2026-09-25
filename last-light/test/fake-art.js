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
