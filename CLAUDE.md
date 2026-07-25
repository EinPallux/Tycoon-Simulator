# CLAUDE.md — Development Handbook

This file is the **canonical operating manual** for anyone (human or AI) working in this repository. Read it fully before doing anything. `AGENTS.md` mirrors the conventions for generic AI agents and adds role playbooks.

---

## 1. What this project is

**Park Mogul** *(working title)* — a polished single-player 3D theme-park tycoon game for the browser (Planet Coaster / Aquapark Tycoon spirit), built on Next.js + React Three Fiber + a pure-TS simulation core, deployed on Vercel. Low-poly CC0 assets (Kenney/KayKit), UI styled after the Overwatch/Marvel Rivals references in `uiinspo/`.

**Design north star:** every session should feel satisfying — tight feedback loops, visible progress, playful tone, zero friction. "Up to the quality of a modern Steam tycoon game" is the bar for polish, onboarding and UX.

---

## 2. ⛔ Current gate: PLANNING ONLY

> **The project owner has not yet said "start coding". Until they explicitly do, do NOT write application code, scaffold projects, or add dependencies. Documentation-only changes are allowed.**
>
> When the owner green-lights coding, update this section to `Gate: OPEN — Phase N in progress` in the same commit that scaffolds the app.

---

## 3. Document map & authority

| Question | Look in |
|---|---|
| What are the rules / conventions / workflow? | **CLAUDE.md** (this file) |
| How do agents split and execute work? | `AGENTS.md` |
| How does the game play? What are the systems and numbers? | `GAME_DESIGN.md` |
| How is it built? Stack, folders, sim, rendering, saves, perf? | `TECHNICAL_ARCHITECTURE.md` |
| What does it look like? Tokens, components, screens? | `UI_UX_DESIGN.md` |
| Which assets exist, what maps to what, how to import? | `ASSET_GUIDE.md` |
| What is in the current phase? When is it done? | `ROADMAP.md` |
| What changed? | `CHANGELOG.md` |
| What is undecided? | `OPEN_QUESTIONS.md` |

Rule: **docs are the spec.** If implementation must deviate, update the doc in the same PR/commit and note it in `CHANGELOG.md`. Never let code and docs drift silently.

---

## 4. Working agreements (hard rules)

1. **Phase discipline.** Work only on the current phase in `ROADMAP.md` unless fixing a bug. Each phase ends with its acceptance criteria demonstrably met.
2. **The game must always run.** After Phase 1, `main` is always buildable, deployable and playable. Feature branches for anything risky.
3. **Never break saves.** Save schema changes require a migration (`TECHNICAL_ARCHITECTURE.md §9`). A player's park is sacred.
4. **Determinism in the sim core.** No `Math.random()`, no `Date.now()`, no DOM/Three imports inside `src/sim/`. Seeded RNG + injected clock only.
5. **Performance budgets are requirements** (60 fps desktop with 500 guests + 5,000 placed pieces; budgets in `TECHNICAL_ARCHITECTURE.md §12`). A feature that busts the budget isn't done.
6. **CC0 / commercially-safe assets only.** Every imported asset is registered in `ASSET_GUIDE.md` with source + license. No exceptions, no "temporary" rips.
7. **Changelog discipline.** Every meaningful change lands in `CHANGELOG.md` under `[Unreleased]` in the same commit.
8. **TypeScript strict, no `any`** unless annotated `// intentional-any: <reason>`. Lint and typecheck must pass before commit.
9. **Playful tone, family-safe.** Copy is witty, never crude. Breakdowns are comedic; nobody is ever harmed (see `GAME_DESIGN.md §14`).
10. **No new heavy dependencies** without a note in `TECHNICAL_ARCHITECTURE.md §2` (what, why, size cost, alternative considered).

---

## 5. Session workflow (every work session)

