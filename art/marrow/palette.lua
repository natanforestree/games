-- Marrow's palette, defined once: the fighters' two glow ramps and their shading (one fighter sheet
-- for every world), then one palette per world. The game swaps amber -> cyan at load time for the CPU,
-- so no other color may equal an amber or cyan entry, and no world color sits near those two hues
-- (amber ~36 deg, cyan ~177 deg) at any real saturation. World ramps run dark -> light.
return {
  amber = { "#5c300f", "#a8601e", "#e8a33a", "#ffd98a" },
  cyan = { "#0f4744", "#2a8f8a", "#6fd6d0", "#c9fff6" },

  -- The fighters are glowing silhouettes: the whole body is the glow ramp (numbers are amber indices,
  -- see rig.lua), hottest on the front edge, dimmest on the back, inside a dark outline. The blade is
  -- neutral bone so it reads against the body and in every world.
  fighter = {
    outline = "#0d0a0f", frontOutline = false,
    body = 2, lit = 3, shade = 1, rim2 = 3, rib = { 3, 1 },
    limb = 1, limbBack = "#1a1216", limbRim = 2,
    blade = { "#3a2e36", "#d6cabe", "#f4ece4" }, -- hilt, body, tip
  },

  -- The worlds, in ladder order: rung 0 (Rusher), rung 1 (Waiter), rung 2 (Shifter).
  worldOrder = { "cathedral", "dusk", "abyss" },
  worlds = {
    -- Flesh cathedral: inside something alive. Crimson meat, flesh pinks and wet magenta, pink-ivory
    -- bone and teeth, pale rose light, cool blue-violet shadow.
    cathedral = {
      void = "#0c0510",
      shadow = { "#140b20", "#1f1638", "#2e2656", "#443f78" },
      crimson = { "#2f0915", "#4f0e20", "#78172c", "#a2263c" },
      flesh = { "#6d2242", "#9a385d", "#c65a75", "#e48892", "#f6c3b6" },
      magenta = { "#731a5f", "#b02a87", "#ea68ba" },
      bone = { "#6b4d59", "#9d7f87", "#ceb3af", "#f0e1d7" },
    },
    -- Beksinski dusk: the chamber broken open onto an impossible evening. Violet to oxblood sky with a
    -- burnt glow band (pushed red, away from amber), dusty rose, cold grey-blue haze, silhouettes.
    dusk = {
      void = "#0e0a10",
      ink = { "#170f18", "#231621", "#33202e" },
      violet = { "#2a2036", "#3f2e4a", "#5a4560", "#7a6478" },
      blood = { "#3e1220", "#5e1a26", "#7e2628" },
      burnt = { "#9a3622", "#b44a34" },
      rose = { "#9a6060", "#bf8a80", "#e2c0b4", "#f4e2da" },
      bone = { "#4a3434", "#6e4e4a", "#98746a", "#c4a292" },
      cold = { "#6c7690", "#98a2b8" },
    },
    -- Bioluminescent abyss: indigo dark lit only by living light. Magenta veins and a glowing heart,
    -- acid-green spores (leaning yellow, away from cyan), bone with an oily green-to-purple sheen.
    abyss = {
      void = "#06040d",
      abyss = { "#0b0a1d", "#131232", "#1c1a48", "#29255f", "#3a3478" },
      bone = { "#2c2842", "#46405f", "#6c6488", "#a098c0", "#d8d2ee" },
      green = { "#2f5a2c", "#62a03a", "#b6e25e", "#eeffc4" },
      purple = { "#4c2682", "#8446c8", "#c08cf2" },
      magenta = { "#4a0c3e", "#8e1470", "#d8309e", "#ff8ad6" },
      heart = { "#2e0820", "#5c1030", "#94203f" },
    },
  },
}
