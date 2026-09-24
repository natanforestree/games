# Games page: floating islands

**Date:** 2026-09-23
**Status:** Approved by Nathan (2026-09-23). The plan is `docs/superpowers/plans/2026-09-23-games-islands.md`.

## What this is

The games site (`natanforestree.github.io/games/`, the root `index.html` of the `games` repo) is currently a plain page with a grid of white cards. This redesign turns it into a single-screen, living pixel-art scene: **a sky where each game floats as its own diorama island**, painted in that game's own style.

It should be fun and artful, in the same spirit as Nathan's friend's pixel-art "atlas" site, but clearly not a copy of it. So there is no top-down map, no towns, no pan and zoom, and no minimap.

## Decisions Nathan made

- **A living scene, not an explorable world.** Everything fits on one screen: you glance, poke and click. There's no scrolling or map to learn.
- **Floating islands.** Each game is its own island, in its own style, floating in a shared sky. New games add new islands.
- **The first section of the design** is approved as described below: the sky follows the time of day, islands bob, you hover to see the game and click to play, and an unfinished island hints at future games.

## Goals and success criteria

- The page loads to a complete, animated scene in any current browser on desktop and phone, with no console errors.
- Both current games, Snake and Marrow, appear as islands, each recognisably in its own game's style. Hovering or focusing an island shows its name, a one-line description and its controls. Clicking or pressing Enter plays the game.
- Adding a game means adding its link to the page's list, writing one island script, adding one entry to a data file and rebuilding the art. Nothing else is repainted.
- The page is keyboard- and screen-reader-usable. It honours "reduced motion". It still lists the games as plain links if the scene can't run.
- All art comes from Lua scripts run through Aseprite, and the rebuild reproduces the committed files byte for byte. There's no build step and there are no dependencies, as with the rest of the site.

## The scene

**The sky.** A full-screen pixel sky whose palette follows the visitor's local time:

| Phase | Hours (local) | Look |
|---|---|---|
| Dawn | 05:00–08:00 | Peach and lilac, pale sun low on the horizon |
| Day | 08:00–17:00 | Soft blue, white clouds, the odd bird |
| Dusk | 17:00–20:00 | Amber into violet, rim-lit clouds |
| Night | 20:00–05:00 | Deep indigo, twinkling stars, a moon, a rare shooting star |

- **Transitions.** Around each boundary the palette crossfades over about 30 minutes, so the sky never snaps from one phase to the next.
- **Testing and showing off.** A `?time=dawn|day|dusk|night` URL parameter overrides the clock.
- **Clouds.** Two or three layers drift slowly at different speeds.
- **One style for the whole sky.** It's deliberately neutral and soft, so that it frames the islands' clashing styles instead of competing with them.

**The islands.** Each island is a floating chunk of its game's world, roughly 96–140 px wide at the scene's internal resolution.

- **Snake.** The cozy meadow diorama from its card icon, grown larger. The snake winds slowly around an apple patch, with warm greens and a soft dark outline.
- **Marrow.** A dark shard of bone-crusted rock carrying a tiny ribbed cathedral. A faint amber and cyan light flickers inside where the duel is happening, and something drips from its underside. It uses the palette of Marrow's worlds.
- **The unfinished island.** A small bare rock with wooden scaffolding and a lantern, hinting at the next game. It isn't a link. When a game is added, its island takes the unfinished island's spot, and the unfinished island moves on to a new one.
- **Common details.** Every island has roots and dangling bits underneath, so it reads as torn from its world. Each bobs gently with its own period and phase, moving in whole pixels, and each has a small looping animation of its own.

**The title.** Pixel lettering floats in the sky, keeping the current words: **"Games"** and **"Little things I've built."** It uses the same pixel font as Marrow (Silkscreen).

**Hover, focus and click.**
- Hovering over an island, or tabbing to it, lifts it a few pixels and gives it a soft glow.
- A small pixel sign hangs beneath it, showing the name, a one-line description and the controls.
- Clicking the island, or pressing Enter while it's focused, goes to the game.
- On touch screens, the first tap on an island shows its sign and a second tap plays the game.