1. **Orient** — read `ROADMAP.md` current-phase checklist + `CHANGELOG.md [Unreleased]` + `OPEN_QUESTIONS.md`.
2. **Pick** the next unchecked item(s) in phase order; prefer vertical slices (feature works end-to-end incl. UI + save + tests) over horizontal scaffolding.
3. **Build** to the specs in `GAME_DESIGN.md` / `TECHNICAL_ARCHITECTURE.md` / `UI_UX_DESIGN.md`.
4. **Verify** — typecheck, lint, unit tests (sim), run the game, check the perf overlay, test a save/load round-trip when state shape changed.
5. **Record** — tick the roadmap checkbox, update `CHANGELOG.md`, update any doc the implementation refined.
6. **Commit & push** with a clear message (see §6). Small, coherent commits.

Definition of Done for any feature: *spec-conformant, typed, tested where testable, within perf budget, save-safe, UI matches design system, changelog updated, roadmap ticked.*

---

## 6. Conventions

- **Commits:** conventional-commit style — `feat(sim): guest hunger decay`, `fix(ui): dock tooltip z-index`, `docs(roadmap): tick phase-2 items`, `perf(render): instance path tiles`, `chore`, `refactor`, `test`.
- **Branches:** work on the session's designated branch; never push to a different branch without permission.
- **Naming:** `PascalCase` React components, `camelCase` functions/vars, `kebab-case` file names except components (`GuestPanel.tsx`), `SCREAMING_SNAKE` constants. Sim entities/systems named by domain (`guestNeedsSystem`, `ridePool`), not by pattern jargon.
- **Units:** 1 tile = 2 m = 1 world unit. Money in whole dollars (integer cents internally). Time in sim ticks (10 ticks/s at 1× speed).
- **IDs:** every placeable/ride/guest has a stable numeric id from a per-pool counter; never reuse ids within a save.
- **Imports:** `src/sim` may import nothing from `src/render` / `src/ui` (enforced by lint rule). UI reads sim state via selectors only.

---

## 7. Quality gates before any push

```
pnpm typecheck && pnpm lint && pnpm test        # must be green
pnpm build                                      # must succeed (Phase 1+)
```
Plus a 2-minute smoke play: boot → hub → load park → place path + stall → save → reload → verify identical.

---

## 8. Things that commonly go wrong (pre-committed answers)

- **"Should this ride/stall be cheaper?"** → Balancing numbers live in `GAME_DESIGN.md §15` and in `src/sim/balance/*.ts` as the single source; change both together.
- **"The GLB looks wrong / floats / faces backwards."** → Fix at import time in the asset pipeline manifest (scale/rotation/origin overrides), never with per-instance hacks. See `ASSET_GUIDE.md §6`.
- **"React re-renders 60×/s."** → UI must subscribe to sim state via throttled/transient selectors (`TECHNICAL_ARCHITECTURE.md §8`). Never put per-tick values in React state.
- **"Where do I put a new panel?"** → Follow the screen inventory in `UI_UX_DESIGN.md §7`; every panel uses the shared `Panel` primitives.
- **"Need an asset we don't have."** → Sourcing rules in `ASSET_GUIDE.md §7` (CC0-first list). Register it before using it.

---

## 9. Project glossary

| Term | Meaning |
|---|---|
| **Guest** | Simulated visitor agent with needs and money |
| **Placeable** | Anything placed on the grid (path, ride, stall, scenery) |
| **Flat ride** | Self-contained ride occupying a footprint (carousel, drop tower…) |
| **Tracked ride** | Ride built from track pieces (coasters, log flume, monorail) |
| **Stall** | Shop/facility (food, drink, souvenir, toilets, info) |
| **Park rating** | 0–1000 composite score of park quality (`GAME_DESIGN.md §9`) |
| **Tick** | One simulation step; 10/s at 1× speed |
| **Scenario** | Curated start + objectives; **Sandbox** = free play |
| **Advisor (Penny)** | Tutorial/tips character |
| **Milestone** | Named progression reward tier (guest count / rating) |
