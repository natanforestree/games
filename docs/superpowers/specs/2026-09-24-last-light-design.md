# Last Light: design spec

**Date:** 2026-09-24
**Status:** Approved in conversation (2026-09-24), awaiting Nathan's review of this written spec

A first-person wave-survival shooter for the games site (`natanforestree.github.io/games/`). You hold a cabin in a snowy clearing through one winter night, from dusk to dawn, against pale hungry things that come out of the trees. It's pixel art, drawn by a Wolfenstein-style raycaster, and it has to feel **super smooth**: that's Nathan's first requirement, and it shapes the engine.

The mood takes after horror Nathan loves (a patient, hungry thing in a frontier winter; the hunter becoming the hunted), but the creatures, place and story are our own. Nothing is taken from any book, and no real culture's beliefs or history are used.

## Goals and success criteria

- You can play a whole night, from dusk to dawn, in current desktop Chrome, Firefox and Safari with a keyboard and mouse.
- **Smoothness:**
  - The game draws at the display's full refresh rate (60, 120 or 144 Hz) on a typical laptop.
  - Turning the mouse moves the view on the next frame drawn.
  - Nothing is allocated in the game loop, so there are no garbage-collection stutters.
  - The renderer benchmark draws a busy frame at 480×270 in under 4 ms.
- Every rule in this spec (movement, collision, weapons, creatures, waves) has an automated test that passes.
- `?debug=bot` plays a whole night by itself, to dawn, with no console errors.
- All art is made by Lua scripts run through Aseprite, and rebuilds byte for byte. There's no build step and no dependencies, like the rest of the site.
- Last Light has its own island on the front page.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Genre | First-person wave survival, "tense action": Doom-like pace, kept creepy by darkness, fog and sound. Ammo is rarely a worry. |
| A run | One night: 8 waves, one per hour, 9 PM to 4 AM. Clearing the last wave brings dawn, and you've won. |
| Enemies | Original pale, hungry, light-hating creatures ("the Hungry"): crawlers, gaunts, leapers, and something huge in the last wave |
| Engine | A raycaster in plain JavaScript: walls on a grid, flat ground, sprites that face you. No WebGL, no libraries. |
| Smoothness | A top requirement: display-rate frames, raw 1:1 mouse, snappy movement, instant shots with strong feedback |
| Platform | Desktop, keyboard and mouse only. Phones get a message. |
| Tech | Plain ES modules, no build step, static files on GitHub Pages, like Snake and Marrow |
| Art | Pixel art from Lua scripts through Aseprite, in `art/last-light/` |
| Sound | Generated live with Web Audio (no audio files), positional, with a score that grows through the night |
| Name | *Last Light*, in `last-light/`, id `last-light` |

## 1. Gameplay

### The place

- A cabin in a snowy clearing, ringed by black pines, with snow falling all night. Past the trees there's only darkness.
- **The cabin** has one room, an open doorway and two windows. A stove glows inside, and its light spills out of the windows.
- **Outside:**
  - a wagon, a woodpile and a well, which are cover and landmarks;
  - a few lone pines inside the clearing;
  - six trails leading off into the trees. The creatures come out of the trails.
- The map is a grid of about 40×40 cells, with a clearing about 26 cells across. It's written as a text grid in `src/map.js`. Walls are grid cells, with a texture per kind: logs, pine trunks, woodpile, and a wagon with a side and an end. The well and the lone pines are sprites with round collision.

### The night

- **Dusk.** The night starts at 8 PM with a few seconds of quiet, then the first wave arrives at 9 PM.
- **Waves.** Each hour is a wave. It ends when all its creatures are dead.
- **The lull.** Then the clock moves to the next hour, and you get a lull of about 20 seconds:
  - standing by the stove heals you;
  - a flare appears at a fixed spot, and so does a box of shells once you have the shotgun;
  - the score thins out and the wind picks up.
- **The shotgun.** It appears on the wagon in the lull before the 11 PM wave.
- **Dawn.** The 4 AM wave brings the Mother. Once she and the rest of the wave are dead, the sky lightens, the sun comes up, and you've won.
- **Death.** If your health reaches 0, the screen reads "You didn't see the dawn", with the hour you reached. One key starts a new night.
- **Your best night is remembered:** the latest hour you reached, and how many dawns you've seen.

### You

- **The lantern.** You carry it in your left hand, and it lights a circle around you. Beyond that you see shapes, then only eyes.
- **Health.** You have 100 health. It only comes back at the stove, and only during a lull.
- **Movement.** You can walk and run. There's no jumping and no looking up or down.
- **Aiming.** Aiming is left and right only, as in Doom. A shot hits whatever is under the crosshair's column.

