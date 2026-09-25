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

test('the lantern: creatures read clearly within about 3 cells, are shapes out to 7, and only their eyes show past it', () => {
  const { full, dark, intensity } = LIGHT.lantern;
  const at = (d) => falloff(d, full, dark);
  assert.ok(at(3) > 0.9 && intensity * at(3) >= 0.7, 'clear at 3 cells');
  assert.ok(at(4) < 0.8 && at(5) < 0.45 && at(6) > 0.05, 'dimming to a shape from 4 to 6 cells');
  assert.equal(at(7), 0, 'dark by 7 cells');
  assert.ok(LIGHT.eyes.full >= dark, 'eyes still shine at full where the lantern ends');
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
