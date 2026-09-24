-- Review image for each world (replaces style-test.lua): its four screens as the game shows them --
-- far and fog at that screen's parallax, the scene, its living-detail anchors lit, fighters in
-- plausible spots, the GO arrow on C and the Maw bursting on V -- at 2x, labeled. Run it after
-- fighter, scenes, maw and ui:
--   aseprite -b --script art/marrow/tour.lua
--     optional: --script-param world=<name>  --script-param poses=<path to a poses.lua>
--               --script-param out=<folder, repo-relative>
-- Writes art/marrow/preview-tour-<world>.png (or <out>/tour-<world>.png). For review only.
-- Poses missing from poses.lua (e.g. "ledge" before Task 15) fall back to standing ones.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local R = dofile(here .. "rig.lua")(L, P)
local G = dofile(here .. "worlds/common.lua")(L)
local body = L.readJson("marrow/data/body.json")
local params = app.params or {}
local D = dofile(params.poses or (here .. "poses.lua"))(body)
local W, H, K = G.W, G.H, 2

local function exists(rel) return app.fs.isFile(L.path(rel)) end

local function wrapBlit(dst, src, ox)
  ox = ox % src.w
  L.blit(dst, src, ox - src.w, 0)
  L.blit(dst, src, ox, 0)
  if ox + src.w < W then L.blit(dst, src, ox + src.w, 0) end
end

local function line(b, x0, y0, x1, y1, c)
  local n = math.max(math.abs(x1 - x0), math.abs(y1 - y0))
  for i = 0, n do
    local t = (n == 0) and 0 or i / n
    L.set(b, math.floor(x0 + (x1 - x0) * t + 0.5), math.floor(y0 + (y1 - y0) * t + 0.5), c)
  end
end

-- A fighter: pose `name` (or `fallback`) with its feet at (x, y), facing +1/-1, amber or cyan.
local function fighter(img, name, fallback, x, y, facing, cyan)
  local pose = D.poses[name] or D.poses[fallback]
  name = D.poses[name] and name or fallback
  local cell = L.buffer(64, 64)
  R.draw(cell, 32, 56, pose)
  local s = name:match("^stand(%d)$") or name:match("^air(%d)$")
  if s then
    local st = body.stances[tonumber(s) + 1]
    R.blade(cell, 32, 56, st.height, st.reach, body.hilt)
  elseif pose.sword then
    local sw = pose.sword
    line(cell, 32 + sw[1], 56 + sw[2], 32 + sw[3], 56 + sw[4], R.roles.blade[2])
  end
  if cyan then R.swap(cell) end
  if facing < 0 then cell = L.flip(cell) end
  L.blit(img, cell, x - ((facing < 0) and 31 or 32), y - 56)
end

local function screen(world, base)
  local dir = "marrow/assets/" .. world .. "/"
  local img = L.buffer(W, H)
  wrapBlit(img, L.load(dir .. "far.png"), -G.farLeft(base))
  wrapBlit(img, L.load(dir .. "fog.png"), -G.fogLeft(base))
  L.blit(img, L.load(dir .. "scene-" .. base .. ".png"), 0, 0)
  -- the living details at one moment: every vessel lit, every drip swelling at its anchor
  local meta = L.readJson(dir .. "scenes.json")
  for _, v in ipairs(meta[base].vessels) do L.set(img, v[1], v[2], meta.colors.vessel[2]) end
  for _, d in ipairs(meta[base].drips) do L.set(img, d[1], d[2], meta.colors.drip); L.set(img, d[1], d[2] + 1, meta.colors.drip) end
  if base == "C" then
    fighter(img, "stand0", "stand0", 128, 150, 1)
    fighter(img, "air2", "stand2", 170, 128, -1, true)
    if exists("marrow/assets/arrow.png") then
      local arrow = L.load("marrow/assets/arrow.png")
      local a = L.buffer(24, 12)
      for y = 0, 11 do for x = 0, 23 do a[y][x] = arrow[y][x] end end
      L.blit(img, a, W - 24 - 8, 16)
    end
  elseif base == "B1" then
    fighter(img, "crouch", "stand0", 112, 150, 1)
    fighter(img, "stand1", "stand1", 236, 150, -1, true)
  elseif base == "B2" then
    fighter(img, "stand1", "stand1", 178, 130, 1)
    if D.poses.ledge then fighter(img, "ledge", "stand2", 245, 132, 1, true)
    else fighter(img, "stand2", "stand2", 260, 110, -1, true) end
  elseif base == "V" then
    fighter(img, "death_3", "stand0", 96, 150, 1, true)
    if exists(dir .. "maw.png") then
      local sheet, data = L.load(dir .. "maw.png"), L.readJson("marrow/assets/maw.json")
      local fw, fh = data.frame[1], data.frame[2]
      local k = 3
      local f = L.buffer(fw, fh)
      for y = 0, fh - 1 do for x = 0, fw - 1 do f[y][x] = sheet[y][k * fw + x] end end
      fighter(img, "air1", "stand1", 214, 58, -1)
      L.blit(img, f, 214 - fw // 2, G.FLOOR - data.floor)
    else
      fighter(img, "stand1", "stand1", 214, 150, -1)
    end
  end
  return img
end

-- a tiny 3x5 font for the labels
local GLYPHS = {
  A = "010101111101101", B = "110101110101110", C = "011100100100011", D = "110101101101110",
  E = "111100110100111", F = "111100110100100", G = "011100101101011", H = "101101111101101",
  I = "111010010010111", K = "101110100110101", L = "100100100100111", M = "101111111101101",
  N = "110101101101101", O = "010101101101010", P = "110101110100100", R = "110101110101101",
  S = "011100010001110", T = "111010010010010", U = "101101101101111", V = "101101101101010",
  W = "101101111111101", Y = "101101010010010", ["1"] = "010110010010111", ["2"] = "110001010100111",
  ["-"] = "000000111000000", [" "] = "000000000000000", ["+"] = "000010111010000",
}
local function label(b, str, x, y, k, c)
  for ch in str:upper():gmatch(".") do
    local g = GLYPHS[ch] or GLYPHS[" "]
    for r = 0, 4 do for q = 0, 2 do
      if g:sub(r * 3 + q + 1, r * 3 + q + 1) == "1" then L.fillRect(b, x + q * k, y + r * k, x + q * k + k - 1, y + r * k + k - 1, c) end
    end end
    x = x + 4 * k
  end
end

local NAMES = { C = "C - THE CENTRE", B1 = "B1+ - TUNNEL AND PIT", B2 = "B2+ - PIT LEDGE PILLAR", V = "V+ - THE MAW" }
local BAR, GAP = 22, 6
for _, world in ipairs(P.worldOrder) do
  if (not params.world or params.world == world) and exists("marrow/assets/" .. world .. "/scene-C.png") then
    local sheet = L.buffer(W * K * 2 + GAP, (H * K + BAR) * 2 + GAP)
    L.fillRect(sheet, 0, 0, sheet.w - 1, sheet.h - 1, "#0b0809")
    for i, base in ipairs(G.BASES) do
      local ox, oy = ((i - 1) % 2) * (W * K + GAP), ((i - 1) // 2) * (H * K + BAR + GAP)
      label(sheet, world .. "  " .. NAMES[base], ox + 4, oy + 4, 3, "#ece0d6")
      L.blit(sheet, L.scale(screen(world, base), K), ox, oy + BAR)
    end
    local out = params.out and (params.out .. "/tour-" .. world .. ".png") or ("art/marrow/preview-tour-" .. world .. ".png")
    L.save(sheet, nil, out)
    print("tour written: " .. out)
  end
end
