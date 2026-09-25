-- Every colour in Last Light, defined once. The game draws the world through pre-shaded tables built
-- from this list (last-light/src/shade.js), so every pixel of a texture, the sky or a sprite must be
-- one of these colours exactly. The order is the palette index (1 up), so only ever add colours at the
-- end. Ramps run dark -> light. `glow` colours ignore the light: eyes, embers, the window, the flare.
local P = {}

P.order = {
  -- the night: sky and fog
  "void", "night1", "night2", "night3", "night4", "star",
  -- snow
  "snow0", "snow1", "snow2", "snow3", "snow4",
  -- wood: logs, planks, wagon, woodpile
  "wood0", "wood1", "wood2", "wood3", "wood4", "wood5",
  -- pine bark and needles
  "bark0", "bark1", "bark2", "bark3", "needle0", "needle1", "needle2", "needle3",
  -- stone and iron: the well, the stove, gun metal
  "stone0", "stone1", "stone2", "stone3", "iron0", "iron1", "iron2",
  -- fire: embers, the lantern, the muzzle flash, the window's glow
  "ember0", "fire1", "fire2", "fire3", "fire4", "window",
  -- the after-eaters: bone-pale flesh, mouths, glowing eyes, dark ichor
  "flesh0", "flesh1", "flesh2", "flesh3", "flesh4", "mouth", "gum", "eye1", "eye2", "ichor0", "ichor1",
  -- the flare's red
  "flare1", "flare2",
  -- your hands, and brass
  "skin0", "skin1", "skin2", "brass0", "brass1",
  -- the HUD
  "ui", "uiDim", "hurt",
}

P.hex = {
  void = "#05070c", night1 = "#0b0f1a", night2 = "#121a2b", night3 = "#1c2740", night4 = "#2a3a58", star = "#dfe6f5",
  snow0 = "#3b4660", snow1 = "#5d6b88", snow2 = "#8a98b4", snow3 = "#b9c5da", snow4 = "#e6edf6",
  wood0 = "#1e140e", wood1 = "#34221a", wood2 = "#4e3324", wood3 = "#6b4a31", wood4 = "#8d6844", wood5 = "#b08a5c",
  bark0 = "#15110f", bark1 = "#262019", bark2 = "#3a3026", bark3 = "#544536",
  needle0 = "#0e1712", needle1 = "#182a20", needle2 = "#26402f", needle3 = "#3a5a40",
  stone0 = "#2a2c33", stone1 = "#454852", stone2 = "#676b77", stone3 = "#8e929e",
  iron0 = "#121317", iron1 = "#23252c", iron2 = "#3a3d47",
  ember0 = "#5c1f0a", fire1 = "#a8400f", fire2 = "#e87a1e", fire3 = "#ffb347", fire4 = "#ffe29a", window = "#ffcf7a",
  flesh0 = "#3b3438", flesh1 = "#6d6268", flesh2 = "#a0949a", flesh3 = "#cfc5c6", flesh4 = "#efe9e6",
  mouth = "#2a0f14", gum = "#6e2230", eye1 = "#b8d63a", eye2 = "#f2ff8a", ichor0 = "#140a10", ichor1 = "#3a1224",
  flare1 = "#ff3b2f", flare2 = "#ff9c8a",
  skin0 = "#4a2e22", skin1 = "#7a4c36", skin2 = "#a8704f", brass0 = "#8a6a2a", brass1 = "#c9a045",
  ui = "#e6dcc6", uiDim = "#8f8a7c", hurt = "#b3121e",
}

P.glow = { "star", "fire2", "fire3", "fire4", "window", "eye1", "eye2", "flare1", "flare2" }

-- The colours the game looks up by name.
P.names = { flake = "snow4", ichor = "ichor1", spark = "fire3", ui = "ui", uiDim = "uiDim", hurt = "hurt", night = "void" }

-- Shorthand: P.c.snow2 is "#8a98b4".
P.c = P.hex

return P
