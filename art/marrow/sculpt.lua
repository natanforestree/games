-- A tiny 2.5D modeler for Marrow's painted backgrounds. Shapes are unions of spheres ("balls")
-- written into a height buffer together with their surface normals; a shader function then turns
-- each pixel's material + normal into a palette color, with ordered dithering between ramp steps.
-- Everything stays pixel-crisp and is lit consistently, and a buffer can wrap horizontally so the
-- far layer tiles when draw-world.js repeats it.
--
--   local S = dofile(here .. "sculpt.lua")(L)
--   local g = S.new(320, 180, wrap)
--   S.tube(g, S.bezier({x0,y0}, {x1,y1}, {x2,y2}), function(t) return 3 - 2 * t end, "bone", 10)
--   S.shade(g, buf, function(px) return S.pick(ramp, light, px.x, px.y) end)
return function(L)
  local S = {}

  function S.new(w, h, wrap)
    return { w = w, h = h, wrap = wrap, z = {}, nx = {}, ny = {}, nz = {}, m = {}, t = {}, d = {} }
  end

  local function index(g, x, y)
    x, y = math.floor(x), math.floor(y)
    if y < 0 or y >= g.h then return nil end
    if g.wrap then x = x % g.w elseif x < 0 or x >= g.w then return nil end
    return y * g.w + x
  end
  S.index = index

  -- Writes one surface sample if it's in front of what's there. `t` is a free per-pixel tag (for
  -- example how far along a tube the pixel is), `d` the distance from the shape's axis (0..1).
  function S.put(g, x, y, h, nx, ny, nz, mat, t, d)
    local i = index(g, x, y)
    if i and (not g.z[i] or h > g.z[i]) then
      g.z[i], g.nx[i], g.ny[i], g.nz[i], g.m[i], g.t[i], g.d[i] = h, nx, ny, nz, mat, t, d
    end
  end

  -- An ellipsoid (rx, ry) whose front surface sits at depth z; rz defaults to the smaller radius.
  function S.ellipsoid(g, cx, cy, rx, ry, mat, z, t, rz)
    rz = rz or math.min(rx, ry)
    for y = math.floor(cy - ry), math.ceil(cy + ry) do
      for x = math.floor(cx - rx), math.ceil(cx + rx) do
        local u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
        local q = u * u + v * v
        if q <= 1 then
          local w = math.sqrt(1 - q)
          -- normal of an ellipsoid: gradient of (x/rx)^2 + (y/ry)^2 + (z/rz)^2
          local nx, ny, nz = u / rx, v / ry, w / rz
          local n = math.sqrt(nx * nx + ny * ny + nz * nz)
          S.put(g, x, y, (z or 0) + w * rz, nx / n, ny / n, nz / n, mat, t, math.sqrt(q))
        end
      end
    end
  end

  function S.ball(g, cx, cy, r, mat, z, t)
    S.ellipsoid(g, cx, cy, r, r, mat, z, t, r)
  end

  -- Curves are functions t in [0, 1] -> x, y.
  function S.bezier(p0, p1, p2, p3)
    if p3 then
      return function(t)
        local u = 1 - t
        return u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
          u * u * u * p0[2] + 3 * u * u * t * p1[2] + 3 * u * t * t * p2[2] + t * t * t * p3[2]
      end
    end
    return function(t)
      local u = 1 - t
      return u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2]
    end
  end

  -- A smooth path through a list of points (Catmull-Rom).
  function S.spline(pts)
    local n = #pts
    return function(t)
      local f = t * (n - 1)
      local i = math.min(n - 1, math.floor(f) + 1)
      local s = f - (i - 1)
      local p0, p1, p2, p3 = pts[math.max(1, i - 1)], pts[i], pts[i + 1], pts[math.min(n, i + 2)]
      local function cr(a, b, c, d)
        return 0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s)
      end
      return cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])
    end
  end

  local function length(curve)
    local len, px, py = 0, curve(0)
    for i = 1, 32 do
      local x, y = curve(i / 32)
      len = len + math.sqrt((x - px) ^ 2 + (y - py) ^ 2)
      px, py = x, y
    end
    return len
  end
  S.length = length

  -- A tube along a curve; `r` is a number or a function of t. The tag of each pixel is t.
  function S.tube(g, curve, r, mat, z, t0, t1)
    local n = math.max(2, math.ceil(length(curve) * 2))
    for i = 0, n do
      local t = i / n
      local x, y = curve(t)
      local rr = (type(r) == "function") and r(t) or r
      if rr > 0.3 then S.ellipsoid(g, x, y, rr, rr, mat, z, (t0 or 0) + t * ((t1 or 1) - (t0 or 0)), rr) end
    end
  end

  -- A flat panel pixel (membranes, walls): normal given directly.
  function S.flat(g, x, y, mat, z, nx, ny, nz, t)
    S.put(g, x, y, z, nx or 0, ny or 0, nz or 1, mat, t, 0)
  end

  -- Calls fn(px) for every covered pixel, px = { x, y, m, nx, ny, nz, z, t, d, edge }, and writes the
  -- color it returns (nil leaves the pixel alone). `edge` is true where a 4-neighbour is empty or more
  -- than `gap` lower, which is where outlines go.
  function S.shade(g, out, fn, gap)
    gap = gap or 3
    local px = {}
    for y = 0, g.h - 1 do
      for x = 0, g.w - 1 do
        local i = y * g.w + x
        local m = g.m[i]
        if m then
          local z, edge = g.z[i], false
          for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
            local j = index(g, x + d[1], y + d[2])
            if j and (not g.z[j] or g.z[j] < z - gap) then edge = true; break end
          end
          px.x, px.y, px.m, px.nx, px.ny, px.nz, px.z, px.t, px.d, px.edge =
            x, y, m, g.nx[i], g.ny[i], g.nz[i], z, g.t[i], g.d[i], edge
          local c = fn(px)
          if c then out[y][x] = c end
        end
      end
    end
  end

  -- Lambert term for a light direction (lx, ly, lz), y pointing down the screen.
  function S.lambert(px, lx, ly, lz)
    local n = math.sqrt(lx * lx + ly * ly + lz * lz)
    return math.max(0, (px.nx * lx + px.ny * ly + px.nz * lz) / n)
  end

  -- Picks from a dark-to-light ramp for v in [0, 1] with a 4x4 ordered dither across each step.
  -- `hard` in [0, 1) narrows the dithered zone so bands stay crisp (0.5 dithers only the middle half).
  function S.pick(ramp, v, x, y, hard)
    v = math.max(0, math.min(1, v))
    local f = v * (#ramp - 1)
    local i = math.floor(f)
    local frac = f - i
    if hard and hard > 0 then frac = math.max(0, math.min(1, (frac - hard / 2) / (1 - hard))) end
    if frac > L.bayer(x, y) then i = i + 1 end
    return ramp[math.max(1, math.min(#ramp, i + 1))]
  end

  -- Dithered vertical gradient through a list of { y, color } stops.
  function S.gradient(b, stops, x0, x1, hard)
    for y = 0, b.h - 1 do
      local a, c = stops[1], stops[#stops]
      for k = 1, #stops - 1 do
        if y >= stops[k][1] and y <= stops[k + 1][1] then a, c = stops[k], stops[k + 1]; break end
      end
      local t = (c[1] == a[1]) and 0 or (y - a[1]) / (c[1] - a[1])
      if y < stops[1][1] then t = 0 elseif y > stops[#stops][1] then t = 1 end
      for x = x0 or 0, x1 or b.w - 1 do
        local f = t
        if hard then f = math.max(0, math.min(1, (t - hard / 2) / (1 - hard))) end
        b[y][x] = (f > L.bayer(x, y)) and c[2] or a[2]
      end
    end
  end

  -- Smooth value noise in [0, 1): bilinear between lattice points `cell` px apart. With `period` (a
  -- whole number of cells across the layer) it tiles horizontally. `octaves` halves the cell each time.
  function S.noise(x, y, seed, cell, period, octaves)
    local sum, amp, norm = 0, 1, 0
    for o = 0, (octaves or 1) - 1 do
      local cs = cell / (2 ^ o)
      local fx, fy = x / cs, y / cs
      local ix, iy = math.floor(fx), math.floor(fy)
      local tx, ty = fx - ix, fy - iy
      tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
      local per = period and period * (2 ^ o)
      local function at(i, j)
        if per then i = i % per end
        return L.rnd(i, j, (seed or 0) + o * 17)
      end
      local a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx
      local c = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx
      sum = sum + (a + (c - a) * ty) * amp
      norm = norm + amp
      amp = amp * 0.5
    end
    return sum / norm
  end

  -- Sets a pixel with horizontal wrap (for tiling layers).
  function S.wset(b, x, y, c)
    x, y = math.floor(x) % b.w, math.floor(y)
    if y >= 0 and y < b.h then b[y][x] = c end
  end

  -- Recolors a pixel through a map { [from] = to } (lighten/darken within a palette).
  function S.remap(b, x, y, map, wrap)
    if wrap then x = math.floor(x) % b.w end
    local c = L.get(b, x, y)
    if c and map[c] then L.set(b, x, y, map[c]) end
  end

  -- Builds a "one step lighter" (or darker) map from ramps listed dark to light.
  function S.stepMap(ramps, dir)
    local map = {}
    for _, r in ipairs(ramps) do
      for i = 1, #r do
        local j = math.max(1, math.min(#r, i + dir))
        if j ~= i then map[r[i]] = r[j] end
      end
    end
    return map
  end

  return S
end
