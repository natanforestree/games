// Checks the committed art (last-light/assets/, written by the scripts in art/last-light/) against
// everything the code expects: every texture the map uses, every sprite and animation the scene draws,
// every frame and icon the HUD draws, and image sizes that hold them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WALLS } from '../src/map.js';
import { FLOORS } from '../src/assets.js';
import { SPRITE_ANIMS, SPRAY_Z } from '../src/scene.js';
import { KINDS } from '../src/creatures.js';
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

// Against the 1.0-unit walls (a doorway's height; a window's top sits at about 0.75): a crawler comes
// about knee-high, its back (4/5 up its frame) under the window sill; a gaunt's head (0.82 up its
// frame) stands a little above a man's, under the doorway's top; the Mother towers over the cabin.
test('creature sizes: a crawler about knee-high, a gaunt a little taller than you, the Mother towering', () => {
  const { sprites } = json('sprites.json');
  assert.ok(sprites.crawler.height <= 0.4, `crawler ${sprites.crawler.height}`);
  assert.ok(sprites.gaunt.height > 1 && sprites.gaunt.height <= 1.15, `gaunt ${sprites.gaunt.height}`);
  assert.ok(sprites.mother.height >= 2, `mother ${sprites.mother.height}`);
  const order = ['crawler', 'leaper', 'gaunt', 'mother'].map((k) => sprites[k].height);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'crawler < leaper < gaunt < mother');
});

// A hit's spray comes out of the body: above the legs, below the eyes.
test("a hit's spray comes from a creature's body, a third to three quarters of the way up it", () => {
  const { sprites } = json('sprites.json');
  KINDS.forEach((k, i) => {
    const up = SPRAY_Z[i] / sprites[k].height;
    assert.ok(up >= 0.35 && up <= 0.75, `${k}: spray at ${SPRAY_Z[i]} is ${up.toFixed(2)} of its ${sprites[k].height} height`);
  });
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
