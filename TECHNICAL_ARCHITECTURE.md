# TECHNICAL_ARCHITECTURE.md — Wanderpark

The engineering spec. Owns: stack, structure, simulation, rendering, state, saves, performance, testing, deployment. Gameplay rules live in `GAME_DESIGN.md`; visual specs in `UI_UX_DESIGN.md`.

---

## 1. Requirements that shape the architecture

1. Deployable on **Vercel**; single-player; browser; no accounts.
2. A real-time simulation (hundreds of agents) **and** a rich DOM UI **and** a 3D scene — cleanly separated.
3. **Determinism** for fairness, testing and future leaderboard integrity.
4. Saves must survive years of development → versioned schema + migrations from day 1.
5. ~4,000 candidate GLB assets, ship only what's used, small and cached.
6. Modular and expandable: content is data, systems are plugins to a tick pipeline.

---

## 2. Tech stack & rationale

| Layer | Choice | Why (and what was rejected) |
|---|---|---|
| Framework | **Next.js (App Router, latest stable)** | First-class Vercel deploy, static title/hub shell, API routes ready for the post-1.0 leaderboard. *(Rejected: plain Vite SPA — fine for the game, but leaderboard would need a second deployable; Next keeps one repo/one deploy.)* |
| Language | **TypeScript, strict** | Non-negotiable for a sim this stateful. |
| 3D | **Three.js via React Three Fiber (R3F) + drei** | Declarative scene composition, mature ecosystem (GLTF loading, instancing helpers, camera controls), React 19 compatible. *(Rejected: Babylon.js — capable but weaker React integration; Unity WebGL — huge bundles, poor Vercel/web-native fit; PlayCanvas — editor-first workflow.)* |
| Game/UI state | **Zustand** (+ `subscribeWithSelector`) | Tiny, transient-subscription friendly (critical for 10 Hz sim → UI without re-render storms). *(Rejected: Redux — ceremony; Jotai — fine, but Zustand's store-outside-React model matches a sim.)* |
| Styling | **Tailwind CSS v4 + CSS custom-property design tokens** | Fast iteration; tokens defined once in `UI_UX_DESIGN.md §3`. |
| Motion | **motion** (framer-motion successor) for DOM; spring utils for camera | The angled-card UI leans on snappy transitions. |
| Audio | **Howler.js** behind a tiny `AudioBus` facade | Sprite sheets, mobile unlock quirks handled. |
| Persistence | **IndexedDB via `idb-keyval`** + JSON export/import | LocalStorage too small for parks; keyval is enough (one key per save slot). |
| Sim core | **Hand-rolled data-oriented TS module** (no engine dep) | Full control + determinism; ECS frameworks add ceremony without benefit at our scale. |
| Asset pipeline | **`@gltf-transform/cli` + custom Node scripts** | Dedupe, prune, meshopt-compress, generate typed manifest. |
| Tests | **Vitest** (sim, utils) + **Playwright** (smoke) | Fast unit loop; browser truth for the shell. |
| Tooling | **pnpm**, ESLint (+ import-boundary rule), Prettier | Standard. |

Version policy: pin latest stable of each at Phase 1 scaffold time; upgrade deliberately between phases, never mid-phase. Any new dependency >20 kB gzip needs a row in this table.

---

## 3. Repository layout (target)

```
├── docs → (the *.md specs at repo root)
├── assets/                      # raw CC0 kits (source material, git-tracked, never shipped)
├── tools/
│   └── asset-pipeline/          # ingest scripts: optimize GLBs → public/assets + manifest codegen
├── public/
│   └── assets/                  # OPTIMIZED shipped subset: models/, textures/, audio/, ui/
└── src/
    ├── app/                     # Next.js routes: / (title), /hub, /play, /api (post-1.0 leaderboard)
    ├── sim/                     # 🧠 PURE simulation core — no react/three/dom imports (lint-enforced)
    │   ├── world/               # grid, land, pathgraph, time
    │   ├── entities/            # pools: guests, rides, stalls, staff, scenery, track
    │   ├── systems/             # tick pipeline: needs, movement, queues, economy, breakdowns, rating, events…
    │   ├── balance/             # ALL tunable numbers (mirrors GAME_DESIGN.md §15)
    │   ├── save/                # schema, serializer, migrations
    │   └── api.ts               # SimHandle: the only surface render/ui may touch
    ├── render/                  # R3F scene: instanced meshes, camera rig, picking, ghosts, vfx, day-night
    ├── ui/                      # DOM UI: design-system primitives, HUD, panels, screens, tutorial
    ├── audio/                   # AudioBus, sound registry
    ├── content/                 # data catalogs: rides, stalls, scenery, research, goals (Opportunities), achievements
    └── shared/                  # types, ids, math, rng, event-bus — importable by all layers
```

**Dependency law:** `shared ← sim ← (render, ui, audio)`; `content` is plain data importable by sim/ui. Nothing imports "upward". A lint rule enforces `src/sim` purity.

---

## 4. Runtime topology

```
┌────────────────────────── Browser ──────────────────────────┐
│  Next.js shell (Title / Hub / Settings / Save mgmt)  [DOM]  │
│      └─ /play mounts <GameRoot> (client-only, no SSR)       │
│           ├─ SimLoop: fixed-timestep driver (10 Hz logic)   │
│           │    └─ src/sim (pure TS world state)             │
│           ├─ R3F <Canvas>: renders FROM sim snapshots       │
│           │    (interpolated at display Hz)                 │
│           └─ HUD/Panels: subscribe to sim via selectors     │
│                (throttled; no per-tick React state)         │
└─────────────────────────────────────────────────────────────┘
```

- **Fixed timestep:** logic at 10 ticks/s (sim-time); render interpolates entity transforms. Game speeds 0×(pause)/1×/2×/3× multiply *sim-time per real second* by running 0/10/20/30 ticks/s (catch-up capped at 5 ticks/frame; beyond that, sim-time slows rather than spiraling).
- **Main-thread first, worker-ready:** the sim runs on the main thread in Phases 1–3 (simpler debugging; budget shows it fits). Because `src/sim` is pure and message-shaped (`SimHandle` = commands in, snapshots out), moving it into a **Web Worker** is a Phase 4/5 optimization flag, not a rewrite. Structured-clone-safe state is a standing constraint.
- **Event bus:** sim emits typed events (`guest-thought`, `ride-broke`, `milestone`, `sale`) consumed by UI toasts, audio and VFX. Events are fire-and-forget; sim never waits on presentation.

---

## 5. Simulation core design

**Data-oriented pools, systems pipeline, zero classes-with-behavior.**

- **Entity pools:** `Struct-of-Arrays`-flavored TS (plain typed arrays for hot fields: positions, need bars; object rows for cold fields: names, configs). Stable numeric ids, freelist recycling, generation counters to invalidate stale refs.
- **Systems (ordered, each a pure function `(world, dt, rng, events) => void`):**
  `time → weather/events → spawning → guestGoals → guestMovement → queues → rideOps → stallSales → needs/mood → staffAI → breakdowns → economyAccrual → parkRating → milestones → analytics`.
  Adding a mechanic = adding a system + its balance file + its save fields. This is the modularity backbone.
- **Determinism:** single `mulberry32`-family seeded RNG per world (streams per subsystem to keep replays stable under feature addition); sim-time only; identical `(seed, commandLog)` ⇒ identical world. Command log (player actions) is recorded per session — powers tests, repro bugs, and future leaderboard verification.
- **Pathfinding:** guests walk only on path tiles → maintain a **path graph** (nodes = tiles, incremental updates on build/demolish) with A* + per-ride *reachability field* cache (recomputed lazily on dirty). 500 guests × sparse re-plans ≪ budget; movement between nodes is constant-speed with per-guest jitter for organic flow.
- **Snapshots for render:** per tick, sim writes compact interpolation buffers (id, x, y, heading, animState) into preallocated `Float32Array`s double-buffered for the renderer — no GC churn, worker-transferable later.

---

## 6. Grid, land & building

- World: 128×128 tiles; per-tile bitfields: ownership, path?, queue?, occupancy (entity id), reserved-footprint, litter level, beauty cache.
- Placement validation is a pure sim function (used by both the ghost preview and the command executor — one truth).
- Build commands (`place`, `demolish`, `move`, `paint-zone`, `set-price`, …) are the **only** mutation entry points (`SimHandle.dispatch`), each validated + undoable (inverse command stack, 20 deep).
- Track pieces: per-family piece catalogs (from CoasterKit geometry) with connection sockets (entry/exit transform + allowed successors). Track graph validated for closure; train motion = precomputed arc-length parameterization over the piece chain (cheap, deterministic, smooth).

---

## 7. Content-as-data

Every ride/stall/scenery/research/goal/achievement is a typed record in `src/content/*` (validated by Zod schemas at build + test time):

```ts
// content/rides/carousel.ts (illustrative)
export const carousel: FlatRideDef = {
  id: 'carousel', name: 'Carousel', category: 'family',
  footprint: [3,3], capacity: 16, cycleSec: 38,
  stats: { excitement: 4.2, intensity: 1.6, nausea: 1.2 },
  cost: 2200, runningPerDay: 12, reliabilityDecay: 0.5,
  model: assetRef('rides/carousel'), unlock: 'start',
}
```

New content requires **no engine changes** — this is the expandability contract (and the future mod-support seam, `GAME_DESIGN.md §19`).

---

## 8. Rendering architecture

- **Instancing-first:** every model that can appear >10× (path tiles, queue pieces, trees, fences, benches, track pieces, guests) renders via `InstancedMesh` keyed by asset id; per-instance color tint for variation. *v1 sync strategy:* instance lists re-derive from world state on a `worldVersion` bump — edit-rate work, never per-frame (a whole built scene renders in ~17 draw calls). The event-driven freelist wrapper (`InstancePool`, no full rebuilds) is the Phase-4 hardening step if edit-rate rebuilds ever show up in profiles.
- **Guests:** low-poly Kenney characters as instanced meshes with a **procedural walk/bob** (shader-based vertex sway + emote sprite above head) instead of skeletal animation for the crowd; the *inspected/followed* guest swaps to a full skinned clone with real animation. Target 500 crowd instances.
- **Static batching:** completed coaster tracks and dense scenery clusters get merged geometry snapshots when "dirty→clean" (rebuild on edit, amortized).
- **Picking:** three.js `InstancedMesh` raycast picking (instanceId → entity) — simple and fast at Phase-1/2 scale. A GPU id-buffer pass (color-coded instance ids to an offscreen target) is the planned upgrade if profiling ever shows raycast cost at 5k+ pieces.
- **Camera rig:** RTS-style — pan (edge/WASD/drag), orbit, zoom-to-cursor with height-eased pitch, 45°-snap option, follow-guest mode, coaster onboard cam. Constrained to park bounds + min/max zoom.
- **Ghost previews:** dedicated transparent-material layer fed by the same validation function as the sim (§6).
- **Lighting/day-night:** one directional sun (shadow-casting) + hemisphere/ambient fill, driven per-frame by a time-of-day palette curve; sky is a **procedural gradient dome shader** (zenith/horizon stops + sun disc) so dawn/dusk blend continuously — chosen over the static Kenney panoramas, which remain in the pipeline for future weather looks. Fog tracks the horizon color; unlit custom shaders (ground) follow a shared `daylight` scalar.
- **VFX:** GPU particle sprites (coins, dust, confetti, smoke, fireworks) via a pooled points system; never DOM.
- **Postprocessing budget:** none by default; optional subtle bloom+vignette behind a "Fancy" toggle (must hold 60 fps or auto-off).

---

## 9. Save system (from day 1)

- **Format:** versioned JSON: `{ formatVersion, appVersion, seed, simTime, world, entities, economy, meta, commandLogTail }`, gzip-compressed (`CompressionStream`) → IndexedDB (`idb-keyval`), one key per slot + rolling autosave (every game day, keep 3).
- **Migrations:** pure functions `migrate_vN_to_vN+1`; loader chains them; every schema change ships its migration + a fixture test (old save file in `src/sim/save/__fixtures__/`).
- **Export/import:** the same payload as a downloadable `.wanderpark.json` (schema-validated on import with friendly errors) — backup + friend-sharing without accounts.
- **Corruption safety:** write-then-swap (never overwrite the only copy), checksum field, "recover previous autosave" UI path.
- **Settings/profile:** small separate keys (settings, profile, achievements) — never entangled with park saves.

---

## 10. UI layer notes

- Screens & components per `UI_UX_DESIGN.md`; primitives under `src/ui/kit/` are the only building blocks (lint-guarded token usage).
- **Perf contract:** panels subscribe via `subscribeWithSelector` + 4 Hz throttle for numeric readouts; HUD tickers use direct DOM ref updates from the event bus (no React re-render per coin).
- **All strings** in `src/ui/i18n/en.ts` message catalog from the first commit (`GAME_DESIGN.md §14`).
- Input map layer (keyboard/mouse abstraction) with remapping UI; shortcuts per `UI_UX_DESIGN.md §9`.

---

## 11. Asset pipeline (tools/asset-pipeline)

1. **Curate:** `manifest.source.ts` lists each used model: source path in `assets/`, target id, category, transform overrides (scale/rotate/origin), tint slots.
2. **Build step:** for each entry — `gltf-transform` (dedupe, prune, weld, quantize, **meshopt**) → `public/assets/models/<category>/<id>.glb`; textures → KTX2 where beneficial; auto-generate `src/content/asset-manifest.ts` (typed ids ⇒ compile-time safety: a missing model is a type error).
3. **Loading:** drei GLTF loader + meshopt decoder; per-category lazy chunks (coaster pieces load when the coaster builder opens); `<link rel=preload>` for the starter set; IndexedDB HTTP cache relies on immutable content-hashed URLs.
4. **Budgets:** shipped models ≤ 40 MB total, ≤ 120 KB per model avg; enforced by a pipeline check that fails the build with a size report.
5. Licensing recorded per entry (source kit, license) → auto-generates the in-game credits screen (`ASSET_GUIDE.md` is the human-readable side).

---

## 12. Performance budgets (requirements, not wishes)

| Metric | Budget | Enforcement |
|---|---|---|
| Frame rate | 60 fps on a 2020 mid-tier laptop (integrated GPU) with **500 guests + 5,000 placed pieces + 3 running coasters** | perf overlay + stress-park fixture, checked each phase |
| Sim tick | ≤ 4 ms p95 at stress scale | `performance.mark` per system; test asserts pipeline sum |
| Draw calls | ≤ 300 at stress scale | instancing discipline; overlay counter |
| Initial JS (route `/play`) | ≤ 1.2 MB gzip | `next build` budget check in CI |
| Title screen LCP | ≤ 1.5 s (DOM-only title; 3D loads behind it) | Lighthouse CI |
| Shipped assets | ≤ 40 MB total, lazy-chunked | pipeline check (§11.4) |
| Memory | ≤ 600 MB heap at stress scale | manual profile per phase gate |

Perf overlay (`F3`): fps, tick ms per system, draw calls, instances, heap — ships in dev + hidden setting in prod.

---

## 13. Testing strategy

- **Sim unit tests (Vitest):** every balance formula (`GAME_DESIGN.md §15`), placement validation, path graph updates, queue math, economy accrual, rating terms, save round-trip per schema version, migration fixtures.
- **Determinism test:** fixed seed + recorded command log ⇒ world-state hash must match golden hash (runs in CI; catches accidental nondeterminism instantly).
- **Simulation soak:** headless 8-hour fast-forward of a scripted park; asserts: no NaNs, bounded queues/litter, economy within envelope, no id leaks.
- **Playwright smokes:** boot→hub→new park→place path+stall→save→reload→state intact; settings persistence; export/import round-trip.
- **Perf gate per phase:** stress park meets §12 on the reference config.

---

## 14. Build & deployment (Vercel)

- Single Next.js project; `/play` is client-only (`dynamic(() [...] , { ssr: false })` boundary) — no Three.js in server bundles.
- Static assets under `public/assets` with immutable cache headers (content-hashed names from the pipeline).
- Preview deploys per push; production from `main`. Env-free by design in 1.0 (no secrets, no backend).
- CI (GitHub Actions): typecheck, lint, unit, build, size budgets, Playwright smoke on the built output. Deploy blocked on red.
- Error reporting: window.onerror → local ring buffer + "copy diagnostics" button in settings (privacy-first: nothing leaves the browser in 1.0).

---

## 15. Post-1.0: leaderboard backend (the very last step)

- **Storage:** Vercel Postgres (Neon). Tables: `boards(code, created_at)`, `entries(board_code, player_name, avatar_color, park_value, rating, guests, milestone_tier, achievements, difficulty, checksum, client_version, created_at)`.
- **API routes:** `POST /api/board` (create → friendly code e.g. `SUNNY-LLAMA-42`), `POST /api/board/:code/submit`, `GET /api/board/:code` (top N + around-me). Zod-validated, rate-limited (IP + board), size-capped.
- **No accounts:** identity = profile name + locally-kept random submission token (lets you update *your* row, nothing else).
- **Integrity (best-effort, honesty-system acknowledged):** submission includes seed + command-log digest + stat plausibility checks server-side (value/time envelopes); flagged rows render with a 🌱 "unverified" leaf instead of being rejected. Fun > forensics for a friends board.
- **Privacy:** name + stats only; no emails, no tracking; boards expire after 12 months of inactivity.

---

## 16. Risk register (technical)

| Risk | Mitigation |
|---|---|
| Crowd rendering tanks fps | Instanced crowd + procedural anim (§8); cap + graceful density scaling in settings |
| Path graph churn on big builds | Incremental graph updates + lazy reachability caches (§5) |
| Save schema chaos across phases | Migrations + fixtures from the first save field (§9) |
| Asset weight creep | Pipeline budget gate (§11.4) |
| React re-render storms | Selector throttling + DOM-ref tickers (§10); perf overlay watches commit counts |
| Sim nondeterminism creep | CI determinism hash test (§13) |
| Worker migration pain later | Structured-clone-safe state + message-shaped `SimHandle` enforced now (§4) |
| Vercel asset/deploy limits | ship-only-used assets, hashed immutable files, 40 MB cap (§11) |
