import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../src/sim.js';
import { SCREENS } from '../src/level.js';
import * as P from '../src/physics.js';
import { NO_INPUT } from '../src/fighter.js';
import { createAI, aiIntent } from '../src/ai.js';

// The arrow holder alone on a screen, starting at its entry edge, must reach the far edge alive.
function cross(screenIndex, id) {
  const s = createState({ screen: screenIndex });
  const me = s.fighters[id];
  const spot = P.findSpawn(SCREENS[screenIndex], me.dir > 0 ? 0 : 320, 150);
  Object.assign(me, { x: spot.x, y: spot.y, facing: me.dir });
  Object.assign(s.fighters[1 - id], { state: 'gone', respawnT: 0 });
  s.arrow = id;
  const ai = createAI(id, 'rusher', 7);
  const deaths = [];
  for (let i = 0; i < 900 && s.phase === 'play'; i++) {
    const intents = [NO_INPUT, NO_INPUT];
    intents[id] = aiIntent(ai, s);
    step(s, intents);
    deaths.push(...s.events.filter((e) => e.type === 'kill'));
  }
  return { s, me, deaths };
}

for (const index of [1, 2, 3, 4, 5]) {
  for (const id of [0, 1]) {
    test(`the CPU crosses ${SCREENS[index].name} heading ${id === 0 ? 'right' : 'left'}`, () => {
      const { s, me, deaths } = cross(index, id);
      assert.deepEqual(deaths, []);
      assert.equal(s.phase, 'slide', `stuck at x=${me.x.toFixed(1)} y=${me.y} in ${me.state}`);
    });
  }
}

test('the CPU sees its opponent `reaction` ticks late', () => {
  const s = createState();
  const ai = createAI(1, 'rusher', 1);
  for (let i = 0; i < 30; i++) {
    s.fighters[0].x = 100 + i;
    aiIntent(ai, s);
  }
  assert.equal(ai.seen[0].x, 100 + 29 - ai.p.reaction);
});
