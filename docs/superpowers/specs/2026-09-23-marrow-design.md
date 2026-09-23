# Marrow — design spec

**Date:** 2026-09-23
**Status:** Approved in conversation, awaiting review of this written spec

A single-player browser fencing game for the games site (`natanforestree.github.io/games/`). It plays like **Nidhogg** (Messhof, 2014) — one-hit-kill fencing tug-of-war — and looks like **Scorn**: dark, biomechanical, surrealist. It gets an original name and original art; no assets, names or characters from either game are used.

## Goals and success criteria

- The mechanics match Nidhogg as closely as the available sources allow (see *Sources*). Rules the sources couldn't confirm are marked **(our call)**.
- You can play the whole arcade ladder (3 CPU opponents) start to finish in a desktop browser with a keyboard.
- Every combat and match rule in this spec has an automated test that passes.
- A CPU-vs-CPU debug match runs to completion in the browser with no console errors.
- The simulation holds 60 logic ticks per second, and rendering stays smooth on a typical laptop.
- The art style is signed off by Nathan at the style-test stage, before the rest of the art is made.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Players | You vs the CPU only (no local 2-player, no online play) |
| Scope | One map of 7 screens |
| Fighters | Pale, faceless biomechanical figures, each lit by a strong side color: amber (you), cyan (CPU) |
| Tech | Plain JavaScript ES modules with no build step, deployed as static files on GitHub Pages |
| Art | Pixel art drawn with Lua scripts through the Aseprite MCP, kept in `art/marrow/` |
| Name | *Marrow* (working title, easy to rename) |

## 1. Gameplay

### Controls

These are the original's keyboard defaults. All bindings live in `tuning.js` so they can be changed later.

| Action | Keys |
|---|---|
| Move left / right | A / D or ← / → |
| Stance up / down | W / S or ↑ / ↓ |
| Attack | F or X |
| Jump | G or Z |
| Pause | Esc |
| Mute | M |

The same keys do the context actions:
- **Duck:** hold Down.
- **Crawl:** move while ducked.
- **Pick up a sword:** Down while standing over it, unarmed.
- **Throw pose:** keep holding Up past high stance.
- **Instant throw:** Up + Attack pressed together.
- **Roll:** hold Down while running.
- **Cartwheel:** tap Down while running.
- **Dive kick:** Attack in the air.
- **Sweep kick:** Attack while crouched or rolling.
- **Punch:** Attack while unarmed.
- **Neck snap:** Attack while standing over a downed opponent, unarmed.
- **Get up from a knockdown:** Up to stand, Left or Right to roll up.

### Sword combat

**Basic rules**
- **Stances:** three sword heights, low, mid and high. Each has a fixed blade height and reach, and low has the longest reach.
- **One hit kills:** any contact between an armed blade and a body kills. That includes auto-stabs, where someone runs, rolls or jumps into a still blade.
- **Lunge (Attack):** a short thrust that steps the fighter forward a few pixels.
- **Block:** blade-on-blade contact at the same height blocks. Both fighters are pushed back by `CLASH_PUSHBACK`, and neither dies.

**Disarms**
- **Stance disarm:** you change stance so your blade crosses theirs, while the blades overlap horizontally by at least half of your blade's length. Their sword is knocked out of their hand: it pops up, then falls to the floor and can be picked up.
  - This works whatever they're doing: lunging, recovering or standing still.
- **Draw disarm:** you come out of a run, roll or cartwheel into a stance with your blade at the same height as theirs and overlapping it.
  - At low or high, this disarms them.
  - At mid, the normal contact rules apply instead: a block, or a kill if the blade reaches a body.

**How each tick is resolved**
1. Blade-vs-blade contact is resolved first: blocks and disarms.
2. Then blade-vs-body contact is resolved.
3. If both fighters are hit in the same tick, it's a double kill.

The low blade's longer reach means it usually connects first. That comes naturally from the geometry and needs no special-case rule.