### Weapons

- **Lever-action rifle.**
  - Accurate. Holds 8 rounds, with unlimited spare ammo.
  - Reloads one round at a time. Firing interrupts a reload.
- **Double-barrel shotgun.**
  - Fires 8 pellets in a spread. Brutal up close, weaker at range.
  - Holds 2 shells, and shells are limited: you pick them up.
- **Flares.**
  - Thrown with F or right-click. A flare lands a few cells ahead, or at the first wall.
  - It burns for about 10 seconds, lighting a patch of snow.
  - Creatures inside its light move at half speed and take 1.5× damage.
  - You can carry up to 5.

### The Hungry

All of them come out of the trails and follow you around the cabin and props instead of getting stuck. They push each other apart, so a pack never overlaps into one sprite. Each one flinches when it's hit.

- **Crawlers.** Low and fast, in packs. They die to one rifle shot. You can only outrun them when you're running.
- **Gaunts.** Tall and slow, and they take about 5 rifle shots. Their swipe is telegraphed by a wind-up, and it hits hard.
- **Leapers.** They arrive from 11 PM. A leaper comes close, circles at the edge of your light, then crouches with a shriek and leaps in a straight line. You can shoot one mid-leap, or sidestep it.
- **The Mother (working name).** Huge and slow. She comes in the 4 AM wave, soaks up a lot of damage, slams hard with a long wind-up, and gives birth to crawlers every few seconds.

### Controls

| Action | Keys |
|---|---|
| Move | WASD |
| Aim | Mouse (pointer lock) |
| Shoot | Left click |
| Throw a flare | F or right click |
| Reload | R |
| Switch weapons | 1 / 2, or the mouse wheel |
| Run | Shift (held) |
| Pause | Esc (releasing the mouse pauses) |
| Mute | M |

- **Starting.** Click the title screen to start. The same click locks the mouse and starts the sound.
- **The pause menu** has a mouse sensitivity slider, volume, mute, and a way back to the title. Sensitivity and volume are remembered.
- **Phones.** On a touch-only device (no fine pointer), the page shows "Last Light needs a keyboard and mouse."

## 2. Feel and engine

### Smoothness

- **Fixed-step world, display-rate frames.**
  - The world updates at a fixed **120 Hz**.
  - Frames are drawn on `requestAnimationFrame`, at whatever rate the screen runs. Each frame blends positions between the last two updates.
  - A long gap (a hidden tab, or the machine sleeping) never turns into a burst of catch-up updates.
- **Turning never waits.**
  - Mouse movement changes your facing the moment the event arrives. The next frame draws with that facing, and the next update uses it.
  - Pointer lock asks for raw input (`unadjustedMovement`) and falls back to normal pointer lock where it isn't supported.
  - The canvas asks for a low-latency context where supported.
- **Movement.**
  - You reach full speed in about 0.1 s and stop just as quickly.
  - You're a circle, and you slide along walls and around props instead of sticking.
  - Movement is split into small steps, so nothing tunnels through a wall at full speed.
- **Shooting.** Shots are instant (hitscan). A shot:
  - flashes, lighting the scene for a moment;
  - kicks the gun, which springs back;
  - makes the creature flinch, with a dark spray;
  - gives a hit tick, with a heavier sound for a kill;
  - shakes the view a little, for the shotgun only.
- **Other feedback.**
  - The view model bobs as you walk.
  - The screen edges pulse red when you're hurt, and you hear a heartbeat when your health is low.
  - `prefers-reduced-motion` turns off the head bob and the screen shake.
- **No hitches.**
  - The frame loop never allocates. Buffers, creatures, particles and sound voices are pooled.
  - Every image and sound is ready before the title screen.
  - The game pauses when the tab is hidden or the pointer lock is lost.

### The view

- The world is drawn at a low internal resolution, then scaled up by a whole number with crisp pixels.
- The scale is the whole number that makes the view closest to **270 pixels tall** (1080p is exactly 4×, giving 480×270). The width fills the window.
- The vertical field of view is fixed, so a wider window sees more to the sides: 90° across at 16:9. Past 21:9, the view stops widening and sits centred between dark bars.

### The renderer

