# Changelog

All notable changes to **Wanderpark** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (`0.x` until Release 1.0; docs-only era uses `0.0.x`).

## [Unreleased]

*(nothing yet — next up: owner-side release checklist → retag as 1.0.0, then Phase 6 leaderboard)*

## [1.0.0-rc.1] — 2026-07-26 — Phase 5: Release 1.0 (code complete)

The release-candidate build: balance, resilience, crash safety, regression coverage and release metadata. Remaining before the `1.0.0` tag are the owner-side steps — Vercel deploy, real-hardware perf matrix, hallway testers (ROADMAP Phase 5).

### Added
- **Difficulty modifiers, implemented** (they were doc-only): per-preset multipliers now drive the sim — breakdown chance (Relaxed ×0.5 / Tycoon ×1.4), guest patience (Relaxed ×1.15), price elasticity (Relaxed ×0.9 / Tycoon ×1.15) and random-event cadence (Relaxed ×1.25 gap / Tycoon ×0.8). Full table in `GAME_DESIGN.md §15.7`; spread CI-asserted.
- **Balance soak harness in CI** (`src/sim/__tests__/balance.test.ts`): builds a real starter park and plays it for in-game weeks across all three difficulties and both unlock modes — asserts the Classic break-even lands in the day-8–12 target (not before day 6), daily books turn positive by day 4, Relaxed outearns Tycoon, everyone stays solvent, and the breakdown-multiplier ratio is exact.
- **Save resilience**: every stored record is now a `{ save, checksum }` envelope (FNV-1a); each write rotates the previous good copy into a 3-deep backup ladder *before* overwriting, so the newest record is never the only copy; loading walks main → auto1 → auto2 → auto3, takes the first record that verifies *and* migrates, and shows a "recovered an earlier autosave" warning when a rung was used. Legacy bare saves still load. Migration-chain test walks a real v1 fixture stepwise through every schema version.
- **Crash safety**: `CrashGuard` error boundary — a family-safe crash sheet ("The teacups spun too hard") with Reload and Copy-diagnostics (app version, GPU, stack) — plus a WebGL context-lost watchdog with its own reload overlay.
- **Key remapping** (Settings → Controls): press-to-rebind for pause, speeds 1–3, build, bulldoze, rotate and photo mode; persisted per profile; Esc cancels; reset-to-defaults.
- **Release metadata**: OpenGraph/Twitter social card (1200×630), Vercel-aware `metadataBase`, version stamp.
- **Playwright regression expansion** (5 specs total, run against the production build): new panels/sheets/settings sweep (all five park-panel tabs, the Manual, milestone + park-over sheets, pause-veil save) and a real export → import round-trip via download/filechooser events.

### Changed
- **Spawn curve retuned** (`§15.5`): base guests/day 20 + 0.35·rating → **10 + 0.065·rating**, and a fresh park's rating now starts humble (happiness prior 0.45, value EMA 0.55 — an empty park rates ~330, not ~500). The old curve broke even on day 2 and trivialized the early game.
- Content catalog `GAME_DESIGN.md §11` reconciled to as-shipped: 11 ride experiences (6 flats + all 5 coaster families), 7 stalls, 31 research nodes, 75+ scenery pieces; the six remaining planned flats + 3 stall variants moved to the post-1.0 backlog explicitly.
- Version: `0.4.0` → `1.0.0-rc.1`.

