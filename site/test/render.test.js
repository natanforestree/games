import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, TITLE, SUBTITLE } from '../render.js';
import { chooseView } from '../layout.js';
import { placeIslands } from '../islands.js';
import { LIFT, LIFT_STEP_MS } from '../motion.js';

const PHASES = ['dawn', 'day', 'dusk', 'night'];
const img = (name, width, height) => ({ name, width, height });
const META = {
  'island-snake': { w: 120, h: 100, frames: 8, ms: 150, hit: [8, 6, 104, 88] },
  'island-marrow': { w: 120, h: 120, frames: 8, ms: 150, hit: [8, 6, 104, 108] },
  'island-unfinished': { w: 70, h: 70, frames: 4, ms: 200, hit: [5, 5, 60, 60] },
};
const GAMES = {
  games: [
    { id: 'snake', island: 'island-snake', at: { landscape: [20, 70], portrait: [4, 50] }, bob: { period: 4000, phase: 0 } },
    { id: 'marrow', island: 'island-marrow', at: { landscape: [180, 30], portrait: [90, 170] }, bob: { period: 5000, phase: 0.5 } },
  ],
  unfinished: { island: 'island-unfinished', at: { landscape: [310, 130], portrait: [20, 300] }, bob: { period: 3000, phase: 0.2 } },
};
const INFO = {
  snake: { name: 'Snake', blurb: "Eat, grow, don't bite yourself.", controls: 'Arrow keys, WASD, or swipe.' },
  marrow: { name: 'Marrow', blurb: 'A duel.', controls: 'Keyboard.' },
};
const ART = {
  games: GAMES,
  sky: {
    order: PHASES,
    phases: Object.fromEntries(PHASES.map((p) => [p, { top: '#000001', bottom: '#000002', title: '#ffffff', shadow: '#000000', subtitle: '#eeeeee' }])),
    clouds: { w: 384, h: 48, layers: 3 },
    sprites: { moon: [0, 0, 14, 14], sun: [16, 0, 20, 20], bird: [[38, 0, 7, 4], [46, 0, 7, 4]], twinkle: [[38, 6, 5, 5], [44, 6, 5, 5], [50, 6, 5, 5]] },
    shooting: '#fff6dc',
  },
  skies: {
    landscape: Object.fromEntries(PHASES.map((p) => [p, img(`sky-${p}-landscape`, 384, 216)])),
    portrait: Object.fromEntries(PHASES.map((p) => [p, img(`sky-${p}-portrait`, 216, 384)])),
  },
  clouds: img('clouds', 384, 576),
  atlas: img('atlas', 56, 20),
  metas: META,
  images: Object.fromEntries(Object.entries(META).map(([k, m]) => [k, img(k, m.w * m.frames, m.h * 2)])),
  sign: {
    meta: { size: [16, 16], slice: 5, rope: [16, 0, 1, 4], fill: '#f3e6c4', text: { name: '#111111', blurb: '#222222', controls: '#333333' } },
    image: img('sign', 17, 16),
  },
};

// A 2D context that records what's drawn, with the alpha and font in force at the time.
function fakeContext() {
  const calls = [];
  return {
    calls, globalAlpha: 1, fillStyle: '', font: '', textBaseline: '', imageSmoothingEnabled: true,
    setTransform() {},
    fillRect(...args) { calls.push({ op: 'fillRect', args, alpha: this.globalAlpha, style: this.fillStyle }); },
    drawImage(image, ...args) { calls.push({ op: 'drawImage', img: image.name, args, alpha: this.globalAlpha }); },
    fillText(text, x, y) { calls.push({ op: 'fillText', text, args: [x, y], alpha: this.globalAlpha, style: this.fillStyle, font: this.font }); },
    measureText(text) { return { width: text.length * 6 }; },
  };
}

function setup(size = [1920, 1080, 1]) {
  const ctx = fakeContext();
  const renderer = createRenderer(ctx, ART, (id) => INFO[id]);
  const view = chooseView(...size);
  const islands = placeIslands(GAMES, META, view.layout);
  const draw = (frame = {}) => {
    ctx.calls.length = 0;
    renderer.draw({ view, islands, sky: { from: 'day', to: 'day', t: 0 }, now: 1000, anim: 1234, reduced: false, active: null, ...frame });
    return [...ctx.calls];
  };
  return { draw, view };
}

// Where each call puts pixels on the canvas.
function destination(c) {
  if (c.op === 'drawImage') return c.args.length === 8 ? c.args.slice(4, 6) : c.args.slice(0, 2);
  return c.args.slice(0, 2);
}

