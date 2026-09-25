# Last Light: Dark harvest (design spec)

**Date:** 2026-09-25
**Status:** Design approved by Nathan in conversation (2026-09-25): "keep it scary, go with dark harvest", then "yes write the spec and plan". The game it changes is specified in `docs/superpowers/specs/2026-09-24-last-light-design.md`.

Nathan asked for more complexity, "like Vampire Survivors, where the monsters drop stuff and you can pick them up and choose different abilities". The design came out of Max's game-design-consultant skill. A straight Vampire Survivors port would trade Last Light's dread for a power trip. Nathan chose to **keep it scary**, so power costs exposure:
- the after-eaters drop **embers** where they die, often out past your lantern's light;
- embers cool in seconds;
- during a lull you spend them at the stove, choosing **one of three upgrades**.

Every upgrade you own was bought with a walk into the dark.

## Goals and success criteria

- **The loop:**
  - kills drop embers;
  - you walk to them before they cool;
  - in each lull the stove offers three upgrades for the embers you carry.
- **The target:** a night's build is about 5 to 7 of the 12 upgrades, so no two nights play the same. The bot, playing whole nights, averages 5 to 7 picks.
- **What doesn't change:**
  - your aiming, the waves, the stove's healing, the lull supplies, and the smoothness;
  - the renderer benchmark stays under 4 ms a frame;
  - nothing allocates in an update.
- **Nothing carries over between nights.** There's no meta-progression, and the saved record stays the latest hour reached and the dawns seen.
- **Tests:** every rule here has an automated test. `?debug=bot` still plays whole nights to dawn with no console errors.
- **The playtest** (after release, for Nathan and friends; not a build gate): it's working if people walk out for embers (at least a quarter of dropped embers fetched), and at least half can name a moment from an ember run.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Direction | Dark harvest: collecting costs exposure. The night stays scary as you grow stronger |
| Currency | Embers: the warmth an after-eater stole, spilling out where it dies. They glow, and they cool |
| Where you choose | At the stove, during a lull, one of three, with keys 1 to 3. Nothing pauses |
| What's offered | 12 upgrades in five families, each taken at most once; only ones you can use are offered |
| Cost | 6 embers for the first upgrade, and 4 more for each one after |
| Gentler nights | A pause-menu switch, "Embers come to you", drifts embers to you. It's remembered |
| Not doing | Weapons that fire themselves, mid-wave pause screens, rerolls, rarity tiers, a meta shop, bigger hordes |

## 1. Embers

- **Dropping.** When an after-eater is killed, it drops one ember where it died. Its value depends on the kind:

  | Kind | Ember value |
  |---|---|
  | Crawler | 1 |
  | Leaper | 2 |
  | Gaunt | 3 |
  | Mother | none (hers is the last hour, so embers would buy nothing) |

  Kills by burning drop embers too.
- **Glow.** An ember glows: a small bright coal on the snow, whose value shows in its size. It lights a little of the ground around it, so you sometimes see what waits near it.
- **Cooling.**
  - An ember lasts **15 s**.
  - For its last **3 s** it flickers and dims.
  - Then it goes dark and is gone.
  - Embers keep cooling through a lull.
- **Collecting.**
  - Walk within **0.6 cells** of an ember to take it. That's **2 cells** with Long reach.
  - A counter next to your health shows the embers you carry.
  - Embers carry over between lulls within a night, and are gone at the end of the night.
- **Pool.** At most **48** embers lie on the ground at once. When a new one drops into a full pool, it replaces the one closest to going out.
- **Gentler nights ("Embers come to you").**
  - Every ember drifts straight towards you at **3 cells/s**, through anything, and you collect it as usual.
  - It's off by default.
  - It's in the pause menu, applies at once (mid-night too), and is remembered.
- **Teaching.**
  - The first time an ember drops in a session, a banner reads **"Embers"**, with the line *"Take them before they cool."*
  - The first lull's line becomes *"Bring embers to the stove."* (it was *"Warm up by the stove."*).

## 2. Choosing at the fire

- **When the fire offers.** You're **choosing** while all three hold:
  - it's a lull;
  - you're within the stove's reach (1.5 cells, the same as healing);
  - there's an **offer** on the table.
