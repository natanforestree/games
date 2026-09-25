// Every number the game plays by. Distances are in grid cells, times in seconds, angles in radians.
// Play-testing changes go here.
export const TICK_HZ = 120;
export const DT = 1 / TICK_HZ;

export const PLAYER = {
  radius: 0.25,
  walk: 3.0,
  run: 4.8,
  accelTime: 0.1, // from standing to full speed
  stopTime: 0.08, // from full speed to standing
  health: 100,
};

export const VIEW = {
  targetHeight: 270, // internal pixels; 1080p is exactly 4x
  tanHalfV: 0.5625, // fixed vertical half-angle: 90 degrees across at 16:9
  maxAspect: 21 / 9,
  bobPixels: 1.5, // head bob height at walking speed, in internal pixels at 270 tall
};

export const MOUSE = {
  sensitivity: 0.0025, // radians per count at 1x
  minScale: 0.25,
  maxScale: 4,
  // A browser glitch (Chrome's, as the pointer lock starts) is one event that jumps out of nowhere: over
  // `spike` counts, and over `jump` times the event before it plus `floor`. It's ignored. A real flick
  // ramps up through its events, so however fast it is, it's kept.
  spike: 600,
  jump: 4,
  floor: 50,
};

export const LIGHT = {
  lantern: { full: 2.5, dark: 7, intensity: 0.75 }, // clear to about 3 cells, shapes out to 7, then only eyes; 0.75 keeps the lit snow a cold night grey
  flare: { full: 1.5, dark: 4, intensity: 1.1 },
  stove: { full: 2.5, dark: 8, intensity: 1 },
  muzzle: { full: 2, dark: 6, intensity: 0.8, time: 0.05 },
  eyes: { full: 12, dark: 16 }, // glowing eyes fade out between these distances
  // The sky's light by hour index (0 = 9 PM ... 7 = 4 AM); dawn brightens to `dawn`.
  night: [0.03, 0.03, 0.035, 0.04, 0.045, 0.05, 0.06, 0.08],
  dawn: 0.85,
  dawnTime: 8, // seconds for the sun to come up
};

export const RIFLE = { damage: 10, rounds: 8, interval: 0.45, reloadPerRound: 0.4, range: 40 };
export const SHOTGUN = {
  pellets: 8,
  damage: 7,
  spread: (6 * Math.PI) / 180, // each side of the crosshair
  falloff: 4, // half damage past this distance
  interval: 0.25,
  reload: 1.2,
  shells: 2,
  foundWith: 8,
  maxSpare: 30,
  range: 20,
};
export const SWITCH_TIME = 0.25; // lowering one gun and raising the other
export const FLARE = { start: 2, max: 5, throw: 6, burn: 10, radius: 4, slow: 0.5, damage: 1.5, cooldown: 0.5 };
export const SHELL_BOX = 6;

export const CREATURES = {
  crawler: { radius: 0.22, hit: 0.3, health: 10, speed: 4.0, reach: 0.35, damage: 6, interval: 0.7, firstBite: 0.25, flinch: 0.12 },
  gaunt: { radius: 0.3, hit: 0.32, health: 45, speed: 1.6, reach: 0.9, windup: 0.45, damage: 25, interval: 1.5, flinch: 0.06 },
  leaper: {
    radius: 0.25, hit: 0.3, health: 20, speed: 3.4, reach: 0.35, damage: 8, interval: 0.8, flinch: 0.12,
    circleAt: 5, circleSpeed: 3.0, circleMin: 2, circleMax: 4, crouch: 0.5, leapSpeed: 9, leapTime: 1.0,
    pounce: 20, land: 0.6, closeLeap: 2,
    lostSight: 0.5, // seconds out of sight before a circling leaper gives up and chases again
  },
  mother: {
    radius: 0.45, hit: 0.7, health: 500, speed: 1.3, reach: 1.4, windup: 0.6, damage: 40, interval: 2, flinch: 0,
    birthEvery: 10, births: 2,
  },
  // `hit` is how wide a creature is to a shot (its sprite), `radius` how wide it is to walls and others.
  // Every radius stays under 0.5, so everything fits through the doorway and any one-cell gap.
  die: 0.6, // seconds the death animation plays
  sightRange: 10, // creatures head straight for you when they can see you this close; otherwise they path
  pushWeight: { crawler: 1, gaunt: 2.5, leaper: 1, mother: 8 },
};
export const MAX_CREATURES = 64;

export const NIGHT = {
  dusk: 6,
  lull: 20,
  spawnEvery: 0.6,
  aliveCap: (wave) => 8 + 2 * wave, // wave counts from 1
  stoveHeal: 25,
  stoveReach: 1.5,
  pickupReach: 0.6,
  spawnAway: 8, // trails closer than this to you aren't used, when others are free
  shotgunBefore: 2, // the shotgun appears in the lull before wave index 2 (11 PM)
  // One row per hour, 9 PM to 4 AM.
  waves: [
    { crawler: 6, gaunt: 0, leaper: 0, mother: 0 },
    { crawler: 10, gaunt: 1, leaper: 0, mother: 0 },
    { crawler: 12, gaunt: 2, leaper: 2, mother: 0 },
    { crawler: 14, gaunt: 3, leaper: 3, mother: 0 },
    { crawler: 16, gaunt: 4, leaper: 4, mother: 0 },
    { crawler: 20, gaunt: 5, leaper: 5, mother: 0 },
    { crawler: 24, gaunt: 6, leaper: 6, mother: 0 },
    { crawler: 10, gaunt: 2, leaper: 2, mother: 1 },
  ],
  hours: ['9 PM', '10 PM', '11 PM', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM'],
};

export const FEEL = {
  kick: { rifle: 0.035, shotgun: 0.07 }, // view kick, radians, springs back
  kickReturn: 14, // per second
  shake: { shotgun: 1.5 }, // pixels
  shakeTime: 0.12,
  hurtTime: 0.35,
  lowHealth: 30,
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  rifle: ['Digit1'],
  shotgun: ['Digit2'],
  flare: ['KeyF'],
  mute: ['KeyM'],
};
