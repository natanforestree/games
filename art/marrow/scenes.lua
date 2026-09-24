-- Marrow's backgrounds for every world, painted procedurally. Run from the repo root:
--   aseprite -b --script art/marrow/scenes.lua                 (all worlds)
--   aseprite -b --script-param world=dusk --script art/marrow/scenes.lua   (just one)
-- For each world in palette.lua's worldOrder, worlds/<world>.lua paints and this writes, to
-- marrow/assets/<world>/ (with .aseprite sources in art/marrow/<world>/):
--   far.png          800x180 panorama behind the whole map (1/4 parallax; see worlds/common.lua)
--   fog.png          320x180 translucent tile (1/2 parallax, drifting)
--   scene-C.png, scene-B1.png, scene-B2.png, scene-V.png
--                    each base screen's architecture over its collision grid from
--                    marrow/data/screens.json; transparent where there's nothing, including the dark
--                    below a pit (it's part of the scene image)
--   scenes.json      { "C": { vessels, drips }, "B1": ..., "B2": ..., "V": ..., "colors": {...} }:
--                    anchors for the game's living details, and the world's effect and HUD colors
-- and marrow/assets/worlds.json: { "order": [ ...worldOrder ] }, the world for each ladder rung.
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local P = dofile(here .. "palette.lua")
local S = dofile(here .. "sculpt.lua")(L)
local G = dofile(here .. "worlds/common.lua")(L)
local grids = L.readJson("marrow/data/screens.json").screens
local only = app.params and app.params.world

L.writeText("marrow/assets/worlds.json", json.encode({ order = P.worldOrder }))
for _, name in ipairs(P.worldOrder) do
  if not only or only == name then
    local world = dofile(here .. "worlds/" .. name .. ".lua")({ L = L, S = S, G = G, P = P.worlds[name], PAL = P })
    local dir, src = "marrow/assets/" .. name .. "/", "art/marrow/" .. name .. "/"
    L.save(world.far(), src .. "far.aseprite", dir .. "far.png")
    L.save(world.fog(), src .. "fog.aseprite", dir .. "fog.png")
    local meta = { colors = world.colors }
    for _, base in ipairs(G.BASES) do
      local img, anchors = world.scenes[base](grids[base])
      L.save(img, src .. "scene-" .. base .. ".aseprite", dir .. "scene-" .. base .. ".png")
      meta[base] = anchors
    end
    L.writeText(dir .. "scenes.json", json.encode(meta))
    print("scenes written: " .. name)
  end
end