- **Drawing the offer.** When you come to the stove in a lull carrying at least the next upgrade's cost, and there's no offer yet, the fire draws **three** upgrades:
  - at random, using the night's seed;
  - distinct from each other;
  - from those you haven't taken and **can use**: Slugs and Dragon's breath only once you have the shotgun.
  - If fewer than three are left, it offers what's left. If none are left, there's no offer.
- **Taking one.**
  - While choosing, **1, 2 or 3** takes that card: it costs its embers, the upgrade applies at once, and the offer is cleared. If you can still afford another, a new three are drawn on the next update.
  - While you're choosing, those keys don't switch guns; the mouse wheel still does. Away from the fire, 1 and 2 switch guns as before, and 3 does nothing.
- **An offer stays until you take one.** Walking away, or the wave starting, keeps it on the table for the next time you're choosing. Nobody can re-roll by stepping back.
- **Cost.** The *n*-th upgrade of the night (counting from 0) costs **6 + 4n** embers: 6, 10, 14, 18, 22, 26, …
- **Nothing pauses.** The lull clock runs while you choose, and the stove keeps healing you.
- **The display while choosing.**
  - Three cards across the middle of the view, above the hands. Each shows its key (1, 2, 3), an icon, the name and a short line.
  - Above them: *"The fire shows you three"* and the cost.
- **The display at the fire without enough embers:** a line reading *"The fire wants 4 more embers"*, with the real number.
- **Feedback.** Taking an upgrade plays a bright sound, and a banner shows the upgrade's name.

## 3. The twelve upgrades

Each is taken at most once. The card's short line is in quotes.

| # | Family | Name | Card line | Exact effect |
|---|---|---|---|---|
| 0 | Rifle | Through-and-through | "Rounds pass through one creature." | A rifle round that hits a creature carries on along its line, and also hits the next creature on it before a wall or the rifle's range, for the same damage |
| 1 | Rifle | Quick lever | "Work the lever a third faster." | The rifle's time between shots goes from 0.45 s to 0.3 s. The lever animation and its sound speed up to match |
| 2 | Rifle | Steady hands | "Stand still, and your next shot hits twice as hard." | Once you've been still (moving under 0.1 cells/s) for 0.5 s, a rifle shot does double damage. The crosshair warms in colour while it's ready |
| 3 | Rifle | Deep magazine | "The rifle holds 12." | Rifle capacity goes from 8 to 12, and the 4 new rounds come loaded. The ammo row shows 12 |
| 4 | Shotgun | Slugs | "One heavy slug: long reach, no spread." | The shotgun fires one slug: 40 damage, range 20, no spread, and no fall-off with distance |
| 5 | Shotgun | Dragon's breath | "Your shots set them burning." | A shotgun pellet or slug that hits sets the creature burning (below) |
| 6 | Flares | Magnesium | "Flares and fire burn twice as long." | A flare burns 20 s, not 10, and burning lasts 6 s, not 3 |
| 7 | Flares | Deep pockets | "Carry 8 flares. Each lull brings two." | Flare capacity goes from 5 to 8, and the lull's flare pickup gives 2 |
| 8 | Lantern | Wide wick | "Your light reaches further." | The lantern's clear light reaches 3.5 cells, not 2.5, and fades out by 9, not 7 |
| 9 | Hunter | Long reach | "Take embers from 2 cells away." | Ember collection reach goes from 0.6 to 2 cells |
| 10 | Hunter | Warm hands | "Each ember heals you a little." | Taking an ember heals 2 health for each ember of its value, up to your maximum, even mid-wave |
| 11 | Hunter | Snowshoes | "Move a fifth faster." | Walk and run speeds are multiplied by 1.2 |

**Burning** is new with this feature:
- A burning creature takes **4 damage a second** for **3 s** (6 s with Magnesium); setting it alight again restarts the time. Flare light makes burning hurt more, as it does shots (×1.5).
- It glows: it's lit as if a small fire stood on it, and sparks rise off it.
- If burning kills it, that's a kill like any other: it drops its ember, counts towards the night's kills, and plays its death cry.
- Burn damage makes no hit sound, no hit tick and no spray, only the kill does.

