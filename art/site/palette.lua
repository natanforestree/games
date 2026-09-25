-- Every colour on the games page, defined once. The sky is deliberately neutral and soft, so it frames
-- the islands' clashing styles instead of competing with them. Each island's colours are copied from its
-- game's own art (named below), not read from there, so the site's art never depends on the games'
-- scripts. Ramps run dark -> light.
return {
  -- Each phase: gradient stops top -> bottom ({ position 0..1, colour }), and the title's colours on it.
  sky = {
    dawn = {
      stops = { { 0, "#4b3f73" }, { 0.35, "#7e6a9e" }, { 0.62, "#c795b3" }, { 0.84, "#f0b3a0" }, { 1, "#fbd8b4" } },
      title = "#fff7ec", shadow = "#4b3f73", subtitle = "#fde9dc",
    },
    day = {
      stops = { { 0, "#4d86c9" }, { 0.4, "#6ea4dc" }, { 0.7, "#9cc6ea" }, { 1, "#d4e9f6" } },
      title = "#ffffff", shadow = "#2f5f99", subtitle = "#eef6ff",
    },
    dusk = {
      stops = { { 0, "#241c47" }, { 0.3, "#4a2d66" }, { 0.55, "#8a3c6c" }, { 0.78, "#cf6456" }, { 1, "#f3a04c" } },
      title = "#ffeede", shadow = "#241c47", subtitle = "#f7d3bc",
    },
    night = {
      stops = { { 0, "#070a1f" }, { 0.45, "#0f1636" }, { 0.8, "#1a2450" }, { 1, "#28336a" } },
      title = "#eef0ff", shadow = "#05071a", subtitle = "#b9c2ea",
    },
  },
  -- Clouds per phase: lit edge, body, underside (dusk's edge is the rim light).
  clouds = {
    dawn = { "#fff0e4", "#f2c9c6", "#b894b4" },
    day = { "#ffffff", "#e9f2fb", "#b9cfe6" },
    dusk = { "#ffc98a", "#c76a78", "#5e3b6e" },
    night = { "#56628f", "#34406e", "#222b55" },
  },
  stars = { "#8d96c8", "#d8ddff", "#ffffff" },
  moon = { "#b9b39a", "#e9e2c6", "#fffbe8" },
  sun = { "#ffd9a8", "#fff3dc" },
  bird = "#3a3550",
  shooting = "#fff6dc",

  -- The hover glow round each island.
  glow = { snake = "#fff4c2", marrow = "#ffd9b8", unfinished = "#ffe8b0", ["last-light"] = "#ffd7a0" },

  -- Snake: copied from art/snake-icon.lua (the card icon), plus a rock ramp for the underside.
  snake = {
    outline = "#2a2f26",
    s1 = "#2e5a4c", s2 = "#3f7a4d", s3 = "#5f9c48", s4 = "#8dbf4f", s5 = "#c9df7e",
    spot = "#35664a", belly1 = "#d8c38a", belly2 = "#f2e5b3",
    g1 = "#3d6a3c", g2 = "#55893f", g3 = "#77aa47", g4 = "#a2cc5c",
    d1 = "#4a3324", d2 = "#6e4c30", d3 = "#8f663f",
    a1 = "#9e2f2a", a2 = "#d2493b", a3 = "#ee7a5c", a4 = "#ffd2b8",
    stem = "#5a3b24", leaf = "#c2e27a",
    eye = "#1d2230", white = "#fffaf0", blush = "#f2a09a", tongue = "#d8404f",
    yellow = "#f7d16b", pink = "#f5a8bd", cream = "#fff3dc",
    mcap = "#c9453c", mcap2 = "#e76f58", mstem = "#efe0c0",
    rock = { "#3b2e2a", "#57443a", "#7a6152" },
  },

  -- Marrow: copied from art/marrow/palette.lua (the fighters' glows and outline, and the cathedral world).
  marrow = {
    outline = "#0d0a0f",
    amber = { "#5c300f", "#a8601e", "#e8a33a", "#ffd98a" },
    cyan = { "#0f4744", "#2a8f8a", "#6fd6d0", "#c9fff6" },
    void = "#0c0510",
    shadow = { "#140b20", "#1f1638", "#2e2656", "#443f78" },
    crimson = { "#2f0915", "#4f0e20", "#78172c", "#a2263c" },
    flesh = { "#6d2242", "#9a385d", "#c65a75", "#e48892", "#f6c3b6" },
    magenta = { "#731a5f", "#b02a87", "#ea68ba" },
    bone = { "#6b4d59", "#9d7f87", "#ceb3af", "#f0e1d7" },
  },

  -- Last Light: copied from art/last-light/palette.lua (the night, the snow, the cabin's logs, the pines,
  -- stone, the fire and the window's glow, and the after-eaters' eyes).
  lastLight = {
    void = "#05070c", night1 = "#0b0f1a", night2 = "#121a2b", night3 = "#1c2740", night4 = "#2a3a58",
    snow0 = "#3b4660", snow1 = "#5d6b88", snow2 = "#8a98b4", snow3 = "#b9c5da", snow4 = "#e6edf6",
    wood0 = "#1e140e", wood1 = "#34221a", wood2 = "#4e3324", wood3 = "#6b4a31", wood4 = "#8d6844", wood5 = "#b08a5c",
    bark0 = "#15110f", bark1 = "#262019", bark2 = "#3a3026", bark3 = "#544536",
    needle0 = "#0e1712", needle1 = "#182a20", needle2 = "#26402f", needle3 = "#3a5a40",
    stone0 = "#2a2c33", stone1 = "#454852", stone2 = "#676b77", stone3 = "#8e929e",
    fire1 = "#a8400f", fire2 = "#e87a1e", fire3 = "#ffb347", fire4 = "#ffe29a", window = "#ffcf7a",
    brass1 = "#c9a045", eye2 = "#f2ff8a",
  },

  -- The unfinished island: bare stone, a little grass, raw timber, rope and a lantern.
  unfinished = {
    outline = "#2a2f26",
    stone = { "#4a4652", "#6b6674", "#908a98", "#b8b2bd" },
    grass = { "#55893f", "#77aa47" },
    wood = { "#4a3324", "#6e4c30", "#8f663f", "#b58a58" },
    rope = "#c9a46a",
    lantern = { "#3a2a1c", "#ffb347", "#ffd98a", "#fff4d0" }, -- frame, flame dark -> bright
  },

  -- The sign: a wooden board round a parchment panel, hung on rope.
  sign = {
    outline = "#2a2f26",
    wood = { "#5a3b24", "#8f663f", "#b58a58" },
    paper = "#f3e6c4", paperShade = "#e0cfa6",
    rope = { "#c9a46a", "#8f6a3a" },
    name = "#3b2a1c", blurb = "#5e4a38", controls = "#7d6247",
  },
}