- **Pixel buffer.** It draws into a `Uint32Array` pixel buffer, then puts it on screen in one step. Because it's plain arithmetic on arrays, it runs and is tested in Node.
- **Colours and light.** Textures are stored as palette indices. Light is applied with **pre-shaded colour tables**, as in Doom: 16 light levels, from cold blue-black up to warm lantern amber. That keeps it fast and keeps every pixel in the palette.
- **Walls.** A DDA raycast per column, with a depth buffer for the sprites.
- **Floor.** Snow is drawn per pixel, and each pixel is lit by where it is in the world.
- **Sky.** A panorama of pine tops against the night, turning with the view. It lightens towards dawn through the night.
- **Lights.**
  - Up to 8 point lights: your lantern, flares, the stove and the muzzle flash.
  - Stove light shows through the windows as glowing texture pixels.
  - Everything fades to black with distance.
- **Glowing pixels.** Creatures' eyes and other glowing pixels ignore the light, so eyes shine in the dark.
- **Sprites.** They're sorted far to near, clipped against the depth buffer, and lit at their position.
- **Snow.** About 300 flakes fall in world space around you, drifting in the wind.
- **Overlays.** The weapons in your hands and the HUD are drawn over the view with the canvas's 2D context, at internal resolution, before the scale-up. The HUD shows health, ammo, flares, the hour, a small crosshair and hit ticks.

### Sound

Like Marrow's, all sound is made live with Web Audio, with no audio files. Browsers only allow sound after a click, so the first click starts it.

- **Positional.** Creature sounds come from where the creature is, with HRTF panning, and a listener that follows you:
  - crawlers skitter;
  - gaunts breathe;
  - leapers shriek before they leap;
  - each kind has a death cry.
- **Voice limit.** At most 12 voices play at once, nearest first.
- **Ambience.** Wind outside, the stove crackling when you're near it, and your footsteps crunching in the snow.
- **Guns.** The rifle cracks and echoes off the trees, and the lever clacks. The shotgun booms. Shells slide in, and flares hiss.
- **The score.**
  - It adds a layer every hour, from a low wind drone at 9 PM to a pounding score at 4 AM.
  - It thins out in the lulls.
  - At dawn, a warm sunrise theme plays.
- **Settings.** M mutes, and the volume and mute settings are remembered.

## 3. Look

- **Palette.** One palette for everything, in `art/last-light/palette.lua`:
  - blue-black and slate for the snow and the night;
  - amber and orange for the lantern, the stove and the muzzle flash;
  - bone-pale for the Hungry, with glowing eyes;
  - dark red for hurt.
- **Textures.** 32×32, for walls and the floor: logs, a log window, pine trunks, the woodpile, the wagon's side and end, and snow.
- **The Hungry.** Each creature is drawn facing you and side-on (so circling leapers read right). Each has walk, attack wind-up, attack, hurt and death frames. The Mother is several times bigger.
- **In your hands.** The rifle (idle, fire, lever, reload), the shotgun (idle, fire, reload), the lantern hand, and a throw.
- **Other art.** Pickups, the HUD, the pixel font (Silkscreen, like Marrow and the front page), the title, and the dawn and death screens.
- **Previews.** A **style test** comes first: the palette, the first textures (logs, pine trunks, snow), a crawler and a gaunt, and a mock first-person frame painted from them in Aseprite. It's sent to Nathan as a preview. Building carries on while he looks, as he asked. Changes he wants are made afterwards.

## 4. Code structure

Everything lives in `last-light/`, as plain ES modules. `package.json` has only `{"type": "module"}` and a `test` script, and there are no dependencies. Data is fetched as JSON, not imported, so it doesn't need JSON import attributes.

| File | Responsibility |
|---|---|
| `index.html` | The canvas, the title font, the "couldn't start" message and the phone message; loads `src/main.js` |
| `src/main.js` | Loads assets, wires input, runs the loop: 120 Hz updates, display-rate frames |
| `src/tuning.js` | Every number: speeds, damage, timings, the wave table, light radii |
| `src/clock.js` | Fixed-step clock: whole ticks per frame, the blend fraction, and gap clamping |
| `src/rng.js` | Seeded random numbers (the simulation never uses `Math.random`) |
| `src/storage.js` | Safe `localStorage` (settings and best night) |
| `src/map.js` | The text-grid map, its legend, spawn trails, props and pickup spots; grid queries |
| `src/collide.js` | Circle-vs-grid sliding and circle-vs-circle pushing |
| `src/player.js` | Movement (acceleration, friction, running), health, the stove |
| `src/weapons.js` | Rifle, shotgun and flare timings, reloads, and the hitscan |
| `src/flowfield.js` | A breadth-first flow field towards the player over the grid, so creatures path around things |
| `src/creatures.js` | The four kinds' behaviours, flinching, flare slowing and separation, from a pool |
| `src/night.js` | Hours, waves, trickled spawns, lulls, pickups, the shotgun, the Mother, dawn and death |
| `src/sim.js` | `step(state, intents)`: one 120 Hz update, emitting events (shots, hits, deaths) for sound and effects |
| `src/input.js` | Pointer lock, raw mouse, and keys into intents; owns your facing |
| `src/view.js` | The internal size, scale and field of view for a window (pure) |
| `src/raycast.js` | DDA wall casting per column (pure) |
| `src/shade.js` | The palette and pre-shaded light tables (pure) |
| `src/render.js` | Draws the world into the pixel buffer: sky, walls, floor, sprites, snow and lights |
| `src/hud.js` | The weapons in your hands, the HUD, and the title, pause, death and dawn screens |
| `src/audio.js` | Web Audio: positional voices, ambience, guns |
| `src/music.js` | The score: which layers play at each hour, and when notes are scheduled (the logic is pure and testable) |
| `src/game.js` | Screens and flow: title, playing, paused, dead, dawn; the best night |
| `src/assets.js` | Loads the PNG and JSON art and unpacks textures into palette indices |
| `assets/` | Art written by the art scripts |
| `test/` | `node --test` tests |
| `bench.js` | `npm run bench`: times the renderer on a busy frame in Node (not a test, because timings vary) |