**How they combine** (the pairs to feel):
- Slugs with Dragon's breath: a burning slug at range.
- Dragon's breath with Magnesium: fire as a weapon.
- Wide wick with Long reach: see embers further, and take them sooner.
- Through-and-through with Steady hands: brace and line them up.
- Warm hands with any ember run.

## 4. Display, sound, art

- **The display:**
  - **Embers:** an ember icon and the number carried, right of the health.
  - **The cards and the fire's line:** as in §2.
  - **Steady crosshair:** with Steady hands ready, the crosshair is drawn in its warm variant.
  - **Ammo:** the rifle's row shows 8 or 12.
  - **End screens:** the dawn and death screens show the upgrades you took that night, as a row of icons in the order taken.
- **Sound** (made live, like the rest; positional where it has a place):
  - an ember dropping: a soft crackle where it fell;
  - taking one: a warm tick, higher for bigger embers;
  - one going out: a faint hiss where it was;
  - the fire drawing an offer: a low whoosh;
  - taking an upgrade: a bright two-note chime;
  - setting a creature alight: a short roar where it is.
- **Art** (Lua through Aseprite, deterministic, like all Last Light art):
  - an **ember** sprite in `sprites.lua`: a coal of glowing fire colours, three frames of flicker, 0.12 cells tall;
  - HUD icons in `hud.lua`: an **ember** (7×7), the **warm crosshair** variant (7×7), and **12 upgrade icons** (12×12), one per upgrade, drawn as rows of characters like the existing icons.
- **Cooling on screen.** The scene draws a cooling ember with a lower glow level, and flickers it in its last 3 s. Its light dims with it.

## 5. The bot

`?debug=bot` must still play whole nights to dawn. It learns:
- **Fetching:**
  - it walks to the nearest ember that will still be warm when it gets there;
  - it goes when no creature is within 3 cells of the ember or of itself, and the ember is within 8 cells;
  - it fetches embers first in a lull, then supplies, then goes to the stove.
- **Choosing:** at the stove with an offer, it takes the first card that it values most, by a fixed order of preference. It still picks something every time.

The balance check: over 8 god-mode seeds, the bot averages 5 to 7 picks a night. The starting values are tuned until it does, then recorded in the plan.

## 6. Code structure

New modules follow the existing rules:
- no allocation in an update;
- fixed pools;
- the night's seeded RNG;
- no DOM in the simulation;
- numbers in `tuning.js`.

