-- The style test for the games page: the landscape stage in all four phases (dawn, day, dusk, night),
-- with the islands at rest and the Snake island's hover glow on the day panel, scaled 2x into
-- art/site/preview-style.png (not committed). Run after sky.lua and the island scripts:
--   aseprite -b --script art/site/style-test.lua
local here = debug.getinfo(1, "S").source:sub(2):match("^(.-)[^/]+$") or ""
local L = dofile(here .. "lib.lua")
local W, H = 384, 216
local PHASES = { "dawn", "day", "dusk", "night" }
-- These match STAGES.landscape in site/layout.js and the landscape spots in site/games.json.
local MOON, SUN, CLOUD_Y = { 336, 14 }, { 292, 160 }, { 8, 60, 150 }
local ISLANDS = { { "unfinished", 300, 118 }, { "snake", 14, 72 }, { "marrow", 180, 20 } }

local sky = L.readJson("site/assets/sky.json")
local clouds = L.load("site/assets/clouds.png")
local atlas = L.load("site/assets/sky.png")
local sheets = {}
for _, isl in ipairs(ISLANDS) do
  sheets[isl[1]] = { meta = L.readJson("site/assets/island-" .. isl[1] .. ".json"), image = L.load("site/assets/island-" .. isl[1] .. ".png") }
end

local out = L.buffer(W * 2, H * 2)
for i, phase in ipairs(PHASES) do
  local panel = L.load("site/assets/sky-" .. phase .. "-landscape.png")
  if phase == "night" then L.blit(panel, L.crop(atlas, table.unpack(sky.sprites.moon)), MOON[1], MOON[2]) end
  if phase == "dawn" then L.blit(panel, L.crop(atlas, table.unpack(sky.sprites.sun)), SUN[1], SUN[2]) end
  for layer = 0, sky.clouds.layers - 1 do
    local row = ((i - 1) * sky.clouds.layers + layer) * sky.clouds.h
    L.blit(panel, L.crop(clouds, 0, row, sky.clouds.w, sky.clouds.h), 0, CLOUD_Y[layer + 1])
  end
  for _, isl in ipairs(ISLANDS) do
    local s = sheets[isl[1]]
    if phase == "day" and isl[1] == "snake" then L.blit(panel, L.crop(s.image, 0, s.meta.h, s.meta.w, s.meta.h), isl[2], isl[3]) end
    L.blit(panel, L.crop(s.image, 0, 0, s.meta.w, s.meta.h), isl[2], isl[3])
  end
  L.blit(out, panel, ((i - 1) % 2) * W, ((i - 1) // 2) * H)
end
L.save(L.scale(out, 2), nil, "art/site/preview-style.png")
print("style test written: art/site/preview-style.png")
