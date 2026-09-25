# Games

Little browser games, hosted on GitHub Pages at https://natanforestree.github.io/games/

## Adding a game

1. Make a folder for it, e.g. `pong/`, with an `index.html` inside.
2. Add its link to the list in the root `index.html`, in the same form as the others, on one line:
   `<li><a href="./pong/" data-game="pong"><strong>Pong</strong> <span class="blurb">…</span> <span class="controls">…</span></a></li>`.
   Browsers that can't show the scene show this list, and the scene writes these words on the island's sign.
3. Paint its island: copy `art/site/island-snake.lua` to `art/site/island-pong.lua` and repaint it in the game's own style, copying the colours you borrow into `art/site/palette.lua`. Change the copy's `I.write("snake", …)` to the new game's id (otherwise it overwrites Snake's art), and add a `glow.pong` colour in `palette.lua`. Keep it 96–140 px wide.
4. Add it to `site/games.json` with its id, `"island": "island-pong"`, a bob, and a spot in both layouts. Find it a spot in both layouts, moving the other islands if needed; the tests say what overlaps or runs off the stage.
5. Rebuild the site art (see "The games page") and run the tests: `cd site && npm test`. They check that every link has an island and that nothing overlaps.
6. Commit and push to `main`. Pages redeploys automatically (about a minute).

## Running locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## The games page

The front page is a living pixel-art scene. Each game floats as its own island, painted in that game's style, in a sky that follows your local time of day. The design spec is `docs/superpowers/specs/2026-09-23-games-islands-design.md`.

- Code: `site/`, plain ES modules with no build step. Tests (Node 22, no dependencies): `cd site && npm test`.
- See any time of day: `/?time=dawn`, `day`, `dusk` or `night`.
- Art: each piece has a script in `art/site/`, and `palette.lua` holds every colour. Rebuild it all from the repo root. It's deterministic: an unchanged script rebuilds its files byte for byte.

  ```sh
  for s in art/site/sky.lua art/site/island-*.lua art/site/sign.lua; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script "$s"; done
  ```

  `aseprite -b --script art/site/style-test.lua` writes `art/site/preview-style.png`, which shows all four skies with the islands, and each island script writes a preview GIF. Previews aren't committed.

## Art

Pixel art lives in `art/`, drawn in Aseprite through the Aseprite MCP. Each piece has a Lua script that regenerates it, e.g.:

```sh
/Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/snake-icon.lua
```

That writes the editable `art/snake-icon.aseprite` and the `snake/icon.png` the site uses.

## Marrow

`marrow/` is a one-hit-kill fencing tug-of-war in the style of Nidhogg. Each of its three CPU opponents fights you in its own world, painted over the same seven screens: a flesh cathedral, a Beksiński-like dusk, and a bioluminescent abyss. The design spec is `docs/superpowers/specs/2026-09-23-marrow-design.md`.

- Tests (Node 22, no dependencies): `cd marrow && npm test`
- Watch the CPU play itself, with hitboxes: open `/marrow/?debug=cpu&speed=10`
- Tuning: every number is in `marrow/src/tuning.js`. The body geometry shared with the art is in `marrow/data/body.json`, and the screen layouts are in `marrow/data/screens.json`.
- Art: each asset has a script in `art/marrow/`. `palette.lua` holds the fighters' glow and every world's palette, and `worlds/<world>.lua` paints that world. Rebuild everything from the repo root (it takes about a minute, and it's deterministic: an unchanged script rebuilds its files byte for byte):

  ```sh
  for s in fighter scenes maw ui icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/marrow/$s.lua; done
  ```

  To repaint one world, run `aseprite -b --script-param world=dusk --script art/marrow/scenes.lua`. To review the worlds, `aseprite -b --script art/marrow/tour.lua` writes `art/marrow/preview-tour-<world>.png`, one image per world. Previews aren't committed.

## Last Light

`last-light/` is a first-person survival horror game: you hold a snowy log cabin through one winter night, from dusk to dawn, against the after-eaters, pale starved things that come out of the trees. It's pixel art drawn by a raycaster. The design spec is `docs/superpowers/specs/2026-09-24-last-light-design.md`. The after-eaters drop embers that you spend at the stove on upgrades ("Dark harvest": `docs/superpowers/specs/2026-09-25-last-light-dark-harvest-design.md`).

- Tests (Node 22, no dependencies): `cd last-light && npm test`. Bench: `npm run bench` (the target is under 4 ms a frame).
- Debug: `?debug=fps` shows the frame rate, and `?debug=bot` plays by itself (add `&speed=N` to speed it up). Debug flags combine with a comma: `?debug=bot,fps`. `?wave=N` (1–8) starts at that wave, `?god` means you can't die, `?seed=N` fixes the night's randomness, and `?embers=N` starts each night carrying N embers. For example, `?debug=bot,fps&god&speed=20&seed=2` watches a whole night play out fast.
- Tuning: every number is in `last-light/src/tuning.js`.
- Art: each asset has a script in `art/last-light/`, and `palette.lua` holds every colour. Rebuild everything from the repo root (it's deterministic: an unchanged script rebuilds its files byte for byte):

  ```sh
  for s in textures sky sprites hands hud icon; do /Applications/Aseprite.app/Contents/MacOS/aseprite -b --script art/last-light/$s.lua; done
  ```

  To review the art, `aseprite -b --script art/last-light/style-test.lua` writes `art/last-light/preview-style.png`. Previews aren't committed.
