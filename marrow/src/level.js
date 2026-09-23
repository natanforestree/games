// The map: 7 screens built from the 4 grids in data/screens.json. Screens ending in '-' are mirror
// images of their '+' twins, so neither side has an advantage.
import data from '../data/screens.json' with { type: 'json' };

export const ORDER = data.order;
export const CENTER = ORDER.indexOf('C');
export const LAST = ORDER.length - 1;

const mirror = (rows) => rows.map((row) => [...row].reverse().join(''));

export const SCREENS = ORDER.map((name) => {
  const base = name.replace(/[+-]$/, '');
  const mirrored = name.endsWith('-');
  return { name, base, mirrored, rows: mirrored ? mirror(data.screens[base]) : data.screens[base] };
});

// True for a solid tile. Only for cells inside the grid; physics.js handles edges.
export function isSolid(screen, col, row) {
  return screen.rows[row][col] === '#';
}

// The screen a fighter heading in `dir` must reach to win: V+ for the player, V- for the CPU.
export function victoryIndex(dir) {
  return dir > 0 ? LAST : 0;
}
