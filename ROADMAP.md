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

**Scope** *(status: code complete 2026-07-26 — verified in-browser via scripted park + screenshots; deferred slices annotated)*
- [x] Coaster builder: grid-snapped piece placement (7 piece types), circuit validation, auto-supports, arc-length train motion, live ghost + home beacon + hotkeys, one-command undoable commit (*Phase 3 shipped Wild Mouse + Log Flume; Steel Streak, Sky Hanger and Park Monorail landed in Phase 4 on the same piece system, along with the onboard cam — train config remains Phase-5*)
- [x] Coaster stats from geometry (energy-model physics; excitement/intensity/nausea per `GAME_DESIGN.md §15.3` as-built) + guest thrill-matching response
- [ ] Remaining 6 flat rides + walk-through attractions (Mini-Golf, Go-Karts, Railroad, Swan Boats) — *moved to Phase 4 content pass; Phase 3 shipped the systems, not the catalog*
- [x] Staff: mechanics/janitors/entertainers — hire/fire tray, weekly wages, self-assigning jobs (nearest litter / broken rides / longest queue), pathing, skill growth; litter cleanup loop closes (*patrol-zone painting + overworked marker → Phase 4*)
- [x] Breakdowns & maintenance: reliability decay, smoke-puff malfunction VFX, queue-flush grumbles, mechanic repair, $250 contractor, renovate at 40% (*scheduled inspections + aging → Phase 5 balancing; the inspection EVENT fines shabby rides today*)
- [x] Loans & debt: $5k tranches at +1.5% APR, park-value credit limit, daily interest, miss penalties, 3-miss repossession auctions → "The bank owns the teacups now" park-over sheet (`GAME_DESIGN.md §6.3` as-built)
- [x] Research: 4 branches × 6 nodes, 3 funding tiers, unlock toasts, dock lock badges; content gated in progression parks, perks everywhere
- [x] Weather: sun/cloud/rain/storm/heatwave — spawn/thirst/leave modifiers, sky grading + rain particles, top-bar chip with forecast tooltip (*umbrella/cover behavior → Phase 4 juice*)
- [x] Events v1 (6): VIP visit, safety inspection, influencer moment, coaster enthusiast club, litter-rat scare, lost wallet — event chip + toasts
- [x] Marketing campaigns (4 types, one at a time, marketing-licence gate, under-delivery hangover rule)
- [x] Guest aggregate analytics: needs trends + "overheard in the park" thought tally (*demographics charts → Phase 4*)

