// Where each island sits on a stage, and the checks that keep site/games.json honest.
import { STAGES } from './layout.js';
import { BOB_AMP, LIFT } from './motion.js';

const WIDTHS = { game: [96, 140], unfinished: [48, 80] };

// The islands in drawing order: the unfinished island first (it sits furthest back), then the games
// in the file's order. x, y: the frame's top-left in stage pixels. hit: the island's opaque box in
// stage pixels, where its link goes. metas maps an island's art name to its JSON.
export function placeIslands(data, metas, layout) {
  const place = (entry, id, game) => {
    const meta = metas[entry.island];
    const [x, y] = entry.at[layout];
    const [hx, hy, hw, hh] = meta.hit;
    return { id, game, island: entry.island, x, y, meta, bob: entry.bob, hit: [x + hx, y + hy, hw, hh] };
  };
  return [place(data.unfinished, 'unfinished', false), ...data.games.map((g) => place(g, g.id, true))];
}

export function overlaps([ax, ay, aw, ah], [bx, by, bw, bh]) {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

// Every problem with games.json, given the island art's JSON, as sentences; empty means it's fine.
export function checkGames(data, metas) {
  if (!Array.isArray(data?.games) || data.games.length === 0) return ['games.json needs a non-empty "games" list'];
  if (!data.unfinished) return ['games.json needs an "unfinished" island'];
  const problems = [];
  const seen = new Set();
  for (const g of data.games) {
    if (g.id === 'unfinished') problems.push('game id "unfinished" is kept for the unfinished island');
    else if (!/^[a-z0-9-]+$/.test(g.id ?? '')) problems.push(`game id "${g.id}" must be lowercase letters, digits and dashes`);
    else if (seen.has(g.id)) problems.push(`game id "${g.id}" is listed twice`);
    seen.add(g.id);
  }
  const entries = [['unfinished', data.unfinished, false], ...data.games.map((g) => [g.id, g, true])];
  for (const [id, e, game] of entries) {
    const meta = metas[e.island];
    if (!meta) {
      problems.push(`${id}: no island art named "${e.island}"`);
      continue;
    }
    const [lo, hi] = WIDTHS[game ? 'game' : 'unfinished'];
    if (meta.hit[2] < lo || meta.hit[2] > hi) problems.push(`${id}: island is ${meta.hit[2]} px wide; it should be ${lo}–${hi}`);
    for (const layout of Object.keys(STAGES)) {
      const at = e.at?.[layout];
      if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isInteger)) {
        problems.push(`${id}: needs a whole-pixel [x, y] position for the ${layout} layout`);
      }
    }
    const { period, phase } = e.bob ?? {};
    if (!Number.isInteger(period) || period < 2000 || period > 8000 || typeof phase !== 'number' || phase < 0 || phase >= 1) {
      problems.push(`${id}: bob needs a whole-ms period of 2000–8000 and a phase in [0, 1)`);
    }
  }
  if (problems.length) return problems;
  // Every entry is well formed, so check each layout's arrangement. Each island's box includes the room
  // it needs to bob and lift, and must stay on the stage, clear of the title and of the other islands.
  for (const [layout, stage] of Object.entries(STAGES)) {
    const boxes = placeIslands(data, metas, layout).map(({ id, hit: [x, y, w, h] }) => ({
      id, box: [x, y - BOB_AMP - LIFT, w, h + 2 * BOB_AMP + LIFT],
    }));
    for (const { id, box: [x, y, w, h] } of boxes) {
      if (x < 0 || y < 0 || x + w > stage.w || y + h > stage.h) problems.push(`${id}: runs off the ${layout} stage`);
      if (overlaps([x, y, w, h], stage.title)) problems.push(`${id}: covers the title in the ${layout} layout`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (overlaps(boxes[i].box, boxes[j].box)) problems.push(`${boxes[i].id} and ${boxes[j].id} overlap in the ${layout} layout`);
      }
    }
  }
  return problems;
}
