# UI_UX_DESIGN.md — Wanderpark

The visual & interaction spec. Derived directly from the 11 references in `uiinspo/` (Overwatch menus & HUD: images 1–5; Marvel Rivals career/hero/battle-pass/shop: images 6–11). Every screen and component below is built from the tokens in §3 — no ad-hoc styling.

---

## 1. What the references teach (style DNA)

From the `uiinspo/` set we extract these rules:

1. **Hero typography:** huge, italic, condensed, ALL-CAPS display headers with a slight forward skew ("ARCADE", "CAREER", "HERO PROFILE"). Confident, sporty, kinetic.
2. **The angle:** nothing is square. Cards, tabs, chips and panels are parallelograms (skew/clip ≈ 4–8°); accents are diagonal slashes; layered diagonal geometry fills backgrounds.
3. **Vibrant cards on calm fields:** saturated flat color blocks (blue/magenta/teal/green/yellow/orange) with white sunburst/ray texture, sitting on desaturated light-lavender or dark-navy backgrounds with soft depth (blur, facets).
4. **Light content panels, dark chrome:** content cards are near-white with dark navy text (Overwatch options rows, Rivals stat cards); global chrome (top bars, tab strips) is dark navy with white/yellow text.
5. **One loud accent:** yellow/orange for the active tab, the primary CTA, the "NEW!" badge. Never two loud accents on one screen.
6. **Chunky stat blocks:** icon + big number + small caption label (Rivals "Time Played / 10 MINS"), arranged in airy grids inside light panels.
7. **Badges & tags:** small skewed rectangles with punchy labels ("CHANGES DAILY", "REWARD", "LUXURY") docked to card corners.
8. **In-game HUD** (Overwatch): corners hold identity/resources; center stays clear; objective/timer top-center; radial progress for charging actions; everything chunky, high-contrast, glanceable.
9. **Escalating value visuals** (Rivals shop): tiered cards growing in warmth/wealth left→right — we reuse this language for milestone tiers & research tiers (no real-money anything).
10. **Character-forward moments:** big friendly character art anchoring screens (menu heroes) — our equivalent: Penny the advisor + guest close-ups in panels.

**Adaptation note:** those references are competitive-shooter UIs; we keep their *energy* but warm it up ~10% (rounded inner corners on small elements, friendlier copy, pastel park colors in data views) so the management game stays cozy under the sport.

---

## 2. Design principles

1. **Glanceable at 2 m:** any number a player checks often (cash, rating, guests, date, speed) is readable without leaning in.
2. **The park is the hero:** UI hugs screen edges; the 3D view is never covered more than necessary; every panel is dismissible with one action.
3. **One accent, one focus:** each screen has exactly one primary action styled in accent yellow.
4. **Diegetic where free, DOM where honest:** emotes/ghosts/zone banners live in-world; numbers, forms and lists are crisp DOM.
5. **Juice with restraint:** motion is fast (≤200 ms), springy, interruptible; nothing blocks input while animating.

---

## 3. Design tokens (single source: `src/ui/kit/tokens.css`)

### 3.1 Color — "Park Hero" palette
| Token | Hex | Use |
|---|---|---|
| `--ink-900` | `#1B2233` | Chrome bars, headers, body text on light |
| `--ink-700` | `#2C3A52` | Panel chrome, secondary surfaces |
| `--paper-050` | `#F4F6FB` | Content panel background (near-white, cool) |
| `--paper-100` | `#E8ECF6` | Row striping, wells |
| `--lavender-200` | `#C9CFEA` | App background fields, faceted backdrop base |
| `--accent-500` | `#FFB300` | THE accent: primary CTA, active tab, highlights |
| `--accent-600` | `#F09000` | Accent hover/pressed |
| `--card-blue` | `#2E5AE8` | Category card: rides |
| `--card-teal` | `#00A8A8` | Category card: stalls/facilities |
| `--card-magenta` | `#D6337A` | Category card: coasters |
| `--card-green` | `#2FA84F` | Category card: scenery/nature · positive states |
| `--card-purple` | `#7B4FD0` | Category card: management/research |
| `--card-orange` | `#F2742C` | Category card: staff · warnings |
| `--danger-500` | `#E5484D` | Destructive, deficits, breakdown |
| `--info-400` | `#4FC3F7` | Ghost-valid, links, tips |
| Status ramps | green→yellow→red 5-step, colorblind-checked | needs bars, reliability, mood |

