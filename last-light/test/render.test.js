import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/render.js';
import { chooseView } from '../src/view.js';
import { parseMap } from '../src/map.js';
import { createLightmap, beginLight, addLight, lightAt } from '../src/lightmap.js';
import { BAYER } from '../src/shade.js';
import { room } from './helpers.js';
import { testArt, drawnAt, IDX } from './render-helpers.js';
import { buildMips } from '../src/assets.js';
import { VIEW } from '../src/tuning.js';

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

test('looking up lowers the horizon by tan(pitch) x focal and looking down raises it; walls stay upright', () => {
  const { art, r, frame } = setup(room());
  const { w, h, focal } = view;
  const at = (x, y) => drawnAt(art, r.buffer, w, x, y);
  const half = focal / 4.5 / 2;
  for (const pitch of [0.3, -0.3]) {
    r.draw(frame({ pitch }));
    const mid = Math.round(h / 2 + Math.tan(pitch) * focal);
    for (const x of [2, w / 2, w - 3]) assert.equal(at(x, mid), IDX.trunks, `the horizon, across the view: pitch ${pitch}, x ${x}`);
    assert.equal(at(w / 2, Math.floor(mid - half) - 2), IDX.sky);
    assert.equal(at(w / 2, Math.floor(mid - half) + 2), IDX.trunks);
    assert.equal(at(w / 2, Math.ceil(mid + half) + 2), IDX.snow);
  }
});

test('looking as far up as you can, the sky fills the top of the view, past the top of the panorama', () => {
  const { art, r, frame } = setup(room());
  r.draw(frame({ pitch: VIEW.maxPitch }));
  for (let y = 0; y < 10; y++) assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, y), IDX.sky);
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

// A 36x36 body with one eye, a single texel, as a creature's are; column-major, like sprite frames.
function oneEyed(art) {
  const f = { w: 36, h: 36, px: new Uint8Array(36 * 36) };
  for (let i = 0; i < f.px.length; i++) f.px[i] = i % 5 === 0 ? 0 : IDX.body;
  f.px[17 * 36 + 11] = IDX.eye;
  return { plain: f, mipped: { ...f, mips: buildMips(f, art.shades.emissive) } };
}
const glowPixels = (art, buf) => {
  const eye = art.shades.table[(15 << 8) | IDX.eye];
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === eye) n++;
  return n;
};

test('far off, a 1-texel eye never blinks out: drawn at 1/3 to 1/6 of its size, every distance shows it', () => {
  const { art, r, frame } = setup(room(), 0);
  const { mipped } = oneEyed(art);
  const lost = [];
  // Height 0.1 is 24 px at 1 cell: 12 px (1/3 of the frame) at 2 cells, 6 px (1/6) at 4.
  for (let d = 2; d <= 4.0001; d += 0.02) {
    r.draw(frame({ sprites: [{ x: 6.5 + d, y: 5.5, height: 0.1, frame: mipped }], spriteCount: 1 }));
    if (glowPixels(art, r.buffer) === 0) lost.push(d.toFixed(2));
  }
  assert.deepEqual(lost, [], `no eye at ${lost.length} distances`);
});

