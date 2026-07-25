# OPEN_QUESTIONS.md — Decisions for the Project Owner

Planning is complete and internally consistent, but a few calls are yours. **Each question ships with the default I've assumed** — if you say nothing, the default stands and development can proceed without pause. Answer any of these in a normal message; docs get updated accordingly.

---

## Q1 — Theme confirmation 🎢 *(the big one)*

The docs commit to a **classic theme/amusement park** (coasters, flat rides, food stalls, themed zones). The asset evidence made this call: CoasterKit alone provides 5 coaster track families *plus* paths, queues, stalls, stations and a park entrance, and the themed kits (Pirate/Space/Castle/Spooky/Winter) map perfectly to Planet-Coaster-style zones.

- **Default (assumed): Theme park.**
- Alternatives the same architecture supports if you'd rather: waterpark-focused (leans MarbleKit/flume; weaker asset coverage), or a hybrid "park with waterpark district" as post-1.0 expansion.

## Q2 — Game title 🏷

- **Default (assumed): “Park Mogul”** as *working title* — used in docs, easy to replace project-wide before Phase 4 (branding/title screen art lands there). Alternatives brainstormed: *Coaster Kingdom, Parkline, Wonderfield, Funfair Empire, Loop & Ledger*. No trademark search done yet — before 1.0 we should sanity-check the final name.

## Q3 — Tone of failure 🎭

Docs specify family-safe comedy: rides *malfunction* (smoke, springs, grumpy guests) but never crash/harm anyone; bankruptcy is firm-but-kind (`GAME_DESIGN.md §14`).

- **Default (assumed): family-safe comedic.** If you want darker RCT-style edge (crashes, injuries), say so — it changes VFX, copy, and content-safety posture.

## Q4 — Platform posture 🖥

- **Default (assumed): desktop-first** (min 1280px, mouse+keyboard), tablet best-effort, phones get a friendly "bigger screen" splash. Full touch/mobile support is a large extra scope — flag it now if it matters to you and I'll add a phase.

## Q5 — Coaster builder ambition 🎢

Chosen scope: grid-snapped modular pieces (the kits' shapes) with computed stats — deep but tractable. Planet-Coaster-style freeform splines are out (incompatible with the kit pieces and a huge cost).

- **Default (assumed): modular piece-based builder.** Confirm you're happy that coasters feel like "RCT-in-3D", not freeform sculpting.

## Q6 — Scenario count & campaign shape 📚

- **Default (assumed): 8 scenarios + sandbox at 1.0** (`GAME_DESIGN.md §13`), linear-ish unlock (finish bronze to unlock next). More scenarios post-1.0. Tell me if you want a bigger/smaller campaign or fully-open scenario select.

## Q7 — Language 🌍

- **Default (assumed): English-only at 1.0**, but every string lives in a message catalog so adding German (guessing from your setup 😉) later is data-entry, not surgery. Say the word if German should ship *at* 1.0.

## Q8 — Music sourcing 🎵

- **Default (assumed):** CC0 music/SFX (Kenney Audio + curated CC0 sources) selected in Phase 4. If you have licensed tracks or a specific vibe (chiptune vs orchestral-lite vs lo-fi), note it before Phase 4.

---

*When you're happy with the plan: say **"start coding"** (optionally with answers to any of the above) and Phase 1 — Foundation begins per `ROADMAP.md`.*
