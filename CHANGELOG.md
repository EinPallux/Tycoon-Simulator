# Changelog

All notable changes to **Wanderpark** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (`0.x` until Release 1.0; docs-only era uses `0.0.x`).

## [Unreleased]

*(nothing yet)*

## [0.3.0] — 2026-07-26 — Phase 3: Coasters & Chaos

### Added
- **Coaster builder** (the flagship): Wild Mouse + Log Flume families with a 7-piece grid-snapped vocabulary (2-tile station, straight, radius-2 corners, ±1-level slopes with chain lifts, vertical loop). Station placement tool with direction ghost, then button/hotkey drafting (W/A/D/R/F/L, Backspace, Enter) with live ghost track, home beacon + distance-to-close hint, live stats & cost — committed as ONE undoable `build-coaster` command. Underground/height/land constraints validated piece-by-piece.
- **Coaster physics & stats from geometry**: per-piece energy model (chain lifts, friction, gravity) → speeds, ride time, excitement/intensity/nausea, drops/inversions — shown in the builder, the inspector, and used by guest thrill-matching. Piece-perfect track rendering from Kenney CoasterKit (one corner model serves both chiralities; slopes/loops entry-anchored) with auto-support columns and an arc-length-spaced animated train (analytic up-vector through the loop).
- **Staff**: janitors sweep litter, mechanics claim and repair broken rides (skill grows with tenure), entertainers cheer the longest queue — hire/fire dock tray with live roster, weekly payday, distinct character models with walk/work animations.
- **Breakdowns & maintenance**: reliability decay per day/cycle, mid-cycle breakdowns with comedy smoke puffs + queue-flush grumbles, mechanic repair (+70 reliability), $250 contractor fallback, renovate at 40% of build cost, reliability bar + repair controls in the inspector.
- **Loans & the debt spiral**: $5,000 tranches (+1.5% APR each) against a park-value credit limit, daily interest, missed-payment penalties, 3-miss repossession auctions (55% pays down debt) and the "The bank owns the teacups now" park-over sheet. Soak-tested: mismanaged tycoon parks fold inside 30 days, managed ones escape clean.
- **Research**: 4 branches × 6 nodes (rides, coaster families, stalls, scenery, 10 gameplay perks), Paused/Standard/Turbo funding, progress bar, unlock toasts, lock badges across the build dock; freeplay parks skip content gates but still earn perks.
- **Weather**: sun/cloud/rain/storm/heatwave with dawn/midday transitions — arrival/thirst/leave-now modifiers, smooth sky/light grading, camera-following rain particles, top-bar chip with forecast tooltip.
- **Events v1** (6): VIP visit, safety inspection (fines shabby rides), influencer moment (crowd surge), coaster enthusiast club (+2 coaster excitement), litter-rat scare, lost wallet — with an active-event HUD chip.
- **Marketing**: 4 campaigns (flyers/radio/TV/influencer) gated on the Marketing Licence perk, one at a time, with the under-delivery hangover rule; managed from Finances.
- **Finances additions**: wages/interest/repairs/research/marketing ledger rows, bank section (APR, credit limit, borrow/repay), campaign cards. **Guests tab**: "overheard in the park" thought tally. **Park panel**: new Research tab.
- **Save v3** with v2→v3 migration + fixture test: coasters (geometry is the truth — stats/speeds recomputed on load), staff, weather, research, loans, events, marketing, ride reliability, widened ledger.
- Phase-3 test suite: 18 tests (track geometry closure, physics sanity, build/undo/save round-trips, staff jobs, contractor repair, research gating, loan flows, weather vocabulary, both debt-spiral soaks) → 51 total; new coaster e2e drives the real builder UI end-to-end.

### Changed
- Rides dock tray hides coaster stations (built via the Coasters tray) and shows research locks; settings commands (hire, loans, repairs) refresh the HUD cash immediately.

### Notes
- Verified in-browser via scripted screenshots: track/train/supports/loop rendering, builder draft ghost, staff at work, rain + breakdown smoke, research/finances/inspector panels.

## [0.2.0] — 2026-07-25 — Phase 2: The Living Park

