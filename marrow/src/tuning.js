// Every gameplay constant and key binding. Units: ticks (60 per second) and pixels.
// Body geometry (boxes, stance heights, blade reach, hit boxes) is in ../data/body.json.
export const TICK_HZ = 60;
export const VIEW_W = 320;
export const VIEW_H = 180;
export const TILE = 10;
export const COLS = 32;
export const ROWS = 18;

export const T = {
  // Movement
  WALK_SPEED: 0.9,
  RUN_SPEED: 1.6,
  RUN_SPEED_UNARMED: 1.9,
  RUN_AFTER_TICKS: 18, // walking in stance this long breaks into a run (blade carried, harmless)
  CRAWL_SPEED: 0.6,
  JUMP_VELOCITY: -4.2,
  GRAVITY: 0.25, // apex about 33px
  MAX_FALL_SPEED: 6,
  AIR_ACCEL: 0.12,
  ROLL_TICKS: 24,
  ROLL_SPEED: 2.2,
  CARTWHEEL_TICKS: 20,
  CARTWHEEL_SPEED: 2.0,
  CARTWHEEL_TAP_TICKS: 6, // Down let go this soon after a roll starts turns it into a cartwheel
  DIVEKICK_SPEED: 3.5, // on each axis: 45 degrees
  DIVEKICK_LAND_TICKS: 8,
  WALL_SLIDE_SPEED: 0.5,
  WALL_RUN_HEIGHT: 16,
  WALL_RUN_SPEED: 1.6,
  WALL_JUMP_SPEED: 1.8,
  LEDGE_GRAB_RANGE: 6,
  LEDGE_REGRAB_TICKS: 12,
  CLIMB_TICKS: 14,

  // Sword combat
  LUNGE_STARTUP_TICKS: 3,
  LUNGE_ACTIVE_TICKS: 6,
  LUNGE_RECOVERY_TICKS: 10,
  LUNGE_STEP: 6,
  STANCE_CHANGE_TICKS: 4, // the blade sweeps between heights over this many ticks
  THROWPOSE_HOLD_TICKS: 10,
  THROW_CHORD_TICKS: 3, // Up pressed this recently + Attack = instant throw
  THROW_TICKS: 10,
  DRAW_WINDOW_TICKS: 6, // how long after a run/roll/cartwheel a draw disarm can happen
  CLASH_PUSHBACK: 6,
  CLASH_STUN_TICKS: 8,
  THROWN_SWORD_SPEED: 5,
  THROW_HEADROOM: 36, // room needed above the feet to throw or raise the throw pose
  DISARM_POP_SPEED: 3,
  PICKUP_RANGE: 6,

  // Knockdowns, punches and respawns
  KNOCKDOWN_TICKS: 30,
  GETUP_TICKS: 12,
  ROLLUP_TICKS: 16,
  PUNCH_TICKS: 16,
  PUNCH_ACTIVE_FROM: 4,
  PUNCH_ACTIVE_TO: 8,
  PUNCH_STUN_TICKS: 10,
  PUNCH_PUSHBACK: 3,
  PUNCH_COMBO_WINDOW: 60,
  SWEEP_TICKS: 20,
  SWEEP_ACTIVE_FROM: 4,
  SWEEP_ACTIVE_TO: 10,
  NECKSNAP_TICKS: 20,
  NECKSNAP_RANGE: 12,
  RESPAWN_TICKS: 300,
  OFFSCREEN_RESPAWN_TICKS: 90,
  RESPAWN_AHEAD: 80,
  SCREEN_SLIDE_TICKS: 18,
  START_X: [100, 220], // where each side starts, and respawns after a double kill
  SPAWN_MARGIN: 16,
  PIT_DEATH_Y: 210,

  // The Maw, on a victory screen
  MAW_DELAY_TICKS: 45,
  MAW_SWALLOW_TICKS: 40,
  MAW_TICKS: 150,
};

export const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  attack: ['KeyF', 'KeyX'],
  jump: ['KeyG', 'KeyZ'],
  pause: ['Escape'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
};