Rules: dark text on light panels ≥ 7:1 contrast; accent yellow never used for text on light; category colors always paired with icons + labels (no color-only meaning).

### 3.2 Typography
- **Display:** *Big Shoulders Display* (SIL OFL, Google Fonts) — 800 weight, ALL-CAPS, `font-style: italic`-emulated via 6° skew, tight tracking. H1 clamp(40–72px), H2 28px, H3 20px.
- **UI/body:** *Inter* — 400/600/700; body 15px/1.45; labels 12px caps +4% tracking.
- **Numerals:** Inter tabular-nums everywhere data updates live.
- Dyslexia toggle swaps body to *Atkinson Hyperlegible* (`GAME_DESIGN.md §18`).

### 3.3 Geometry & elevation
- **Skew system:** `--skew: 6deg`. Cards/tabs/chips render as parallelograms (`transform: skewX(-6deg)`, content counter-skewed) or clip-path slashes for full-bleed panels. Small controls (checkbox, slider) stay orthogonal for usability.
- Radii: 2px on skewed cards (crisp), 8px on inner light panels, 999px on pills/dots.
- Elevation: flat fills + 1px inner hairline (`#FFFFFF22` on dark, `#1B223314` on light) + soft ambient shadow `0 8px 24px #1B223326` for floating panels; no glassmorphism blur except the pause veil.
- Background fields: layered low-poly facet SVG (lavender tints) + 12% white diagonal ray texture inside vibrant cards (both from `Kenney_PatternPack`-style generated SVG).

### 3.4 Motion
| Token | Value | Use |
|---|---|---|
| `--t-tap` | 90 ms, ease-out | hover/pressed states |
| `--t-panel` | 180 ms, spring(1, 80, 12) | panel slide/scale in |
| `--t-screen` | 260 ms, diagonal wipe | screen transitions (skewed edge wipe, Overwatch-style) |
| `--t-count` | 400 ms | number roll-ups |
Reduced-motion mode: all → 0/fade-only.

### 3.5 Iconography & imagery
Line-weight-bold flat SVG icons (Lucide base + custom game set: ride categories, needs, staff, weather). Emotes in-world from `Kenney_EmotesPack`. Screen backdrops: blurred beauty-shots of the player's actual park where possible (hub "Continue" card renders latest autosave thumbnail).

---

## 4. Component library (`src/ui/kit/`)

| Component | Spec highlights |
|---|---|
| `HeroHeader` | Skewed ALL-CAPS display title + breadcrumb chip; sits top-left of every full screen |
| `TabStrip` | Dark chrome bar; tabs are skewed chips; active = accent underline slash + yellow text (refs 6–8) |
| `CategoryCard` | Vibrant color card w/ ray texture, icon/silhouette, corner badge slot, hover = lift + 2° extra skew (ref 1–2) |
| `Panel` | Light `paper-050` parallelogram, dark header slash w/ title + close; docks left/right/bottom; drag-repositionable, remembers spot |
| `StatBlock` | Icon + tabular big number + caption; grid-friendly (ref 6–7) |
| `Badge` | Small skewed tag: `NEW`, `BROKEN`, `ON SALE`, milestone tier colors (ref 1, 9) |
| `PriceTag` | Skewed money chip; green/red pulse on change |
| `MeterBar` / `MeterDial` | Needs/reliability bars, mood dial; status ramp + icon + % tooltip |
| `Button` | Primary (accent, skewed, caps), Secondary (ink outline), Ghost, Destructive; all with pressed-skew micro-motion |
| `Slider` | Price/interval sliders w/ value bubble + min/max hints (Overwatch options rows, ref 4) |
| `Toggle/Segmented` | For settings rows on light wells |
| `Toast` | Bottom-right stack; Penny variant with portrait slot; auto-dismiss + hover-pin |
| `Modal` | Rare (destructive confirm, milestone tier & park-over sheets); skewed sheet on dim veil |
| `Tooltip` | 250 ms delay, rich body (title, rule-of-thumb line, numbers) |
| `Checklist` | Tutorial/objective tracker; ticks animate with confetti tick |
| `DataTable` | Sortable (rides list, finances); zebra `paper-100` rows |
| `MiniChart` | Sparkline/area for cash & rating history (uses status ramp) |

