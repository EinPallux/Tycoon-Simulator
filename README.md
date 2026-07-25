# 🎢 Wanderpark

> **Build the park of your dreams. Survive the business behind it.**

A fully-featured **3D theme-park tycoon game for the browser**, in the spirit of *Planet Coaster*, *Aquapark Tycoon*, *Planet Zoo* and *Two Point Museum* — built with a modern web stack, deployable on **Vercel**, playable with **no account and no install**.

You start with an empty plot of land, a modest pile of cash and an uncomfortable amount of debt. You build paths, food stalls, flat rides and fully modular roller coasters. Guests stream in, judge everything, buy burgers, ride your creations, throw litter, and leave reviews. You expand, research, take loans, survive breakdowns, storms and inspections — and turn a muddy field into the greatest park ever built.

---

## 📌 Project Status

| | |
|---|---|
| **Current phase** | 🟡 **Phase 1 — Foundation: code complete** (remaining: Vercel deploy + real-GPU perf pass) |
| **Next step** | Phase 2 — The Living Park (see [ROADMAP.md](./ROADMAP.md)) |
| **Playable build** | ✅ v0.1.0 — build paths, scenery & stalls in a living day/night world; saves, undo, export |
| **Target platform** | Desktop browser (1280px+), deployed on Vercel |
| **Mode** | Single-player guided sandbox. Post-1.0: friend leaderboard (no accounts) |

## 🚀 Run it

```bash
pnpm install
pnpm assets     # once (and after changing the asset manifest): builds optimized models
pnpm dev        # → http://localhost:3000
```

Quality gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` · e2e: `pnpm e2e` (needs a build + Chromium).
**Deploy:** import the repo on [vercel.com/new](https://vercel.com/new) — zero config (committed `public/assets` ship with the build).

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

- **Build**: paths, queues, 12+ flat rides & attractions, shops and stalls, hundreds of scenery pieces, and **modular roller coasters** (log flume, inverted, wild mouse, monorail…) placed piece-by-piece on a 3D grid.
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
├── uiinspo/       # 11 UI reference screenshots (Overwatch / Marvel Rivals style)
├── *.md           # The planning documents listed above
└── (src appears in Phase 1)
```

The planned source layout is specified in [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md#repository-layout).
