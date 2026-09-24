import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeIslands, checkGames, overlaps } from '../islands.js';
import { readJson } from './helpers.js';

// Fixture art: two 100-wide game islands and a 60-wide unfinished one, their opaque boxes inset in their frames.
const META = {
  'island-a': { w: 110, h: 90, frames: 4, ms: 150, hit: [5, 4, 100, 80] },
  'island-b': { w: 110, h: 90, frames: 4, ms: 150, hit: [5, 4, 100, 80] },
  'island-u': { w: 70, h: 70, frames: 2, ms: 200, hit: [5, 5, 60, 60] },
};
const BOB = { period: 4000, phase: 0 };
const fixture = () => ({
  games: [
    { id: 'a', island: 'island-a', at: { landscape: [0, 60], portrait: [0, 50] }, bob: { ...BOB } },
    { id: 'b', island: 'island-b', at: { landscape: [130, 60], portrait: [0, 150] }, bob: { ...BOB } },
  ],
  unfinished: { island: 'island-u', at: { landscape: [260, 60], portrait: [0, 260] }, bob: { ...BOB } },
});
const metas = (changes = {}) => ({ ...META, ...changes });

test('a well-formed games.json has no problems', () => {
  assert.deepEqual(checkGames(fixture(), metas()), []);
});

test('the unfinished island is placed first, then the games, each with its hit box on the stage', () => {
  const placed = placeIslands(fixture(), metas(), 'landscape');
  assert.deepEqual(placed.map((p) => [p.id, p.game]), [['unfinished', false], ['a', true], ['b', true]]);
  assert.deepEqual(placed[1].hit, [5, 64, 100, 80]);
  assert.deepEqual([placed[1].x, placed[1].y], [0, 60]);
  assert.equal(placed[1].meta, META['island-a']);
  assert.equal(placed[1].island, 'island-a');
  assert.deepEqual(placeIslands(fixture(), metas(), 'portrait')[2].hit, [5, 154, 100, 80]);
});

test('islands that overlap (allowing for bob and lift) are reported', () => {
  const data = fixture();
  data.games[1].at.landscape = [60, 60];
  assert.deepEqual(checkGames(data, metas()), ['a and b overlap in the landscape layout']);
});

test('an island that runs off a stage, or covers the title, is reported', () => {
  const off = fixture();
  off.games[0].at.portrait = [150, 50];
  assert.deepEqual(checkGames(off, metas()), ['a: runs off the portrait stage']);
  const title = fixture();
  title.games[0].at.landscape = [0, 10];
  assert.deepEqual(checkGames(title, metas()), ['a: covers the title in the landscape layout']);
});

test('islands must be the right width', () => {
  assert.deepEqual(checkGames(fixture(), metas({ 'island-a': { ...META['island-a'], hit: [5, 4, 150, 80] } })),
    ['a: island is 150 px wide; it should be 96–140']);
  assert.deepEqual(checkGames(fixture(), metas({ 'island-u': { ...META['island-u'], hit: [5, 5, 100, 60] } })),
    ['unfinished: island is 100 px wide; it should be 48–80']);
});

test('every entry needs whole-pixel positions in both layouts, a bob, and art that exists', () => {
  const noPortrait = fixture();
  delete noPortrait.games[0].at.portrait;
  assert.deepEqual(checkGames(noPortrait, metas()), ['a: needs a whole-pixel [x, y] position for the portrait layout']);
  const fractional = fixture();
  fractional.games[0].at.landscape = [0.5, 60];
  assert.deepEqual(checkGames(fractional, metas()), ['a: needs a whole-pixel [x, y] position for the landscape layout']);
  const badBob = fixture();
  badBob.games[1].bob.period = 100;
  assert.deepEqual(checkGames(badBob, metas()), ['b: bob needs a whole-ms period of 2000–8000 and a phase in [0, 1)']);
  const noArt = fixture();
  noArt.games[0].island = 'island-z';
  assert.deepEqual(checkGames(noArt, metas()), ['a: no island art named "island-z"']);
});

test('game ids are unique, lowercase, and never "unfinished"', () => {
  const twice = fixture();
  twice.games[1].id = 'a';
  assert.deepEqual(checkGames(twice, metas()), ['game id "a" is listed twice']);
  const shouty = fixture();
  shouty.games[0].id = 'Snake!';
  assert.deepEqual(checkGames(shouty, metas()), ['game id "Snake!" must be lowercase letters, digits and dashes']);
  const reserved = fixture();
  reserved.games[0].id = 'unfinished';
  assert.deepEqual(checkGames(reserved, metas()), ['game id "unfinished" is kept for the unfinished island']);
});

test('games.json needs games and an unfinished island', () => {
  assert.deepEqual(checkGames({ games: [], unfinished: fixture().unfinished }, metas()), ['games.json needs a non-empty "games" list']);
  const noUnfinished = fixture();
  delete noUnfinished.unfinished;
  assert.deepEqual(checkGames(noUnfinished, metas()), ['games.json needs an "unfinished" island']);
});

test('overlaps: touching edges do not overlap', () => {
  assert.equal(overlaps([0, 0, 10, 10], [10, 0, 10, 10]), false);
  assert.equal(overlaps([0, 0, 10, 10], [9, 9, 10, 10]), true);
});

test('the real games.json fits its art in both layouts', () => {
  const data = readJson('games.json');
  const real = Object.fromEntries([data.unfinished, ...data.games].map((e) => [e.island, readJson(`assets/${e.island}.json`)]));
  assert.deepEqual(checkGames(data, real), []);
});