**Core contract**
- The simulation is `step(state, intents)`. It updates the state in place, reusing pooled objects, and never touches the DOM, the canvas, the clock or `Math.random`. Randomness comes from a seeded RNG kept in the state.
- So the rules are deterministic and tested in Node. The same seed and the same intents always give the same night.
- Your facing arrives in the intents, and `input.js` owns it, so turning is never held up by the update rate.
- Rendering and sound only read the state and its events.

**Debug modes** (URL parameters, combinable)
- `?debug=fps`: frame time and update counts on screen.
- `?debug=bot`: the game plays itself, turning to the nearest creature and firing (for testing whole nights).
- `?speed=N`: runs N updates per frame (with the bot).
- `?wave=N`: starts at wave N.
- `?god`: you can't die.

**Error handling**
- If the art fails to load, the game draws a message instead of a blank canvas.
- A browser too old to run the modules gets the "couldn't start" message after a few seconds, as Marrow does.
- Every `localStorage` access is wrapped in `try/catch`.
- With no Web Audio, the game plays silently.

## 5. The front page

- **The link.** Add it to the list in the root `index.html`, on one line:
  `<li><a href="./last-light/" data-game="last-light"><strong>Last Light</strong> <span class="blurb">Hold the cabin until dawn.</span> <span class="controls">Keyboard and mouse: WASD move, mouse aim, click shoot.</span></a></li>`
- **The island.** `art/site/island-last-light.lua`: a snowy chunk of clearing with the cabin, one lit window, a couple of pines, snow drifting off its edges, and a pair of eyes in the trees now and then. Its glow colour is added to `art/site/palette.lua`.
- **Placement.** Add its entry to `site/games.json`. The stages are nearly full, so the islands are re-laid out in both layouts, and the unfinished island moves to a new spot. The site tests (`cd site && npm test`) must pass.
- **README.** A "Last Light" section: tests, the bench, debug modes, and the art rebuild loop.

## 6. Testing

**Rule tests** (`cd last-light && npm test`, no dependencies)
- **Clock:** whole ticks per frame, the blend fraction, and a long gap giving no burst.
- **View:** the scale and size for common screens (1080p gives 480×270 at 4×), the field of view, and the 21:9 cap.
- **Raycast:** the distance, the face hit and the texture column for known angles, including exactly along grid lines.
- **Collision:**
  - sliding along a wall and into a corner;
  - no tunnelling at running speed;
  - pushing apart from props and creatures.
- **Movement:** acceleration and stopping times, and running.
- **Weapons:**
  - fire intervals, rounds, one-at-a-time reloads, and firing interrupting a reload;
  - the hitscan hits the nearest creature and walls block it;
  - shotgun spread and range, and shell counts;
  - a flare landing at a wall, burning, slowing, and the extra damage.
- **Flow field:** creatures path around the cabin and through the doorway.
- **Creatures:**
  - crawlers chase and bite;
  - a gaunt's wind-up comes before its swipe;
  - leapers circle, then leap in a straight line and miss when you sidestep;
  - the Mother's births;
  - separation, and flinching.
- **The night:**
  - the wave table and trickled spawns under the alive cap;
  - the lull's length, and the stove healing only in lulls;
  - pickups, and the shotgun before 11 PM;
  - dawn after 4 AM, and death with the hour reached.
