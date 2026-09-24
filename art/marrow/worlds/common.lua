-- Shared by every world painter: the screen and map geometry, the collision-grid queries, and small
-- painting helpers.
--
-- Map geometry. The seven screens (screens.json "order": V-, B2-, B1-, C, B1+, B2+, V+) are indexed
-- 0..6; only the four "+" bases are painted, and the game mirrors them for the "-" screens. The far
-- layer scrolls at 1/4 of the camera, so across the whole map it shows 320 + 6 * 320 / 4 = 800 px: far.png
-- is one 800 px panorama with no repeats, and screen i shows its columns [80 i, 80 i + 320). Screen C's
-- centre is far column 400. (It still tiles, in case the camera ever runs further.) The fog scrolls at
-- 1/2 and also drifts with time, so fog.png is a seamless 320 px tile.
return function(L)
  local G = { W = 320, H = 180, TILE = 10, FAR_W = 800, FOG_W = 320, FLOOR = 150 }
  G.INDEX = { C = 3, B1 = 4, B2 = 5, V = 6 } -- each painted base's screen index (its "+" screen)
  G.BASES = { "C", "B1", "B2", "V" }

  -- Where screen `base` shows far.png and fog.png (fog at tick 0).
  function G.farLeft(base) return G.INDEX[base] * 80 end
  function G.fogLeft(base) return (G.INDEX[base] * 160) % G.FOG_W end

  -- Solid test in pixels. Rows past the top or bottom repeat the edge row and columns clamp, so floors
  -- and ceilings continue past the frame instead of showing an edge.
  function G.solid(grid, x, y)
    local c = math.max(0, math.min(31, math.floor(x / G.TILE)))
    local r = math.max(0, math.min(#grid - 1, math.floor(y / G.TILE)))
    return grid[r + 1]:sub(c + 1, c + 1) == "#"
  end

  -- Per-pixel distances inside the solids, capped at `cap`: up (solid pixels above before air), down,
  -- and side (to the nearest air left or right). Returned as a lookup function.
  function G.probe(grid, cap)
    cap = cap or 40
    local up, down, side = {}, {}, {}
    for y = 0, G.H - 1 do
      up[y], down[y], side[y] = {}, {}, {}
      for x = 0, G.W - 1 do
        if G.solid(grid, x, y) then
          local u = 0
          while u < cap and G.solid(grid, x, y - u - 1) do u = u + 1 end
          local d = 0
          while d < cap and G.solid(grid, x, y + d + 1) do d = d + 1 end
          local s = cap
          for k = 1, cap do
            if not G.solid(grid, x - k, y) or not G.solid(grid, x + k, y) then s = k; break end
          end
          up[y][x], down[y][x], side[y][x] = u, d, s
        end
      end
    end
    return function(x, y)
      if not up[y] or not up[y][x] then return nil end
      return up[y][x], down[y][x], side[y][x]
    end
  end

  -- The floor's gaps: { x0, x1 } column ranges where the floor row (y = 150) is open.
  function G.pits(grid)
    local list, x = {}, 0
    while x < G.W do
      if not G.solid(grid, x, G.FLOOR) then
        local x0 = x
        while x < G.W and not G.solid(grid, x, G.FLOOR) do x = x + 1 end
        list[#list + 1] = { x0, x - 1 }
      else
        x = x + 1
      end
    end
    return list
  end

  function G.smooth(a, b, x)
    local t = math.max(0, math.min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  end

  -- Chains of "one step lighter" colors: G.chains({ {a, b, c}, {d, e} }) -> { [a] = b, [b] = c, [d] = e }.
  function G.chains(lists)
    local map = {}
    for _, list in ipairs(lists) do
      for i = 1, #list - 1 do map[list[i]] = list[i + 1] end
    end
    return map
  end

  -- Steps a pixel along a map (lighten or darken), optionally wrapping x.
  function G.step(b, x, y, map, wrap)
    x, y = math.floor(x), math.floor(y)
    if wrap then x = x % b.w end
    local row = b[y]
    if row and row[x] and map[row[x]] then row[x] = map[row[x]] end
  end

  -- Only paints empty (transparent) pixels: for details that must stay behind what's already there.
  function G.under(b, x, y, c)
    if not L.get(b, x, y) then L.set(b, x, y, c) end
  end

  return G
end