**Throwing**
- From the throw pose, Attack throws. Up + Attack together throws instantly from any stance.
- You can't throw without enough headroom (`THROW_HEADROOM`), so low tunnels block throws.
- **Flight:** the thrown sword flies straight, with no gravity, at head/chest height.
- **What it can hit:**
  - An opponent's body kills them.
  - A **mid or high blade** deflects it, and the sword then falls to the floor **(our call)**. Deflection is decided by the defender's stance, not by exact pixel overlap.
  - A low blade doesn't block it, so a low-stance opponent is killed.
  - A ducking or crawling fighter is under its path.
  - A wall stops it, and it drops to the floor.

### Movement and unarmed combat

**Rolling and cartwheels**
- A **roll** passes under mid and high blades, but a low blade kills the roller. Rolling doesn't make you invulnerable.
- Standing up at the end of a roll resets your stance to low. A cartwheel keeps your stance.

**Kicks**
- The **dive kick** travels at 45°.
  - It knocks down and disarms whoever it hits.
  - A dive kick that meets a blade kills the kicker. High stance is the natural counter.
- The **sweep kick** knocks down and disarms a standing opponent, and knocks a ledge-hanging opponent off the ledge.

**Unarmed**
- An unarmed fighter runs faster (`RUN_SPEED_UNARMED`).
- Two punches landed within `PUNCH_COMBO_WINDOW` knock the opponent down.

**Knockdowns**
- A knockdown lasts `KNOCKDOWN_TICKS` (about 0.5 s). Then Up stands, and Left/Right rolls up.
- A roll-up passes over a sword on the floor and picks it up.
- A downed opponent is killed by an unarmed neck snap (Attack while standing over them) or by any blade contact.

**Ledges and walls**
- **Ledges:** a fighter falling past a ledge corner within `LEDGE_GRAB_RANGE` grabs it. Up or Jump climbs up, and Down lets go.
- **Walls:**
  - Jumping into a wall makes you cling to it and slide down slowly.
  - Holding toward the wall runs up it a short distance (`WALL_RUN_HEIGHT`).
  - Jump wall-jumps away from it.

### Match flow

**Start and the GO arrow**
- A match starts on the center screen with no GO arrow. You run right, and the CPU runs left.
- A kill gives the killer the **GO arrow**. Only the arrow holder can advance, by running off the screen edge in their direction. They don't need to kill again.

**When a fighter dies**
- **Respawn:** the dead fighter respawns with a sword after `RESPAWN_TICKS` (about 5 s). They appear `RESPAWN_AHEAD` px in front of the arrow holder, on the nearest safe floor (never over a pit) and inside the screen.
- **Falling into a pit** is a death, and the other fighter gets the arrow **(our call)**.
- **Double kill:** if both fighters die in the same tick, the arrow is cleared and play returns to neutral **(our call)**.

**Changing screens**
- The screen changes with a quick slide lasting `SCREEN_SLIDE_TICKS`.
- The fighter without the arrow is then placed using the respawn rule, after the shorter `OFFSCREEN_RESPAWN_TICKS`.
- A fighter without the arrow who runs off-screen on their own gets the same short respawn.

**Winning**
- The map has 7 screens: `V- B2- B1- C B1+ B2+ V+`.
  - You win by entering `V+` holding the arrow.
  - The CPU wins by entering `V-`.
  - That's three screen changes from the center.
- On a victory screen, the loser doesn't respawn. **The Maw** bursts from the floor and swallows the winner, then the result screen appears.

### Arcade ladder (single player)

This is modelled on the original's arcade mode.

**Structure**
- You face 3 CPU opponents in order, all on the same map.
- Losing a match replays that same opponent.
- One speedrun timer runs across the whole ladder, retries included. The final time is shown at the end, and the best time is saved in `localStorage` (inside `try/catch`).

**Opponents**