test('drawn at full size or bigger, a sprite with mips looks exactly as it does without', () => {
  const { art, r, frame } = setup(room(), 0.6);
  const { plain, mipped } = oneEyed(art);
  for (const d of [1.5, 2.5, 3.3]) { // height 0.5: 80, 48 and 36.4 px for the 36-texel frame
    r.draw(frame({ sprites: [{ x: 6.5 + d, y: 5.5, height: 0.5, frame: plain, flip: d > 2 }], spriteCount: 1 }));
    const before = Uint32Array.from(r.buffer);
    r.draw(frame({ sprites: [{ x: 6.5 + d, y: 5.5, height: 0.5, frame: mipped, flip: d > 2 }], spriteCount: 1 }));
    assert.deepEqual(r.buffer, before, `at ${d} cells`);
  }
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

// Every snow, floorboard and rafter pixel against the lightmap at the point of the ground or roof it
// shows: looking down outside and up inside with a light close by, and level with a light 10 cells
// off (where the renderer reads the light least often). Its shade is within a level of lightAt's.
test('the snow, the floorboards and the rafters are lit from the lightmap, pixel by pixel', () => {
  const map = parseMap();
  const { art, r, lm, frame } = setup(map, 0.05);
  const { w, h, focal, plane } = view;
  // Colours two surfaces can both be drawn in (black, in the dark) say nothing about the light.
  const drawnBy = new Map();
  for (const i of Object.values(IDX)) for (let l = 0; l < 16; l++) {
    const v = art.shades.table[(l << 8) | i];
    drawnBy.set(v, drawnBy.has(v) && drawnBy.get(v) !== i ? -1 : i);
  }
  for (const [x0, y0, facing, pitch, lx, ly, kinds] of [
    [19.5, 22.5, Math.PI / 2, -0.35, 20.2, 22.9, [IDX.snow]],
    [19.5, 16.5, 0, 0.35, 20.2, 16.9, [IDX.rafters, IDX.planks]],
    [19.5, 22.5, Math.PI / 2, 0, 19.9, 32.5, [IDX.snow]],
  ]) {
    beginLight(lm, 0.2); // never darker than level 3: levels 0 and 1 are the same fog for everything
    addLight(lm, lx, ly, 0.3, 2, 1); // steep: 2 shade levels a lightmap cell
    r.draw(frame({ x: x0, y: y0, facing, pitch }));
    const hz = Math.round(h / 2 + Math.tan(pitch) * focal);
    const dx = Math.cos(facing), dy = Math.sin(facing);
    let seen = 0, worst = 0, lo = 15, hi = 0;
    for (let y = 0; y < h; y++) {
      if (y === hz) continue;
      const rowDist = (0.5 * focal) / Math.abs(y + 0.5 - hz);
      for (let x = 0; x < w; x += 2) {
        const v = r.buffer[y * w + x], idx = drawnBy.get(v);
        if (!kinds.includes(idx)) continue;
        const cam = (2 * x) / w - 1 + 1 / w;
        const wx = x0 + rowDist * (dx - dy * plane * cam), wy = y0 + rowDist * (dy + dx * plane * cam);
        const want = Math.min(15, Math.floor(lightAt(lm, wx, wy) * 15 + BAYER[((y & 3) << 2) | (x & 3)]));
        let off = 16;
        for (let l = 0; l < 16; l++) if (art.shades.table[(l << 8) | idx] === v) off = Math.min(off, Math.abs(l - want));
        worst = Math.max(worst, off);
        lo = Math.min(lo, want);
        hi = Math.max(hi, want);
        seen++;
      }
    }
    assert.ok(seen > 1000, `${seen} pixels`);
    assert.ok(hi - lo >= 8, `the light should vary across the view: ${lo} to ${hi}`);
    assert.ok(worst <= 1, `a pixel ${worst} levels off (pitch ${pitch})`);
  }
});

test('inside the cabin you see rafters overhead, not sky', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI / 2 }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, 0), IDX.rafters);
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h - 1), IDX.planks);
  r.draw(frame({ x: 19.5, y: 16.5, facing: Math.PI / 2, pitch: VIEW.maxPitch }));
  assert.equal(drawnAt(art, r.buffer, view.w, view.w / 2, view.h / 2 + 5), IDX.rafters, 'looking up, the rafters come down the view');
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

test('looking up outside, snow falls from the top of the view, not from partway up the sky', () => {
  const map = parseMap();
  const { art, r, frame } = setup(map);
  const bands = [0, 0, 0]; // flakes in the top, middle and bottom thirds, over ten moments
  for (let t = 0; t < 10; t++) {
    r.draw(frame({ x: 19.5, y: 25.5, facing: Math.PI / 2, pitch: VIEW.maxPitch, snow: true, time: t }));
    for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) if (drawnAt(art, r.buffer, view.w, x, y) === IDX.flake) bands[Math.floor((3 * y) / view.h)]++;
  }
  assert.ok(bands[0] > bands[2] / 4, `top ${bands[0]}, middle ${bands[1]}, bottom ${bands[2]}`);
});
