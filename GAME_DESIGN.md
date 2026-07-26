# GAME_DESIGN.md — Wanderpark

The complete game design. This document is the **gameplay spec**: if a system ships differently, this file gets updated in the same commit. Balancing values (§15) are *initial targets* — expect tuning, but tune the doc and the code together.

---

## 1. Vision

**You inherit a muddy field and a loan. You leave behind the greatest theme park ever built.**

Wanderpark is a single-player 3D management/building game in the lineage of *RollerCoaster Tycoon*, *Planet Coaster*, *Aquapark Tycoon* and *Two Point Museum*: charming on the surface, a real business simulation underneath. The player alternates between two joys — **creative building** (laying out paths, plazas, themed zones, hand-built coasters) and **systems mastery** (pricing, staffing, research, debt, crisis management). Guests are the connective tissue: visible, opinionated little customers whose thoughts and wallets tell you how you're doing.

**There is no authored story or campaign — by design (owner decision).** Wanderpark is a **guided sandbox**: one open mode where the player freely explores whatever strategy makes money and grows the park, gently guided by milestones, research, optional dynamic goals ("Opportunities", §13) and Penny's contextual hints — never railroaded by mandatory objectives.

### Design pillars

1. **Watchable simulation.** The park is alive and legible: guests queue, snack, cheer, grumble and litter. When something is wrong, you can *see* it before you read it in a chart.
2. **Satisfying by the second.** Every placement thunks, every sale clinks, every milestone fanfares. Feedback is instant, juicy and informative (see §16 "Juice").
3. **Real stakes, cozy tone.** Debt, breakdowns, storms and inspections create genuine pressure — delivered with warmth and comedy, never cruelty (§14).
4. **Depth without homework.** Systems are explained in one sentence, in context, when first needed. Optimal play emerges from simple, composable rules.
5. **Steam-quality presentation.** Boot → title → hub → game like a modern release; UI to the standard of the `uiinspo/` references (see `UI_UX_DESIGN.md`).

### Player fantasies served

- *The Architect* — "my park is beautiful and it's MINE, every path and tree."
- *The Engineer* — "I built that coaster, piece by piece, and people scream on it."
- *The Mogul* — "I turned $25k and a loan into a million-dollar empire."
- *The Caretaker* — "my little guests are happy and I know each system keeping them so."

---

## 2. Core loops

### Minute loop (moment-to-moment)
**Observe → Build/Adjust → Watch reaction → Collect money.**
Place a stall near a long queue → guests break off to buy drinks → coins pop, thirst thoughts vanish → cash ticks up.

### Session loop (15–45 min)
**Expand → Stress → Stabilize → Milestone.**
New ride draws a crowd → paths clog, litter spikes, mechanic overworked → hire staff, widen plaza, raise prices → park rating crosses threshold, milestone reward + new unlocks.

### Long-game loop (hours)
**Milestone tiers → research branches → land expansion → new parks & achievements.**
The guided sandbox has no finish line: the player picks their own trajectory (thrill park? food empire? scenery wonderland?), research chooses what unlocks next, milestones celebrate the climb, Opportunities (§13) offer optional detours, and achievements + additional parks provide fresh starts. Post-1.0: leaderboard park value chase (§17).

### The "one more minute" hooks
At almost any moment, at least two of these should be pending: research finishing, milestone within reach, loan nearly paid, ride under construction, event countdown, an Opportunity at 80%. The HUD surfaces the nearest hook (see `UI_UX_DESIGN.md §7.3`).

---

## 3. World & park structure

- **World grid:** 128×128 tiles; 1 tile = 2 m. Flat terrain in 1.0 (terraforming is post-1.0 backlog; coasters get verticality via supports and elevated track).
- **Starting land:** an owned rectangle (configured at park creation, default 44×44) containing the **park entrance** (fixed on the south edge, connected to the outside world by the *approach promenade*).
- **Land expansion:** adjacent 8×8 plots purchasable; price escalates per plot owned (§15.6). Plots show ghost fencing + price on hover.
- **Park boundary:** auto-fence along owned perimeter. Entrance building (CoasterKit `park-entrance`) holds the ticket gates.
- **In-world clock:** 1 game day = 90 s at 1× speed. Days aggregate into weeks (7 days, finance summary) and months (4 weeks, loan interest + rent-like fixed costs). Day/night lighting cycle runs continuously; park is open all day (guests thin out at night). Seasons are post-1.0.

