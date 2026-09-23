-- Snake card icon: a coiled snake on a grassy island with an apple, a mushroom and flowers.
-- Regenerate with the Aseprite MCP (run_lua_script: dofile this file), or from a shell:
--   aseprite -b --script art/snake-icon.lua
-- Writes art/snake-icon.aseprite (editable source) and snake/icon.png (48x48, used by the site).

local W, H = 48, 48
local ROOT = debug.getinfo(1, "S").source:sub(2):match("^(.-)art/[^/]+$") or ""
local function hex(h)
  return app.pixelColor.rgba(tonumber(h:sub(2,3),16), tonumber(h:sub(4,5),16), tonumber(h:sub(6,7),16), 255)
end
local C = {
  outline=hex("#2a2f26"),
  s1=hex("#2e5a4c"), s2=hex("#3f7a4d"), s3=hex("#5f9c48"), s4=hex("#8dbf4f"), s5=hex("#c9df7e"),
  spot=hex("#35664a"), belly1=hex("#d8c38a"), belly2=hex("#f2e5b3"),
  g1=hex("#3d6a3c"), g2=hex("#55893f"), g3=hex("#77aa47"), g4=hex("#a2cc5c"),
  d1=hex("#4a3324"), d2=hex("#6e4c30"), d3=hex("#8f663f"),
  a1=hex("#9e2f2a"), a2=hex("#d2493b"), a3=hex("#ee7a5c"), a4=hex("#ffd2b8"),
  stem=hex("#5a3b24"), leaf=hex("#c2e27a"),
  eye=hex("#1d2230"), white=hex("#fffaf0"), blush=hex("#f2a09a"), tongue=hex("#d8404f"),
  yellow=hex("#f7d16b"), pink=hex("#f5a8bd"), cream=hex("#fff3dc"),
  mcap=hex("#c9453c"), mcap2=hex("#e76f58"), mstem=hex("#efe0c0"),
}

local buf = {}
for y = 0, H-1 do buf[y] = {} end
local function set(x, y, c) if x >= 0 and x < W and y >= 0 and y < H then buf[y][x] = c end end
local function get(x, y) if x >= 0 and x < W and y >= 0 and y < H then return buf[y][x] end end

-- Deterministic noise so the grass texture is identical on every run.
local function rnd(x, y)
  local n = (x * 374761393 + y * 668265263) % 2147483647
  n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
  return (n % 1000) / 1000
end

local function inEll(x, y, cx, cy, rx, ry)
  local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
  return dx*dx + dy*dy <= 1, dx, dy
end

-- Light comes from the top-left, slightly toward the viewer.
local function light(nx, ny, nz)
  local lx, ly, lz = -0.5, -0.7, 0.5
  local l = math.sqrt(lx*lx + ly*ly + lz*lz)
  return (nx*lx + ny*ly + nz*lz) / l
end

local function ramp(v, a, b, c, d, e)
  if v > 0.8 then return e elseif v > 0.5 then return d elseif v > 0.15 then return c elseif v > -0.25 then return b else return a end
end

-- Island: dirt sides, then grass top
local icx, icy, irx, iry = 24, 33, 22, 8.5
for y = 0, H-1 do for x = 0, W-1 do
  local top, dx, dy = inEll(x, y, icx, icy, irx, iry)
  local side = false
  for k = 1, 5 do if inEll(x, y, icx, icy + k, irx - k * 0.35, iry) then side = true end end
  if top then
    local d = math.sqrt(dx*dx + dy*dy)
    local c = C.g3
    if dx < -0.1 and dy < -0.1 and d < 0.75 then c = C.g4 end
    if d > 0.88 and dy > 0.2 then c = C.g2 end
    local r = rnd(x, y)
    if r < 0.08 then c = C.g2 elseif r > 0.95 then c = C.g4 end
    set(x, y, c)
  elseif side then
    local xb = (x + 0.5 - icx) / irx
    local yb = icy + iry * math.sqrt(math.max(0, 1 - xb*xb))
    local depth = y + 0.5 - yb
    local c = depth < 2 and C.d3 or (depth < 4 and C.d2 or C.d1)
    if depth < 1 and rnd(x, y) < 0.5 then c = C.g2 end
    if rnd(x + 7, y) < 0.07 then c = C.d1 end
    set(x, y, c)
  end