### Added
- **Guests** (up to 500): appeal-driven arrivals with day/night curves, entry payment, thrill/patience personalities, wallets, per-sim-hour needs & mood engine, A* path-walking with procedural gaits, thought logs, 11 emote bubbles, night departures.
- **Six operating flat rides** with animated machines (Carousel, Ferris Wheel, Whirly Teacups, Sky Plunge, Bump-a-Lot Arena, Jolly Roger): queue chains, boarding fares, cycle phases, patience bails, closing-time flush, preference-scaled fun payoffs.
- **Seven operating stalls** (2× food, 2× drinks, souvenir, info, free toilets): item pricing with fairness verdicts, cost of goods, need restoration, bladder consequences.
- **Economy v1**: entry-price slider with elasticity, income/expense ledger (14-day history), daily rollovers with ride upkeep, lifetime books.
- **Park rating** (5 weighted terms + "what's hurting you" hints) and **milestone tiers** with cash awards and fanfares; objective chip tracks the next tier live.
- **Litter loop v1**: snack litter, bin prevention radius, overnight decay (janitors arrive Phase 3).
- **Management UI**: ride/stall/guest inspectors (with follow-cam), park panel (Finances / Guests / Rating), guests & rating HUD chips, Rides + Manage dock categories.
- **Audio v1**: fully procedural WebAudio SFX (taps, placement thunks, rate-limited coin clinks, error boings, milestone fanfare) + crowd-walla bed scaled by guest density.
- **Save v2** with v1→v2 migration and fixture test: guests, ride/stall runtime state, ledger, litter, milestones all persist; snapshots keep ride prices across move/undo.
- Deterministic e2e/debug hook (`window.__wanderpark`) for scripted verification.

### Fixed
- Needs decay and ride cycles now share one coherent time model (per-sim-hour needs, watchable real-time ride cycles) — guests get hungry by lunch and rides no longer swallow the whole day.

### Notes
- 33 unit/integration tests green (incl. 3-day soak, determinism hash, migration fixture); verified in-browser with 112 concurrent guests.

## [0.1.0] — 2026-07-25 — Phase 1: Foundation (first playable)

### Added
- **App shell:** DOM-only title screen with local profile creation (name + banner color, no accounts); hub with Continue / My Parks (load, rename, export/import incl. drag-drop, delete) / New Park configurator (name, map size S–L, difficulty presets, Guided Start & Freeplay toggles, "The Deal" summary) / Settings (live UI scale, reduced motion, volumes, control toggles) / auto-generated Credits; locked Achievements/Records tabs marked with their arrival phase.
- **Deterministic sim core** (pure TS, lint-enforced boundaries): seeded RNG streams, 10 Hz fixed-timestep with speed 0–3×, tile bitfield world (128×128, owned rect, entrance), placement validation as the single source of truth, command dispatch with generic patch-based undo/redo (20 deep), path graph with auto-tile masks + BFS reachability.
- **Save system v1:** versioned zod schema + migration chain with guardrail errors, IndexedDB slots + index, autosave (per park day, tab-hide, exit), export/import `.wanderpark.json`, serializer that rebuilds derived state; round-trip + migration tests.
- **3D world:** procedural gradient sky dome + sun/moon day-night driven by sim time (parks open 09:00 Day 1), shadow-casting sun, fog, owned-land ground shader with build-mode grid, perimeter fence with entrance gap, CoasterKit entrance arch, RTS camera rig (WASD/middle-drag pan, Q/E 45° snaps, wheel zoom-to-cursor, damped, saved per park).
- **Build system v1:** path & queue painting with drag strokes, live cost readout and correct auto-tiling; 30 scenery defs + 4 stalls (path-adjacency rule); model ghosts (valid blue / invalid red + reason toasts); rotate, move (grace = free), bulldoze click+drag with 50% refunds and 30 s full-refund grace; category build dock with trays.
- **Rendering:** instancing-first (a built scene draws in ~17 calls), instance raycast picking, selection highlight, inspector panel (beauty/theme/cost, move, demolish with refund preview), F3 perf overlay.
- **HUD:** park name, pulsing tabular cash, day/clock, speed controls, undo/redo, pause veil (pauses sim; save/exit), tool hint chip, toast rail.
- **Pipeline & tooling:** gltf-transform asset pipeline (dedup/prune/weld, baked per-model transforms, content-hashed immutable files, typed manifest, 40 MB budget gate — ships 3.5 MB); GitHub Actions CI (typecheck, lint, unit, build, asset budget, Playwright smoke); 26 unit tests + 2 e2e smokes (full build→save→reload journey) green.