| # | Personality | Style | Starting reaction delay |
|---|---|---|---|
| 1 | **Rusher** | Charges in at low stance, lunges often, rarely throws | 14 ticks |
| 2 | **Waiter** | Keeps its distance, mirrors your stance to block, and hunts for stance and draw disarms | 10 ticks |
| 3 | **Shifter** | Switches tactics every few seconds; uses throws, dive kicks and sweeps | 8 ticks |

### Not in this version

- Conveyor belts, collapsing floors, tall grass, doors and water.
- Boomerang swords, no-sword and timed variants.
- Local 2-player, online play, touch controls and gamepads.
- The original's heart-rip finisher.

## 2. Look, world and sound

**Screen**
- The internal resolution is **320×180**, scaled up by the largest whole number that fits the window, with dark bars filling the rest.
- Image smoothing is off, and CSS uses `image-rendering: pixelated`.
- Collision tiles are 10×10 px, so each screen is 32×18 tiles.

**Palette**
- About 24 colors in Scorn's murk: dark umber, ochre flesh-browns, bone ivory, rust, and oily, sickly yellow-greens.
- The only saturated colors are the fighters' glow (amber `#e8a33a`, cyan `#6fd6d0`) and their ichor.
- The palette is defined once, in `art/marrow/palette.lua`.

**Fighters**
- Pale, faceless, lanky figures, about 24 px tall, with visible ribbing along the spine and blades of bone or chitin (insect shell).
- The fighter's color glows from the side it's facing.
- **Frames** are drawn by a Lua skeleton rig: each frame is a set of joint angles, which keeps the animations consistent. The fighter is drawn once in amber, and the cyan fighter is made at load time by swapping palette colors.
- **Animations:**
  - standing in each of the 3 stances
  - the throw pose
  - running
  - lunging in each stance
  - duck and crawl
  - roll and cartwheel
  - jump and fall
  - dive kick, sweep kick and punch
  - knockdown, get-up and roll-up
  - ledge hang and climb
  - wall cling and wall run
  - neck snap
  - death
