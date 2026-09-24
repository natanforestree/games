-- The Marrow island for the games page: a dark shard of Marrow's flesh-cathedral world, crusted with
-- bone and veined with crimson, carrying a tiny ribbed cathedral. Inside, the duel flickers amber and
-- cyan through the doorway and windows, flashing when the blades clash, and ichor drips from the
-- spikes underneath. Run from the repo root:
--   aseprite -b --script art/site/island-marrow.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local I = dofile(here .. "island.lua")
local W, H, N, MS = 128, 136, 12, 130
local C = P.marrow
local sh, cr, fl, mg, bn, am, cy = C.shadow, C.crimson, C.flesh, C.magenta, C.bone, C.amber, C.cyan

-- The duel's light in each frame (0..1) for the amber fighter and the cyan one; the blades clash,
-- and both flash, in frames 3 and 8.
local AMBER = { 0.45, 0.55, 0.4, 1, 0.5, 0.35, 0.55, 0.45, 1, 0.4, 0.55, 0.5 }
local CYAN = { 0.5, 0.35, 0.55, 1, 0.4, 0.55, 0.45, 0.5, 1, 0.55, 0.4, 0.5 }

-- Light comes from the top-left, slightly toward the viewer.
local function light(nx, ny, nz)
  local lx, ly, lz = -0.5, -0.7, 0.5
  local n = math.sqrt(nx * nx + ny * ny + nz * nz)
  return (nx * lx + ny * ly + nz * lz) / (n * math.sqrt(lx * lx + ly * ly + lz * lz))
end

