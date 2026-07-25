# ASSET_GUIDE.md — Wanderpark

Owns: what's in `assets/`, licensing, how kits map to game content, import conventions, and sourcing rules for new assets. The machine-readable twin of this document is the pipeline manifest (`tools/asset-pipeline/manifest.source.ts`, Phase 1+).

---

## 1. Licensing status ✅

- **Kenney kits** (all `Kenney_*` folders): **CC0 1.0** (public domain, no attribution required — we credit anyway).
- **KayKit packs** (all `KayKit_*` folders): **CC0 1.0** per bundled `License.txt` (verified; e.g. `KayKit_Dungeon/License.txt`).
- Policy: **only CC0 or equivalently commercial-safe** assets may enter the repo (§7). Every shipped asset gets a manifest entry with `sourceKit` + `license`; the in-game **Credits screen is auto-generated** from that manifest (`TECHNICAL_ARCHITECTURE.md §11`), crediting Kenney (kenney.nl) and Kay Lousberg (kaylousberg.com) prominently.

Raw kits stay in `assets/` (git-tracked source material). **Nothing in `assets/` ships directly** — only optimized copies in `public/assets/` produced by the pipeline.

---

## 2. Inventory snapshot (models per kit, GLB/GLTF)

~4,000 web-ready models across 50 kits (≈203 MB raw). Counts:

| Kit | Models | Kit | Models |
|---|---|---|---|
| Kenney NatureKit | 329 | Kenney BuildingKit | 79 |
| KayKit Medieval Hexagon | 221 | Kenney CastleKit | 76 |
| Kenney FoodKit | 200 | Kenney PirateKit | 72 |
| KayKit Dungeon | 185 | Kenney CityKitRoads | 72 |
| **Kenney CoasterKit** | **183** | KayKit SpaceBase | 57 |
| Kenney MarbleKit | 162 | KayKit FurnitureBits | 53 |
| Kenney TDKit | 160 | KayKit RPGToolsBits | 49 |
| Kenney ToyCarKit | 157 | KayKit Spooktober | 48 |
| Kenney SpaceKit | 153 | Kenney WatercraftKit | 46 |
| Kenney PrototypeKit | 145 | Kenney CityKitCommercial | 41 |
| KayKit RestaurantBits | 144 | KayKit CityBits | 41 |
| Kenney FactoryKit | 143 | Kenney ModularSpaceKit | 40 |
| Kenney FurnitureKit | 140 | Kenney ModularCaveKit | 40 |
| Kenney MinigolfKit | 126 | Kenney CityKitSuburban | 40 |
| Kenney RacingKit | 112 | Kenney ModularDungeonKit | 39 |
| Kenney ModularBuildingsKit | 108 | KayKit FantasyWeaponsBits | 31 |
| Kenney TrainKit | 103 | Kenney CuteCharacters | 26 |
| Kenney HolidayKit | 99 | Kenney Minidungeon | 25 |
| Kenney GraveyardKit | 91 | Kenney CityKitIndustrial | 25 |
| Kenney SurvivalKit | 80 | Kenney CubePets | 24 |
| | | Kenney MiniForest / MiniArena | 22/22 |
| | | Kenney MiniSkateKit / MiniMarketKit | 20/20 |
| | | KayKit Skeletons | 19 |
| | | Kenney BlockyCharacters | 18 |

Non-model kits: **Kenney Skyboxes** (morning/day/night/space/alien panoramas), **Kenney EmotesPack** (emote sprites/sheets/vectors), **Kenney PatternPack** (SVG patterns → UI backgrounds), **Kenney PlatformKit** (misc).

---

## 3. The crown jewel: Kenney CoasterKit (183)

Everything a theme park needs to bootstrap:
- **Track families × full piece sets** (straight, curves S/L, slope begin/mid/end, bumps, skews, loops, caps): `coaster-*` (steel), `coaster-flume-*` (log flume/water), `coaster-hanging-*` (inverted), `coaster-monorail-*`, `coaster-mouse-*` (wild mouse) → the 5 tracked-ride families of `GAME_DESIGN.md §11.1`.
- **Trains:** `train-log-flume`, `train-monorail` (+ steel/mouse cars to source/compose, §7).
- **Park infrastructure:** `park-entrance`, path set (`path-straight/corner/crossing/split/exit/steps`), **queue set** (`queue-*`), `ride-entrance`/`ride-exit`, station pieces (`station`, `station-gate`, `station-fence`), support system (`support-*` small/large, skew, horizontal, rings).
- **Furniture:** `bench`, `trash`, `stall-food`, `stall-drinks`, `stall-information`, `stall-toilets`, `flowers`, `grass`, `tree`, `tree-large`.

---

## 4. Kit → game content mapping