- **Geometry shared by art and code:** stance heights, blade reach and body box sizes live in `games/marrow/data/body.json`. The game reads it for collisions, and the art rig reads it (Aseprite's `json` module) to draw blades in exactly the positions that collide.

**Ichor**
- A killed fighter bursts into fluid in their own color.
- The splatter is painted onto a stain layer for that screen, and it stays there for the rest of the match.

**The map's screens**

| Screen | Features |
|---|---|
| `C` | A ribbed, cathedral-like chamber built from a ribcage; open flat floor |
| `B1±` | A low fleshy tunnel with 30 px clearance: fighters can stand, but it's below `THROW_HEADROOM`, so no throwing. It opens onto a small pit. |
| `B2±` | A pit over a hazy abyss, a raised ledge, and a wall to climb |
| `V±` | A vaulted chamber where the Maw emerges |

The layouts mirror each other left and right, so neither side has an advantage.

**Backgrounds and animated detail**
- Each screen has 2–3 background layers that scroll at different speeds for depth: far tumor-like towers, spinal columns shaped like pipe organs, and fog.
- Small effects are drawn in code: pulsing vessels, drips and drifting spores.

**The Maw**
- An eyeless worm with a ring of bone teeth, about 160×120 px, in about 12 animation frames: burst out of the floor, swallow, sink back.

**Interface**
- **GO arrow:** a glowing sinew pointer in the arrow holder's color.
- **Font:** a pixel font from Google Fonts.
- **Screens:** a title screen, an intro banner for each opponent, a win/lose screen, a speedrun timer and a pause overlay.

**Card icon**
- A 48×48 `marrow/icon.png` for the games page, made from `art/marrow/icon.lua` in the same way as the Snake icon.

**Sound**
- All sound is generated live with Web Audio; there are no audio files.
- **Ambience:** a low drone that swells as the fighters get closer.
- **Effects:** wet and metallic sounds for sword clashes, stabs, disarms, throws, deaths and the Maw.
- Audio starts on the first key press (a browser rule). M toggles mute, and the choice is remembered.

**Art pipeline**
- Each asset has a script in `art/marrow/`, run through the MCP (`dofile`) or with `aseprite -b --script`.
- The scripts write the editable `.aseprite` source files to `art/marrow/`, and the PNG sprite sheets plus JSON frame data to `games/marrow/assets/`.
- **Style test first:** one fighter in all three stances, plus the `C` screen. Nathan approves it before any other art is made.

## 3. Code structure

Everything lives in `games/marrow/` (plain ES modules), with `package.json` containing only `{"type": "module"}` and a `test` script. It has no dependencies.

| File | Responsibility |
|---|---|
| `index.html` | The canvas and the module entry point; loads the pixel font |
| `src/main.js` | Loads assets, then runs a fixed-timestep loop: 60 Hz logic, rendering on `requestAnimationFrame` |
| `src/tuning.js` | All constants: speeds, frame timings, distances, delays and key bindings |
| `src/input.js` | Turns keyboard state into per-tick **intents** (held and just-pressed: left, right, up, down, attack, jump) |
| `src/fighter.js` | The fighter state machine: stand, run, lunge, crouch, crawl, roll, cartwheel, air, divekick, sweep, punch, throwpose, knocked, ledge, wallcling, necksnap, dead. Also the timing of each move. |
| `src/physics.js` | Gravity, box-vs-tile collision, ledge and wall detection, and headroom checks |
| `src/combat.js` | Each tick: blade geometry, blade-vs-blade (block, stance disarm, draw disarm), blade-vs-body, thrown swords, kicks, punches and neck snaps |
| `src/match.js` | The GO arrow, deaths, respawns, screen changes, double kills and the win condition |
| `src/level.js` | The 7 screens as 32×18 text grids, plus the legend that turns characters into tiles |
| `src/ai.js` | The CPU opponents. They perceive the game state and output the **same intents** as the keyboard, so they follow exactly the same rules as you. |
| `src/game.js` | Flow between title, opponent intro, match, result and ladder complete; the speedrun timer and best time |
| `src/render.js` | Background layers, tiles, sprites (with the cyan palette swap), the stain layer, effects and the HUD |
| `src/audio.js` | The Web Audio drone and sound effects |
| `data/body.json` | The geometry shared between the game and the art rig |

**Core contract**
- The simulation is `step(state, intents) → state`.
- It never touches the DOM, the canvas, the clock or `Math.random`. Where randomness is needed, it comes from a seeded RNG stored in the state.
- Because of that, the rules are deterministic and testable in Node, and rendering and input are thin layers around them.

**CPU-vs-CPU debug mode**
- Adding `?debug=cpu` to the URL has both fighters controlled by AI, and adds a hitbox overlay.

**Error handling**
- If the assets fail to load, the game draws a message instead of a blank canvas.
- Every `localStorage` access is wrapped in `try/catch`.
- On a touch-only device, the game shows a "keyboard needed" message.

## 4. Testing

**Rule tests**
- `node --test` runs the tests in `games/marrow/test/`. Each test builds a small state, feeds in scripted intents, and checks the outcome.
- There's at least one test for each rule:
  - same-height lunges block and push both fighters back
  - a stance change across the blade disarms
  - draw disarms work at low and high, but not at mid
  - the low blade outreaches mid and high
  - running into a still blade kills
  - a thrown sword is deflected by mid and high, kills a low-stance fighter, misses a ducking one, and is blocked by headroom in tunnels
  - a roll passes under a mid blade and dies to a low one
  - a dive kick into a blade kills the kicker; a dive kick or sweep into a body knocks down and disarms
  - two punches knock down, and a neck snap kills a downed fighter
  - a kill gives the arrow; only the arrow holder advances; a double kill clears the arrow
  - respawns avoid pits
  - entering a victory screen wins

**Browser test**
- Playwright opens `?debug=cpu` on a local server and checks that the page loads with no console errors and that a match reaches a result.

**Play-testing**
- Nathan plays for feel. Tuning changes go in `tuning.js`.

## Build order

This is the outline for the implementation plan.

1. **Art style test:** the palette, the fighter rig in 3 stances, and the `C` screen. *Nathan approves it.*
2. **Simulation core:** `tuning.js`, `body.json`, `physics.js`, a stripped-down `level.js`, and movement for `fighter.js`, with tests.
3. **Combat:** `combat.js` with all of its rules, test first.
4. **Match flow:** the arrow, respawns, screen changes and winning, with tests.
5. **Something playable:** `input.js`, `main.js`, and `render.js` using placeholder boxes.
6. **The CPU:** `ai.js`, with its three personalities and the CPU-vs-CPU debug mode.
7. **The rest of the art:** all animations, tiles, backgrounds, the Maw and the UI, wired into `render.js`.
8. **Sound:** `audio.js`.
9. **Game flow:** `game.js` with the ladder, timer, title and results.
10. **Release:** the card icon, the games-page card, README notes, then deploy and check the live site.

## Starting tuning values

These are starting points to be tuned by play. Everything is at 60 ticks/s, with distances in px.

**Movement**

| Constant | Value |
|---|---|
| `RUN_SPEED` | 1.6 |
| `RUN_SPEED_UNARMED` | 1.9 |
| `CRAWL_SPEED` | 0.6 |
| `JUMP_VELOCITY` | −4.2 |
| `GRAVITY` | 0.25 (apex ≈ 35 px) |
| `ROLL_TICKS` / `ROLL_SPEED` | 24 / 2.2 |
| `CARTWHEEL_TICKS` | 20 |
| `DIVEKICK_SPEED` | 3.5 on each axis (45°) |
| `WALL_SLIDE_SPEED` | 0.5 |
| `WALL_RUN_HEIGHT` | 16 |
| `LEDGE_GRAB_RANGE` | 6 |

**Sword combat**

| Constant | Value |
|---|---|
| `LUNGE` | 3 ticks startup, 6 active, 10 recovery; 6 px forward |
| `STANCE_CHANGE_TICKS` | 4 (the blade sweeps between heights during this time; used for disarm crossing) |
| `CLASH_PUSHBACK` | 6 |
| `THROWN_SWORD_SPEED` | 5 |
| `THROW_HEADROOM` | 36 (the room needed above the feet) |

**Knockdowns, punches and respawns**

| Constant | Value |
|---|---|
| `KNOCKDOWN_TICKS` | 30 |
| `PUNCH_COMBO_WINDOW` | 60 |
| `NECKSNAP_TICKS` | 20 |
| `RESPAWN_TICKS` | 300 |
| `OFFSCREEN_RESPAWN_TICKS` | 90 |
| `RESPAWN_AHEAD` | 80 |
| `SCREEN_SLIDE_TICKS` | 18 |

**Body geometry (in `body.json`)**

| Measurement | Value |
|---|---|
| Standing body box | 8×24 |
| Crouching box | 8×14 |
| Rolling box | 10×10 |
| Blade height above the feet (low / mid / high) | 7 / 13 / 18 |
| Blade reach from the body's front (low / mid / high) | 14 / 12 / 11 |

## Sources

No frame data for Nidhogg exists publicly, so the numbers above are our own. The rules come from:
- Finn Haverkamp's "Nidhogg Technique" guide: [GameFAQs](https://gamefaqs.gamespot.com/pc/616362-nidhogg/faqs/70364), [Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=216329928)
- [Messhof Q&A (Venus Patrol)](https://venuspatrol.com/2014/01/beast-emerges-qa-nidhogg-creator-messhof/)
- [PSNProfiles guide](https://psnprofiles.com/guide/3885-nidhogg-trophy-guide)
- [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Nidhogg)
- [Steam store page](https://store.steampowered.com/app/94400/)
- [Destructoid review](https://www.destructoid.com/reviews/review-nidhogg/)
