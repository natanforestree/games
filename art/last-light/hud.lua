-- Last Light's HUD icons: health, rounds and shells (full and spent), flares, the crosshair and the
-- hit tick, in last-light/assets/hud.png with each icon's place in hud.json. Run from the repo root:
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
})
print("hud written")