---

## 5. Screen flow

```
Boot (logo pulse, asset warm-up)
 └─ TITLE  ── New here? → Profile create (name + avatar color)
     └─ HUB (tab shell)
         ├─ CONTINUE (hero card w/ park thumbnail)
         ├─ MY PARKS (save slots: load/rename/duplicate/export/import/delete)
         ├─ NEW PARK (park configurator: name · map size · funds/debt · difficulty · Guided Start · Freeplay unlocks)
         ├─ ACHIEVEMENTS (badge grid + progress)
         ├─ RECORDS (personal stats; LEADERBOARD tab post-1.0)
         ├─ SETTINGS (Video/Audio/Controls/Gameplay/Accessibility tabs)
         └─ CREDITS (auto-generated from asset manifest)
     └─ LOADING (park name + tip + progress slash)
         └─ IN-GAME (HUD §7) ⇄ Pause veil (Resume/Save/Settings/Photo/Exit)
             └─ Milestone tier sheet (stats roll-up, Continue) · Park-over sheet (repossession)
```

Title screen is DOM-only (fast LCP, `TECHNICAL_ARCHITECTURE.md §12`) over a slow diagonal-pan park beauty render (pre-baked video/imagery until real park exists).

---

## 6. Hub screens (key specs)

- **Layout:** Rivals-style: dark `TabStrip` top; content on lavender facet field; one hero element per tab.
- **NEW PARK (configurator):** a single Rivals-style detail pane (ref 9): park-name field with generate-dice, map size as three `CategoryCard`s (S/M/L with tile counts), funds/debt preset segmented control, difficulty segmented control with modifier tooltips, `Guided Start` and `Freeplay unlocks` toggles with one-line explanations, big accent **BUILD IT** button. No mode select — the guided sandbox is the game.
- **MY PARKS:** rows = park thumbnail, name, value, rating, last played; actions inline; import drops a file anywhere on the screen ("drop save to import" dashed slash).
- **SETTINGS:** Overwatch options anatomy (ref 4): left tab rail, rows of label + control on light wells, footer `RESTORE DEFAULTS`; every row has a tooltip; changes apply live with Undo toast.

---

## 7. In-game HUD (the big one)

### 7.1 Layout map (1920×1080 reference; scales 1280+)
```
┌───────────────────────────────────────────────────────────────────┐
│ [💰 Cash ▲][👥 Guests][⭐ Rating] (TL)   (TC: Objective chip)      │
│                                    [📅 Day/Clock][☀️][⏸▶▶▶] (TR) │
│                                                                   │
│ (L: contextual Panel dock)                 (R: Notification rail) │
│                                                                   │
│              [🔨 BUILD DOCK — bottom-center]                      │
│ (BL: Advisor/Penny toasts)                (BR: selected-tool hint)│
└───────────────────────────────────────────────────────────────────┘
```
Corners busy, center sacred (ref 5). Every HUD cluster hides in Photo mode.

### 7.2 Top bar
Cash (tabular, coin-pop deltas fly into it), guest count, park rating chip (with trend arrow; click → Rating panel), date/time-of-day dial, weather icon (click → forecast strip), speed control `⏸ 1× 2× 3×` (keys `Space,1,2,3`).

