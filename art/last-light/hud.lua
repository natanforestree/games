-- Last Light's HUD icons: health, rounds and shells (full and spent), flares, the crosshair (and its
-- warm Steady hands variant), the hit tick, the ember counter's ember, and one 12x12 icon for each of
-- the fire's upgrades ("up-" and its key in last-light/src/upgrades.js), in last-light/assets/hud.png
-- with each icon's place in hud.json. Run from the repo root:
--   aseprite -b --script art/last-light/hud.lua
--
-- Each icon is drawn from rows of characters, one colour each ('.' is empty). They're drawn over the
-- view as images, so they may use alpha, but they keep to palette colours.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = L.palette()
local C = P.c

local KEY = {
  H = C.hurt, h = C.mouth, F = C.flare2, R = C.flare1,
  B = C.brass1, b = C.brass0, u = C.ui, d = C.uiDim, t = C.uiDim .. "99",
  k = C.iron1, w = C.snow4,
  Y = C.fire4, O = C.fire3, r = C.fire2, E = C.ember0, g = C.stone3, W = C.wood4, n = C.snow2,
}

local function icon(rows)
  local b = L.buffer(#rows[1], #rows)
  for y, row in ipairs(rows) do
    assert(#row == b.w, "icon row " .. y .. " is " .. #row .. " wide, not " .. b.w)
    for x = 1, #row do
      local ch = row:sub(x, x)
      if ch ~= "." then b[y - 1][x - 1] = assert(KEY[ch], "no colour for '" .. ch .. "'") end
    end
  end
  return b
end

L.writePieces("hud", {
  -- A heart, with a glint.
  { "heart", icon({
    ".HH.HH.",
    "HFHHHHH",
    "HHHHHHH",
    "HHHHHHh",
    ".HHHHh.",
    "..HHh..",
    "...h...",
  }) },
  -- A rifle cartridge: the bullet's lead-grey nose (in brass here, darker) and the case.
  { "round", icon({
    ".b.",
    "bBb",
    "bBb",
    "BBb",
    "BBb",
    "BBb",
    "BBb",
    "bbb",
  }) },
  { "roundEmpty", icon({
    ".d.",
    "d.d",
    "d.d",
    "d.d",
    "d.d",
    "d.d",
    "d.d",
    "ddd",
  }) },
  -- A shotgun shell: the red hull and its brass head.
  { "shell", icon({
    ".HHH.",
    "HFHHh",
    "HFHHh",
    "HHHHh",
    "HHHHh",
    "bBBBb",
    "BBBBb",
    "bbbbb",
  }) },
  { "shellEmpty", icon({
    ".ddd.",
    "d...d",
    "d...d",
    "d...d",
    "d...d",
    "d...d",
    "d...d",
    "ddddd",
  }) },
  -- A road flare: the red stick, its striker cap, and a dark end.
  { "flare", icon({
    "...kk",
    "..kkk",
    "..FR.",
    ".FRh.",
    ".RRh.",
    "FRh..",
    "RRh..",
    "Rh...",
  }) },
  -- A single dot, with faint ticks two pixels out.
  { "crosshair", icon({
    ".......",
    "...t...",
    ".......",
    ".t.u.t.",
    ".......",
    "...t...",
    ".......",
  }) },
  -- Four short diagonal ticks round the centre.
  { "hitTick", icon({
    "u.....u",
    ".u...u.",
    ".......",
    ".......",
    ".......",
    ".u...u.",
    "u.....u",
  }) },
  -- The crosshair gone warm: Steady hands is ready.
  { "crosshairSteady", icon({
    ".......",
    "...O...",
    ".......",
    ".O.Y.O.",
    ".......",
    "...O...",
    ".......",
  }) },
  -- An ember, for the counter.
  { "ember", icon({
    "...r...",
    "..rOr..",
    ".rOYOr.",
    ".rOYYO.",
    "ErOYOrE",
    ".EEEEE.",
    ".......",
  }) },
  -- Through-and-through: a round's streak through a pale shape and out the other side.
  { "up-pierce", icon({
    "............",
    "....dddd....",
    "...d....d...",
    "..d......d..",
    "..d......d..",
    "bBBBBBBBBBOY",
    "..d......d..",
    "..d......d..",
    "...d....d...",
    "....dddd....",
    "............",
    "............",
  }) },
  -- Quick lever: the lever's loop, and a blur of speed behind it.
  { "up-quickLever", icon({
    "............",
    "..uuuuuuu...",
    "..u.....u...",
    "..uuu...u...",
    "....u...u...",
    ".O..u...u...",
    "O...uuuuu...",
    ".O..........",
    "O..O........",
    ".O..........",
    "............",
    "............",
  }) },
  -- Steady hands: a warm ring round a still, bright centre.
  { "up-steady", icon({
    "............",
    "....OOOO....",
    "...O....O...",
    "..O......O..",
    "..O......O..",
    "..O..YY..O..",
    "..O..YY..O..",
    "..O......O..",
    "..O......O..",
    "...O....O...",
    "....OOOO....",
    "............",
  }) },
  -- Deep magazine: a row of rounds, and more behind them.
  { "up-deepMagazine", icon({
    "............",
    ".b..b..b..b.",
    "bBbbBbbBbbBb",
    "bBbbBbbBbbBb",
    "BBbBBbBBbBBb",
    "BBbBBbBBbBBb",
    "BBbBBbBBbBBb",
    "bbbbbbbbbbbb",
    "............",
    ".d..d..d..d.",
    ".d..d..d..d.",
    "............",
  }) },
  -- Slugs: one heavy grey ball in a shotgun shell's mouth.
  { "up-slugs", icon({
    "............",
    "....gggg....",
    "...gwwggg...",
    "...gwggggg..",
    "...gggggg...",
    "....gggg....",
    "...HHHHHH...",
    "...HFHHHh...",
    "...HFHHHh...",
    "...bBBBBb...",
    "...bbbbbb...",
    "............",
  }) },
  -- Dragon's breath: flame pouring from a shell.
  { "up-dragon", icon({
    "..r...O.....",
    "...O.YO..r..",
    ".r.OYYO.O...",
    "...OYYYO....",
    "..rOYYOr....",
    "...rOOr.....",
    "...HHHHH....",
    "...HFHHh....",
    "...HFHHh....",
    "...bBBBb....",
    "...bbbbb....",
    "............",
  }) },
  -- Magnesium: a flare burning white-hot.
  { "up-magnesium", icon({
    "......w.....",
    "..w..wYw..w.",
    "....wYYYw...",
    "...wYYYYw...",
    "....YYYYw...",
    ".....RR.....",
    ".....Rh.....",
    ".....Rh.....",
    ".....Rh.....",
    ".....Rh.....",
    ".....kk.....",
    "............",
  }) },
  -- Deep pockets: two flares, crossed.
  { "up-pockets", icon({
    "Y..........Y",
    "OR........RO",
    ".FR......RF.",
    "..FR....RF..",
    "...FR..RF...",
    ".....RR.....",
    ".....RR.....",
    "...RF..FR...",
    "..RF....FR..",
    ".RF......FR.",
    "gg........gg",
    "............",
  }) },
  -- Wide wick: the lantern, its light reaching out.
  { "up-wick", icon({
    "O....BB....O",
    ".O..B..B..O.",
    "....BBBB....",
    "O..B.YY.B..O",
    "...B.YO.B...",
    "...B.OO.B...",
    "O..BBBBBB..O",
    "....bbbb....",
    ".O........O.",
    "O..........O",
    "............",
    "............",
  }) },
  -- Long reach: an ember inside a wide dotted ring.
  { "up-reach", icon({
    "...d.d.d....",
    ".d.......d..",
    "............",
    "d....r....d.",
    "....rOr.....",
    "d..rOYOr..d.",
    "...ErOrE....",
    "d...EEE...d.",
    "............",
    ".d.......d..",
    "...d.d.d....",
    "............",
  }) },
  -- Warm hands: a heart, warmth rising off it.
  { "up-warm", icon({
    "...O...O....",
    "..O...O.....",
    "...O...O....",
    "............",
    ".HH..HH.....",
    "HFHHHHHH....",
    "HHHHHHHH....",
    "HHHHHHHh....",
    ".HHHHHh.....",
    "..HHHh......",
    "...Hh.......",
    "............",
  }) },
  -- Snowshoes: a webbed oval.
  { "up-snowshoes", icon({
    "....WWWW....",
    "...W.u.uW...",
    "..Wu.u.u.W..",
    "..W.u.u.uW..",
    "..Wu.u.u.W..",
    "..WWWWWWWW..",
    "..W.u.u.uW..",
    "..Wu.u.u.W..",
    "...W.u.uW...",
    "....WuuW....",
    ".....WW.....",
    "............",
  }) },
})
print("hud written")