-- Is the centre of pixel (x, y) inside the polygon? (even-odd rule)
local function inPoly(poly, x, y)
  local px, py, inside, j = x + 0.5, y + 0.5, false, #poly
  for i = 1, #poly do
    local xi, yi, xj, yj = poly[i][1], poly[i][2], poly[j][1], poly[j][2]
    if (yi > py) ~= (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi then inside = not inside end
    j = i
  end
  return inside
end

local function copy(b)
  local c = L.buffer(b.w, b.h)
  for y = 0, b.h - 1 do for x = 0, b.w - 1 do c[y][x] = b[y][x] end end
  return c
end

-------------------------------------------------------------------------------------------------
-- The rock shard

-- Its outline, clockwise: a flat top at y 70-77, then three jagged spikes underneath (the longest in
-- the middle), with a small stalactite on the long spike's shoulder.
local ROCK = {
  { 11, 76 }, { 13, 73 }, { 18, 71 }, { 26, 70 }, { 35, 71 }, { 46, 70 }, { 58, 70 }, { 69, 69 }, { 81, 70 },
  { 93, 69 }, { 104, 70 }, { 111, 71 }, { 115, 73 }, { 117, 76 },
  { 116, 80 }, { 113, 83 }, { 111, 86 }, { 108, 89 }, { 106, 93 },
  { 104, 97 }, { 102, 100 }, { 101, 104 }, { 99, 106 }, { 98, 109 }, { 97, 111 }, { 96, 108 }, { 94, 106 },
  { 93, 102 }, { 91, 100 }, { 89, 97 },
  { 86, 99 }, { 84, 98 }, { 82, 101 },
  { 79, 104 }, { 78, 108 }, { 76, 110 }, { 75, 113 }, { 73, 115 }, { 72, 118 }, { 70, 120 }, { 69, 117 },
  { 68, 114 }, { 67, 112 }, { 66, 109 }, { 65, 106 },
  { 63, 104 }, { 62, 106 }, { 60, 102 },
  { 57, 100 }, { 54, 101 }, { 51, 98 }, { 48, 99 },
  { 45, 101 }, { 43, 103 }, { 41, 104 }, { 39, 107 }, { 37, 109 }, { 35, 106 }, { 34, 103 }, { 32, 101 },
  { 30, 97 }, { 27, 95 }, { 24, 92 }, { 21, 89 }, { 18, 87 }, { 15, 84 }, { 13, 80 },
}
local DRIPS = { { 37, 0 }, { 62, 4 }, { 97, 8 } } -- column, frame offset: under the left spike, the stalactite, the right spike

-- The rim: where the flat top meets the faces below.
local function rim(x) return 77 + math.floor(math.sin(x * 0.45) * 0.8 + 0.5) end

-- The faces below the rim are broken into flat facets (each pixel takes its nearest seed's tilt), so
-- the shard looks split and angular: facets on the left face the light, lower ones face away.
local SEEDS = {}
for i = 1, 56 do
  local sx, sy = 12 + L.rnd(i, 1, 201) * 104, 78 + L.rnd(i, 2, 201) * 42
  local u = (sx - 64) / 52
  SEEDS[i] = { sx, sy, u * 0.9 + (L.rnd(i, 3, 201) - 0.5) * 0.8, (sy - 78) / 40 * 1.1 + (L.rnd(i, 4, 201) - 0.5) * 0.6 }
end
local function facet(x, y)
  local best, bi = 1e9, 1
  for i, s in ipairs(SEEDS) do
    local d = (x - s[1]) ^ 2 + ((y - s[2]) * 1.4) ^ 2
    if d < best then best, bi = d, i end
  end
  return bi
end

local function rock(b)
  local facets = L.buffer(W, H)
  for y = 60, 125 do
    for x = 0, W - 1 do
      if inPoly(ROCK, x, y) then
        if y < rim(x) then
          -- the flat top: wet crimson flesh, lit toward the left
          local v = 0.65 - (x - 11) / 106 * 0.45 + (L.bayer(x, y) - 0.5) * 0.35
          b[y][x] = (v > 0.5) and cr[3] or ((v > 0.3) and cr[2] or cr[1])
          if y <= 71 and v > 0.3 then b[y][x] = cr[4] end -- the far edge catches the light
        else
          local i = facet(x, y)
          facets[y][x] = i
          local s = SEEDS[i]
          local v = light(s[3], s[4], 0.8) - (y - 78) / 40 * 0.3
          local k = (v > 0.5) and 4 or ((v > 0.2) and 3 or ((v > -0.15) and 2 or 1))
          if L.rnd(x, y, 206) < 0.07 then k = math.max(1, k - 1) end -- grit
          b[y][x] = sh[k]
        end
      end
    end
  end
  -- a lit seam along each facet's upper-left edge
  for y = 79, 125 do
    for x = 1, W - 1 do
      local i = facets[y][x]
      if i and facets[y - 1][x] and facets[y - 1][x] ~= i and b[y][x] ~= sh[4] then
        b[y][x] = (b[y][x] == sh[1]) and sh[2] or sh[3]
      end
    end
  end
  -- veins: crimson threads wandering down through the rock, branching, flesh where they swell
  local function vein(x, y, a, len, seed, depth)
    for s = 0, len do
      if not facets[math.floor(y)] or not facets[math.floor(y)][math.floor(x)] then return end
      local c = (L.rnd(seed, s, 202) < 0.18) and fl[2] or ((s < len * 0.6) and cr[4] or cr[3])
      L.set(b, x, y, c)
      a = a + (L.rnd(seed, s, 203) - 0.5) * 0.9
      a = a + (math.pi / 2 - a) * 0.08 -- they tend downward
      x, y = x + math.cos(a), y + math.sin(a)
      if depth < 1 and s > 3 and L.rnd(seed, s, 204) < 0.08 then
        vein(x, y, a + ((L.rnd(seed, s, 205) < 0.5) and -0.9 or 0.9), len * 0.5, seed * 3 + s, depth + 1)
      end
    end
  end
  for i, v in ipairs({ { 24, 80, 1.9 }, { 44, 80, 1.3 }, { 58, 81, 1.7 }, { 79, 80, 1.5 }, { 100, 80, 1.9 } }) do
    vein(v[1], v[2], v[3], 16 + i * 2, 300 + i, 0)
  end
  -- a magenta rim light along the lower right edges, as in Marrow's scenes
  for y = 79, 125 do
    for x = 64, W - 2 do
      if facets[y][x] and (not facets[y][x + 1] or not facets[y + 1][x]) then
        b[y][x] = ((x + y) % 3 == 0) and mg[2] or mg[1]
      end
    end
  end
  -- a few magenta pustules on the faces
  for _, p in ipairs({ { 30, 88 }, { 71, 96 }, { 102, 89 } }) do
    L.set(b, p[1], p[2], mg[2]); L.set(b, p[1] + 1, p[2], mg[1]); L.set(b, p[1], p[2] + 1, mg[1])
    L.set(b, p[1], p[2] - 1, mg[3])
  end
end

-- The bone crust along the rim and the far edge: vertebrae in a row, and barnacle knobs.
local function knob(b, x, y, r)
  for yy = math.floor(y - r), math.ceil(y + r) do
    for xx = math.floor(x - r), math.ceil(x + r) do
      local dx, dy = (xx + 0.5 - x) / r, (yy + 0.5 - y) / r
      local d2 = dx * dx + dy * dy
      if d2 <= 1 then
        local v = light(dx, dy, math.sqrt(1 - d2))
        L.set(b, xx, yy, (v > 0.7) and bn[4] or ((v > 0.3) and bn[3] or ((v > -0.1) and bn[2] or bn[1])))
      end
    end
  end
end

local function crust(b)
  -- the vertebrae along the rim: 3 px bodies on a 4 px step, with a dark disc between
  for x = 13, 115 do
    local y = rim(x)
    local k = (x - 13) % 4
    if k == 3 then
      L.set(b, x, y, bn[1]); L.set(b, x, y + 1, sh[1])
    else
      L.set(b, x, y, (k == 0) and bn[4] or bn[3]); L.set(b, x, y + 1, (k == 2) and bn[1] or bn[2])
    end
  end
  -- barnacle knobs, a hole in the bigger ones
  for _, p in ipairs({ { 16, 77, 2.1, true }, { 30, 79, 1.5 }, { 52, 78, 1.6 }, { 88, 79, 2.2, true }, { 104, 78, 1.5 },
      { 112, 80, 1.8, true }, { 21, 71, 1.4 }, { 31, 70.5, 1.6, true }, { 99, 69.5, 1.8, true }, { 108, 70.5, 1.4 } }) do
    knob(b, p[1], p[2], p[3])
    if p[4] then L.set(b, p[1], p[2], sh[1]) end
  end
end

-- Sinewy strands hanging from the underside (drawn after the outline, so they stay thin): two hang
-- free with a swollen end, one loops between two points.
local function strands(b)
  local function bottom(x) -- the lowest pixel of the shard in column x
    local y = rim(x)
    while L.get(b, x, y + 1) do y = y + 1 end
    return y
  end
  local function hang(x0, len, phase)
    local y0, x = bottom(x0), x0
    for k = 1, len do
      x = math.floor(x0 + (math.sin(k * 0.35 + phase) - math.sin(phase)) * 1.2 + 0.5)
      L.set(b, x, y0 + k, (k % 4 == 0) and fl[3] or ((k < len / 2) and cr[4] or fl[2]))
    end
    L.set(b, x, y0 + len + 1, fl[4]); L.set(b, x - 1, y0 + len + 1, fl[2]); L.set(b, x, y0 + len + 2, fl[2])
  end
  hang(28, 10, 0.8)
  hang(85, 12, 2.4)
  hang(107, 7, 4.1)
  local y0 = math.max(bottom(46), bottom(55))
  for x = 46, 55 do
    local y = y0 + math.floor(6 * math.sin((x - 46) / 9 * math.pi) + 0.5)
    L.set(b, x, y, (x % 3 == 0) and fl[3] or fl[2])
  end
end

-------------------------------------------------------------------------------------------------
-- The cathedral: a ribbed nave standing on the shard at y 76, seen from the front-left. Its front is
-- a pointed arch; five more rib arches stand behind it, each a step further back (up and to the right),
-- so their right halves make the ribbed roof and side wall. The spine runs along their points.

local BASE = 76
local LEFT, SPAN, SPRING = 38, 26, 53        -- the front arch: left foot x, span, where its legs curve in
local RIBS, STEP_X, STEP_Y = 5, 5.2, -1.2    -- ribs behind the front one, each this far behind the last
local APEX = SPRING - SPAN * math.sqrt(3) / 2 -- the front arch's point (an equilateral Gothic arch)
local MID = LEFT + SPAN / 2

-- Is (u, y) inside a pointed arch of this span whose legs curve in at `spring` (u from its left foot)?
local function inArch(u, y, span, spring, base)
  if u < 0 or u > span or y > base then return false end
  if y >= spring then return true end
  return (u - span) ^ 2 + (y - spring) ^ 2 <= span * span and u * u + (y - spring) ^ 2 <= span * span
end

-- How far back the nave's visible surface is at pixel (x, y): 0 on the front, up to RIBS on the roof
-- and side wall, nil off the nave.
local DEPTH = L.buffer(W, H)
for y = 10, BASE do
  for x = LEFT, LEFT + SPAN + RIBS * STEP_X + 1 do
    for i = 0, RIBS * 20 do
      local d = i / 20
      if inArch(x + 0.5 - LEFT - STEP_X * d, y + 0.5 - STEP_Y * d, SPAN, SPRING, BASE) then DEPTH[y][x] = d; break end
    end
  end
end

-- The front's openings: a pointed doorway and a round rose window over it. Returns the side its light
-- comes from, or nil.
local function frontOpening(x, y)
  local u = x + 0.5 - MID
  if inArch(u + 4, y + 0.5, 8, 67, BASE) then return (u < 0) and "amber" or "cyan" end
  if (u - 0.5) ^ 2 + (y - 45) ^ 2 <= 6.5 then return "amber" end -- the rose, round pixel (MID, 45)
end
-- Lancet windows in the side wall, between the ribs: 2 px wide, a pointed head.
local function sideOpening(x, y)
  local d = DEPTH[y][x]
  if not d or d == 0 then return nil end
  local ly = y + 0.5 - STEP_Y * d -- height on the front arch's scale
  for _, wd in ipairs({ 1.5, 2.5, 3.5 }) do
    local cx = LEFT + SPAN + STEP_X * wd
    local dx = math.abs(x + 0.5 - cx)
    if dx <= 1 and ly >= 58 and ly <= 70 and (ly >= 59.5 or dx <= 0.5) and x + 0.5 >= LEFT + SPAN then return "cyan" end
  end
end
local function opening(x, y) return (DEPTH[y][x] == 0) and frontOpening(x, y) or sideOpening(x, y) end

-- The membrane's colour for a surface with this normal: Marrow's crimson-to-flesh ramp, dithered,
-- darker low down.
local MEMBRANE = { cr[1], cr[2], fl[1], fl[2], fl[3] }
local function membrane(x, y, nx, ny, nz)
  local v = light(nx, ny, nz) - 0.05 - (y - APEX) / (BASE - APEX) * 0.2
  local k = 1 + math.max(0, math.min(4, (v + 0.45) * 3.6 + L.bayer(x, y) - 0.25))
  return MEMBRANE[math.floor(k)]
end

-- The surface's normal at pixel (x, y) of the nave: the front faces us, the roof curves up and to the
-- right, the side wall faces right, away from the light.
local function normal(x, y)
  local d = DEPTH[y][x]
  if d == 0 then return 0, 0, 1 end
  local u, ly = x + 0.5 - LEFT - STEP_X * d, y + 0.5 - STEP_Y * d
  if ly < SPRING then return u / SPAN, (ly - SPRING) / SPAN, 0.25 end
  return 1, 0, 0.25
end

-- Is pixel (x, y) on a rib? The front rib frames the front arch (2 px); each one behind it is the band
-- of roof and wall just behind its arch.
local function onRib(x, y)
  local d = DEPTH[y][x]
  if not d then return false end
  if d > 0 then return d - math.floor(d) < 0.35 and d < RIBS + 0.35 end
  for _, o in ipairs({ { -2, 0 }, { 2, 0 }, { 0, -2 }, { -1, -1 }, { 1, -1 }, { -1, 0 }, { 1, 0 }, { 0, -1 } }) do
    if L.get(DEPTH, x + o[1], y + o[2]) ~= 0 then return true end
  end
  return false
end

local function cathedral(b)
  for y = 10, BASE do
    for x = 0, W - 1 do
      if DEPTH[y][x] then
        local nx, ny, nz = normal(x, y)
        if onRib(x, y) then
          local v = light(nx, ny, nz + 0.35)
          b[y][x] = (v > 0.55) and bn[4] or ((v > 0.2) and bn[3] or ((v > -0.2) and bn[2] or bn[1]))
        else
          b[y][x] = membrane(x, y, nx, ny, nz)
        end
      end
    end
  end
  -- faint veins creeping up the front from its feet
  for i, v in ipairs({ { 41, 74, -1.2 }, { 61, 74, -2.0 } }) do
    local x, y, a = v[1], v[2], v[3]
    for k = 0, 16 do
      if DEPTH[math.floor(y)][math.floor(x)] == 0 and not onRib(math.floor(x), math.floor(y)) then
        L.set(b, x, y, (k < 6) and mg[2] or mg[1])
      end
      a = a + (L.rnd(i, k, 207) - 0.5) * 0.8
      x, y = x + math.cos(a), y + math.sin(a)
    end
  end
  -- each rib's tip pokes up past the spine, like the ends of crossed fingers
  for d = 1, RIBS do
    local x, y = math.floor(MID + STEP_X * d) + 1, math.floor(APEX + STEP_Y * d)
    L.set(b, x, y - 2, bn[3]); L.set(b, x + 1, y - 3, bn[4])
  end
  -- the spine: vertebrae along the ridge, each with a little spinous process
  for d = RIBS, 0, -0.5 do
    local x, y = math.floor(MID + STEP_X * d), math.floor(APEX + STEP_Y * d)
    L.fillRect(b, x - 1, y - 1, x + 1, y, bn[3])
    L.set(b, x - 1, y - 1, bn[4]); L.set(b, x + 1, y, bn[1]); L.set(b, x, y - 2, bn[3])
    L.set(b, x + 2, y, sh[1])
  end
  -- the spire at the front: stacked vertebrae tapering to a point at y 12, with a pair of prongs
  local top = math.floor(APEX) - 1
  for y = 12, top do
    local half = 0.5 + (y - 12) / (top - 12) * 2
    for x = math.floor(MID - half), math.floor(MID + half - 0.01) do
      local c = (x + 0.5 < MID) and bn[4] or bn[2]
      if (y - 12) % 4 == 3 then c = (x + 0.5 < MID) and bn[2] or bn[1] end
      L.set(b, x, y, c)
    end
  end
  local py = 12 + math.floor((top - 12) * 0.45)
  L.set(b, math.floor(MID) - 2, py, bn[3]); L.set(b, math.floor(MID) - 3, py - 1, bn[4])
  L.set(b, math.floor(MID) + 2, py, bn[2]); L.set(b, math.floor(MID) + 3, py - 1, bn[3])
  -- bone frames round the front's openings, dark leading round the side's windows
  for y = 30, BASE do
    for x = LEFT, W - 1 do
      if DEPTH[y][x] and not opening(x, y) then
        if opening(x - 1, y) or opening(x + 1, y) or opening(x, y + 1) or opening(x, y - 1) then
          b[y][x] = (DEPTH[y][x] == 0) and ((x + 0.5 < MID) and bn[3] or bn[2]) or sh[1]
        end
      end
    end
  end
end

-- The duel's light inside the openings in frame f: dark (void, shadow), lit from the floor by each
-- fighter's glow, mostly in the two dimmest steps of its ramp; a clash flashes both.
local function duel(b, f)
  for y = 30, BASE do
    for x = LEFT, W - 1 do
      local side = DEPTH[y][x] and opening(x, y)
      if side then
        local ramp = (side == "amber") and am or cy
        local k = (side == "amber") and AMBER[f + 1] or CYAN[f + 1]
        local v = k * (0.55 + (y - 40) / 36 * 0.5) - L.bayer(x, y) * 0.45
        local c = C.void
        if v > 0.75 then c = ramp[4] elseif v > 0.55 then c = ramp[3] elseif v > 0.3 then c = ramp[2]
        elseif v > 0.05 then c = ramp[1] elseif v > -0.15 then c = sh[1] end
        b[y][x] = c
      end
    end
  end
  L.set(b, math.floor(MID), 45, bn[3]) -- the rose window's hub
  if AMBER[f + 1] >= 1 then -- the blades meet in the doorway
    local x = math.floor(MID)
    L.set(b, x - 1, 71, am[4]); L.set(b, x - 2, 72, am[3]); L.set(b, x, 71, cy[4]); L.set(b, x + 1, 70, cy[3])
    L.set(b, x, 70, "#ffffff")
  end
end

-- A drop of ichor at column x, its phase p (0..11): swelling for 6 frames, falling for 5, then gone.
local FALL = { 3, 6, 10, 14, 18 } -- how far the drop has fallen in each falling frame
local function drip(b, x, p)
  local y = rim(x)
  while L.get(b, x, y) do y = y + 1 end -- down to the first empty pixel under the spike
  if p < 2 then L.set(b, x, y, mg[1])
  elseif p < 4 then L.set(b, x, y, mg[2])
  elseif p < 6 then L.set(b, x, y, mg[2]); L.set(b, x, y + 1, mg[3])
  elseif p < 11 then
    local top = y + FALL[p - 5]
    L.set(b, x, top, cr[4]); L.set(b, x, top + 1, mg[3])
  end
end

-------------------------------------------------------------------------------------------------

local base = L.buffer(W, H)
rock(base)
cathedral(base)
crust(base)
L.outline(base, C.outline)
strands(base)

-- Frame f of N (0-based): the duel's light, and each drip's place in its cycle.
local function paint(f)
  local b = copy(base)
  duel(b, f)
  for _, d in ipairs(DRIPS) do drip(b, d[1], (f - d[2]) % N) end
  return b
end

local frames = {}
for f = 0, N - 1 do frames[#frames + 1] = paint(f) end
I.write("marrow", frames, MS, P.glow.marrow)