### Notes
- Doc'd deviations from the original spec: raycast picking instead of GPU id-buffer (upgrade path kept), edit-rate instance re-derive instead of freelist pools (Phase-4 hardening), procedural sky dome instead of skybox crossfade (`TECHNICAL_ARCHITECTURE.md §8`).
- Remaining Phase-1 exit items: Vercel deploy (owner: import the repo) and a real-GPU 5,000-piece perf pass (headless SwiftShader can't measure it).

## [0.0.2] — 2026-07-25 — Owner decisions locked

### Changed
- **Name:** the game is officially **Wanderpark** (was working title "Park Mogul"); docs, save-file extension (`.wanderpark.json`) and titles updated project-wide.
- **No campaign — guided sandbox only** (owner decision): removed the 8-scenario campaign from `GAME_DESIGN.md`/`ROADMAP.md`/`UI_UX_DESIGN.md`. Replaced with:
  - **Opportunities** — optional, state-generated dynamic goals (2 active + 1 offered, accept/decline/reroll, reward-only, never punishing) — new `GAME_DESIGN.md §13`.
  - **Guided Start** — the tutorial is now an optional toggle on any new park (default ON for the first park), not a separate scenario.
  - **New-park configurator** as the single entry point (name, map size, funds/debt preset, difficulty, Guided Start, Freeplay-unlocks toggle).
  - Unified **repossession spiral** fail pressure (asset seizure → park-over sheet) replacing the scenario bankruptcy fail-state.
  - Penny hint engine spec (state-driven contextual suggestions) added.
- Leaderboard submission stats: scenario medals → milestone tier + achievements count.
- Confirmed by owner: theme park direction, family-safe comedic tone, desktop-first, modular piece-based coaster builder, English-only at 1.0, CC0 audio plan.
- `OPEN_QUESTIONS.md` converted into a decision log (all 8 questions answered).

### Notes
- ⛔ Coding gate still closed — awaiting explicit "start coding" (see `CLAUDE.md §2`).

## [0.0.1] — 2026-07-25 — Phase 0: Planning

### Added
- Complete planning documentation set:
  - `README.md` — project front door, status, doc map
  - `CLAUDE.md` — canonical development handbook (rules, workflow, conventions, quality gates)
  - `AGENTS.md` — AI-agent conventions + specialist role playbooks
  - `GAME_DESIGN.md` — full game design: vision, loops, all systems, content catalog v1.0, scenarios, tone, balancing tables, accessibility
  - `TECHNICAL_ARCHITECTURE.md` — stack (Next.js + R3F + pure-TS deterministic sim), repo layout, sim/render/save architecture, perf budgets, testing, Vercel deployment, post-1.0 leaderboard backend
  - `UI_UX_DESIGN.md` — design system derived from `uiinspo/` (Overwatch/Marvel Rivals style): tokens, component kit, all screens, HUD, input map
  - `ASSET_GUIDE.md` — CC0 licensing verification, 50-kit inventory, kit→content mapping, gap/sourcing plan, import conventions
  - `ROADMAP.md` — 5 development phases + post-1.0 leaderboard phase, acceptance criteria, release criteria
  - `OPEN_QUESTIONS.md` — decisions awaiting the project owner + assumed defaults
- Decisions locked by asset & reference analysis: **theme-park tycoon** direction (CoasterKit + themed kits), Overwatch/Rivals-style UI language, desktop-first browser target, Vercel deploy, no-account friend leaderboard as the final step.

### Notes
- Repository previously contained only `assets/` (50 CC0 kits, ~4,000 GLB/GLTF models) and `uiinspo/` (11 reference screenshots) — commit `35c67d5`.
- ⛔ No application code exists yet, by owner instruction (see `CLAUDE.md §2`).
