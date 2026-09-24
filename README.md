# Games

Little browser games, hosted on GitHub Pages at https://natanforestree.github.io/games/

## Adding a game

1. Make a folder for it, e.g. `pong/`, with an `index.html` inside.
2. Add a card linking to `./pong/` in the root `index.html`, with a 48x48 pixel-art `pong/icon.png`.
3. Commit and push to `main`. Pages redeploys automatically (about a minute).

## Running locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

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