test('everything is drawn at whole scene pixels', () => {
  const cases = [
    [[1920, 1080, 1], { active: 'snake', sky: { from: 'night', to: 'dawn', t: 0.4 }, anim: 45123 }],
    [[390, 844, 3], { active: 'marrow', sky: { from: 'dusk', to: 'night', t: 0.5 }, anim: 1 }],
    [[1366, 768, 1.25], { active: 'snake', anim: 99999 }],
  ];
  for (const [size, frame] of cases) {
    for (const c of setup(size).draw(frame)) {
      assert.ok(destination(c).every(Number.isInteger), `${c.op} ${c.img ?? c.text ?? ''} at ${destination(c)}`);
    }
  }
});

test('the incoming phase is drawn over the outgoing one at the crossfade opacity', () => {
  const calls = setup().draw({ sky: { from: 'night', to: 'dawn', t: 0.25 } });
  const night = calls.findIndex((c) => c.img === 'sky-night-landscape');
  const dawn = calls.findIndex((c) => c.img === 'sky-dawn-landscape');
  assert.ok(night >= 0 && dawn > night);
  assert.equal(calls[night].alpha, 1);
  assert.equal(calls[dawn].alpha, 0.25);
});

test('the moon only shows at night, the sun only at dawn', () => {
  const moon = (calls) => calls.filter((c) => c.img === 'atlas' && c.args.slice(0, 4).join() === '0,0,14,14');
  const sun = (calls) => calls.filter((c) => c.img === 'atlas' && c.args.slice(0, 4).join() === '16,0,20,20');
  const { draw } = setup();
  assert.equal(moon(draw({ sky: { from: 'day', to: 'day', t: 0 } })).length, 0);
  assert.equal(moon(draw({ sky: { from: 'night', to: 'night', t: 0 } })).length, 1);
  assert.equal(sun(draw({ sky: { from: 'dawn', to: 'dawn', t: 0 } })).length, 1);
  assert.equal(sun(draw({ sky: { from: 'dusk', to: 'dusk', t: 0 } })).length, 0);
});

test('the active island glows behind itself, and its sign is drawn over everything', () => {
  const calls = setup().draw({ active: 'snake' });
  const snake = calls.filter((c) => c.img === 'island-snake');
  assert.deepEqual(snake.map((c) => c.args[1]), [META['island-snake'].h, 0], 'the glow row, then the island');
  const lastIsland = calls.findLastIndex((c) => c.img?.startsWith('island-'));
  const name = calls.findIndex((c) => c.op === 'fillText' && c.text === 'Snake');
  assert.ok(name > lastIsland, 'the sign comes after the islands');
  assert.equal(calls[name].font, '700 8px Silkscreen, monospace');
  assert.equal(calls.filter((c) => c.img === 'island-marrow').length, 1, 'other islands have no glow');
});

test('with nothing active there is no sign: only the title is lettered', () => {
  const texts = new Set(setup().draw().filter((c) => c.op === 'fillText').map((c) => c.text));
  assert.deepEqual(texts, new Set([TITLE, SUBTITLE]));
});

test('with reduced motion the scene holds still', () => {
  const { draw } = setup();
  const a = JSON.stringify(draw({ reduced: true, anim: 0 }));
  const b = JSON.stringify(draw({ reduced: true, anim: 98765 }));
  assert.equal(a, b);
});

test('an active island rises LIFT pixels a step at a time, and sinks back when it stops being active', () => {
  const { draw, view } = setup();
  const snakeY = (calls) => calls.filter((c) => c.img === 'island-snake').at(-1).args[5];
  const rest = view.oy + 70; // snake's landscape y; bob(0, 4000, 0) is 0
  assert.equal(snakeY(draw({ anim: 0, now: 1000, active: 'snake' })), rest);
  assert.equal(snakeY(draw({ anim: 0, now: 1000 + LIFT_STEP_MS, active: 'snake' })), rest - 1);
  assert.equal(snakeY(draw({ anim: 0, now: 2000, active: 'snake' })), rest - LIFT);
  assert.equal(snakeY(draw({ anim: 0, now: 2040, active: null })), rest - LIFT);
  assert.equal(snakeY(draw({ anim: 0, now: 2040 + LIFT_STEP_MS, active: null })), rest - LIFT + 1);
  assert.equal(snakeY(draw({ anim: 0, now: 3000, active: null })), rest);
});

test('with reduced motion the lift is immediate', () => {
  const { draw, view } = setup();
  const snakeY = (calls) => calls.filter((c) => c.img === 'island-snake').at(-1).args[5];
  assert.equal(snakeY(draw({ reduced: true, now: 1000, active: 'snake' })), view.oy + 70 - LIFT);
});