| Game content (`GAME_DESIGN.md §11`) | Primary kits | Notes |
|---|---|---|
| Paths, queues, park entrance, stations, supports | CoasterKit | auto-tiling brush uses the 6 path/queue pieces |
| Tracked rides (5 families) | CoasterKit | piece catalogs + socket metadata authored in `content/` |
| Stalls & facilities | CoasterKit stalls + FoodKit + RestaurantBits + MiniMarketKit | FoodKit's 200 food props = counter displays, item icons, theming |
| Flat rides (12) | composed: GraveyardKit (Haunted Manor), SpaceKit (Star Simulator), MinigolfKit (Mini-Golf), RacingKit/ToyCarKit (Go-Karts), WatercraftKit (Swan Boats), TrainKit (Park Railroad) + **sourced CC0 hero models** for Carousel/Ferris/Drop Tower/Teacups/Swing Ship/Bumper Cars (§7) | composition = kit parts assembled into one prefab at pipeline time |
| Guests | BlockyCharacters (18) + CuteCharacters (12 + mobility aids) | crowd = instanced; aids included for inclusive guest gen (`GAME_DESIGN.md §14`) |
| Staff | BlockyCharacters recolors + prop (wrench/broom from RPGToolsBits/SurvivalKit) | tint slots via pipeline |
| Advisor Penny | CuteCharacters female + EmotesPack | |
| Scenery: Nature set | NatureKit (329) + MiniForest | trees, rocks, gardens, fences |
| Scenery: Pirate set | PirateKit + WatercraftKit | ships, palms, crates, cannons |
| Scenery: Space set | SpaceKit + ModularSpaceKit + KayKit SpaceBase | |
| Scenery: Castle set | CastleKit + KayKit Medieval Hexagon + Dungeon | |
| Scenery: Spooky set | GraveyardKit + KayKit Spooktober + Skeletons | |
| Scenery: Winter set | HolidayKit | |
| Plazas, lamps, urban furniture | CityKitRoads/Suburban/Commercial + FurnitureBits | lamps, hydrants, signs |
| Petting-zoo props / mascots (backlog) | CubePets | post-1.0 candy |
| Skyboxes (day/night cycle) | Kenney Skyboxes | morning/day/night crossfade |
| Emote bubbles | EmotesPack | billboarded sprites |
| UI patterns/rays/facets | PatternPack + generated SVG | `UI_UX_DESIGN.md §3.3` |
| Greybox/prototyping | PrototypeKit | dev-only, never ships |
| Unused-for-now | TDKit, MarbleKit, FactoryKit, MiniSkateKit, MiniArena, ModularCave/Dungeon kits, FantasyWeapons | future themes/events backlog (e.g. MarbleKit → water-slide theme pack) |

---

## 5. Known gaps → sourcing plan

| Gap | Plan |
|---|---|
| Carousel, Ferris Wheel, Drop Tower, Teacups, Swing Ship, Bumper Cars hero models | Source CC0 (Quaternius, Poly Pizza CC0 filter, Kenney future packs) or compose from kit parts; decision per ride at Phase 2 content authoring |
| Steel/mouse coaster **cars** | Compose (ToyCarKit chassis + custom seat block) or source CC0 |
| Water surface for Swan Boats/flume basins | Shader-based animated water tile (no model needed) |
| Fireworks/particles | GPU sprites, generated (no asset) |
| Audio (music + SFX) | Kenney Audio packs (CC0: UI, jingles, crowd), sourced at Phase 4; same licensing rules |
| Fonts | Big Shoulders Display, Inter, Atkinson Hyperlegible — SIL OFL via Google Fonts, self-hosted |

---

## 6. Import conventions (pipeline contract)

- **Scale:** kits are authored ~1 unit = 1 m; game tile = 2 m. Manifest `fitFootprint` override scales prefabs to their declared tile footprint; guests normalized to 1.75 m height.
- **Orientation:** +Z = "forward/entrance" after import; fix per-model in manifest `rotateY`, never at runtime.
- **Origin:** bottom-center on the footprint; manifest `originOffset` fixes off-center sources.
- **Materials:** kits are flat-colored/palette-textured — keep unlit-friendly, single shared palette texture where possible; per-instance tint slots declared in manifest (staff uniforms, ride recolors).
- **Naming:** shipped ids are `category/kebab-name` (`rides/carousel`, `track/flume/curve-small`, `scenery/pirate/palm-a`). Raw kit filenames never leak into code — the typed manifest is the boundary.
- **Budget:** ≤ 40 MB shipped total, meshopt-compressed; the pipeline fails the build over budget (`TECHNICAL_ARCHITECTURE.md §11–12`).

---

## 7. Sourcing rules for new assets (standing policy)

1. License must be **CC0** or explicitly commercial-safe-no-attribution-required (Kenney, KayKit free CC0 packs, Quaternius CC0, Poly Pizza CC0-filtered, ambientCG CC0 textures, Kenney Audio). When in doubt: don't.
2. Style gate: low-poly, flat/palette colors, matches kit proportions (test render next to CoasterKit pieces before committing).
3. Land the raw file in `assets/_sourced/<pack-name>/` with a `SOURCE.txt` (URL, author, license, date).
4. Register in the pipeline manifest with license fields (feeds auto-credits) **in the same commit**.
5. Update the mapping table (§4) if it fills a gap.
