# Changelog

All notable changes to **Wanderpark** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (`0.x` until Release 1.0; docs-only era uses `0.0.x`).

## [Unreleased]

*(nothing yet)*

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
