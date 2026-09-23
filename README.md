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
