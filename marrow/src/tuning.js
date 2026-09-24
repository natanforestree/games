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
  WALL_LETGO_PUSH: 0.5, // Down off a wall cling nudges away from it
  LEDGE_GRAB_RANGE: 6,
  LEDGE_REGRAB_TICKS: 12,
  LEDGE_CLIMB_HOLD_TICKS: 6, // holding Up this long on a ledge climbs, even without a fresh press
  LEDGE_RELEASE_FALL: 0.5, // starting fall speed when Down lets go of a ledge
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
  BLADE_LEVEL_TOLERANCE: 2, // blades within this many px of each other's height count as level
  CLASH_PUSHBACK: 6,
  CLASH_STUN_TICKS: 8,
  THROWN_SWORD_SPEED: 5,
  THROWN_SWORD_HALF_W: 4, // half-width of a thrown sword's hit segment
  SWORD_WALL_BOUNCE_VX: 0.5, // sideways speed a thrown sword bounces back at off a wall
  THROW_HEADROOM: 36, // room needed above the feet to throw or raise the throw pose
  DISARM_POP_SPEED: 3,
  DISARM_POP_VX: 0.8, // sideways speed a disarmed sword pops away at
  DISARM_OVERLAP_SLACK: 0.5, // deliberate slack in the stance-disarm overlap check, for fractional positions
  DISARM_FALLBACK_HEIGHT: 12, // spawn height above the feet for a disarm with no blade geometry to place it from
  DEFLECT_VX: 1, // horizontal speed of a deflected sword
  DEFLECT_POP_SPEED: 1.5, // upward pop of a deflected sword
  SWORD_EDGE_MARGIN: 2, // how close a falling sword may get to the screen's left/right edge
  PICKUP_RANGE: 6,

  // Knockdowns, punches and respawns
  KNOCKDOWN_TICKS: 30,
  KNOCKDOWN_VX: 1.5, // sideways speed a kick or punch knockdown sends its victim skidding at
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
  LEDGE_KICK_VX: 0.5, // horizontal speed a sweep knocks a ledge-hanger off the ledge at
  LEDGE_KICK_HIT_Y: 20, // height above the victim's feet where a ledge sweep's impact effect appears
  DIVEKICK_BOUNCE_VX: 1.2, // horizontal speed a landed dive kick bounces its attacker back at
  DIVEKICK_BOUNCE_VY: 2.5, // upward speed a landed dive kick bounces its attacker at
  NECKSNAP_TICKS: 20,
  NECKSNAP_RANGE: 12,
  NECKSNAP_Y_TOLERANCE: 4, // vertical distance allowed between attacker and a downed opponent to start a neck snap
  RESPAWN_TICKS: 300,
  OFFSCREEN_RESPAWN_TICKS: 90,
  RESPAWN_AHEAD: 80,
  RESPAWN_MIN_GAP: 40, // a fresh respawn must be at least this far in front of the arrow holder, beyond blade reach plus a lunge
  SCREEN_SLIDE_TICKS: 18,
  SLIDE_ENTRY_X: 6, // how far inside the edge the arrow holder appears after a screen slide
  START_X: [100, 220], // where each side starts, and respawns after a double kill
  START_Y: 150, // the y findSpawn prefers when there's no better hint: match start, and a respawn with no arrow holder to spawn in front of
  SPAWN_MARGIN: 16,
  PIT_DEATH_Y: 210,

  // The Maw, on a victory screen
  MAW_DELAY_TICKS: 45,
  MAW_SWALLOW_TICKS: 40,
  MAW_TICKS: 150,

  // Ichor (effects.js): a kill bursts into the victim's own glow ramp, from palette.json.
  ICHOR_DROPS_PER_KILL: 46,
  ICHOR_DROP_SPEED_MIN: 0.8,
  ICHOR_DROP_SPEED_RANGE: 3.2,
  ICHOR_DROP_SPREAD_X: 6, // horizontal jitter around the kill point
  ICHOR_DROP_RISE_MIN: 6, // upward jitter above the kill point
  ICHOR_DROP_RISE_RANGE: 14,
  ICHOR_DROP_LIFE_TICKS: 90,
  ICHOR_DROP_GRAVITY: 0.2,
  ICHOR_DROP_BIG_CHANCE: 0.25, // chance a drop is the larger of its two sizes
  ICHOR_SPLASH_STAMPS: 12, // floor stains stamped at the moment of the kill
  ICHOR_SPLASH_SPREAD_X: 22,
  ICHOR_SPLASH_SPREAD_Y: 2,
  ICHOR_OFFSCREEN_MARGIN: 10, // below VIEW_H before a falling drop is dropped, landed or not
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
