// The clearing, as a text grid: one character per cell, rows top (north) to bottom (south). x runs
// east along a row and y south down the rows, so a facing angle of 0 looks east and PI / 2 looks south.
// Positions are in cells: the centre of cell (3, 4) is (3.5, 4.5).
//
//   #  pines (the forest wall)       .  snow
//   L  cabin logs                    ,  cabin floor (under the roof)
//   W  cabin window (lets light out) D  doorway (open, under the roof)
//   P  woodpile                      G  wagon (its sides face north and south)
//   S  stove (a prop, in the cabin)  O  well (a prop)       T  lone pine (a prop)
//   1-6  where each trail's creatures come out
//   @  where you start, facing south
//   f  where flares turn up          s  where shells turn up     g  where the shotgun turns up
export const MAP_ROWS = [
  '########################################',
  '########################################',
  '########################################',
  '###############..#######################',
  '###############5.#######################',
  '###############..#######################',
  '###############...######################',
  '################......#########.########',
  '################........######.6.#######',
  '##############............###...########',
  '############...............#...#########',
  '###########...................##########',
  '##########...................###########',
  '##########.....LLLLLLLLL.....###########',
  '#########..T...L,,,S,,,L......##########',
  '###.4..##......L,,,,,,,L.......#########',
  '###............L,,,,,,,L..PP....########',
  '######.........L,,,,,,,L.........#######',
  '########.......LLWLDLWLL.........#######',
  '########....................T....#######',
  '########.........f.@.s...........#######',
  '########.........................#######',
  '#########.........................######',
  '#########.g..........................###',
  '#########GGG....................#..1.###',
  '#########.................O....#########',
  '#########......................#########',
  '#########....T................##########',
  '##########..............T...############',
  '#########...................############',
  '########...##..............#############',
  '#######.3.######....##...###############',
  '########.#############..################',
  '######################...###############',
  '#######################..###############',
  '#######################.2###############',
  '#######################..###############',
  '########################################',
  '########################################',
  '########################################',
];

// What each wall character is drawn with. The wagon shows its side on north and south faces, its end
// on east and west faces.
export const WALLS = {
  '#': { ns: 'trunks', ew: 'trunks' },
  L: { ns: 'logs', ew: 'logs' },
  W: { ns: 'window', ew: 'window' },
  P: { ns: 'woodpile', ew: 'woodpile' },
  G: { ns: 'wagonSide', ew: 'wagonEnd' },
};
const ROOFED = new Set([',', 'D', 'S']);
const PROPS = { S: { kind: 'stove', radius: 0.35 }, O: { kind: 'well', radius: 0.45 }, T: { kind: 'pine', radius: 0.3 } };

// Parses rows into the map the game uses:
//   w, h            size in cells
//   solid           Uint8Array, 1 where a cell is a wall (movement, shots and sight stop there)
//   wall            Uint8Array, the index into `wallKinds` of each wall cell (0 for open cells)
//   wallKinds       [{ ns, ew }] texture names, in first-seen order, from index 1
//   roofed          Uint8Array, 1 under the cabin roof (planks below, rafters above)
//   blocked         Uint8Array, 1 where creatures may not path: walls and prop cells
//   passLight       Uint8Array, 1 for window cells (static light shines through them)
//   props           [{ kind, x, y, radius }] at cell centres
//   spawns          [{ x, y }] trail ends in order 1-6
//   start           { x, y, facing }
//   spots           { flare, shells, shotgun } as { x, y }
export function parseMap(rows = MAP_ROWS) {
  const h = rows.length, w = rows[0].length;
  const size = w * h;
  const map = {
    w, h,
    solid: new Uint8Array(size), wall: new Uint8Array(size), wallKinds: [null],
    roofed: new Uint8Array(size), blocked: new Uint8Array(size), passLight: new Uint8Array(size),
    props: [], spawns: [], start: null, spots: {},
  };
  const kindIndex = new Map();
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`map row ${y} is ${rows[y].length} wide, not ${w}`);
    for (let x = 0; x < w; x++) {
      const c = rows[y][x], i = y * w + x;
      if (WALLS[c]) {
        if (!kindIndex.has(c)) {
          kindIndex.set(c, map.wallKinds.length);
          map.wallKinds.push(WALLS[c]);
        }
        map.solid[i] = 1;
        map.blocked[i] = 1;
        map.wall[i] = kindIndex.get(c);
        if (c === 'W') map.passLight[i] = 1;
        continue;
      }
      if (ROOFED.has(c)) map.roofed[i] = 1;
      if (PROPS[c]) {
        map.props.push({ kind: PROPS[c].kind, x: x + 0.5, y: y + 0.5, radius: PROPS[c].radius });
        map.blocked[i] = 1;
      } else if (c >= '1' && c <= '6') map.spawns[c - 1] = { x: x + 0.5, y: y + 0.5 };
      else if (c === '@') map.start = { x: x + 0.5, y: y + 0.5, facing: Math.PI / 2 };
      else if (c === 'f') map.spots.flare = { x: x + 0.5, y: y + 0.5 };
      else if (c === 's') map.spots.shells = { x: x + 0.5, y: y + 0.5 };
      else if (c === 'g') map.spots.shotgun = { x: x + 0.5, y: y + 0.5 };
      else if (c !== '.' && c !== ',' && c !== 'D') throw new Error(`map cell ${x},${y} has an unknown character "${c}"`);
    }
  }
  return map;
}

// Outside the map counts as solid, so nothing ever walks or sees off the edge.
export function isSolid(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return true;
  return map.solid[cy * map.w + cx] === 1;
}

export function isRoofed(map, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) return false;
  return map.roofed[cy * map.w + cx] === 1;
}
