-- Writes an island's animation for the games page. Each island script paints its frames and calls
-- I.write(id, frames, ms, glowColor), which writes:
--   site/assets/island-<id>.png   row 0: the frames side by side; row 1: each frame's hover glow
--   site/assets/island-<id>.json  { w, h, frames, ms, hit = opaque box across all frames [x, y, w, h] }
--   art/site/island-<id>.aseprite the editable animation, one Aseprite frame per frame
--   art/site/preview-island-<id>.gif  the animation at 3x, to look at (not committed)
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local I = {}
I.MARGIN = 3 -- every frame keeps this transparent border, so the glow fits inside it

-- The hover glow round one frame: a soft ring 1 px out (alpha c0) and 2 px out (alpha 60).
local function glow(frame, color)
  local g = L.buffer(frame.w, frame.h)
  for y = 0, frame.h - 1 do
    for x = 0, frame.w - 1 do
      if not frame[y][x] then
        local best = 99
        for dy = -2, 2 do
          for dx = -2, 2 do
            local d2 = dx * dx + dy * dy
            if d2 <= 5 and d2 < best and L.get(frame, x + dx, y + dy) then best = d2 end
          end
        end
        if best <= 2 then g[y][x] = color .. "c0" elseif best <= 5 then g[y][x] = color .. "60" end
      end
    end
  end
  return g
end

-- An RGB sprite with one frame per buffer (scaled k times), each lasting `seconds`.
local function animation(frames, k, seconds)
  local fw, fh = frames[1].w * k, frames[1].h * k
  local spr = Sprite(fw, fh, ColorMode.RGB)
  for _ = 2, #frames do spr:newEmptyFrame() end
  for i, f in ipairs(frames) do
    local s = (k == 1) and f or L.scale(f, k)
    local img = Image(fw, fh, ColorMode.RGB)
    for y = 0, fh - 1 do
      for x = 0, fw - 1 do
        local c = s[y][x]
        if c then img:drawPixel(x, y, L.rgba(c)) end
      end
    end
    spr.frames[i].duration = seconds
    spr:newCel(spr.layers[1], i, img, Point(0, 0))
  end
  return spr
end

function I.write(id, frames, ms, glowColor)
  local w, h, n = frames[1].w, frames[1].h, #frames
  local minX, minY, maxX, maxY = w, h, -1, -1
  local sheet = L.buffer(w * n, h * 2)
  for i, f in ipairs(frames) do
    assert(f.w == w and f.h == h, "island " .. id .. ": frame " .. i .. " is a different size")
    for y = 0, h - 1 do
      for x = 0, w - 1 do
        if f[y][x] then
          assert(x >= I.MARGIN and y >= I.MARGIN and x < w - I.MARGIN and y < h - I.MARGIN,
            "island " .. id .. ": frame " .. i .. " paints inside the " .. I.MARGIN .. " px margin at " .. x .. "," .. y)
          minX, minY = math.min(minX, x), math.min(minY, y)
          maxX, maxY = math.max(maxX, x), math.max(maxY, y)
        end
      end
    end
    L.blit(sheet, f, (i - 1) * w, 0)
    L.blit(sheet, glow(f, glowColor), (i - 1) * w, h)
  end
  local hit = { minX, minY, maxX - minX + 1, maxY - minY + 1 }
  L.save(sheet, nil, "site/assets/island-" .. id .. ".png")
  L.writeText("site/assets/island-" .. id .. ".json", json.encode({ w = w, h = h, frames = n, ms = ms, hit = hit }))
  local src = animation(frames, 1, ms / 1000)
  src:saveAs(L.path("art/site/island-" .. id .. ".aseprite"))
  src:close()
  local gif = animation(frames, 3, ms / 1000)
  gif:saveCopyAs(L.path("art/site/preview-island-" .. id .. ".gif"))
  gif:close()
  print(string.format("island %s: %d frames of %dx%d, %d ms; hit %d,%d %dx%d", id, n, w, h, ms, hit[1], hit[2], hit[3], hit[4]))
end

return I
