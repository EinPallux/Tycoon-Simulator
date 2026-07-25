# AGENTS.md — AI Agent Conventions & Role Playbooks

This file is for **any AI agent** (Claude Code, subagents, other tools) contributing to this repository. `CLAUDE.md` is the canonical handbook — read it first; this file adds agent-specific workflow and specialist role definitions.

---

## 1. Non-negotiables (inherited from CLAUDE.md)

- ⛔ **Planning gate:** no application code until the project owner explicitly says "start coding" (CLAUDE.md §2).
- Docs are the spec; update docs in the same commit when implementation deviates.
- Determinism inside `src/sim/` (seeded RNG only, no wall-clock, no Three/DOM imports).
- Never break saves; migrations required.
- CC0/commercially-safe assets only, registered in `ASSET_GUIDE.md`.
- TypeScript strict; quality gates (`typecheck`, `lint`, `test`, `build`) green before push.
- Changelog + roadmap updated with every meaningful change.
- Work on the designated session branch only. Never create a PR unless asked.

---

## 2. How to execute a phase (agent workflow)

1. Read `ROADMAP.md` → current phase → unchecked items.
2. Slice work **vertically**: one feature end-to-end (sim + render + UI + save + test) beats five half-scaffolds. A slice should be demoable in the running game.
3. Before writing code for a system, re-read its spec section in `GAME_DESIGN.md` / `TECHNICAL_ARCHITECTURE.md` / `UI_UX_DESIGN.md`. If the spec is ambiguous, make the smallest reasonable decision, implement it, and record the decision in the spec doc (same commit).
4. Prefer editing existing modules over adding parallel ones; check for an existing helper before writing a new one.
5. After each slice: run quality gates + the 2-minute smoke play (CLAUDE.md §7), tick roadmap, update changelog, commit, push.
6. If blocked on a genuine product decision, add it to `OPEN_QUESTIONS.md` with a recommended default, adopt the default, and continue — never stall the phase.

### Parallelizing with subagents

Safe split boundaries (low merge-conflict risk):
- `src/sim/**` (simulation) vs `src/render/**` (3D) vs `src/ui/**` (React DOM) vs `tools/**` (asset pipeline).
- Within UI: distinct screens/panels are independent (shared primitives land first).
- Content authoring (balance tables, ride/stall/scenery catalogs, Opportunity templates) is data-only and safe to parallelize once schemas exist.

Contract-first rule: when two agents share a boundary, the **types/interfaces land first** (one small commit), then both sides build against them.

---

## 3. Specialist roles

Use these role lenses when splitting work. Each role lists its home directories, owned docs, and guardrails.

### 🎛 Simulation Engineer
- **Owns:** `src/sim/**` — game loop, guests, economy, rides, staff, events, park rating, balance data.
- **Docs:** `GAME_DESIGN.md` systems + numbers; `TECHNICAL_ARCHITECTURE.md §5–7`.
- **Guardrails:** pure TS, deterministic, unit-tested (every formula in `GAME_DESIGN.md §15` gets a test). No rendering concerns. Data-oriented pools, no per-entity classes with hidden state.

### 🧊 3D / Rendering Engineer
- **Owns:** `src/render/**` — R3F scene, instancing, camera rig, picking, ghost previews, guest animation, VFX, LOD, day/night.
- **Docs:** `TECHNICAL_ARCHITECTURE.md §8, §12`.
- **Guardrails:** perf budgets are law; everything placed in bulk is instanced; no React state per frame; dispose everything you create; test with the 5,000-piece stress park.

### 🖥 UI Engineer
- **Owns:** `src/ui/**`, `src/app/**` — screens, HUD, panels, design-system primitives, settings, save UI.
- **Docs:** `UI_UX_DESIGN.md` (tokens/components/screens), `GAME_DESIGN.md §12–13` (onboarding, UX of systems).
- **Guardrails:** build from the shared primitives; angled "Hero-style" aesthetic per tokens; keyboard + screen-reader basics; UI reads sim via throttled selectors only; every panel closable with Esc and mouse.

### 🎨 Tech Artist / Asset Pipeline
- **Owns:** `tools/asset-pipeline/**`, `public/assets/**`, asset manifest.
- **Docs:** `ASSET_GUIDE.md`.
- **Guardrails:** CC0 only + license registered; meshopt-compressed GLB output; consistent scale/origin per §6 conventions; per-model manifest overrides instead of runtime hacks; keep shipped asset weight within budget.

### 📐 Game Designer / Balancer
- **Owns:** balance tables, ride/stall/scenery catalogs, Opportunity templates, research tree, achievements, all player-facing copy.
- **Docs:** `GAME_DESIGN.md` (canonical).
- **Guardrails:** every number lives in one balance module, mirrored in the doc; tone guide §14 for all copy; changes come with a "why" note; playtest notes recorded in `ROADMAP.md` backlog when they spawn work.

### 🔍 QA / Release Engineer
- **Owns:** test suites, Playwright smokes, perf overlay checks, save-migration tests, Vercel deploy config.
- **Docs:** `TECHNICAL_ARCHITECTURE.md §13–14`, `ROADMAP.md` acceptance criteria.
- **Guardrails:** acceptance criteria are executable where possible; a phase isn't "done" on green units alone — run the smoke play; keep CI fast (<5 min).

---

## 4. Code review checklist (self-review before push)

- [ ] Matches the spec doc (or the spec doc was updated).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
- [ ] No `Math.random`/`Date.now` in `src/sim`; no sim→render/ui imports.
- [ ] New state survives save → load round-trip; migration added if schema changed.
- [ ] Perf overlay checked on the stress park (Phase 2+).
- [ ] UI uses design-system primitives + tokens (no ad-hoc hex colors).
- [ ] Assets registered with license (if any added).
- [ ] `CHANGELOG.md` + `ROADMAP.md` updated.
- [ ] Commit message follows convention; pushed to the designated branch.