## Layout

- The scene is drawn at a small internal resolution, **384×216 in landscape and 216×384 in portrait**, and scaled up by the largest whole number that fits (1920×1080 is exactly 5×), with crisp pixels, as Marrow does. The canvas covers the whole window. The islands and title sit on a stage centred in it. The sky tiles sideways past the stage, and carries on in its top and bottom colours above and below it, so there are no bars.
- **Two layouts:**
  - **Landscape**, for desktop and landscape phones: the islands are spread across a wide sky with the title top-left.
  - **Portrait**, for phones: the islands are stacked vertically with the title on top.
- The page picks whichever layout fits the window better. Each game's island position is stored per layout in the data file.

## How it's built

- **Page.** The root `index.html` stays the entry point. It loads one ES module, `site/main.js`, with no build step.
- **Rendering.** A `<canvas>` draws the sky, clouds, islands and signs at the internal resolution, scaled by a whole number.
- **Interaction.** It uses **real `<a>` links**, one per game, positioned invisibly over each island's hit area. That keeps keyboard focus, screen readers, hover, middle-click and "open in new tab" all working naturally. The canvas reads which link is hovered or focused, and lifts and signs that island.
- **Words and data.**
  - The page's list of links in `index.html` holds each game's name, link, blurb and controls. It's the plain list without JavaScript, and the words on the sign with it, so the words live in one place.
  - `site/games.json` holds the rest, keyed by the same id: the island's art (whose frame data the art script writes beside its picture), the island's position in each layout, and its bob.
  - A test checks that the two agree.
- **Art.**
  - Lua scripts in `art/site/` write the editable `.aseprite` files to `art/site/`, and PNG plus JSON to `site/assets/`. They make:
    - a pre-painted, dithered sky for each phase and stage shape;
    - the clouds;
    - the moon, sun, birds and stars;
    - each island's animation frames, with its hover glow;
    - the sign frame.
  - One rebuild loop regenerates everything, and must be deterministic.
  - The site art gets its own small helper library, so it doesn't depend on Marrow's art scripts.
- **Fallbacks.**
  - With no JavaScript, or a browser too old to run the scene, the page shows the games as a simple list of links, styled plainly.
  - With `prefers-reduced-motion`, the scene is static: no bobbing and no cloud drift.
  - When the tab is hidden, animation pauses.
- **Weight.** All site art together should stay small, under about 300 KB.

## Adding a game later

1. Add the game's link, with its blurb and controls, to the list in `index.html`.
2. Write `art/site/island-<id>.lua`, borrowing colours or motifs from the game's own art.
3. Add the game's entry, with its positions, to `site/games.json`.
4. Rebuild the art, run the tests, and commit.

The README's "To add a game" section is updated to say this.

## Testing

- **Unit tests** (`node --test`, no dependencies), for the pure logic in small modules:
  - time of day to phase and crossfade amount, including the boundaries and the `?time=` override;
  - layout choice for a given window size;
  - bob offsets, which must be whole pixels;
  - hit areas matching the island positions;
  - validation of `games.json`: every entry has its fields, sprites and positions in both layouts, and no islands overlap.
- **Browser checks** with Playwright, on a local server:
  - the page loads with 0 console errors;
  - each `?time=` phase, captured as a screenshot;
  - hover and keyboard focus show the sign;
  - clicking goes to each game;
  - a phone-sized portrait viewport;
  - reduced motion;
  - the no-JavaScript fallback.
- **Art style checkpoint.** The first build step produces a style test: the sky in all four phases, with the Snake and Marrow islands. **Nathan approves the look before the rest is built**, as with Marrow.

## Out of scope

Pan and zoom, maps, minimaps, a day/night clock readout, sound, visitor accounts or saved state, and per-game screenshots. Each game's own page is unchanged.
