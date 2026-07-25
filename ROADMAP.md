# ROADMAP.md — Wanderpark

Few phases, each **big and meaningful** (owner's requirement): every phase ends with the game visibly, playably better. Boxes get ticked in the same commit as the work. Acceptance criteria are the phase's definition of done — demonstrable in the running game, not just merged.

**Status legend:** 🟢 done · 🟡 in progress · ⚪ not started

| Phase | Name | Status |
|---|---|---|
| 0 | Planning | 🟢 complete (this document set) |
| 1 | Foundation — *"The Architect"* | 🟡 code complete — remaining: Vercel deploy (owner) + real-GPU perf pass |
| 2 | The Living Park | 🟡 code complete — remaining: real-GPU perf pass, break-even tuning (Phase 5), hallway test |
| 3 | Coasters & Chaos | ⚪ |
| 4 | Progression & Polish | ⚪ |
| 5 | Release 1.0 | ⚪ |
| 6 | Beyond 1.0 — Leaderboard *(very last, per owner)* | ⚪ |

---

## Phase 1 — Foundation *("The Architect")*

**Goal:** a deployed, polished app shell around an empty-but-buildable 3D park. Everything structural exists; the fantasy of *placing things in a beautiful world* already works.

**Scope**
- [x] Next.js scaffold (TS strict, pnpm, ESLint+sim-purity boundaries, Prettier, Vitest, Playwright, GitHub Actions CI) — *Vercel: import the repo, zero config needed (owner-side)*
- [x] Asset pipeline v1: manifest, gltf-transform build (dedup/prune/weld + baked transforms), content-hashed output, typed ids, 40 MB budget gate, auto-credits data (47 models + 3 skies = 3.5 MB)
- [x] Design-system kit: tokens, HeroHeader, TabStrip, CategoryCard, Panel, Button, Slider, Toggle, Badge, StatBlock, Toast, Modal (*rich Tooltip component lands with the Phase-2 panels; native titles for now*)
- [x] Screens: Boot → Title → Profile-create → Hub (Continue/My Parks/New Park configurator/Settings/Credits) → Loading → Game; pause veil (pauses sim); settings persist + apply live
- [x] 3D world: 128×128 grid, owned-land shader + perimeter fence + entrance arch, procedural-dome day/night cycle (doc'd deviation), sun shadows, camera rig (WASD/drag pan, Q/E 45° snaps, zoom-to-cursor), perf overlay (F3)
- [x] Sim skeleton: fixed-timestep loop (catch-up capped), seeded RNG streams, command dispatch + patch-based undo/redo (20), entity pools, tile bitfields, path graph + reachability
- [x] Build system v1: path & queue auto-tiling brushes (drag strokes, live cost), scenery placement (30 defs), 4 stalls with path-adjacency rule, model ghosts w/ reason feedback, rotate, bulldoze click+drag w/ refunds + grace, move tool, build dock + trays (locked future categories visible)
- [x] Save system v1: zod schema + versioning + migration chain + fixtures, IndexedDB slots, autosave (per park day + tab-hide + exit), export/import `.wanderpark.json` + drag-drop, round-trip tests
- [x] Instanced rendering for paths/scenery (17 draw calls for a built scene) + instance raycast picking (doc'd deviation) + selection highlight + inspector

**Out of scope:** guests, money-earning, ride operation.
**Acceptance criteria**
1. ✅ Fresh visitor: title → create profile → park → build paths/scenery/stall with ghosts, undo, refunds → save → reload → identical park — **Playwright-verified in CI** (`e2e/smoke.spec.ts`).
2. 🟡 Deployed on Vercel (**owner action: import repo**); title LCP ≤ 1.5 s (DOM-only title ✓, measure on deploy); `/play` JS ≤ 1.2 MB gzip (route shell 104 kB + async three chunk — verify on deploy); 60 fps @ 5,000 pieces (**needs a real-GPU pass** — headless SwiftShader can't measure this; stress fixture scheduled with Phase 2's perf gate).
3. ✅ All UI built from kit primitives + tokens; sim determinism enforced by lint boundaries + unit suite (26 tests + 2 e2e green).
4. ✅ Docs updated in-step (picking, render-sync and sky deviations recorded in `TECHNICAL_ARCHITECTURE.md §8` / `ASSET_GUIDE.md §4`).

---

## Phase 2 — The Living Park

**Goal:** the park breathes and pays. Guests arrive, judge, spend; the player manages prices, watches trends, and hits the first "one more minute" hooks.

**Scope**
- [x] Guest sim: spawning (rating/entry-value/day-curve), thrill & patience profiles, needs/mood engine (per-sim-hour decay), A* movement on the path graph, full FSM (approach/pay/stroll/travel/queue/ride/buy/leave), 500-guest pool
- [x] Instanced crowd rendering (4 character models, procedural limb swing + bob, tick interpolation) + emote bubbles (11 sprites) + guest inspector (needs bars, wallet, thoughts, follow-cam)
- [x] Flat rides operational — all 6 Phase-2 machines animated (Carousel, Ferris, Teacups, Drop, Bumper, Swing): queue-chain → board (fare) → cycle → exit; pricing slider, open/close, ride inspector
- [x] Stalls operational (food ×2 / drink ×2 / souvenir / info / toilets): item pricing with rip-off verdicts, cost-of-goods, need restoration (*first-aid arrives with the fuller nausea model in Phase 3*)
- [x] Economy v1: entry ticket slider, income/expense ledger with 14-day history, day rollovers + upkeep, Finances panel (*trend charts arrive with Phase 4 polish*)
- [x] Park rating v1 (5 terms + weakest-term hints panel) · milestone tiers with awards + fanfares · notifications via the toast rail · objective chip with live progress
- [x] Time controls (Phase 1) + day/night guest curves + closing-time flush
- [x] HUD per `UI_UX_DESIGN.md §7`: guests/rating chips, cash pulse + coin clinks, park panel dock (*flying-coin particles land with the Phase-4 juice pass*)
- [x] Litter: guests drop after snacks, bins prevent within radius, instanced rendering, overnight decay keeps it bounded until janitors (Phase 3)
- [x] Audio v1: procedural WebAudio taps/thunks/clinks/boings/fanfares + crowd-walla bed scaled by guest density (sourced CC0 packs arrive Phase 4)
- [x] Sim soak (3-day invariants) + determinism hash across guest systems + save-v2 migration fixture

**Acceptance criteria**
1. 🟡 A park sustains 100+ concurrent guests with legible needs-driven behavior — **verified in-browser** (112 guests, queue bails, lunch-rush stall sales); the 300+ @ 60 fps check needs the real-GPU pass (headless SwiftShader can't measure it).
2. ✅ Pricing matters: entry-value elasticity gates spawns, over-priced items trigger refusals + "rip-off" thoughts + value-term decay (unit-tested + observed).
3. 🟡 Break-even arc tuning to the day-8–12 band is Phase-5 balancing work; the soak currently asserts sanity envelopes only.
4. ⚪ Hallway test (reach rating 300 unaided) — owner-side once deployed.

---

## Phase 3 — Coasters & Chaos

**Goal:** the flagship creative tool + the full management fantasy: risk, debt, staff, research. This is the phase that makes it *a tycoon game*.

**Scope**
- [ ] Coaster builder: 5 track families, piece-by-piece placement with sockets/constraints, auto-supports, circuit validation, train config, arc-length train motion, test-run with onboard/chase cam
- [ ] Coaster stats from geometry (excitement/intensity/nausea per `GAME_DESIGN.md §15.3`) + guest response to stats
- [ ] Remaining 6 flat rides + walk-through attractions (Mini-Golf, Go-Karts, Railroad, Swan Boats)
- [ ] Staff: mechanics/janitors/entertainers — hire/fire, wages, patrol zone painting, pathing, skill growth; litter/vomit cleanup loop closes
- [ ] Breakdowns & maintenance: reliability, inspections, comedic malfunction VFX, repair flow, renovate/aging
- [ ] Loans & debt: tranches, credit limit, interest accrual, warnings, repossession spiral → "park over" sheet with restart/rewind (`GAME_DESIGN.md §6.3`)
- [ ] Research: 4 branches × 6 nodes, funding tiers, unlock toasts; content gated accordingly
- [ ] Weather: sun/cloud/rain/storm/heatwave — spawn & need modifiers, umbrellas/cover behavior, forecast strip
- [ ] Events v1 (≥6): VIP visit, safety inspection, heatwave rush, litter-rat scare, influencer moment, coaster enthusiast club
- [ ] Marketing campaigns (4 types, hangover rule)
- [ ] Guest aggregate analytics panel (thought clouds, demographics)

**Acceptance criteria**
1. Build a 40+ piece flume coaster with a loop; test-run reports plausible stats; open it; guests queue by preference; onboard cam is smooth at 60 fps.
2. Neglect maintenance → breakdown cascade → rating slide → recover via mechanics + renovation: the full crisis loop is playable and *legible* (hints name the cause).
3. "Loan Ranger"-style pressure works: at 11% interest a mismanaged park goes bankrupt inside 30 game-days; a managed one escapes (soak-tested both ways).
4. Sim tick p95 ≤ 4 ms at 500 guests + 3 running coasters + 12 staff.

---

## Phase 4 — Progression & Polish

**Goal:** turn the systems sandbox into a *guided sandbox with a pull* — and make every minute feel Steam-release good.

**Scope**
- [ ] Opportunities engine: template pool (6 categories), state-driven generation, accept/decline/reroll, rewards, Goals panel + objective chip integration (`GAME_DESIGN.md §13`)
- [ ] Penny hint engine (state-driven, throttled, dismiss-forever topics)
- [ ] Guided Start: configurator toggle + Penny checklist flow + contextual first-time explainers + Park Manual codex
- [ ] New-park configurator final: name, map size S/M/L, cash/debt preset, difficulty, Guided Start & Freeplay-unlocks toggles
- [ ] Milestone tier sheets (stats roll-up celebration) + park-over "repossession" sheet
- [ ] Theming sets & zones: 6 sets ≥ 60 scenery pieces, zone detection/bonuses/banners/naming
- [ ] Achievements (~25) + hub badge grid + toasts
- [ ] Hub completion: Continue thumbnail card, Records tab, Credits from manifest
- [ ] Audio v2: music (menu + 3 in-park moods), full SFX pass, mixer settings
- [ ] Juice pass: every item in `GAME_DESIGN.md §16` (placement dust, demolish confetti, milestone fireworks, rating shimmer…)
- [ ] Photo mode (free cam, DOF, time slider, stickers, PNG export)
- [ ] Performance hardening: static batching for tracks/scenery clusters, LOD where needed, optional Web-Worker sim flag, memory pass
- [ ] Accessibility completion (`GAME_DESIGN.md §18`): colorblind palettes, remapping UI, UI scale, reduced motion/flash, dyslexia font

**Acceptance criteria**
1. New player completes the Guided Start unaided in ≤ 20 min and names, unprompted, what rating/needs/breakdowns mean (hallway test ×3).
2. Opportunities always offer something sensible for the current park state (audited across early/mid/late fixture parks); declining everything never blocks progress; rewards persist through save/load.
3. Stress park holds budgets with juice on; worker flag passes the determinism suite.
4. The game *sounds* alive: blindfold test — you can hear rating rise (crowd swell) and trouble (Penny uh-oh, springs).

---

## Phase 5 — Release 1.0

**Goal:** ship quality. Balance, difficulty, resilience, final QA — the "fully polished, ready to play" bar.

**Scope**
- [ ] Balancing campaign: soak-driven tuning of §15 tables across map sizes & difficulties (Relaxed/Classic/Tycoon) and both unlock modes
- [ ] Save resilience: corruption recovery UX, migration chain tests from every prior phase's fixtures, autosave rotation
- [ ] Full Playwright regression: onboarding, each panel, save/load/export/import, settings, milestone & park-over sheets
- [ ] Error-boundary + diagnostics-copy UX; graceful WebGL-lost recovery
- [ ] Final content/copy review (tone §14), credits, version stamp, favicon/OG/social card
- [ ] Performance final gate on reference hardware matrix (incl. integrated GPU + 1280×720)
- [ ] Public Vercel production deploy + smoke on production URL
- [ ] `CHANGELOG.md` 1.0.0 entry; docs synced to as-shipped reality

**Acceptance criteria (release checklist)**
1. Zero known crash/save-loss bugs; all CI suites green; budgets met on the hardware matrix.
2. Three cold-start hallway testers each: finish the Guided Start, reach rating 500, and describe the game as "polished" unprompted.
3. Every doc's spec matches the shipped game (audit pass).
4. **1.0.0 tagged and live on Vercel.**

---

## Phase 6 — Beyond 1.0 *(explicitly the very last step)*

**Leaderboard (owner requirement: after everything else):**
- [ ] Vercel Postgres + API routes per `TECHNICAL_ARCHITECTURE.md §15` (boards, friendly codes, submit/read, rate limits)
- [ ] Records tab → Leaderboard: create/join board by code, opt-in submission (name, value, rating, guests, medals, difficulty badge, checksum), around-me view, unverified-🌱 marking
- [ ] Privacy & abuse posture shipped as specified (no accounts, expiring boards)

**Backlog (unscheduled, ideas parking lot):** terraforming & water, coaster blueprints sharing, security staff + vandals, seasons/holiday events, MarbleKit water-slide theme pack, CubePets petting zoo, mod support via content packs, mobile layout, more Opportunity templates & authored challenge parks (only if ever requested — no campaign by owner decision), Steam wrapper (Tauri/Electron) evaluation.

---

## Release criteria summary (what "done" means for 1.0)

A new player, on a normal laptop, with no instructions: boots in seconds, is charmed by the title screen, builds a park that feels alive within 10 minutes, understands every system the game shows them, gets surprised by (and survives) their first crisis, plays "one more day" three times past their bedtime, and their save is still perfect next month. That — plus every checkbox above — is 1.0.