### Fixed
- **Riders could get trapped by their own ride** (long-standing, exposed by the balance soak): rides exit guests onto queue tiles when those are the only walkable neighbors, but pathfinding refused to route *from* a non-strollable start tile — so after one ride, guests could only re-queue forever and never reached stalls again (stall income silently collapsed as a park's ride got popular). Exits now prefer a true path tile when one exists, and `findPath` lets you step *off* whatever tile you stand on (neighbors still gate).
- `renameSave` previously rewrote the record without its checksum envelope.
- Missing `metadataBase` warning during `next build`.

## [0.4.0] — 2026-07-26 — Phase 4: Progression & Polish

### Added
- **Opportunities** (the guided-sandbox pull): 12 goal templates across 6 categories, parameters rolled from the live park (peaks, tallies, rating, coasters), at most 2 active + 1 offered, offers every 2–4 days rating-scaled. Accept/reroll/decline freely — expiry is quiet and penalty-free. Rewards: cash, research surges, a free ad campaign, and three exclusive trophy scenery pieces (earn-only, even in freeplay). Goals tab + objective-chip live progress.
- **Penny, park advisor**: 10 throttled state-driven hints (thirsty crowds, idle cash, missing staff, weak rating terms…) with per-topic 3-day cooldowns and dismiss-forever; 4 one-time explainers on first breakdown/storm/zone/opportunity. Never interrupts building.
- **Guided Start**: 7-step predicate-driven checklist (path → ride → queue → guests → needs → janitor → rating 300) for parks with the toggle ON — which now defaults ON for the first-ever park. No scripted mode: the park you build is the park you keep; skippable at any second; retires itself with a cheer.
- **Park Manual**: 14 searchable plain-English articles ("?" in the top bar).
- **Theming zones**: 8+ same-theme scenery near a ride forms a named zone (Pirate Cove, Star Harbor, Frostfair…) with +0.5 excitement for zone rides, in-world banner sprites, and click-to-rename. **38 new themed pieces** across pirate/space/castle/spooky/winter bring scenery past 75 across 6 sets.
- **Three new coaster families** on the same piece system: Steel Streak (Thrill 7), Sky Hanger (Thrill 8 — the train hangs under the rail), Park Monorail (Family 7); research branches extended to 8/7 nodes.
- **Milestone celebration sheets** with stats roll-up and next-tier teaser.
- **Achievements** (25, cross-save) with tally-backed detection, unlock toasts, and a hub badge wall; **Records** tab with cross-park bests and lifetime totals; **Continue** card minimap thumbnail drawn from save data.
- **Juice pass**: one pooled 320-particle instanced system — placement dust, demolish confetti, sale coin-pops, goal confetti, milestone firework barrages (+ crackle SFX); rating tick-up shimmer. Reduced-motion spawns nothing; reduced-flash kills fireworks.
- **Audio v2**: procedural chip-orchestra soundtrack — menu theme in the hub, day/night/storm moods in the park, seeded patterns, 1.4 s crossfades, dedicated music fader (documented deviation from sourced packs: zero assets, zero licenses, perfectly reactive). New pop/chime/whoosh SFX; walla moved to the SFX fader.
- **Photo mode** (P): HUD retreats to a capture bar, golden-hour light slider (visuals only — the sim keeps living), PNG export named after the park. **Coaster onboard cam** via "Ride it" in the inspector (arc-accurate front-car camera, Esc hops off).
- **Accessibility**: colorblind-safe status palette (blue/orange), dyslexia-friendlier body font (Atkinson Hyperlegible), reduced-flash mode — all live-applied everywhere alongside UI scale + reduced motion (which now work in-game, not just the hub).
- **World tallies** (17 lifetime counters) powering goals, achievements and records; **save v4** (+ migration & fixtures) for tallies, opportunities, zone names, bonus unlocks and the guided flag.
- Tests: 57 green (zones form/dissolve/rename, offer lifecycle, reward payout, penalty-free expiry, template sanity sweep, v1→v4 chain).

### Changed
- Settings gained Accessibility toggles and an updated key reference; music/effects faders now do exactly what they say.

### Deferred (tracked in ROADMAP)
- Web-Worker sim flag, static batching/LOD (Phase 5 hardening — render reads sim zero-copy; needs a snapshot protocol; current profiles don't justify it), DOF/stickers in photo mode, key remapping UI, queue-heat hover glow.

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