---

## 4. Building system

The heart of the creative half. Everything placeable shares one interaction model (see `UI_UX_DESIGN.md §7.5` for the build dock UI).

### 4.1 Placement model
- **Grid-snapped footprints** (1×1 up to 6×6 for flat rides; tracked-ride pieces are 1×1-per-piece with height steps). Rotation in 90° steps; scenery may allow 45°.
- **Ghost preview**: valid = hologram blue, invalid = red with reason chip ("Needs path access", "Blocked", "Outside your land").
- **Placement rules:** rides/stalls need ≥1 footprint edge adjacent to path; entrance/exit tiles auto-suggest. Scenery is free-form.
- **Bulldoze** refunds 50% of build cost (scenery 100% within 30 s "undo grace").
- **Undo/redo stack** (20 steps) for build actions.
- **Move tool:** relocating a built piece costs 10% of its build price (free during grace).

### 4.2 Paths & queues
- Path network is the guest circulation graph: straight/corner/junction/steps auto-tile from one "path" brush (CoasterKit path set; wide 2-tile plaza variant).
- **Queue paths** are a distinct brush; a ride opens only when its entrance connects through queue → path.
- Path furniture snaps to path edges: benches, bins, lamps, banners (bins reduce litter radius, benches restore energy, lamps raise night safety/mood).

### 4.3 Flat rides & attractions
Self-contained footprint buildings with stats (§15.2): capacity, cycle time, base excitement/intensity/nausea, ticket price, running cost, reliability. Guests enter via queue, ride a visible animated cycle, exit at the exit tile. V1.0 roster in §11.

### 4.4 Stalls & facilities
1×1 or 2×1 shops: food, drink, dessert, souvenir, info/map, toilets, first aid. Stalls have price sliders per item, cost-of-goods, and satisfaction quality; toilets/first-aid are free-to-use pressure valves for bladder/nausea.

### 4.5 Scenery & theming
Trees, gardens, fountains, statues, fences, rocks, themed props from the kits. Every scenery piece carries **beauty** and optional **theme tag** (Pirate, Space, Castle, Spooky, Winter, Nature). Scenery raises nearby guests' mood and ride excitement (§15.4); coherent theme clusters grant zone bonuses (§10.3).

### 4.6 Coaster builder (tracked rides) — Phase 3 flagship
Piece-by-piece track construction, RCT-style but 3D:
- **Track families (1.0):** Steel Coaster, Log Flume (water), Inverted Coaster, Wild Mouse, Park Monorail (transport ride). Kits provide straights, curves (small/large), slopes, hills, loops, skews per family (CoasterKit, 183 models).
- **Flow:** place station (2–6 tiles) → extend track piece-by-piece with live ghost + auto-support rendering → close the circuit → configure trains (1–3 trains, 2–6 cars) → **test run** with onboard/chase camera → open.
- **Stats computed from geometry** during test: Excitement / Intensity / Nausea (0–10) from drops, speed, inversions, curvature, airtime, nearby theming; plus min/max speed, ride time, capacity/hr (formulas §15.3).
- **Constraints:** max slope per family, min turn radius, chain lift on climbs, block-brake not modeled in 1.0 (single-train safety spacing instead), track must close.
- **Save/share coaster blueprints** (post-1.0 backlog).

> **As shipped (Phase 3):** two families live — **Wild Mouse** and **Log Flume** — with a
> 7-piece vocabulary: station (2 tiles, chain 1.4 u/s), straight, corner L/R (radius-2
> quarter turns; one model serves both chiralities — a left is the right corner anchored at
> its exit), slope up/down (4 tiles, ±1 height level, chain lift on climbs), vertical loop
> (4 tiles, inversion). Grid-snapped N/E/S/W headings, height levels 0–6 (cap raisable by
> the *Extreme Engineering* perk — pending). The builder is button/hotkey-driven from the
> station outward with a live ghost, home beacon, distance-to-close hint, live stats & cost;
> commit is a single undoable `build-coaster` command. One train per coaster (2 cars),
> arc-length-spaced. Steel/Inverted/Monorail families, train config and the test-run
> onboard cam are the Phase-4/5 content & polish slice — the piece math is family-agnostic,
> so new families are data + models, not new systems.

