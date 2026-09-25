-- Shared helpers for Last Light's art scripts: repo paths, JSON, pixel buffers, deterministic noise,
-- ordered dither, simple drawing, alpha blitting, outlines, saving, and the writers for each kind of
-- sheet the game loads. Buffers hold "#rrggbb" or "#rrggbbaa" strings (nil is transparent), indexed
-- buf[y][x] from 0. (The drawing helpers are the same as art/site/lib.lua's; the art for each part of
-- the site keeps its own copy, so no part depends on another's scripts.)
local M = {}

local here = debug.getinfo(1, "S").source:sub(2)
M.ROOT = here:match("^(.-)art/last%-light/[^/]+$") or ""
M.ASSETS = "last-light/assets/"
M.ART = "art/last-light/"

function M.path(rel) return M.ROOT .. rel end

function M.readJson(rel)
  local f = assert(io.open(M.path(rel), "r"), "can't open " .. M.path(rel))
  local text = f:read("a")
  f:close()
  return json.decode(text)
end

-- Makes sure the folder that will hold a repo-relative file exists.
function M.ensureDir(rel)
  app.fs.makeAllDirectories(app.fs.filePath(M.path(rel)))
end

function M.writeText(rel, text)
  M.ensureDir(rel)
  local f = assert(io.open(M.path(rel), "w"), "can't write " .. M.path(rel))
  f:write(text)
  f:close()
end

function M.channels(hex)
  return tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16),
    (#hex >= 9) and tonumber(hex:sub(8, 9), 16) or 255
end

function M.rgba(hex)
  local r, g, b, a = M.channels(hex)
  return app.pixelColor.rgba(r, g, b, a)
end

function M.buffer(w, h)
  local b = { w = w, h = h }
  for y = 0, h - 1 do b[y] = {} end
  return b
end

function M.set(b, x, y, c)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then b[y][x] = c end
end

function M.get(b, x, y)
  x, y = math.floor(x), math.floor(y)
  if x >= 0 and y >= 0 and x < b.w and y < b.h then return b[y][x] end
  return nil
end

-- Deterministic noise in [0, 1), so every run draws identical pixels.
function M.rnd(x, y, seed)
  local n = (math.floor(x) * 374761393 + math.floor(y) * 668265263 + math.floor(seed or 0) * 1442695041) % 2147483647
  n = ((n ~ (n >> 13)) * 1274126177) % 2147483647
  return (n % 10007) / 10007
end

local BAYER = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }
-- 4x4 ordered-dither threshold in (0, 1).
function M.bayer(x, y)
  return (BAYER[(math.floor(y) % 4) * 4 + (math.floor(x) % 4) + 1] + 0.5) / 16
end