end end

-- Soft shadows on the grass
local function shadow(cx, cy, rx, ry)
  for y = 0, H-1 do for x = 0, W-1 do
    local c = get(x, y)
    if inEll(x, y, cx, cy, rx, ry) and (c == C.g3 or c == C.g4) then set(x, y, C.g2) end
  end end
end
shadow(25, 35.5, 12.5, 4.5)
shadow(8, 35, 4.5, 1.6)
shadow(41.5, 33.5, 3.5, 1.2)

-- Apple
local ax, ay, ar = 8, 31.5, 3.6
for y = 0, H-1 do for x = 0, W-1 do
  local dx, dy = x + 0.5 - ax, y + 0.5 - ay
  if dx*dx + dy*dy <= (ar + 1)^2 then set(x, y, C.outline) end
end end
for y = 0, H-1 do for x = 0, W-1 do
  local dx, dy = (x + 0.5 - ax) / ar, (y + 0.5 - ay) / ar
  local d2 = dx*dx + dy*dy
  if d2 <= 1 then set(x, y, ramp(light(dx, dy, math.sqrt(1 - d2)), C.a1, C.a1, C.a2, C.a3, C.a4)) end
end end
set(8, 27, C.stem); set(8, 26, C.stem); set(9, 26, C.leaf); set(10, 26, C.leaf); set(10, 25, C.leaf)
set(7, 26, C.outline); set(8, 25, C.outline); set(9, 25, C.outline); set(10, 24, C.outline)
set(11, 25, C.outline); set(11, 26, C.outline); set(9, 27, C.outline); set(10, 27, C.outline)

-- Mushroom
for _, p in ipairs({{40,31},{41,31},{40,32},{41,32}}) do set(p[1], p[2], C.mstem) end
for x = 39, 42 do set(x, 28, C.mcap) end
for x = 38, 43 do set(x, 29, C.mcap); set(x, 30, C.mcap) end
set(40, 28, C.mcap2); set(39, 29, C.mcap2); set(40, 29, C.mcap2)
set(41, 29, C.cream); set(39, 30, C.cream); set(42, 30, C.cream)

-- Flowers
local function flower(x, y, petal, center)
  set(x-1, y, petal); set(x+1, y, petal); set(x, y-1, petal); set(x, y+1, petal); set(x, y, center)
end
flower(14, 38, C.cream, C.yellow)
flower(35, 39, C.pink, C.yellow)
flower(5, 36, C.yellow, C.cream)
flower(44, 36, C.pink, C.cream)