| File | Change |
|---|---|
| `src/tuning.js` | `EMBERS` (values, life, flicker, reach, drift, pool size, light); `UPGRADES` (cost base and step, offer size) and each upgrade's numbers; `BURN` |
| `src/embers.js` (new) | The ember pool: create, drop, cool, drift (gentle), collect (with Warm hands) |
| `src/upgrades.js` (new) | The upgrade list (id, name, card line, family, needs the shotgun), `createPerks`, `upgradeCost`, drawing and taking an offer, the `choosing` flag, applying an upgrade |
| `src/creatures.js` | One `kill()` shared by shots and burning (drops the ember); `burnT` and burning damage each update |
| `src/weapons.js` | The rifle's `rounds` per gun (Deep magazine); Quick lever; Steady hands; Through-and-through; Slugs; Dragon's breath; Magnesium flare burn; Deep pockets capacity; gun keys ignored while choosing |
| `src/player.js` | Snowshoes speed; `stillT` (seconds you've been still) |
| `src/night.js` | The lull's flare pickup gives 2 with Deep pockets; flare capacity from perks |
| `src/sim.js` | New state (`embers`, `carried`, `bought`, `perks`, `offer`, `taken`, `choosing`, `gentle`); the update order below |
| `src/input.js` | Keys 1 to 3 give a `pick` press (1 and 2 still give `weapon`) |
| `src/bot.js` | Fetching embers; choosing |
| `src/scene.js` | Ember sprites and their lights; burning creatures' light and sparks; Wide wick |
| `src/effects.js` | Sparks: a second small pool drawn in a glowing colour |
| `src/render.js` | Draws sparks at full brightness (they glow) |
| `src/hud.js` | The ember counter, the cards and the fire's line, the warm crosshair, the rifle row from `rounds`, the end-screen upgrade row, lever timings scaled for Quick lever |
| `src/audio.js` | Sounds for the new events |
| `src/game.js` | Banners (the first ember; an upgrade's name); the first lull's line; the end screens get the upgrades taken |
| `src/main.js`, `index.html` | The "Embers come to you" checkbox in the pause menu, stored as `last-light-gentle`; `?embers=N` (debug) to start a night carrying N embers |
| `src/events.js` | Documents the new events |
| `art/last-light/sprites.lua`, `hud.lua` | The ember sprite; the new icons |

**New events:**

| Event | x, y | a | b |
|---|---|---|---|
| `emberDrop` | where it fell | value | |
| `ember` | where it was | value | |
| `emberOut` | where it was | | |
| `offer` | the stove | how many cards | |
| `upgrade` | you | upgrade id | |
| `alight` | the creature | kind | |

**Update order** in `step`:
1. `movePlayer`
2. `updateField`
3. `updateChoosing` (sets `choosing`, takes a pick)
4. `updateGun` (ignores gun keys while choosing)
5. `updateCreatures` (burning included)
6. `updateFlares`
7. `updateEmbers`
8. `updateNight`

## 7. Testing

Node tests, like the rest. At least:
- **Embers:**
  - a kill drops an ember of the right value where the creature died;
  - the Mother drops none;
  - embers cool out after 15 s and are gone;
  - taking one within reach adds its value, but not from beyond reach;
  - Long reach widens the reach;
  - a full pool replaces the coolest ember;
  - gentle mode drifts embers to you;
  - Warm hands heals, but not past maximum.
- **Choosing:**
  - an offer appears only in a lull, at the stove, with enough embers;
  - it has three distinct, unowned, usable upgrades, and no shotgun cards before the shotgun;
  - taking one costs 6, then 10, then 14;
  - it applies, and a new offer follows while you can afford one;
  - the offer stays after walking away and after the next wave begins;
  - keys 1 and 2 don't switch guns while choosing, but do otherwise;
  - offers are deterministic by seed.
- **Each upgrade's effect**, one test at least per row of §3. Burning has its own tests:
  - damage over time;
  - no spray or hit events while burning;
  - a burn kill drops an ember and counts.
- **Input:** keys 1 to 3 give `pick`.
- **Display:**
  - the counter;
  - the cards are drawn while choosing;
  - the fire's line;
  - the warm crosshair;
  - a rifle row of 12;
  - the end-screen icons.
- **Scene:** embers become sprites with glow and light, and burning creatures are lit.
- **Bot:** it fetches an ember, picks at the stove, and still plays a whole night to dawn (god mode). Picks per night averaged over 8 seeds lie in 5 to 7.
- **Allocation:** an update allocates nothing that lasts, with embers, burning and choosing in play.
- **Art:** every new sprite and icon exists in the sheets at the sizes above.
- **Benchmark:** the existing frames plus 20 embers on the ground stay under 4 ms.

## 8. Starting tuning values

These are starting values, to be tuned with the bot's picks-per-night check and then by play.

| Value | Start |
|---|---|
| Ember values | crawler 1, leaper 2, gaunt 3, Mother 0 |
| Ember life, flicker | 15 s, last 3 s |
| Ember reach | 0.6 cells (2 with Long reach) |
| Gentle drift | 3 cells/s |
| Ember pool | 48 |
| Ember light | clear to 0.15 cells, dark by 1.2, intensity 0.35 (scaled by value, up to ×1.5) |
| Upgrade cost | 6 + 4n |
| Offer | 3 cards |
| Burning | 4 damage/s for 3 s (6 s with Magnesium) |
| Slug | 40 damage, range 20 |
| Quick lever | 0.3 s between shots |
| Steady hands | still 0.5 s (under 0.1 cells/s), ×2 damage |
| Deep magazine | 12 rounds |
| Magnesium | flare 20 s |
| Deep pockets | 8 flares, 2 per lull |
| Wide wick | lantern clear to 3.5, dark by 9 |
| Warm hands | 2 health per ember value |
| Snowshoes | ×1.2 |

## Out of scope

- Meta-progression, unlocks or anything that carries between nights.
- Rerolls, banishing, rarity tiers.
- More than 12 upgrades, upgrade levels, and special "evolution" combinations. Combinations come from the upgrades themselves.
- Weapons that fire themselves, and pausing mid-wave to choose.
- Changes to the creatures' numbers or the waves.
