# Changelog

All notable changes to **Park Mogul** *(working title)* are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (`0.x` until Release 1.0; docs-only era uses `0.0.x`).

## [Unreleased]

*(empty — awaiting "start coding" green-light for Phase 1)*

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