-- Snake body: a rising spiral coil (passes 1-2) then an S-curved neck (pass 3),
-- painted as overlapping discs so later passes sit on top of earlier ones.
local samples = {}
local function push(x, y, r, pass) samples[#samples + 1] = {x = x, y = y, r = r, pass = pass} end
local th0, th1 = 0.8 * math.pi, 4.2 * math.pi
local N = 900
for i = 0, N do
  local t = i / N
  local th = th0 + (th1 - th0) * t
  local cx, cy = 25, 32.5 - 4.5 * t
  local rx, ry = 9.5 - 3 * t, 4.2 - 1.4 * t
  local r = 3.0 - 0.3 * t
  if t < 0.14 then r = 1.0 + 2.0 * (t / 0.14) end -- tapered tail tip
  push(cx + rx * math.cos(th), cy + ry * math.sin(th), r, t < 0.59 and 1 or 2)
end
local p0 = samples[#samples]
local P = {{p0.x, p0.y}, {p0.x + 5, p0.y - 3}, {30, 21}, {34, 16.5}}
for i = 1, 300 do
  local t = i / 300
  local u = 1 - t
  local x = u^3*P[1][1] + 3*u^2*t*P[2][1] + 3*u*t^2*P[3][1] + t^3*P[4][1]
  local y = u^3*P[1][2] + 3*u^2*t*P[2][2] + 3*u*t^2*P[3][2] + t^3*P[4][2]
  push(x, y, 2.7 - 0.2 * t, 3)
end

-- Arclength (for the spot pattern) and the unit perpendicular (for tube shading).
local s = 0
for i, p in ipairs(samples) do
  local a = samples[math.max(1, i - 1)]
  local b = samples[math.min(#samples, i + 1)]
  local tx, ty = b.x - a.x, b.y - a.y
  local tl = math.sqrt(tx*tx + ty*ty); if tl == 0 then tl = 1 end
  p.px, p.py = -ty / tl, tx / tl
  if i > 1 then s = s + math.sqrt((p.x - a.x)^2 + (p.y - a.y)^2) end
  p.s = s
end

local function disc(p, r, fn)
  for y = math.floor(p.y - r - 1), math.ceil(p.y + r + 1) do
    for x = math.floor(p.x - r - 1), math.ceil(p.x + r + 1) do
      local dx, dy = x + 0.5 - p.x, y + 0.5 - p.y
      if dx*dx + dy*dy <= r*r then fn(x, y, dx, dy) end
    end
  end
end

for pass = 1, 3 do
  local idx = {}
  for i, p in ipairs(samples) do if p.pass == pass then idx[#idx + 1] = i end end
  -- Skip the outline where a pass continues from the previous one, so no seam crosses the body.
  local skip = pass == 1 and 0 or 28
  for k, i in ipairs(idx) do
    if k > skip then disc(samples[i], samples[i].r + 1, function(x, y) set(x, y, C.outline) end) end
  end
  for _, i in ipairs(idx) do
    local p = samples[i]
    disc(p, p.r, function(x, y, dx, dy)
      local perp = math.max(-1, math.min(1, (dx * p.px + dy * p.py) / p.r))
      local v = light(perp * p.px, perp * p.py, math.sqrt(1 - perp * perp))
      local c = ramp(v, C.s1, C.s2, C.s3, C.s4, C.s5)
      if pass == 3 and perp > 0.3 then
        c = v > 0.1 and C.belly2 or C.belly1
      elseif pass < 3 and math.floor(p.s / 2.2) % 3 == 0 and perp < -0.05 and perp > -0.7 and p.s > 6 then
        c = C.spot
      end
      set(x, y, c)
    end)
  end
end

-- Head
local hx, hy, hrx, hry = 34.5, 13.5, 5, 4
for y = 0, H-1 do for x = 0, W-1 do
  if inEll(x, y, hx, hy, hrx + 1, hry + 1) then set(x, y, C.outline) end
end end
for y = 0, H-1 do for x = 0, W-1 do
  local inside, dx, dy = inEll(x, y, hx, hy, hrx, hry)
  if inside then
    local v = light(dx, dy, math.sqrt(math.max(0, 1 - dx*dx - dy*dy)))
    local c = ramp(v, C.s1, C.s2, C.s3, C.s4, C.s5)
    if dy > 0.45 and dx > -0.3 then c = v > 0.0 and C.belly2 or C.belly1 end
    set(x, y, c)
  end
end end
set(35, 11, C.white); set(36, 11, C.eye); set(35, 12, C.eye); set(36, 12, C.eye)
set(37, 14, C.blush); set(38, 14, C.blush)
set(40, 15, C.tongue); set(41, 15, C.tongue); set(42, 14, C.tongue); set(42, 16, C.tongue)

-- Outline the island (the only part without one) so the icon sits cleanly on any background.
local add = {}
for y = 0, H-1 do for x = 0, W-1 do
  if not get(x, y) then
    for _, d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do
      local n = get(x + d[1], y + d[2])
      if n and n ~= C.tongue and n ~= C.outline then add[#add + 1] = {x, y}; break end
    end
  end
end end
for _, a in ipairs(add) do set(a[1], a[2], C.outline) end

local spr = Sprite(W, H, ColorMode.RGB)
local img = spr.cels[1].image
for y = 0, H-1 do for x = 0, W-1 do
  if buf[y][x] then img:drawPixel(x, y, buf[y][x]) end
end end
spr:saveAs(ROOT .. "art/snake-icon.aseprite")
spr:saveCopyAs(ROOT .. "snake/icon.png")
print("wrote " .. ROOT .. "art/snake-icon.aseprite and snake/icon.png")
