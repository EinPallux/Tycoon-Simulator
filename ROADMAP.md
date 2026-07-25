# ROADMAP.md — Park Mogul

Few phases, each **big and meaningful** (owner's requirement): every phase ends with the game visibly, playably better. Boxes get ticked in the same commit as the work. Acceptance criteria are the phase's definition of done — demonstrable in the running game, not just merged.

**Status legend:** 🟢 done · 🟡 in progress · ⚪ not started

| Phase | Name | Status |
|---|---|---|
| 0 | Planning | 🟢 complete (this document set) |
| 1 | Foundation — *"The Architect"* | ⚪ awaiting "start coding" |
| 2 | The Living Park | ⚪ |
| 3 | Coasters & Chaos | ⚪ |
| 4 | Progression & Polish | ⚪ |
| 5 | Release 1.0 | ⚪ |
| 6 | Beyond 1.0 — Leaderboard *(very last, per owner)* | ⚪ |

---

## Phase 1 — Foundation *("The Architect")*

**Goal:** a deployed, polished app shell around an empty-but-buildable 3D park. Everything structural exists; the fantasy of *placing things in a beautiful world* already works.

**Scope**
- [ ] Next.js scaffold (TS strict, pnpm, ESLint+boundaries, Prettier, Vitest, Playwright, CI, Vercel deploy)
- [ ] Asset pipeline v1: manifest, gltf-transform/meshopt build, typed ids, budget gate, auto-credits data
- [ ] Design-system kit: tokens, HeroHeader, TabStrip, CategoryCard, Panel, Button, Slider, Toast, Tooltip, Modal (per `UI_UX_DESIGN.md §3–4`)
- [ ] Screens: Boot → Title → Profile-create → Hub (Continue/My Parks/New Park[sandbox only]/Settings/Credits) → Loading → Game; pause veil; settings persist (video/audio/controls/accessibility basics)
- [ ] 3D world: 128×128 grid, owned-land rendering + fence, CoasterKit park entrance, skybox day/night cycle, lighting, camera rig (pan/orbit/zoom/rotate-snap), perf overlay (F3)
- [ ] Sim skeleton: fixed-timestep loop, seeded RNG, command dispatch + undo/redo, entity pools, tile bitfields, path graph (no guests yet)
- [ ] Build system v1: path & queue auto-tiling brushes, scenery placement (≥30 nature/furniture pieces), stall placement (4 CoasterKit stalls as props), ghost validation, rotate, bulldoze+refund, move tool, build dock + category trays
- [ ] Save system v1: schema+versioning+migration harness, IndexedDB slots, autosave, export/import, save/load round-trip tests
- [ ] Instanced rendering for paths/scenery + GPU picking + selection outline

**Out of scope:** guests, money, ride operation.
**Acceptance criteria**
1. Fresh visitor: title → create profile → sandbox park → build paths/plazas/scenery/stalls with ghosts, undo, refunds → save → reload → identical park (Playwright-verified).
2. Deployed on Vercel; title LCP ≤ 1.5 s; `/play` JS ≤ 1.2 MB gzip; 60 fps with 5,000 placed pieces (stress fixture).
3. All UI built from kit primitives; zero ad-hoc styles; determinism hash test green in CI.
4. Docs updated (this file ticked, CHANGELOG, any spec deltas).

---

## Phase 2 — The Living Park

**Goal:** the park breathes and pays. Guests arrive, judge, spend; the player manages prices, watches trends, and hits the first "one more minute" hooks.

**Scope**
- [ ] Guest sim: spawning (rating/appeal-driven), preference profiles, needs/mood engine, A* movement on path graph, FSM (wander/goal/queue/ride/leave), 500-guest perf target
- [ ] Instanced crowd rendering + procedural walk/bob + emote bubbles + guest inspector (portrait, needs, thoughts, follow-cam)
- [ ] Flat rides operational (first 6 of 12): queue → board → animated cycle → exit; per-ride pricing, open/close; ride inspector panel
- [ ] Stalls operational (food/drink/toilets/first-aid/souvenir/info): item pricing, cost-of-goods, need satisfaction
- [ ] Economy v1: cash, entry ticket, income/expense ledger, daily/weekly rollups, Finances panel (P&L, sparklines)
- [ ] Park rating v1 (5 terms + hints panel) · milestones with fanfares · notification rail · objective chip
- [ ] Time controls (pause/1×/2×/3×), day/night guest curves, in-game date
- [ ] HUD complete per `UI_UX_DESIGN.md §7` (top bar live tickers, coin-pops, panels dock)
- [ ] Litter: guests drop, bins absorb, visual accumulation (cleanup arrives with janitors in Phase 3 — bins + despawn keep it bounded for now)
- [ ] Audio v1: UI taps, placement thunk, coin clink, ambient crowd walla scaled by guests
- [ ] Sim soak test + determinism hash extended to guest systems

**Acceptance criteria**
1. A sandbox park with 6 rides + 6 stalls sustains 300+ guests at 60 fps; needs/thought analytics visibly drive behavior (starve the park of drinks → thirst thoughts spike → drink stall queue forms).
2. Pricing matters: doubling entry visibly drops spawn rate; underpriced burgers sell out wallet share (elasticity per `GAME_DESIGN.md §15.5`).
3. Break-even arc on defaults lands in the day-8–12 target band (automated economy soak asserts envelope).
4. A first-time player can reach rating 300 without docs, using tooltips alone (hallway-test checklist).

---

## Phase 3 — Coasters & Chaos

**Goal:** the flagship creative tool + the full management fantasy: risk, debt, staff, research. This is the phase that makes it *a tycoon game*.

**Scope**
- [ ] Coaster builder: 5 track families, piece-by-piece placement with sockets/constraints, auto-supports, circuit validation, train config, arc-length train motion, test-run with onboard/chase cam
- [ ] Coaster stats from geometry (excitement/intensity/nausea per `GAME_DESIGN.md §15.3`) + guest response to stats
- [ ] Remaining 6 flat rides + walk-through attractions (Mini-Golf, Go-Karts, Railroad, Swan Boats)
- [ ] Staff: mechanics/janitors/entertainers — hire/fire, wages, patrol zone painting, pathing, skill growth; litter/vomit cleanup loop closes
- [ ] Breakdowns & maintenance: reliability, inspections, comedic malfunction VFX, repair flow, renovate/aging
- [ ] Loans & debt: tranches, credit limit, interest accrual, warnings, bankruptcy fail-state (scenario) / asset-auction (sandbox)
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

**Goal:** turn the systems sandbox into a *game with a career* — and make every minute feel Steam-release good.

**Scope**
- [ ] Scenario framework (start states, objectives bronze/silver/gold, twists, end sheet) + all 8 scenarios (`GAME_DESIGN.md §13`)
- [ ] Tutorial: scenario 1 with Penny checklist flow + contextual first-time explainers + Park Manual codex
- [ ] Theming sets & zones: 6 sets ≥ 60 scenery pieces, zone detection/bonuses/banners/naming
- [ ] Achievements (~25) + hub badge grid + toasts
- [ ] Hub completion: Continue thumbnail card, Records tab, scenario select with medals, Credits from manifest
- [ ] Audio v2: music (menu + 3 in-park moods), full SFX pass, mixer settings
- [ ] Juice pass: every item in `GAME_DESIGN.md §16` (placement dust, demolish confetti, milestone fireworks, rating shimmer…)
- [ ] Photo mode (free cam, DOF, time slider, stickers, PNG export)
- [ ] Performance hardening: static batching for tracks/scenery clusters, LOD where needed, optional Web-Worker sim flag, memory pass
- [ ] Accessibility completion (`GAME_DESIGN.md §18`): colorblind palettes, remapping UI, UI scale, reduced motion/flash, dyslexia font

**Acceptance criteria**
1. New player completes the tutorial unaided in ≤ 20 min and names, unprompted, what rating/needs/breakdowns mean (hallway test ×3).
2. All 8 scenarios completable to gold by a dev playthrough; medal state persists; end sheets roll up stats.
3. Stress park holds budgets with juice on; worker flag passes the determinism suite.
4. The game *sounds* alive: blindfold test — you can hear rating rise (crowd swell) and trouble (Penny uh-oh, springs).

---

## Phase 5 — Release 1.0

**Goal:** ship quality. Balance, difficulty, resilience, final QA — the "fully polished, ready to play" bar.

**Scope**
- [ ] Balancing campaign: soak-driven tuning of §15 tables across all scenarios & difficulties (Relaxed/Classic/Tycoon per-park)
- [ ] Sandbox configurator final (map size, cash, difficulty, progression toggle)
- [ ] Save resilience: corruption recovery UX, migration chain tests from every prior phase's fixtures, autosave rotation
- [ ] Full Playwright regression: onboarding, each panel, save/load/export/import, settings, scenario end
- [ ] Error-boundary + diagnostics-copy UX; graceful WebGL-lost recovery
- [ ] Final content/copy review (tone §14), credits, version stamp, favicon/OG/social card
- [ ] Performance final gate on reference hardware matrix (incl. integrated GPU + 1280×720)
- [ ] Public Vercel production deploy + smoke on production URL
- [ ] `CHANGELOG.md` 1.0.0 entry; docs synced to as-shipped reality

**Acceptance criteria (release checklist)**
1. Zero known crash/save-loss bugs; all CI suites green; budgets met on the hardware matrix.
2. Three cold-start hallway testers each: finish tutorial, reach rating 500 in sandbox, and describe the game as "polished" unprompted.
3. Every doc's spec matches the shipped game (audit pass).
4. **1.0.0 tagged and live on Vercel.**

---

## Phase 6 — Beyond 1.0 *(explicitly the very last step)*

**Leaderboard (owner requirement: after everything else):**
- [ ] Vercel Postgres + API routes per `TECHNICAL_ARCHITECTURE.md §15` (boards, friendly codes, submit/read, rate limits)
- [ ] Records tab → Leaderboard: create/join board by code, opt-in submission (name, value, rating, guests, medals, difficulty badge, checksum), around-me view, unverified-🌱 marking
- [ ] Privacy & abuse posture shipped as specified (no accounts, expiring boards)

**Backlog (unscheduled, ideas parking lot):** terraforming & water, coaster blueprints sharing, security staff + vandals, seasons/holiday events, MarbleKit water-slide theme pack, CubePets petting zoo, mod support via content packs, mobile layout, more scenarios, Steam wrapper (Tauri/Electron) evaluation.

---

## Release criteria summary (what "done" means for 1.0)

A new player, on a normal laptop, with no instructions: boots in seconds, is charmed by the title screen, builds a park that feels alive within 10 minutes, understands every system the game shows them, gets surprised by (and survives) their first crisis, plays "one more day" three times past their bedtime, and their save is still perfect next month. That — plus every checkbox above — is 1.0.
