-- Shared helpers for Marrow's art scripts: repo paths, JSON, pixel buffers, deterministic noise,
-- simple drawing, alpha blitting and saving. Buffers hold "#rrggbb" or "#rrggbbaa" strings (nil is
-- transparent), indexed buf[y][x] from 0.
local M = {}

local here = debug.getinfo(1, "S").source:sub(2)
M.ROOT = here:match("^(.-)art/marrow/[^/]+$") or ""

function M.path(rel) return M.ROOT .. rel end

function M.readJson(rel)
  local f = assert(io.open(M.path(rel), "r"), "can't open " .. M.path(rel))
  local text = f:read("a")
  f:close()
  return json.decode(text)
end

function M.writeText(rel, text)
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

-- Mirror image (for facing left). A pixel at column c lands at w - 1 - c.
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
  if asepriteRel then spr:saveAs(M.path(asepriteRel)) end
  if pngRel then spr:saveCopyAs(M.path(pngRel)) end
  spr:close()
end

return M
