-- World "abyss" (ladder rung 2, the Shifter): deep dark, or the inside of something vast, lit only by
-- living light. Loaded by scenes.lua (and maw.lua for `maw`) as
--   dofile("worlds/abyss.lua")({ L = lib, S = sculpt, G = common, P = this world's palette })
-- and returns { far, fog, scenes = { C, B1, B2, V }, colors, maw }.
--   far    indigo deep inside an even vaster dim ribcage: a colossal anatomical heart hanging by its
--          great vessels, veined with magenta light (above C); an embryo curled in a glowing sac above
--          each V; drifting jellies, spores, and pairs of small pale eyes watching
--   fog    violet murk low down, with bright motes
--   scenes thorned ribs curling in like claws, their bone sheened green to purple, magenta veins
--          crawling on them; clusters of acid-green spore pods; lures dangling on threads; every
--          floor is black chitin scales with oily glints and glowing splits; pits drop into a magenta
--          glow; B1's tunnel runs under a chitin slab studded with glowing pods; B2's ledge is a great
--          ridged shell and its pillar a chitin spine; V is a ring of claws over a sealed, glowing star
return function(env)
  local L, S, G, P = env.L, env.S, env.G, env.P
  local W, H, FW, FLOOR = G.W, G.H, G.FAR_W, G.FLOOR
  local ab, bn, gr, pu, mg, he = P.abyss, P.bone, P.green, P.purple, P.magenta, P.heart
  local smooth = G.smooth
  local KEY = { -0.35, -0.8, 0.5 } -- a faint cold light from above
  local HEART_U, HEART_Y = 400, 60
  local SACS = { { 160, 62, 1 }, { 640, 62, -1 } } -- above V- and V+ (the second curls the other way)
  local LIGHTER = G.chains({
    { P.void, ab[1], ab[2], ab[3], ab[4], ab[5], pu[1], pu[2] },
    { he[1], he[2], he[3], mg[2], mg[3], mg[4] },
    { bn[1], bn[2], bn[3], bn[4], bn[5] },
  })

  -- the heart's glow as seen on each screen, for magenta rim light on the ribs
  local function glowOn(base) return { x = HEART_U - G.farLeft(base), y = HEART_Y } end

  -- Oily sheen: lit bone picks up green or purple depending on the angle it faces and where it is.
  local function sheen(px, v)
    local h = math.sin(px.x * 0.045 + px.y * 0.03 + math.atan(px.ny, px.nx) * 1.6) * (S.noise(px.x, px.y, 306, 12) * 1.6 - 0.2)
    if v > 0.66 then
      if h > 0.25 then return S.pick({ gr[1], gr[2], gr[3] }, (v - 0.62) / 0.38 + 0.2, px.x, px.y, 0.5) end
      if h < -0.25 then return S.pick({ pu[1], pu[2], pu[3] }, (v - 0.62) / 0.38 + 0.2, px.x, px.y, 0.5) end
    end
  end

  -- A glowing halo: lightens what's already there, densest near (cx, cy), `steps` times.
  local function halo(b, cx, cy, r, strength, steps, wrap, skip)
    for y = math.floor(cy - r), math.ceil(cy + r) do
      for x = math.floor(cx - r), math.ceil(cx + r) do
        local d = math.sqrt((x + 0.5 - cx) ^ 2 + (y + 0.5 - cy) ^ 2) / r
        if d < 1 then
          local k = (1 - d) ^ 1.6 * strength
          for s = 1, steps do
            if k > L.bayer(x + s, y + s * 2) + (s - 1) * 0.5 then
              local xx = wrap and x % b.w or x
              if not (skip and skip(xx, y)) then G.step(b, xx, y, LIGHTER) end
            end
          end
        end
      end
    end
  end

  -------------------------------------------------------------------------------------------------
  -- far

  local function far()
    local b = L.buffer(FW, H)
    S.gradient(b, { { 0, P.void }, { 24, ab[1] }, { 70, ab[2] }, { 140, ab[1] }, { 179, P.void } }, nil, nil, 0.3)
    local g = S.new(FW, H, true)
    for i = 0, 14 do -- a vaster ribcage far behind, its ribs arching right over the frame
      local x0 = i * (FW / 15) + 18
      S.tube(g, S.bezier({ x0 - 30, 200 }, { x0 - 44, 40 }, { x0 + 40, -30 }), function(t) return 7 - t * 3 end, "far", 0)
    end
    -- the heart: ventricles tapering to an apex down and left, atria, the aortic arch, the pulmonary
    -- trunk and the vena cava, and the vessels it hangs from
    local HX, HY = HEART_U, HEART_Y
    S.tube(g, S.spline({ { HX + 4, HY - 8 }, { HX - 2, HY + 12 }, { HX - 12, HY + 32 } }), function(t) return 22 - t * 17 end, "heart", 40)
    S.ellipsoid(g, HX + 11, HY + 2, 14, 18, "heart", 43)
    S.ball(g, HX + 17, HY - 20, 9, "heart", 36)
    S.ball(g, HX - 15, HY - 17, 10, "heart", 36)
    S.tube(g, S.spline({ { HX + 1, HY - 20 }, { HX - 1, HY - 40 }, { HX + 12, HY - 52 }, { HX + 26, HY - 44 },
      { HX + 28, HY - 30 } }), 6, "vessel", 38)
    for k = 0, 2 do
      local bx = HX + 3 + k * 7
      S.tube(g, S.spline({ { bx, HY - 50 + k }, { bx - 2 + k, HY - 62 }, { bx - 4 + k * 2, -10 } }), 2.6 - k * 0.3, "vessel", 37)
    end
    S.tube(g, S.spline({ { HX - 5, HY - 16 }, { HX - 12, HY - 34 }, { HX - 22, HY - 44 }, { HX - 36, HY - 46 } }), 5, "vessel", 42)
    S.tube(g, S.spline({ { HX - 18, HY - 24 }, { HX - 19, HY - 44 }, { HX - 20, -10 } }), 4.4, "vessel", 35)
    for k = 0, 4 do -- thin roots trailing from the apex
      local x0, sway = HX - 12 + k * 3, (k - 2) * 6
      S.tube(g, S.spline({ { x0, HY + 26 }, { x0 + sway * 0.5, HY + 40 }, { x0 + sway, HY + 52 + k * 4 } }),
        function(t) return 1.6 * (1 - t) + 0.4 end, "vessel", 39)
    end
    -- the embryos: each curled in a sac hung on a cord: a big head bowed over, the back curved round,
    -- knees drawn up to the chin, an arm across the face (d flips which way it faces)
    for _, sac in ipairs(SACS) do
      local x, y, d = sac[1], sac[2], sac[3]
      local function X(dx) return x + dx * d end
      S.tube(g, S.spline({ { X(6), y - 38 }, { X(12), y - 60 }, { X(6), -10 } }), 2.2, "vessel", 30)
      S.ellipsoid(g, X(3), y + 6, 9, 12, "embryo", 48)                                             -- torso
      S.tube(g, S.spline({ { X(6), y - 8 }, { X(13), y + 4 }, { X(7), y + 19 } }), function(t) return 7 - t * 1.5 end, "embryo", 49) -- back
      S.ellipsoid(g, X(-3), y - 14, 11, 10, "embryo", 52)                                          -- head
      S.tube(g, S.spline({ { X(5), y + 18 }, { X(-4), y + 15 }, { X(-9), y + 8 } }), function(t) return 4.6 - t * 1.2 end, "embryo", 53) -- thigh
      S.tube(g, S.spline({ { X(-9), y + 8 }, { X(-10), y + 16 }, { X(-4), y + 21 } }), function(t) return 3.2 - t * 1 end, "embryo", 54) -- shin
      S.tube(g, S.spline({ { X(2), y - 2 }, { X(-5), y + 1 }, { X(-10), y - 5 } }), function(t) return 2.6 - t * 0.8 end, "embryo", 56) -- arm
    end
    S.shade(g, b, function(px)
      if px.m == "far" then
        if px.edge then return ab[1] end
        return S.pick({ ab[1], ab[2], ab[3], ab[4] }, 0.2 + S.lambert(px, KEY[1], KEY[2], KEY[3]) * 0.5, px.x, px.y, 0.5)
      end
      if px.m == "embryo" then -- pale, lit through the sac, a purple rim
        if px.edge then return pu[1] end
        if px.nz < 0.35 then return pu[2] end
        return S.pick({ ab[4], ab[5], bn[3], bn[4] }, 0.2 + S.lambert(px, KEY[1], KEY[2], KEY[3]) * 0.8, px.x, px.y, 0.5)
      end
      local core = math.max(0, 1 - math.sqrt((px.x - HX - 2) ^ 2 + (px.y - HY - 4) ^ 2) / 20)
      local v = 0.05 + S.lambert(px, KEY[1], KEY[2], KEY[3]) * 0.7 + px.nz * 0.15 + core * 0.3
      if px.m == "vessel" then v = v - 0.1 - smooth(20, -10, px.y) * 0.35 end
      if px.edge then return P.void end
      if px.m == "heart" and px.nz < 0.4 and (px.nx > 0.25 or px.ny > 0.5) then return (px.nz < 0.22) and mg[3] or mg[2] end
      if px.m == "heart" and S.lambert(px, -0.4, -0.55, 0.73) > 0.992 then return mg[4] end
      return S.pick({ ab[1], he[1], he[2], he[3], mg[2] }, v, px.x, px.y, 0.45)
    end, 4)
    local function lit(x, y) local m = g.m[S.index(g, x, y)]; return m ~= nil and m ~= "far" end
    halo(b, HX, HY, 80, 2.0, 3, true, lit)
    local function vein(x, y, a, len, depth, seed) -- coronary veins of light branching down the heart
      for s = 0, len do
        if g.m[S.index(g, x, y)] ~= "heart" then return end
        S.wset(b, x, y, (s < 3 and depth == 0) and mg[4] or ((depth < 2) and mg[3] or mg[2]))
        if depth < 2 and s % 7 == 6 then vein(x, y, a + ((s % 14 == 6) and 0.7 or -0.7), len * 0.5, depth + 1, seed + s) end
        a = a + (L.rnd(seed, s, 305) - 0.5) * 0.6
        x, y = x + math.cos(a), y + math.sin(a)
      end
    end
    vein(HX - 2, HY - 12, 1.95, 46, 0, 1)
    vein(HX - 14, HY - 6, 2.1, 30, 0, 2)
    vein(HX + 10, HY - 12, 1.7, 34, 0, 3)
    vein(HX + 18, HY - 4, 1.9, 20, 1, 4)
    for _, s in ipairs(SACS) do -- the sacs: a thin glowing membrane round each embryo
      local x, y, d = s[1], s[2], s[3]
      for k = -2, 2 do S.wset(b, x + (-9 + k) * d, y - 13 + math.abs(k) * 0.4, ab[1]) end -- the closed eye
      local cord = S.spline({ { x + d * -1, y + 10 }, { x - d * 14, y + 24 }, { x - d * 24, y + 16 }, { x - d * 30, y + 26 } })
      for i = 0, 80 do local cx, cy = cord(i / 80); S.wset(b, cx, cy, (i % 9 < 5) and mg[2] or mg[1]) end
      halo(b, x, y, 58, 1.2, 2, true, lit)
      for a = 0, 359, 0.5 do
        local r = math.rad(a)
        local sx, sy = x + math.cos(r) * 34, y + 2 + math.sin(r) * 40
        S.wset(b, sx, sy, (a % 40 < 20) and pu[2] or pu[3])
        if a % 3 < 1.5 then S.wset(b, x + math.cos(r) * 32, y + 2 + math.sin(r) * 38, pu[1]) end
      end
      for k = 0, 6 do -- veins on the sac
        local a0 = math.rad(k * 51 + 10)
        for r = 20, 34 do S.wset(b, x + math.cos(a0 + r * 0.02) * r, y + 2 + math.sin(a0 + r * 0.02) * r * 1.15, mg[1]) end
      end
    end
    -- jellies: a domed bell with a frilled rim and long faint threads
    local jellies = { { 292, 36, 7 }, { 492, 24, 6 }, { 532, 82, 5 }, { 262, 104, 4 }, { 338, 80, 3.5 },
      { 60, 30, 6 }, { 110, 110, 4 }, { 222, 50, 3.5 }, { 700, 34, 6 }, { 750, 100, 4 }, { 590, 120, 3.5 } }
    for i, j in ipairs(jellies) do
      local jx, jy, r = j[1], j[2], j[3]
      halo(b, jx, jy, r * 3, 0.8, 1, true)
      for k = -2, 2 do
        local len = math.floor(r * (3 + (2 - math.abs(k)) * 1.2))
        for s = 1, len do
          local x = jx + k * r * 0.35 + math.sin(s * 0.35 + i + k) * (1 + s * 0.06)
          if s < len * 0.7 or (s % 2 == 0) then S.wset(b, x, jy + s, (s < 3) and pu[2] or ((s < len * 0.5) and pu[1] or ab[4])) end
        end
      end
      for y = math.floor(jy - r), jy do
        for x = math.floor(jx - r), math.ceil(jx + r) do
          local u, v = (x + 0.5 - jx) / r, (y + 0.5 - jy) / (r * 0.9)
          local q = u * u + v * v
          if q <= 1 then
            local c = (q > 0.7) and pu[2] or ((q < 0.25 and v < -0.3) and pu[3] or ab[5])
            if y == jy then c = ((x + i) % 2 == 0) and pu[3] or pu[2] end
            S.wset(b, x, y, c)
          end
        end
      end
    end
    for i = 0, 180 do -- spores hanging in the water
      local x, y = L.rnd(i, 1, 302) * FW, L.rnd(i, 2, 302) * 150
      S.wset(b, x, y, (i % 5 == 0) and gr[2] or ((i % 3 == 0) and pu[1] or ab[4]))
      if i % 11 == 0 then halo(b, x, y, 4, 0.8, 1, true) end
    end
    for _, e in ipairs({ { 270, 60 }, { 344, 112 }, { 454, 106 }, { 540, 50 }, { 488, 128 }, { 310, 130 },
      { 40, 80 }, { 200, 120 }, { 600, 90 }, { 730, 130 }, { 120, 60 } }) do -- small pale eyes, watching
      S.wset(b, e[1], e[2], gr[3]); S.wset(b, e[1] + 3, e[2], gr[3])
      S.wset(b, e[1], e[2] - 1, ab[3]); S.wset(b, e[1] + 3, e[2] - 1, ab[3])
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- fog: violet murk low down, with the odd bright mote. Seamless.

  local function fog()
    local b = L.buffer(G.FOG_W, H)
    local k = 2 * math.pi / G.FOG_W
    for y = 80, H - 1 do
      for x = 0, G.FOG_W - 1 do
        local band = math.sin(y * 0.1 + math.sin(x * k * 2 + y * 0.04) * 2) * 0.5 + 0.5
        local depth = (y - 80) / (H - 80)
        local a = depth * 0.4 + band * 0.3 * depth
        if a > L.bayer(x, y) * 0.9 + 0.1 then b[y][x] = (a > 0.5) and (ab[5] .. "50") or (pu[1] .. "38") end
      end
    end
    for i = 0, 40 do
      local x, y = math.floor(L.rnd(i, 1, 303) * G.FOG_W), 60 + math.floor(L.rnd(i, 2, 303) * 110)
      b[y][x] = ((i % 4 == 0) and gr[3] or pu[3]) .. "c0"
    end
    return b
  end

  -------------------------------------------------------------------------------------------------
  -- solids: black chitin. An oily sheen along every top, then overlapping scales like an insect's
  -- armour, a few split by a glowing magenta seam; undersides and walls keep a thin violet edge.

  local function scaleAt(x, u)
    local r0 = math.floor(u / 6)
    for r = r0 - 1, r0 + 1 do -- upper rows lie over lower ones
      local off = (r % 2) * 7
      local k = math.floor((x - off) / 14 + 0.5)
      local dx, dy = (x + 0.5 - (k * 14 + off)) / 8.5, (u + 0.5 - r * 6 - 3) / 6.5
      local q = dx * dx + dy * dy
      if q <= 1 and r >= 0 then return r, k, q, dx, dy end
    end
  end

  local function paintSolids(b, grid, seed)
    local probe = G.probe(grid, 40)
    for y = 0, H - 1 do
      for x = 0, W - 1 do
        local up, down, side = probe(x, y)
        if up then
          local c
          if up == 0 then
            local h = math.sin(x * 0.09) + math.sin(x * 0.023 + 1)
            c = (h > 0.5) and gr[2] or ((h < -0.5) and pu[2] or bn[4])
          elseif up == 1 then c = bn[3]
          elseif down == 0 then c = pu[1]
          elseif side == 1 then c = bn[2]
          else
            local r, k, q, dx, dy = scaleAt(x, (up < 40) and (up - 2) or (y + 40)) -- deep inside: scales by y
            local depth = math.min(1, (math.min(up, down * 2 + 10) - 2) / 30)
            if not r then c = P.void
            else
              local v = 0.85 - q * 0.55 - depth * 0.45 - dx * 0.15
              if dy < -0.35 then v = v - 0.35 end
              c = S.pick({ P.void, ab[1], bn[1], bn[2], bn[3] }, v, x, y, 0.5)
              if q > 0.82 and dy > 0 then c = P.void end
              local hue = L.rnd(k, r, seed + 1)
              if q < 0.2 and dy > -0.35 and dy < 0.05 and dx < 0.1 and depth < 0.6 then
                c = (hue < 0.3) and gr[2] or ((hue < 0.6) and pu[2] or bn[3])
              end
              if L.rnd(k, r, seed) > 0.9 and depth < 0.7 and math.abs(dx) < 0.07 and q < 0.75 then
                c = (q < 0.25) and mg[3] or mg[2]
              end
            end
          end
          b[y][x] = c
        end
      end
    end
  end

  -- The dark below a pit: a shaft falling away into a magenta glow, pods on its walls, tendrils
  -- rising out of it.
  local function pits(b, grid, anchors)
    for _, p in ipairs(G.pits(grid)) do
      local x0, x1 = p[1], p[2]
      local wdt = x1 - x0 + 1
      for y = FLOOR, H - 1 do
        for x = x0, x1 do
          if not G.solid(grid, x, y) then
            local u = ((x + 0.5 - x0) / wdt) * 2 - 1
            local t = (y - FLOOR) / (H - FLOOR)
            local glow = smooth(0.35, 1, t) * (1 - u * u * 0.6)
            local c = S.pick({ P.void, ab[1], mg[1], mg[2] }, glow * 1.1 - (1 - math.abs(u)) * 0.05, x, y, 0.35)
            if t < 0.3 and math.abs(u) > 0.75 then c = ab[2] end
            b[y][x] = c
          end
        end
      end
      for k = 0, 3 do -- tendrils rising out of the glow, curling back down
        local x = x0 + 5 + k * (wdt - 10) / 3
        for s = 0, 22 do
          local yy = H - 1 - s
          L.set(b, x + math.sin(s * 0.3 + k) * 2, yy, (s > 18) and mg[3] or ab[3])
        end
      end
      L.set(b, x0 + 1, FLOOR + 3, gr[3]); L.set(b, x1 - 1, FLOOR + 6, gr[3]); L.set(b, x0 + 1, FLOOR + 9, gr[2])
      anchors.drips[#anchors.drips + 1] = { x0 + 2, FLOOR + 1, H }
    end
  end

  -------------------------------------------------------------------------------------------------
  -- architecture shared by the screens

  -- Claw ribs: { baseX, control {x, y}, tip {x, y}, depth 0..3 } for the left side, mirrored on the
  -- right. Thorned, knuckled, their tips hooked; veins of magenta light crawl along them.
  local function claws(g, list, both)
    local out = {}
    for side = -1, 1, 2 do
      if side < 0 or both then
        for _, r in ipairs(list) do
          local i = r[4]
          local X = function(x) return (side < 0) and x or (W - x) end
          local curve = S.bezier({ X(r[1]), 154 }, { X(r[2][1]), r[2][2] }, { X(r[3][1]), r[3][2] })
          local mat = "rib" .. i
          local rr = 6 - i * 0.6
          S.tube(g, curve, function(t) return rr * (1 - t * 0.75) end, mat, 50 - i * 8)
          for k = 1, 4 do
            local x, y = curve(0.12 + k * 0.17)
            S.ball(g, x, y, rr * (1 - (0.12 + k * 0.17) * 0.75) + 0.8, mat, 50.5 - i * 8)
          end
          for k = 0, 6 do -- barbs along the outer edge, raked back toward the root
            local t = 0.2 + k * 0.11
            local x, y = curve(t)
            local qx, qy = curve(t + 0.01)
            local tx, ty = qx - x, qy - y
            local tl = math.sqrt(tx * tx + ty * ty)
            local nx, ny = ty / tl * side, -tx / tl * side
            if ny > 0.4 then nx, ny = -nx, -ny end
            local rt = rr * (1 - t * 0.75)
            local len = 3 + rt * 0.8
            local bx, by = x + nx * rt * 0.8, y + ny * rt * 0.8
            S.tube(g, S.bezier({ bx, by }, { bx + nx * len * 0.6, by + ny * len * 0.6 }, { bx + nx * len - tx / tl * 2, by + ny * len - ty / tl * 2 }),
              function(u) return 1.3 * (1 - u) + 0.3 end, mat, 49 - i * 8)
          end
          local ex, ey = curve(1)
          S.tube(g, S.bezier({ ex, ey }, { ex - side * 4, ey + 1 }, { ex - side * 5, ey + 6 }),
            function(u) return 1.2 * (1 - u) + 0.3 end, mat, 50 - i * 8)
          out[#out + 1] = { curve = curve, i = i, mat = mat, r = rr }
        end
      end
    end
    return out
  end

  local DIMS = { [0] = 0, [1] = 0.1, [2] = 0.2, [3] = 0.3 }
  local function shadeScene(g, b, light, extra)
    S.shade(g, b, function(px)
      if extra then
        local c = extra(px)
        if c then return c end
      end
      local i = tonumber(px.m:sub(4)) or 0
      local lam = S.lambert(px, KEY[1], KEY[2], KEY[3])
      local hx, hy = light.x - px.x, light.y - px.y
      local hl = math.sqrt(hx * hx + hy * hy) + 0.001
      local rim = (px.nx * hx + px.ny * hy) / hl * (1 - px.nz)
      local v = 0.08 + lam * 0.95 - (DIMS[i] or 0) - smooth(100, 154, px.y) * 0.35
      if px.edge and v < 0.5 then return P.void end
      if rim > 0.5 and px.y < 120 then return (rim > 0.7 and i < 2) and mg[3] or mg[2] end
      return sheen(px, v) or S.pick({ ab[1], bn[1], bn[2], bn[3], bn[4] }, v, px.x, px.y, 0.45)
    end, 3)
  end

  local function ribVeins(b, g, anchors, ribs)
    for k, r in ipairs(ribs) do
      local ph = L.rnd(k, 1, 304) * 6.28
      for s = 0, 260 do
        local t = 0.08 + s / 260 * 0.84
        local x, y = r.curve(t)
        local qx, qy = r.curve(math.min(1, t + 0.01))
        local tx, ty = qx - x, qy - y
        local tl = math.sqrt(tx * tx + ty * ty) + 0.0001
        local off = math.sin(t * 26 + ph) * r.r * (1 - t * 0.75) * 0.55
        local vx, vy = x - ty / tl * off, y + tx / tl * off
        local i = S.index(g, vx, vy)
        if i and g.m[i] == r.mat and vy < 132 and r.i < 3 and math.sin(t * 9 + ph * 2) >= -0.35 then
          L.set(b, vx, vy, (s % 37 == 0) and mg[4] or ((r.i < 2) and mg[3] or mg[2]))
          if s % 37 == 0 then anchors.vessels[#anchors.vessels + 1] = { math.floor(vx), math.floor(vy) } end
        end
      end
    end
  end

  -- Lures dangling on threads, their tips glowing: { x, top, length }. The game drips from them.
  local function lures(b, anchors, list)
    for i, l in ipairs(list) do
      local x0, y0, len = l[1], l[2], l[3]
      for y = y0, y0 + len do
        local sx = x0 + math.floor(math.sin(y * 0.12 + i) * 1.5)
        if not L.get(b, sx, y) or y > y0 + 4 then L.set(b, sx, y, (y % 6 == 0) and pu[1] or ab[4]) end
        if y == y0 + len then
          L.disc(b, sx + 0.5, y + 2, 2.2, (i % 2 == 0) and mg[3] or gr[3])
          L.set(b, sx, y + 2, (i % 2 == 0) and mg[4] or gr[4])
          anchors.drips[#anchors.drips + 1] = { sx, y + 5, l[4] or FLOOR }
        end
      end
    end
  end

  -- Spore pods: { x, y, r, stalkEndY? }, bulbs lit from inside with a faint halo.
  local function pods(b, list)
    for _, p in ipairs(list) do
      local x, y, r = p[1], p[2], p[3]
      for yy = math.floor(y - r - 3), math.ceil(y + r + 3) do
        for xx = math.floor(x - r - 3), math.ceil(x + r + 3) do
          local d = math.sqrt((xx + 0.5 - x) ^ 2 + (yy + 0.5 - y) ^ 2)
          if d > r and d < r + 3 and not L.get(b, xx, yy) and L.bayer(xx, yy) < 0.28 * (1 - (d - r) / 3) + 0.08 then
            L.set(b, xx, yy, gr[1])
          end
        end
      end
    end
    for _, p in ipairs(list) do
      local x, y, r = p[1], p[2], p[3]
      if p[4] then
        for yy = math.min(p[4], math.floor(y)), math.max(p[4], math.floor(y)) do
          L.set(b, x + math.floor(math.sin(yy * 0.5) * 0.6), yy, gr[1])
        end
      end
      for yy = math.floor(y - r), math.ceil(y + r) do
        for xx = math.floor(x - r), math.ceil(x + r) do
          local u, v = (xx + 0.5 - x) / r, (yy + 0.5 - y) / r
          local q = u * u + v * v
          if q <= 1 then
            local c = gr[2]
            if q > 0.72 then c = gr[1] elseif q < 0.25 then c = gr[4] elseif q < 0.5 then c = gr[3] end
            if u > 0.2 and v > 0.2 and q > 0.45 then c = gr[1] end
            L.set(b, xx, yy, c)
          end
        end
      end
    end
  end

  -------------------------------------------------------------------------------------------------
  -- screens

  local C_CLAWS = { { 12, { -12, 2 }, { 112, 10 }, 0 }, { 38, { 12, 22 }, { 116, 34 }, 1 },
    { 64, { 38, 48 }, { 114, 56 }, 2 }, { 88, { 66, 72 }, { 108, 78 }, 3 } }
  local CORNER_PODS = {
    { 6, 140, 4.5 }, { 13, 144, 3.2 }, { 4, 131, 3 }, { 20, 147, 2.4 }, { 11, 136, 2.2 },
    { 314, 139, 4.5 }, { 306, 144, 3.4 }, { 316, 129, 2.8 }, { 299, 147, 2.4 }, { 309, 133, 2 },
  }

  -- C: an oily ribcage splayed open around the heart; pods at its roots, lures on threads.
  local function sceneC(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local ribs = claws(g, C_CLAWS, true)
    shadeScene(g, b, glowOn("C"))
    ribVeins(b, g, anchors, ribs)
    lures(b, anchors, { { 60, 18, 30 }, { 92, 26, 42 }, { 110, 60, 14 }, { 212, 58, 18 }, { 230, 26, 46 }, { 262, 18, 26 } })
    local list = { { 34, 30, 3.4, 16 }, { 41, 35, 2.4, 20 }, { 28, 36, 2.2, 22 }, { 286, 30, 3.4, 16 }, { 280, 36, 2.4, 20 }, { 292, 37, 2, 22 } }
    for _, p in ipairs(CORNER_PODS) do list[#list + 1] = p end
    pods(b, list)
    paintSolids(b, grid, 71)
    return b, anchors
  end

  -- B1: the tunnel runs under a chitin slab whose underside is studded with glowing pods; outside,
  -- claws from both sides; past the exit, a shaft dropping into a magenta glow.
  local function sceneB1(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local ribs = claws(g, { { 12, { -10, 20 }, { 54, 16 }, 0 }, { 36, { 16, 60 }, { 56, 56 }, 2 } }, true)
    shadeScene(g, b, glowOn("B1"))
    ribVeins(b, g, anchors, ribs)
    lures(b, anchors, { { 236, 24, 40, H }, { 268, 30, 60, H }, { 290, 20, 34 } })
    local list = { { 30, 40, 3.2, 20 }, { 36, 46, 2.2, 24 } }
    for _, p in ipairs(CORNER_PODS) do list[#list + 1] = p end
    pods(b, list)
    paintSolids(b, grid, 81)
    local studs = {}
    for k = 0, 9 do -- pods set into the slab's underside, lighting the tunnel
      local x = 70 + k * 16 + math.floor(L.rnd(k, 1, 307) * 6)
      studs[#studs + 1] = { x, 115 + math.floor(L.rnd(k, 2, 307) * 2), 2.2 + L.rnd(k, 3, 307) * 1.2 }
      anchors.drips[#anchors.drips + 1] = { x, 120, FLOOR }
    end
    pods(b, studs)
    for x = 61, 218 do b[119][x] = ((x // 6) % 3 == 0) and gr[2] or pu[1] end
    pits(b, grid, anchors)
    return b, anchors
  end

  -- B2: a shaft to leap, a great ridged shell to stand on, a chitin spine to climb.
  local function sceneB2(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local ribs = claws(g, { { 12, { -12, 2 }, { 100, 10 }, 0 }, { 36, { 14, 40 }, { 60, 44 }, 2 },
      { 300, { 328, 10 }, { 232, 18 }, 0 } }, false)
    shadeScene(g, b, glowOn("B2"))
    ribVeins(b, g, anchors, ribs)
    lures(b, anchors, { { 80, 24, 50, H }, { 98, 16, 64, H }, { 178, 20, 30, 130 }, { 240, 22, 28 } })
    local list = { { 34, 30, 3.4, 16 }, { 41, 35, 2.4, 20 } }
    for _, p in ipairs(CORNER_PODS) do list[#list + 1] = p end
    pods(b, list)
    paintSolids(b, grid, 91)
    for y = 130, 149 do -- the shell: radial ridges fanning from its hinge, an oily lip on top
      for x = 150, 209 do
        local a = math.atan(y - 152, x - 179.5)
        local ridge = math.abs(math.sin(a * 9))
        local c = S.pick({ ab[1], bn[1], bn[2], bn[3] }, 0.25 + ridge * 0.5 - (y - 130) * 0.02, x, y, 0.5)
        if y == 130 then c = ((x // 7) % 2 == 0) and gr[2] or pu[2] end
        if y == 131 then c = bn[4] end
        if x == 150 or x == 209 then c = P.void end
        b[y][x] = c
      end
    end
    for y = 110, 149 do -- the spine: chitin segments on glowing joints, a flat cap
      for x = 250, 269 do
        local band = (y - 110) % 8
        local u = (x - 250) / 19
        local c = S.pick({ P.void, ab[1], bn[1], bn[2], bn[3] }, 0.95 - u * 0.8 - band * 0.04, x, y, 0.5)
        if band == 7 then c = (x > 253 and x < 266) and mg[2] or P.void end
        if y == 110 then c = bn[4] elseif y == 111 then c = gr[2] end
        if x == 250 or x == 269 then c = (band == 7) and P.void or bn[1] end
        b[y][x] = c
      end
      if (y - 110) % 8 == 7 then anchors.vessels[#anchors.vessels + 1] = { 259, y } end
    end
    pits(b, grid, anchors)
    return b, anchors
  end

  -- V: a ring of claws closing overhead like jaws; in the floor, a sealed star of glowing seams.
  local function sceneV(grid)
    local b = L.buffer(W, H)
    local anchors = { vessels = {}, drips = {} }
    local g = S.new(W, H, false)
    local ribs = claws(g, { { 10, { -30, -10 }, { 146, 8 }, 0 }, { 36, { 0, 20 }, { 136, 26 }, 1 },
      { 62, { 30, 50 }, { 128, 46 }, 2 }, { 86, { 60, 80 }, { 118, 70 }, 3 } }, true)
    shadeScene(g, b, { x = 160, y = 30 })
    ribVeins(b, g, anchors, ribs)
    lures(b, anchors, { { 150, 10, 30 }, { 170, 12, 24 }, { 120, 40, 20 }, { 200, 40, 22 } })
    local list = { { 150, 30, 3, 10 }, { 170, 28, 2.6, 10 } }
    for _, p in ipairs(CORNER_PODS) do list[#list + 1] = p end
    pods(b, list)
    paintSolids(b, grid, 101)
    for k = 0, 11 do -- the sealed star: seams radiating from the centre of the floor, glowing
      local a = math.rad(k * 15 + 7)
      for r = 0, 44 do
        local x = 160 + math.cos(a) * r * ((k % 2 == 0) and 1 or 0.8)
        local y = FLOOR + 2 + math.abs(math.sin(a)) * r * 0.28
        if y < H then L.set(b, x, y, (r < 10) and mg[4] or ((r < 26) and mg[3] or mg[1])) end
      end
    end
    for x = 150, 170 do L.set(b, x, FLOOR, (x % 2 == 0) and mg[3] or bn[4]) end
    for k = 0, 7 do anchors.vessels[#anchors.vessels + 1] = { 132 + k * 8, FLOOR + 3 } end
    return b, anchors
  end

  -------------------------------------------------------------------------------------------------

  return {
    far = far,
    fog = fog,
    scenes = { C = sceneC, B1 = sceneB1, B2 = sceneB2, V = sceneV },
    colors = {
      vessel = { mg[2], mg[4] }, drip = mg[3], spore = gr[3], sporeAlpha = 0.45,
      hud = { text = bn[4], dim = bn[3], mark = ab[4], markEnd = mg[2], markHere = bn[5] },
      clear = P.void,
    },
    -- the Maw in this world: black chitin with an oily sheen, lilac teeth, a glowing magenta throat
    maw = {
      skin = { P.void, ab[1], ab[2], bn[1], bn[2], bn[3], pu[2] }, ring = { P.void, ab[1], ab[2], pu[1] },
      teeth = { bn[2], bn[3], bn[4], bn[5] }, gullet = { mg[2], mg[3], mg[4] }, rim = mg[3],
      lip = { pu[1], pu[2] }, outline = P.void, crust = { bn[3], bn[4], gr[2] },
    },
  }
end