---

## 5. Guests

The stars of the simulation. Target: **500 concurrent guests** at 60 fps (perf contract, `TECHNICAL_ARCHITECTURE.md §12`).

### 5.1 Spawning & population
Guests spawn outside the entrance at a rate driven by **park appeal**: `f(park rating, ride variety, entry price value, marketing, weather, day/night)` (§15.5). Each guest arrives with: name (generated, e.g. "Greta Loopington"), money ($40–120), preference profile (thrill-seeker / family / chill; sweet-tooth vs savory), and patience trait.

### 5.2 Needs (0–100, decay over time; §15.1 rates)
| Need | Filled by | Critical symptom |
|---|---|---|
| **Fun** | Rides (scaled by excitement × preference match) | "I'm bored", leaves early |
| **Hunger** | Food stalls | Grumpy thoughts, mood sink |
| **Thirst** | Drink stalls | Decays faster in heat |
| **Energy** | Benches, gentle rides, monorail | Walks slower, skips far rides |
| **Bladder** | Toilets | Urgent beeline; big mood hit if unmet |
| **Nausea** *(status)* | Rises from intense rides; falls idle; first aid clears | Vomit event → litter + mood hit for witnesses |

**Mood** (0–100) = weighted needs + recent experiences (ride joy, queue overrun, litter seen, prices felt as unfair, weather exposure). Mood drives spending, staying time, thought bubbles, and the park-rating guest term.

### 5.3 Behavior (finite-state machine)
`Enter → Wander/Choose goal → Travel (A* on path graph) → Queue → Ride → Exit ride → …repeat… → Leave`.
Goal choice = utility scoring of nearby options vs needs (with preference weights + novelty bonus for un-ridden rides). Guests only walk on paths (classic tycoon model). Queue tolerance = f(patience, expected wait vs perceived ride value); bail-outs leave a negative thought.

### 5.4 Thoughts & emotes
Every significant experience emits a thought (log per guest, aggregated in panels) + floating emote bubble (EmotesPack): 💚 joy after a great ride, 🍔 hunger, 🤢 nausea, 💢 queue rage, 💸 "too expensive!". Aggregate thought analytics are a first-class management tool ("23 guests think the Log Flume is too expensive").

### 5.5 Guest inspector
Click any guest: portrait, name, mood dial, needs bars, wallet, current goal, thought history, preference tags. Pin favorites to follow with a chase camera.

---

## 6. Economy

### 6.1 Money flows
**In:** park entry tickets, ride tickets, stall sales, milestone/objective rewards, loans.
**Out:** construction, staff wages (weekly), ride running costs (daily), stall cost-of-goods, loan interest (monthly), marketing campaigns, repairs, event fines/payouts, research funding.

### 6.2 Pricing
Player sets: park entry, per-ride tickets, per-item stall prices. Guests compare price to **perceived value** (ride stats, hunger level, weather for drinks/umbrellas) — overpricing produces refusals + "rip-off" thoughts; free-entry/high-ride-price (pay-per-ride) vs high-entry (all-inclusive feel) are both viable strategies. Price elasticity in §15.5.

### 6.3 Loans & debt (a pillar of tension)
- Every new park starts carrying debt by default ($10,000 at 8%/yr, monthly interest; configurable at creation).
- Bank offers up to a credit limit = f(park value); each additional tranche costs +1.5% rate.
- **Debt spiral warning UX:** interest > 25% of weekly profit triggers advisor warnings; missed payments (cash < interest) add penalty fees and −50 park rating.
- **Repossession spiral (the fail pressure):** after 3 consecutive missed payments the bank starts seizing and auctioning assets one at a time (comedic, brutal, recoverable — sell-off, refinance and staff cuts can still save you). If the **park entrance** itself is ever seized, the park is over: a firm-but-kind "Bank Owns The Fun Now" sheet with stats roll-up, then restart or rewind-to-autosave. Severity scales with difficulty (§15.7).