**Acceptance criteria**
1. 🟡 Coaster loop verified in-browser: 15-piece Wild Mouse with lift, vertical loop and drop — built via the real builder UI (e2e) and the sim hook (screenshots); stats plausible (E4.9/I2.7/N1.6, 26 km/h, 20 s); guests queued and rode (36 riders day 1). The 40+ piece flume + onboard-cam slice lands with the cam in Phase 4.
2. ✅ Crisis loop playable & legible: breakdown → smoke + toast + queue grumbles → mechanic/contractor/renovate recovery; safety-inspection fines name the shabby rides (verified in-browser + unit-tested).
3. ✅ "Loan Ranger" pressure soak-tested both ways (`phase3.test.ts`): a mismanaged tycoon-difficulty park goes bankrupt inside 30 game-days; a managed one escapes with zero missed payments.
4. 🟡 Sim tick p95 ≤ 4 ms at 500 guests + 3 coasters + 12 staff — needs the real-GPU/profiling pass (headless SwiftShader can't measure it); revisit with Phase-4 performance hardening.

---

## Phase 4 — Progression & Polish

**Goal:** turn the systems sandbox into a *guided sandbox with a pull* — and make every minute feel Steam-release good.

**Scope** *(status: code complete 2026-07-26 — verified in-browser via scripted screenshots; deferred slices annotated)*
- [x] Opportunities engine: 12 templates across the 6 categories, parameters rolled from live park state, 2-active+1-offered cadence, accept/decline/reroll, quiet expiry, rewards (cash / research surge / free campaign / exclusive trophy scenery), Goals tab + objective-chip progress (`GAME_DESIGN.md §13`)
- [x] Penny hint engine: 10 state-driven throttled hints (3-game-day topic cooldown, dismiss-forever persisted per profile) + 4 one-time event explainers (first breakdown/storm/zone/opportunity); never interrupts building
- [x] Guided Start: configurator toggle (defaults ON for the first-ever park), Penny's 7-step predicate-driven checklist (no scripted mode — the park is real), skippable forever, auto-retires with a cheer; Park Manual codex (14 searchable articles, "?" in the top bar) (*glowing UI-target fly-tos → Phase 5 polish*)
- [x] New-park configurator final: name, map size S/M/L, difficulty presets, Guided Start & Freeplay toggles — complete since Phase 1, guided default fixed here
- [x] Milestone tier sheets (stats roll-up celebration, next-tier teaser) + park-over sheet (Phase 3)
- [x] Theming sets & zones: 6 themes / 75+ scenery pieces (38 new across pirate/space/castle/spooky/winter), union-find zone detection (8+ pieces near a ride), +0.5 excitement zone bonus, canvas-sprite world banners, click-to-rename with per-theme name suggestions
- [x] Achievements (25) with cheap tally-backed predicates + hub badge wall + unlock toasts; cross-save in the local profile
- [x] Hub completion: Continue card minimap thumbnail (drawn from save data), Records tab (cross-park bests + lifetime totals), Credits (manifest-driven since Phase 1)
- [x] Audio v2: procedural chip-orchestra music — menu + day/night/storm park moods with crossfades on a dedicated mixer channel (*documented deviation: zero-asset generative music instead of sourced CC0 packs*); pop/chime/whoosh SFX; walla on the SFX fader
- [x] Juice pass (`GAME_DESIGN.md §16`): pooled 320-particle instanced system — placement dust, demolish confetti, sale coin-pops, goal confetti, milestone firework barrages with crackle; rating tick-up shimmer; money-loss pulse + Penny portraits shipped earlier (*queue-heat hover glow + coin daily-ticker → Phase 5*)
- [x] Photo mode (P): HUD retreat, free camera, golden-hour light slider, PNG export; coaster **onboard cam** from the ride inspector (*DOF + stickers → Phase 5 wishlist — 60 fps first*)
- [ ] Performance hardening: instancing-first architecture is already in place (a full park renders in ~20 draw calls); static batching, LOD and the Web-Worker sim flag are **deferred to Phase 5** — the render layer currently reads sim state zero-copy each frame, so a worker needs a snapshot protocol first, and current profiles don't justify it
- [x] Accessibility completion (`GAME_DESIGN.md §18`): colorblind-safe status palette, dyslexia-friendlier font (Atkinson Hyperlegible), reduced-motion + reduced-flash, UI scale 90–140% — all applied globally, live; pause-anywhere + visual cues for audio were already in (*key remapping UI → Phase 5 release polish*)

**Acceptance criteria**
1. ⚪ Guided Start ≤ 20 min hallway test — owner-side once deployed; the checklist reacts live to real play (verified: steps tick as the world changes) and every explainer is one sentence.
2. ✅ Opportunities roll from current park state only (template eligibility + parameter fill audited by unit sweep across all 12 templates); declining/expiry is provably penalty-free (soak-asserted); accepted goals + rewards survive save round-trips.
3. 🟡 Juice holds budget by construction (one instanced mesh, 320-particle pool, zero GC per frame — +1 draw call); the worker-flag half is deferred to Phase 5 with the hardening slice.
4. 🟡 The park sounds alive — mood-reactive music (storm minor-key, night pads), walla scaling with crowd, event chimes; the blindfold judgment call is the owner's.

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