- **Determinism:** the same seed and intents give the same state after a scripted minute.
- **Music:** the layers for each hour, and the lull thinning.
- **Assets:** every sprite and texture the code names exists, with the frames it expects, and textures unpack to palette indices.

**Performance**
- `npm run bench` renders a busy frame at 480×270 (30 creatures, 3 flares, snow) and reports its time. The target is under 4 ms.
- `?debug=fps` in the browser, on Nathan's Mac, holds the display rate during a late wave.

**Browser checks** (Playwright, on a local server)
- The title loads with 0 console errors.
- `?debug=bot&speed=10&god` plays a whole night to the dawn screen with 0 errors.
- `?wave=8` shows the Mother.
- A phone-sized touch viewport shows the phone message.
- The front page shows the new island, and its link goes to the game.

**Play-testing**
- Nathan plays for feel. Tuning changes go in `src/tuning.js`.

## Build order

This is the outline for the implementation plan.

1. **Style test.** The palette, the first textures, a crawler and a gaunt, and a mock first-person frame. Sent to Nathan as a preview; building continues.
2. **Simulation core.** `tuning.js`, `rng.js`, `clock.js`, `map.js`, `collide.js` and `player.js`, with tests.
3. **Renderer core.** `view.js`, `raycast.js`, `shade.js` and `render.js` (walls, floor, sky, light), with tests and the bench.
4. **Walk around.** `index.html`, `main.js`, `input.js` and `assets.js` with the style test's textures. You can walk the clearing, and we check the frame rate.
5. **Weapons.** `weapons.js`, the hitscan, the weapons in your hands, the HUD basics.
6. **The Hungry.** `flowfield.js`, `creatures.js` and the sprites.
7. **The night.** `night.js`, `game.js`, the screens, saving, and the debug modes.
8. **The rest of the art.** All textures, creature frames, weapon frames, pickups, the HUD and the icon.
9. **Sound.** `audio.js` and `music.js`.
10. **Feel pass.** Flashes, kicks, sprays, snow, the hurt pulse, reduced motion, and tuning.
11. **The front page.** The island, `games.json`, the re-layout, the link and the README.
12. **Release.** The whole-branch review, publishing to `main`, and checking the live site.

## Starting tuning values

Distances are in grid cells, times in seconds.

| Value | Start |
|---|---|
| Update rate | 120 Hz |
| Player radius / walk / run | 0.25 / 3.0 / 4.8 cells/s |
| Time to full speed / to stop | 0.1 / 0.08 s |
| Mouse sensitivity | 0.0025 rad per count, slider 0.25×–4× |
| Lantern light | full to 3 cells, dark by 7; eyes visible to 16 |
| Player health | 100 |
| Rifle | 10 damage, 8 rounds, 0.45 s between shots, 0.4 s per round reloaded |
| Shotgun | 8 pellets × 7 damage, ±6° spread, half damage past 4 cells, 0.25 s between barrels, 1.2 s reload, found with 8 shells |
| Shell box | 6 shells |
| Flares | start with 2, carry 5; 6-cell throw, 10 s burn, 4-cell light; ×0.5 speed and ×1.5 damage inside |
| Crawler | 10 health, 4.0 cells/s, bite 6 every 0.7 s |
| Gaunt | 45 health, 1.6 cells/s, 0.45 s wind-up, swipe 25 every 1.5 s |
| Leaper | 20 health, circles at 5 cells at 3.0 cells/s for 2–4 s, 0.5 s crouch, leaps at 9 cells/s, pounce 20 |
| The Mother | 500 health, 1.3 cells/s, 0.6 s wind-up, slam 40 every 2 s, 2 crawlers every 10 s |
| Stove | heals 25/s within 1.5 cells, in lulls only |
| Lull | 20 s; the opening dusk is 6 s |
| Alive at once | 8 + 2 × wave number |

**Waves**

| Hour | Crawlers | Gaunts | Leapers | Also |
|---|---|---|---|---|
| 9 PM | 6 | 0 | 0 | |
| 10 PM | 10 | 1 | 0 | |
| 11 PM | 12 | 2 | 2 | the shotgun appears on the wagon in the lull before |
| 12 AM | 14 | 3 | 3 | |
| 1 AM | 16 | 4 | 4 | |
| 2 AM | 20 | 5 | 5 | |
| 3 AM | 24 | 6 | 6 | |
| 4 AM | 10 | 2 | 2 | the Mother, and her crawlers |

## Out of scope

- Phones and touch controls, gamepads, looking up or down, jumping.
- Multiple maps, difficulty settings, and saving partway through a night.
- Multiplayer, story and cutscenes.
- Settings beyond mouse sensitivity, volume and mute.
