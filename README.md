# 🎢 Wanderpark

> **Build the park of your dreams. Survive the business behind it.**

A fully-featured **3D theme-park tycoon game for the browser**, in the spirit of *Planet Coaster*, *Aquapark Tycoon*, *Planet Zoo* and *Two Point Museum* — built with a modern web stack, deployable on **Vercel**, playable with **no account and no install**.

You start with an empty plot of land, a modest pile of cash and an uncomfortable amount of debt. You build paths, food stalls, flat rides and fully modular roller coasters. Guests stream in, judge everything, buy burgers, ride your creations, throw litter, and leave reviews. You expand, research, take loans, survive breakdowns, storms and inspections — and turn a muddy field into the greatest park ever built.

---

## 📌 Project Status

| | |
|---|---|
| **Current phase** | 🟡 **Phase 5 — Release 1.0: code complete as `1.0.0-rc.1`** — remaining: owner-side deploy, real-hardware perf matrix, hallway testers, `v1.0.0` tag |
| **Next step** | Owner release checklist (ROADMAP Phase 5), then Phase 6 — leaderboard (see [ROADMAP.md](./ROADMAP.md)) |
| **Playable build** | ✅ v1.0.0-rc.1 — everything from 0.4.0 plus: real difficulty modifiers, CI-asserted economy balance (break-even day 8–12 on Classic), checksummed saves with a 3-deep recovery ladder, crash sheet + WebGL-lost recovery, key remapping, social card, 5-spec Playwright regression |
| **Target platform** | Desktop browser (1280px+), deployed on Vercel |
| **Mode** | Single-player guided sandbox. Post-1.0: friend leaderboard (no accounts) |

## 🚀 Run it

```bash
pnpm install
pnpm assets     # once (and after changing the asset manifest): builds optimized models
pnpm dev        # → http://localhost:3000
```

Quality gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` · e2e: `pnpm e2e` (needs a build + Chromium; set `PW_CHROMIUM_PATH` to reuse a system browser).

## 🚢 Deploy (owner checklist for 1.0)

1. Import the repo on [vercel.com/new](https://vercel.com/new) — zero config needed (committed `public/assets` ship with the build). Optionally set `NEXT_PUBLIC_SITE_URL=https://your-domain` so the social card resolves to the final domain.
2. Smoke the production URL: title → new park → build → save → reload.
3. Run the perf pass on real hardware (F3 overlay; integrated GPU + 1280×720 included) and the three hallway tests (ROADMAP Phase 5 acceptance).
4. When green: bump `1.0.0-rc.1` → `1.0.0` (package.json + `APP_VERSION`), tag `v1.0.0`, and tick the last ROADMAP boxes.

---

## 📚 Documentation Map

Every document has a single owner-topic. If information conflicts, the more specific document wins.

| Document | What it owns |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | **Canonical dev handbook** — rules, conventions, workflow, quality gates. Read first. |
| [AGENTS.md](./AGENTS.md) | Agent/AI-contributor conventions, specialist roles, how to split phase work |
| [GAME_DESIGN.md](./GAME_DESIGN.md) | The complete game design: loops, systems, content, balancing values, tone |
| [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) | Tech stack, simulation core, rendering, save system, performance budgets, deployment |
| [UI_UX_DESIGN.md](./UI_UX_DESIGN.md) | Design system (derived from `uiinspo/`), tokens, components, every screen spec |
| [ASSET_GUIDE.md](./ASSET_GUIDE.md) | Asset inventory, licensing, kit→content mapping, import pipeline, sourcing rules |
| [ROADMAP.md](./ROADMAP.md) | Phases, scope, acceptance criteria, release criteria, backlog |
| [CHANGELOG.md](./CHANGELOG.md) | Human-readable history of every meaningful change |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Decisions awaiting the project owner + the defaults assumed meanwhile |

---

## 🎮 The Game in 60 Seconds

- **Build**: paths, queues, 6 animated flat rides, 7 stalls & facilities, 75+ scenery pieces across 6 theme sets, and **modular roller coasters** (wild mouse, log flume, steel, inverted, monorail) placed piece-by-piece on a 3D grid.
- **Simulate**: hundreds of autonomous guests with needs (hunger, thirst, fun, energy, bladder), moods and thought bubbles. They queue, ride, snack, complain and pay.
- **Manage**: ticket & stall pricing, staff (mechanics, janitors, entertainers), research, marketing, loans and cash flow.
- **Survive**: breakdowns, rainstorms, litter spirals, safety inspections, heatwaves, loan interest and bankruptcy.
- **Progress**: one open **guided sandbox** (no forced campaign — ever): park rating, milestone tiers, research unlocks, optional dynamic goals ("Opportunities"), achievements. You choose how to make money and grow.
- **Compare** *(post-1.0)*: an opt-in, no-account leaderboard of park value among friends.

Full design: [GAME_DESIGN.md](./GAME_DESIGN.md)

---

## 🛠 Tech Stack (summary)

**Next.js (App Router) + React + TypeScript strict + React Three Fiber (Three.js) + Zustand + Tailwind CSS + a pure-TS deterministic simulation core.** Assets are CC0 low-poly GLB kits (Kenney, KayKit) processed through a `gltf-transform` pipeline. Deployed on Vercel; saves live in the browser (IndexedDB + export/import). Rationale and full detail: [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)

---

## 🗺 Development Phases (summary)

| Phase | Name | One-liner |
|---|---|---|
| 1 | **Foundation** | App shell (title/hub/settings/saves), 3D world, camera, grid, full build system, asset pipeline |
| 2 | **The Living Park** | Guest simulation, economy v1, time controls, park rating, HUD & management panels |
| 3 | **Coasters & Chaos** | Modular coaster builder, staff, breakdowns, research, loans, weather, events |
| 4 | **Progression & Polish** | Opportunities engine, Guided Start onboarding, achievements, theming sets, audio, juice, performance pass |
| 5 | **Release 1.0** | Balancing, difficulty modes, sandbox, accessibility, QA, deploy hardening |
| 6 | **Beyond** *(very last)* | Friend leaderboard (no accounts), post-release backlog |

Details and acceptance criteria: [ROADMAP.md](./ROADMAP.md)

---

## 📦 Repository Layout (current)

```
Tycoon-Simulator/
├── assets/        # 50 CC0 low-poly kits (~4,000 GLB/GLTF models) — source material, not shipped as-is
├── public/assets/ # The optimized, content-hashed models the game actually loads (pnpm assets)
├── src/
│   ├── app/       # Next.js routes (title / hub / play)
│   ├── sim/       # Pure deterministic simulation core (no DOM, no Three, seeded RNG)
│   ├── render/    # React Three Fiber layers (world, guests, coasters, staff, juice)
│   ├── ui/        # HUD, hub, panels, stores (Zustand), save-slot service
│   ├── audio/     # Procedural music + SFX engines (WebAudio)
│   └── content/   # Typed catalogs: placeables, research, goals, achievements, manual
├── e2e/           # Playwright suites (run against the production build)
├── uiinspo/       # 11 UI reference screenshots (Overwatch / Marvel Rivals style)
└── *.md           # The docs listed above
```

Full architecture: [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md).
