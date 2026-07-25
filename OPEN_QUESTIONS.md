# OPEN_QUESTIONS.md — Decision Log

All Phase-0 questions have been **answered by the project owner** (2026-07-25). This file now serves as the decision log; new questions get appended to the "Open" section below with a recommended default, so work never stalls on them.

---

## ✅ Decided

| # | Question | Owner decision | Where it's reflected |
|---|---|---|---|
| Q1 | Theme | **Theme park** confirmed | everywhere |
| Q2 | Title | **Wanderpark** (final; trademark sanity-check before 1.0 still advised) | all docs, `.wanderpark.json` save extension |
| Q3 | Tone of failure | **Family-safe comedic** — malfunctions & repossession comedy, no harm ever | `GAME_DESIGN.md §6.3, §8, §14` |
| Q4 | Platform | **Desktop-first** (min 1280px); tablet best-effort; phone splash | `UI_UX_DESIGN.md §10` |
| Q5 | Coaster builder | **Modular piece-based** (grid pieces + computed stats; no freeform splines) | `GAME_DESIGN.md §4.6` |
| Q6 | Campaign shape | **NO set story/campaign.** One **guided sandbox**: free exploration of how to make money and expand, lightly guided | `GAME_DESIGN.md §10.2, §13` (Opportunities + Guided Start + Penny hints), `ROADMAP.md` Phase 4 |
| Q7 | Language | **English-only** at 1.0 (string catalog still centralized) | `GAME_DESIGN.md §14`, `TECHNICAL_ARCHITECTURE.md §10` |
| Q8 | Music | **CC0 sourcing** (Kenney Audio + curated), selected in Phase 4 | `ASSET_GUIDE.md §5`, `ROADMAP.md` Phase 4 |

### How Q6 is honored (summary)
No scenario list, no medals, no forced objectives. The game is one open mode. Guidance = **milestones** (celebration tiers), **research** (player-chosen unlock direction), **Opportunities** (optional generated goals with rewards — decline freely, zero punishment), and **Penny's contextual hints**. The Guided Start tutorial is a toggle on the new-park configurator, produces a real park you keep, and fades away.

---

## ❓ Open

*(none — next expected owner input is the **"start coding"** green-light for Phase 1, per `ROADMAP.md`)*