-- Picks from a ramp (a list of colours, dark -> light) at t in [0, 1], dithered at (x, y).
function M.ramp(list, t, x, y)
  local f = math.max(0, math.min(1, t)) * (#list - 1)
  local i = math.floor(f)
  if f - i > M.bayer(x, y) then i = i + 1 end
  return list[math.min(#list, i + 1)]
end

function M.fillRect(b, x0, y0, x1, y1, c)
  for y = y0, y1 do for x = x0, x1 do M.set(b, x, y, c) end end
end

function M.disc(b, cx, cy, r, c)
  for y = math.floor(cy - r), math.ceil(cy + r) do
    for x = math.floor(cx - r), math.ceil(cx + r) do
      local dx, dy = x + 0.5 - cx, y + 0.5 - cy
      if dx * dx + dy * dy <= r * r then M.set(b, x, y, c) end
    end
  end
end

-- A line of `c` from (x0, y0) to (x1, y1), `w` pixels thick.
function M.line(b, x0, y0, x1, y1, c, w)
  local n = math.max(1, math.ceil(math.max(math.abs(x1 - x0), math.abs(y1 - y0)) * 2))
  for i = 0, n do
    local t = i / n
    local x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    if (w or 1) <= 1 then M.set(b, x, y, c) else M.disc(b, x, y, w / 2, c) end
  end
end

-- Draws src onto dst at (ox, oy); translucent pixels are blended over what's already there.
function M.blit(dst, src, ox, oy)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then
        local r, g, bl, a = M.channels(c)
        local under = M.get(dst, ox + x, oy + y)
        if a < 255 and under then
          local r2, g2, b2 = M.channels(under)
          local k = a / 255
          c = string.format("#%02x%02x%02x", math.floor(r * k + r2 * (1 - k) + 0.5),
            math.floor(g * k + g2 * (1 - k) + 0.5), math.floor(bl * k + b2 * (1 - k) + 0.5))
        end
        if a > 0 then M.set(dst, ox + x, oy + y, c) end
      end
    end
  end
end

-- Mirror image. A pixel at column c lands at w - 1 - c.
function M.flip(src)
  local b = M.buffer(src.w, src.h)
  for y = 0, src.h - 1 do for x = 0, src.w - 1 do b[y][src.w - 1 - x] = src[y][x] end end
  return b
end

function M.scale(src, k)
  local b = M.buffer(src.w * k, src.h * k)
  for y = 0, src.h - 1 do
    for x = 0, src.w - 1 do
      local c = src[y][x]
      if c then for yy = 0, k - 1 do for xx = 0, k - 1 do b[y * k + yy][x * k + xx] = c end end end
    end
  end
  return b
end

-- A copy of the w x h rectangle of src at (x, y).
function M.crop(src, x, y, w, h)
  local b = M.buffer(w, h)
  for yy = 0, h - 1 do for xx = 0, w - 1 do b[yy][xx] = M.get(src, x + xx, y + yy) end end
  return b
end

-- A 1px outline in `color` round everything opaque in b (4-neighbour), added outside the shape.
function M.outline(b, color)
  local add = {}
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      if not b[y][x] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          if M.get(b, x + d[1], y + d[2]) then add[#add + 1] = { x, y }; break end
        end
      end
    end
  end
  for _, p in ipairs(add) do b[p[2]][p[1]] = color end
end

-- Loads a PNG (path relative to the repo root) into a buffer of "#rrggbbaa" strings.
function M.load(rel)
  local img = Image{ fromFile = M.path(rel) }
  local b = M.buffer(img.width, img.height)
  local pc = app.pixelColor
  for y = 0, img.height - 1 do
    for x = 0, img.width - 1 do
      local p = img:getPixel(x, y)
      local a = pc.rgbaA(p)
      if a > 0 then b[y][x] = string.format("#%02x%02x%02x%02x", pc.rgbaR(p), pc.rgbaG(p), pc.rgbaB(p), a) end
    end
  end
  return b
end

-- Writes a buffer as a one-layer RGB sprite: the editable .aseprite and/or a PNG (either may be nil).
function M.save(b, asepriteRel, pngRel)
  local spr = Sprite(b.w, b.h, ColorMode.RGB)
  local img = spr.cels[1].image
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local c = b[y][x]
      if c then img:drawPixel(x, y, M.rgba(c)) end
    end
  end
  if asepriteRel then M.ensureDir(asepriteRel); spr:saveAs(M.path(asepriteRel)) end
  if pngRel then M.ensureDir(pngRel); spr:saveCopyAs(M.path(pngRel)) end
  spr:close()
end

-- The palette: palette.json for the game, and a check that a buffer uses only palette colours at
-- full opacity (everything the game shades must). `what` names the image in the error.
function M.palette()
  local P = dofile(M.ROOT .. M.ART .. "palette.lua")
  local index = {}
  for i, name in ipairs(P.order) do
    assert(P.hex[name], "palette: no colour for " .. name)
    assert(not index[P.hex[name]], "palette: " .. name .. " repeats " .. P.hex[name])
    index[P.hex[name]] = i
  end
  P.index = index
  return P
end

function M.writePalette(P)
  local colors, glow, names = {}, {}, {}
  for i, name in ipairs(P.order) do colors[i] = P.hex[name] end
  for _, name in ipairs(P.glow) do glow[#glow + 1] = P.index[P.hex[name]] end
  for key, name in pairs(P.names) do names[key] = P.index[P.hex[name]] end
  M.writeText(M.ASSETS .. "palette.json", json.encode({ colors = colors, glow = glow, names = names }))
end

function M.checkPalette(b, P, what)
  for y = 0, b.h - 1 do
    for x = 0, b.w - 1 do
      local c = b[y][x]
      if c then
        local hex, a = c:sub(1, 7), (#c >= 9) and tonumber(c:sub(8, 9), 16) or 255
        assert(a == 255, string.format("%s: the pixel at %d,%d is see-through (alpha %d)", what, x, y, a))
        assert(P.index[hex], string.format("%s: the pixel at %d,%d is %s, which isn't in palette.lua", what, x, y, hex))
      end
    end
  end
end

-- textures.png and textures.json: 32x32 tiles side by side, in the order given ({ name, buffer }).
function M.writeTextures(P, tiles)
  local size = 32
  local out, names = M.buffer(size * #tiles, size), {}
  for i, t in ipairs(tiles) do
    assert(t[2].w == size and t[2].h == size, "texture " .. t[1] .. " isn't 32x32")
    M.checkPalette(t[2], P, "texture " .. t[1])
    M.blit(out, t[2], (i - 1) * size, 0)
    names[i] = t[1]
  end
  M.save(out, M.ART .. "textures.aseprite", M.ASSETS .. "textures.png")
  M.writeText(M.ASSETS .. "textures.json", json.encode({ size = size, names = names }))
  return out
end

-- sprites.png and sprites.json. Each sprite is { name, frames = { buffers, all one size }, height (world
-- units tall), anims = { anim = { frame numbers from 0 } }, stride? (cells walked per frame), ms? (per
-- frame, for looping props) }. Each sprite's frames go left to right on their own row.
function M.writeSprites(P, sprites)
  local width, height = 0, 0
  for _, s in ipairs(sprites) do
    width = math.max(width, s.frames[1].w * #s.frames)
    height = height + s.frames[1].h
  end
  local out, meta, y = M.buffer(width, height), {}, 0
  for _, s in ipairs(sprites) do
    local fw, fh = s.frames[1].w, s.frames[1].h
    for i, f in ipairs(s.frames) do
      assert(f.w == fw and f.h == fh, s.name .. ": frame " .. i .. " is a different size")
      M.checkPalette(f, P, s.name .. " frame " .. (i - 1))
      M.blit(out, f, (i - 1) * fw, y)
    end
    for anim, list in pairs(s.anims) do
      for _, n in ipairs(list) do assert(n >= 0 and n < #s.frames, s.name .. "." .. anim .. " names frame " .. n) end
    end
    meta[s.name] = { x = 0, y = y, w = fw, h = fh, count = #s.frames, height = s.height, stride = s.stride, ms = s.ms, anims = s.anims }
    y = y + fh
  end
  M.save(out, M.ART .. "sprites.aseprite", M.ASSETS .. "sprites.png")
  M.writeText(M.ASSETS .. "sprites.json", json.encode({ sprites = meta }))
  return out
end

-- A sheet of named pieces packed left to right: hands.png/.json ({ name, buffer, ox, oy } each, where
-- (ox, oy) places the frame's top-left relative to the bottom centre of the view) or hud.png/.json
-- ({ name, buffer } each). These are drawn as images, so they may use any colour and alpha.
function M.writePieces(kind, pieces)
  local width, height = 0, 0
  for _, p in ipairs(pieces) do
    width = width + p[2].w + 1
    height = math.max(height, p[2].h)
  end
  local out, meta, x = M.buffer(width, height), {}, 0
  for _, p in ipairs(pieces) do
    M.blit(out, p[2], x, 0)
    meta[p[1]] = kind == "hands" and { x, 0, p[2].w, p[2].h, p[3], p[4] } or { x, 0, p[2].w, p[2].h }
    x = x + p[2].w + 1
  end
  M.save(out, M.ART .. kind .. ".aseprite", M.ASSETS .. kind .. ".png")
  M.writeText(M.ASSETS .. kind .. ".json", json.encode(kind == "hands" and { frames = meta } or { icons = meta }))
  return out
end

return M