### 7.3 Objective chip (top-center)
The most-progressed active Opportunity / nearest milestone with progress slash; click → Goals panel (active Opportunities + current offer + milestone track). This is the "one more minute" surface (`GAME_DESIGN.md §2, §13`).

### 7.4 Notification rail (right)
Skewed toast cards: breakdown (orange, click→jump camera), milestone (gold, fanfare), guest-trend ("12 guests: too expensive!"), event warnings. Grouped, rate-limited, all click-to-locate.

### 7.5 Build dock (bottom-center)
The signature control. A skewed dock of 7 `CategoryCard` minis: **Paths · Coasters · Rides · Stalls · Scenery · Staff · Management**. Click/hotkey (`B` cycle or `1–7`) → dock expands upward into the category tray (grid of item cards: model thumbnail, name, price, lock badge) with search + theme filter. Selecting an item enters placement mode: ghost follows cursor, `R` rotate, `Del` bulldoze mode, `Esc` exits. Tray collapses while dragging-placing (park stays visible).

### 7.6 Panels (left dock, one at a time, `Tab` cycles)
- **Ride/Stall inspector:** header (name, rename, open/close toggle), stats blocks (excitement/intensity/nausea dials, queue, uptime, age), price slider with "guest verdict" hint, reliability meter + inspection interval, income sparkline, actions (renovate, move, demolish).
- **Guest inspector:** §5.5 of GAME_DESIGN — portrait, mood dial, needs meters, wallet, thought log, follow button.
- **Park panel (tabs):** Goals (active Opportunities + offer + milestone track), Finances (P&L table + charts, loans w/ big scary interest row), Guests (aggregate thoughts, demographics), Rides (DataTable), Staff (roster, hire cards, zone paint button), Rating (five-term breakdown w/ hints), Research (4-branch tree, node cards w/ progress slash), Marketing (campaign cards).
- **Coaster builder panel:** piece palette (family-filtered), constraint readouts (slope/radius), live stat preview dials, test-run controls (run/onboard cam/abort), train config, cost ticker, CLOSE CIRCUIT accent button.

### 7.7 In-world overlays
Emote bubbles (billboarded, distance-faded, density-capped), zone banners, queue-length glow on hover, litter/beauty heatmap toggles (`H`), ghost previews, selection outline (accent), breakdown smoke + "!" marker.

---

## 8. Onboarding UI
The Guided Start checklist docks top-left under the top bar (Checklist component); Penny toasts bottom-left with portrait + one sentence + optional "Show me" (camera flies + target element pulses). First-time-topic explainers reuse the same toast with a "Got it, don't repeat" ghost button. All skippable from the first second (`GAME_DESIGN.md §12`).

---

## 9. Input map (defaults, remappable)
`WASD/edge/drag-middle` pan · `Q/E` rotate · wheel zoom-to-cursor · `Space` pause · `1/2/3` speeds · `B` build dock · `P` paths · `C` coasters · `Del` bulldoze · `R` rotate piece · `Z/Shift+Z` undo/redo · `Tab` cycle panels · `F` follow selected guest · `H` heatmaps · `F3` perf overlay · `F12` photo mode · `Esc` universal back/close (tray → tool → panel → pause, in that order).

---

## 10. Responsive & platform posture
Desktop-first (min 1280×720; reference 1920×1080; UI scale setting 90–140%). Tablet landscape best-effort: dock grows hit areas, panels become sheets; phone shows a friendly "grab a bigger screen" splash with a park gif. Cursor: custom pointer + tool-state cursors (build hammer, bulldoze, paint).

---

## 11. Audio UX (with `GAME_DESIGN.md §16`)
UI taps: soft "thock" family (placement = satisfying deep thunk; invalid = rubber "boing", never harsh) · coin clinks pitch-up with combo streaks · milestone = brass sting + crowd cheer swell · breakdown = comedic spring + Penny "uh-oh" toast sound · ambient park loop = crowd walla + distant coaster screams scaled by real guest density/mood (the park *sounds* like its rating). Master/music/SFX/UI sliders + mute-on-blur toggle in settings.