> **As shipped (Phase 3):** interest accrues **daily** at APR/364 (simpler feedback loop
> than monthly — a deliberate deviation). Tranches are $5,000 each at +1.5% APR; credit
> limit = 60% of park value (+$10,000 base allowance). A miss (cash < the day's interest)
> costs a $100 penalty + a guest-mood hit; the third consecutive miss seizes the
> highest-value ride/scenery — 55% of its auction price pays down debt, the bank pockets
> the rest — and leaves you at "one more chance". Nothing left to seize → the park-over
> sheet ("The bank owns the teacups now") with stats roll-up, *Back to the hub* or
> *Wander the ruins*. Soak-tested both directions (ROADMAP P3 acceptance #3).

### 6.4 Research (Phase 3)
Fund a workshop ($/week, 3 speed tiers) to progress one of four branches: **Thrill** (coasters, intense flats), **Family** (gentle rides, entertainment), **Food & Retail** (stall tiers, souvenirs), **Operations** (staff efficiency, marketing tiers, reliability upgrades). ~24 nodes for 1.0 (§11.4). Research is the guided sandbox's unlock spine — the player chooses which branch to push, which *is* the "explore what works for you" freedom. (A "Freeplay unlocks" toggle at park creation starts with everything open for pure creative play.)

> **As shipped (Phase 3):** 4 branches × 6 nodes exactly as §11.4; funding tiers are
> **per-day** — Paused $0 (0×), Standard $150 (1×), Turbo $400 (1.8×) — charged at day
> rollover while a branch is active. Freeplay parks skip content gates but still research
> perk nodes.

### 6.5 Marketing
4 campaign types (flyers, radio, TV, influencer visit), each: cost, duration, targeted guest-type boost. Diminishing returns; a "marketing hangover" if the park under-delivers on the promise (rating < advertised expectation → temporary appeal dip). Unlocked via Operations research.

> **As shipped (Phase 3):** Flyer Blitz $500/3d/×1.15 · Radio Spots $1,200/4d/×1.3 ·
> TV Advert $3,000/5d/×1.5 · Influencer Day $2,000/2d/×1.8 (arrival multipliers). One
> campaign at a time, gated on the *Marketing Licence* perk. Hangover: rating < 500 at
> campaign end → arrivals ×0.8 for 2 days. Weather also multiplies arrivals (sun 1.1,
> cloud 1.0, rain 0.55, storm 0.2 + everyone-leaves, heatwave 0.95 with ×1.7 thirst), and
> six dynamic events spice the days: VIP visit, safety inspection, influencer moment,
> coaster club (+2 excitement on coasters), litter rats, lost wallet.

---

## 7. Staff

Hire/fire from the management panel; each staffer has a wage, a patrol zone (paintable tiles) and simple skill growth with tenure.

| Role | Job | Neglect symptom |
|---|---|---|
| **Mechanic** | Inspect (preventive) + repair breakdowns | Rides break often, stay broken, rating tanks |
| **Janitor** | Sweep litter/vomit, empty bins, mow | Litter spiral → disgust thoughts, rats event |
| **Entertainer** | Patrol in costume; boosts queue mood | Long queues become bail-outs |

Security is post-1.0 (vandalism appears only as a rare event in 1.0). Staff pathfind on paths + staff-only gates; wages weekly; overworked staff (zone too big) show a red "!" and work slower — the fix is hiring, zoning, or Operations research perks.

> **As shipped (Phase 3):** hire/fire from the Staff dock tray (janitor $50 + $110/wk,
> mechanic $80 + $160/wk, entertainer $60 + $130/wk; cap 24). No patrol zones yet — staff
> self-assign park-wide: janitors hunt the nearest litter, mechanics claim broken rides,
> entertainers work the longest queue (patience relief + fun sprinkle within 3 tiles), all
> idle-wander otherwise. Skill grows with jobs done (mechanics repair up to 50% faster);
> *Golden Brooms* / *Swift Wrenches* perks stack on top. Zones + the overworked marker
> arrive with Phase-4 polish.

---

## 8. Rides operations, breakdowns & maintenance

- Each ride has **Reliability** (100% → decays with age/cycles; §15.3) and an inspection timer. Mechanic inspections restore reliability; skipping them raises breakdown odds.
- **Breakdown:** ride stops, queue freezes, comedic malfunction VFX (smoke puffs, boinging springs — never harm). Mechanic travels, repairs (repair time ∝ severity), costs $. Frequent breakdowns → guests distrust the ride (temporary excitement penalty).
- **Aging:** after ~5 in-game years a ride's base appeal depreciates; **Renovate** (40% of build cost) resets it — long-term parks must reinvest, not just extract.
- Player levers: per-ride inspection interval, ride ticket price, open/close, renovate, demolish.

> **As shipped (Phase 3):** reliability decays 2.2/day + 0.22/cycle; breakdown odds rise
> as it falls (§15.3 as-built). A breakdown stops the ride mid-cycle with smoke-puff VFX,
> flushes the queue with a grumble, and waits for a mechanic — or a **$250 contractor**
> (90 s). **Renovate** (40% of build cost) resets reliability to 100 any time it dips
> below 70. The scheduled-inspection lever and age depreciation land with the Phase-5
> balancing pass; the random *safety inspection* event already fines shabby parks ($150
> per ride under 50 reliability).

---

## 9. Park rating (0–1000)

The single headline KPI (RCT homage), always in the HUD, recomputed continuously from five weighted terms (§15.4): **Guest happiness** (35%), **Ride portfolio** (25% — count, variety, excitement spread, uptime), **Cleanliness** (15%), **Scenery & theming** (15%), **Value perception** (10%).
Rating gates milestones (§10.1), drives spawn rate, and is the primary leaderboard stat family (§17). The rating panel shows each term with its trend and top 3 "what's hurting you now" hints — management legibility is a pillar.

---

## 10. Progression

### 10.1 Milestones (per park)
Rating/guest-count thresholds award named tiers (Local Attraction → Rising Star → Regional Star → National Treasure → World Wonder; $500–$10,000 awards), each granting a cash bonus — cosmetic flourishes (entrance upgrades, fireworks) and the free research node join in Phases 3–4. Milestone fanfares are the session loop's exclamation points.

### 10.2 The Guided Sandbox (the one and only mode)
**No campaign, no mandatory objectives — owner decision.** "New Park" opens the configurator: park name, map size (S/M/L), starting cash & debt preset, difficulty (§15.7), **Guided Start** toggle (§12, default ON for the first-ever park) and **Freeplay unlocks** toggle (default OFF → research progression on). Guidance is ambient, optional and player-serving: milestones (§10.1), Opportunities (§13), Penny's contextual hints, and the rating panel's "what's hurting you" hints. Players find their own path to money and growth — thrill empire, boutique garden park, food-court economy: all viable.

### 10.3 Theming zones
≥8 same-theme scenery pieces within a radius around ≥1 ride forms a **named zone** (player-nameable, auto-suggested: "Pirate Cove"): +excitement to zone rides, +mood to zone guests, zone banner on the map. Drives the Planet-Coaster fantasy of *places*, not just objects, and makes scenery economically rational.

### 10.4 Achievements (~25)
Cross-save badges in the hub (examples): *First Blood(less)* — survive 10 breakdowns; *Loop Scholar* — coaster with 3 inversions ≥7 excitement; *Debt-Free* — repay $50k; *Penny Pincher* — profitable week with entry ≥ $30; *Full Bladder Economy* — 1,000 toilet uses. Stored in the local profile (§17).

---

## 11. Content catalog v1.0

Counts are commitments for 1.0; sources per `ASSET_GUIDE.md` mapping table.

### 11.1 Tracked rides (5 families)
Steel Coaster · Log Flume · Inverted Coaster · Wild Mouse · Park Monorail — full piece sets from Kenney CoasterKit (stations, supports, trains included). *(Phase 3 ships Wild Mouse + Log Flume; the remaining three are Phase-4/5 content on the same piece system.)*

### 11.2 Flat rides & attractions (12)
Carousel, Ferris Wheel, Drop Tower, Spinner/Teacups, Swing Ship, Bumper Cars, Haunted Manor (GraveyardKit build), Star Simulator (SpaceKit build), Mini-Golf (MinigolfKit, walk-through attraction), Go-Kart Circuit (RacingKit/ToyCarKit), Swan Boats (WatercraftKit, on placed water basin prop), Park Railroad Station ride (TrainKit). *Flat-ride hero models are composed from kit parts and/or sourced CC0 (Quaternius/PolyPizza) per `ASSET_GUIDE.md §7`.*

### 11.3 Stalls & facilities (10)
Burger Bar, Pizza Corner, Ice-Cream Dream, Candy Stand, Drinks Depot, Coffee Cart, Souvenir Shop, Info Kiosk, Toilets, First-Aid Post (CoasterKit stalls + FoodKit/RestaurantBits props for theming).

### 11.4 Research tree (24 nodes, 4 branches × 6)
Each branch alternates content unlock → systemic perk → content → … ending in a flagship (e.g., Thrill: Inverted Coaster; Operations: "Predictive Maintenance" −40% breakdowns).

### 11.5 Scenery (60+ pieces, 6 theme sets)
Nature (NatureKit), Pirate (PirateKit), Space (SpaceKit/ModularSpaceKit), Castle (CastleKit/Medieval), Spooky (GraveyardKit/Spooktober), Winter (HolidayKit) + generic park furniture (benches, bins, lamps, fountains, flags).

---

## 12. Onboarding & tutorial

**Golden rule: teach in context, one sentence at a time, always skippable.**

- **Guided Start** (a toggle in the park configurator, default ON for the first-ever park, never a separate mode): advisor **Penny** (CuteCharacters model, big friendly emotes) walks the player through a checklist that mirrors the real loop — build path → place Carousel → connect queue → set price → open park → first 10 guests → place food+drink+toilet → hire janitor → reach rating 300. Each step: short Penny toast + glowing UI target + checklist tick. ~15 minutes, skippable at any second, and the park it builds is a *real park the player keeps playing* — the guidance simply fades out.
- **Contextual first-time tips:** the first breakdown/litter-spiral/loan-warning/storm each triggers a one-time Penny explainer (dismiss forever per topic).
- **Tooltips everywhere:** every stat, slider and icon has a hover/long-press tooltip with the plain-English rule ("Excitement ↑ spawn rate and queue tolerance").
- **Codex ("Park Manual")**: searchable in-game reference auto-unlocking articles as systems appear; no mandatory reading.

---

## 13. Opportunities — the "little bit guided" layer

Optional, dynamic, contextual goals that give direction without ever taking the wheel. This system replaces a scenario campaign (owner decision: guided sandbox only).

### Rules
- At most **2 active + 1 offered** at a time; a new offer surfaces every 2–4 game-days (rating-scaled).
- Offers are **generated from current park state** (template + parameter fill), so they always feel like sensible next steps, never homework.
- Player can **accept, decline, or reroll** (declining is free; offers expire quietly). Accepted Opportunities show on the objective chip and Goals panel with progress.
- Rewards: cash bonus, free research node, rare cosmetic scenery, temporary buffs (marketing surge). Completion = fanfare + Penny cheer; failure = quiet expiry, zero punishment.
- Cadence, template pool and reward scaling live in `content/goals/` + `sim/balance/` like all content (`TECHNICAL_ARCHITECTURE.md §7`).

### Template categories & examples
| Category | Example (parameters auto-filled from park state) |
|---|---|
| Growth | "Host **120** guests at once" · "Reach park rating **450**" |
| Builder | "Open a coaster with excitement ≥ **6.0**" · "Create a themed zone with **8** Pirate pieces" |
| Economy | "Bank **$8,000** profit in a week" · "Sell **50** burgers in 2 days" |
| Operations | "Keep cleanliness above **80%** for 3 days" · "Zero breakdowns for a week" |
| Visitors (flavored) | "A coaster club visits Friday — have **2** coasters open" · "VIP critic incoming: rating **500+** when she arrives" |
| Care | "Get average guest mood above **75**" · "10 guests leave the park happy in a row" |

### Penny's hint engine (the other half of "guided")
State-driven, throttled, dismissible-forever-per-topic suggestions: thirst thoughts trending → "A drinks stall near the Wild Mouse would print money right now"; cash idle > $30k → "That savings pile could be a coaster"; rating term lagging → points at the weakest of the five terms. Hints never repeat within 3 game-days and never interrupt building.

---

## 14. Tone, writing & content safety

- **Voice:** warm, quick-witted, lightly absurd. Breakdown: *"The Tilt-o-Tron is currently performing interpretive dance. A mechanic is on the way."* Bankruptcy: firm but kind. Never sarcastic at the player's expense.
- **Family-safe, no harm:** rides *malfunction*, they never crash into people; guests get comedically grumpy/nauseous, never injured. No gambling mechanics, no real-money anything.
- **Guest dignity:** generated names/thoughts are silly-affectionate, never mocking demographics; guest models use the kits' inclusive set (varied bodies, wheelchairs — paths are universally accessible by design, wheelchair guests are equal riders, no special penalty).
- **Localization posture:** English-only at 1.0; ALL strings in one message catalog from day 1 (`TECHNICAL_ARCHITECTURE.md §10`).

---

## 15. Balancing reference (initial targets)

Single source of truth for numbers; mirrored in `src/sim/balance/*.ts` once coding starts.

### 15.1 Needs decay (points per **sim-hour**; 24 sim-hours = 1 park day = 90 real s at 1×)
Fun −4 (idle) · Hunger −2.2 · Thirst −3 (+50% in heat, Phase 3) · Energy −1.6 · Bladder +0.9/h passive, +18 per meal, +26 per drink · Nausea: +f(ride intensity − tolerance), −5 idle (fuller model Phase 3). A guest arriving at 60 hunger seeks food (~35) after roughly half a park day. Mood = 0.4·min(needs) + 0.6·avg(needs) + experience modifiers (each thought ±2–9, decaying).

### 15.2 Flat ride envelope (Carousel → Sky Plunge, as shipped)
Build $2,200–$4,200 · footprint 2×2–4×3 · capacity 8–20 · cycle **7–12 real seconds** (≈2–3 park hours — cycles live in real time so rides stay watchable against 90 s days; boarding 3 s, unload 1.8 s, part-full dispatch after 7 s) · excitement 4.2–6.5 · intensity 1.4–6.8 · nausea 0.8–4.2 · running $12–22/day · default ticket $3–5.50 · reliability decay arrives Phase 3.

### 15.3 Coaster stat formulas (as built in Phase 3)
- Physics: energy model per piece — v² ← v²·0.985 + 2·5.2·(−Δh), clamped 1.0–8.5 u/s; stations/chain lifts force 1.4/1.6 u/s; two convergence laps. km/h = u/s × 2 × 3.6.
- Excitement = 1.2 + 0.9·drops + 1.4·inversions + 0.028·max_speed(km/h) + 0.35·airtime_s (0.5/drop) + 0.12·turns, clamp 0–10. *(Theming bonus & roughness join with the Phase-4 theming zones.)*
- Intensity = 0.020·max_speed + 1.1·inversions + 0.5·drops + 0.15·turns, clamp 0–10.
- Nausea = 0.55·intensity + 0.45·inversions − 0.9·family_smoothness (mouse 0.4, flume 0.7), clamp 0–10. Guests reject rides with intensity > tolerance+2; excitement→value: perceived $ ≈ excitement × $0.90.
- Breakdown chance/day = 0.3 × (2 − reliability/100) × perk_mult (Preventive Care 0.65, Predictive 0.4); mechanic repair restores +70 reliability (skill/perk-scaled speed).
- Piece prices: straight $180 · corner $240 · slope-up $380 · slope-down $320 · loop $1,400; family base — Wild Mouse $8,000 (ticket $4.50, upkeep $26/day), Log Flume $9,000 (ticket $4.00, upkeep $24/day).

### 15.4 Park rating terms
happiness_term = avg(mood)·10 → ×0.35 · rides_term = (Σ excitement capped, variety bonus, uptime %)→ ×0.25 · cleanliness (litter/vomit density, bin coverage) ×0.15 · scenery (beauty density near paths, zone count) ×0.15 · value (avg "fair price" verdicts) ×0.10. Displayed with per-term trend arrows.

### 15.5 Spawning & price elasticity
Base spawn/day = 20 + rating·0.35, ×weather (sun 1.1, rain 0.55, storm 0.25), ×marketing, ×entry_value where entry_value = clamp(1.6 − entry_price / (6 + 0.02·rating), 0.2, 1.4). Guest budget $40–120 (normal-ish distribution; thrill-seekers richer, families thriftier).

### 15.6 Money anchors
Start cash $25k (default) · path $10/tile, queue $14 · bench/bin/lamp $50/35/60 · stall build $250–600, item cost-of-goods 30–40% of default price · staff wages/wk: janitor $110, mechanic $160, entertainer $130 · land plot $2,400 + $800·plots_owned · loan: base 8%/yr, +1.5% per tranche, credit limit = 0.6·park_value · marketing $500–5,000 per campaign-week. Target arc (Classic difficulty): break-even by day 8–12, first coaster affordable ~day 15–20, $1M park value ~ hour 6–8 of play.

### 15.7 Difficulty modifiers
Relaxed: +40% start cash, interest 4%, breakdowns −50%, guests +15% patient. Classic: baseline. Tycoon: −30% start cash, interest 11%, breakdowns +40%, elasticity harsher, events more frequent. Difficulty is per-park, badge-stamped on saves/leaderboard entries.

---

## 16. Juice & feedback (non-negotiable polish list)

Placement thunk + dust puff · demolish confetti of parts · coin-pop on every sale with daily-total ticker · guest emotes bubbling constantly · milestone fanfare with park-wide firework burst · rating tick-up shimmer · queue-length heat glow on hover · coaster test-run onboard camera with wind SFX · money-loss red pulse on the wallet, never a modal · advisor Penny reacts (cheers/facepalms) in her toast portraits · photo mode (Phase 4): free camera, DOF, time-of-day slider, stickers, PNG export (drives sharing without accounts).

---

## 17. Meta, saves & leaderboard (post-1.0)

- **Local profile:** display name + avatar color chosen on first launch (editable; no account, no email). Profile holds achievements, settings, lifetime records.
- **Saves:** multiple named parks, autosave slot per park, export/import as `.wanderpark.json` file (backup/share). See `TECHNICAL_ARCHITECTURE.md §9`.
- **Leaderboard (the very last roadmap step):** opt-in submission of headline stats (park value, rating, guests, milestone tier, achievements count + integrity checksum + difficulty badge) under the profile name to a Vercel-hosted board with friend-group codes ("join board `SUNNY-LLAMA-42`"). No accounts; abuse mitigations in `TECHNICAL_ARCHITECTURE.md §15`.

---

## 18. Accessibility

Color-blind-safe status palettes (never color-only meaning) · full keyboard map + remapping · UI scale 90–140% · reduced-motion mode (disables shakes/parallax) · reduced-flash mode · subtitles/visual cues for all audio signals · pause-anywhere; sim never punishes pausing · dyslexia-friendlier font toggle · Penny explainers use plain language. Guest inclusivity per §14.

---

## 19. Out of scope for 1.0 (explicit)

Authored story/campaign/scenarios (**by owner decision — permanently out unless requested**) · terraforming/water-table editing · multiplayer/co-op · ride crashes & injuries · security staff/vandal system · weather beyond sun/cloud/rain/storm/heatwave · seasonal calendar · coaster blueprint sharing · mobile-touch-first layout (desktop-first; tablet best-effort) · mod support (architecture keeps catalogs data-driven to enable it later) · monetization of any kind (free game, forever).
