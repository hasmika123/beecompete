# BeeCompete — Design Brief

**Status:** Living document · **Last updated:** 2026-07-07 · **Type:** Reference — input to **F7** and to every **hero-page design pass** (`development-process.md` §3)

The single home for aesthetic direction and your page-specific input. Claude sessions building UI
read this doc the way they read the glossary — decisions live here, not in chat history.

---

## 1. How this doc is used (the flow)

- **Before F7 (design system):** fill §2–§4. This is the "invest in UI before development" step —
  it turns F7 from *inventing a style while coding* into *encoding already-approved decisions as
  tokens and components*.
- **Before each hero page is built (§5):** its row gets your references/preferences → Claude builds a
  **throwaway HTML prototype** (screenshots/preview for you to react to) → 🧑 **you approve the look**
  → the real page is implemented with `packages/ui` primitives and must match the approved prototype.
- **Utility pages** (settings, admin, plain forms) need no entry here — they assemble from primitives.

## 2. Brand personality *(locked 2026-07-07)*

- **Tone:** ✅ **Energetic but credible** — warm, encouraging, optimistic for students; grown-up
  typography/layout so parents & educators trust it.
- **Inspirations:** ✅ a mix of **Duolingo** (playful energy, bold color) × **Airbnb** (warm,
  human marketplace polish) × **Linear** (crisp, precise, modern).
- **Anti-references:** ✅ avoid ALL of: corporate-sterile enterprise gray · childish/cartoonish
  (comic fonts, clipart) · cluttered old-edu-portal layouts · salesy marketing flash
  (aggressive gradients, popups, urgency timers).

## 3. Visual direction *(locked 2026-07-07 except where noted; seeds the F7 tokens)*

- **Color:** ✅ **logo colors corrected 2026-07-07: `#F5C330` (honey gold) + `#030201` (near-black
  ink)** — the bee palette after all *(supersedes the mistyped `#2596be`; the gold-vs-blue open
  question is dead — gold IS the brand)*. Gold = primary accent; `#030201` = ink. Buttons
  (round-2 locked): **flat gold fill + near-black text, ~12px radius — NO glow/colored shadow**
  (contrast ~12:1; the banned looks: dark buttons with yellow text, and glowing buttons). Gold
  volume confirmed "right" at round 2. Neutral foundation stays cool (Direction B).
- **Direction (locked from round-1 tiles, 2026-07-07):** base = **Direction B** (crisp/modern —
  cool paper ground, hairline borders, tight tracking; **B's cards**), blended with: **A's button
  treatment** (filled accent + soft shadow — **never accent-on-black / yellow-on-black**), buttons
  **more rounded (~12px)**, and **A's card meta tags** (tinted, rounded).
- **Typography:** ✅ **locked 2026-07-07: Inter** (display + body; Segoe UI as the system proxy in
  prototypes). Self-host the font files in `packages/ui` (no Google Fonts CDN — privacy + CSP).
- **Density & shape:** ✅ (from the locked prototype) airy-but-efficient spacing on an 8px scale;
  **~12px radius** on buttons and cards; **hairline 1px borders** as the primary separator;
  **minimal shadows** — a soft lift on card hover only, no ambient/glow shadows.
- **Illustration/iconography:** 🔶 *proposed — confirm at F7:* one **consistent line-icon set**
  (Lucide-style, crisp to match the Linear side), filled/gold variants for active states; small
  spot illustrations for hero/audience/empty states. **Emoji in the prototypes are placeholders.**
  No mascot at launch (bee lives in the logo/mark).
- **Light + dark mode:** ✅ both required (architecture §8), delivered via design tokens. Prototypes
  are **light-first**; dark mode is a token swap in F7, not a separate design pass. The dark
  category-highlight band is a *section treatment*, not dark mode.

## 4. Do / Don't *(grows over time — add whenever you give feedback)*

- **Do:** flat filled-accent buttons on a crisp B-style ground; **CompetitionCards taller and
  narrower** (~220px wide, generous cover + body); **compact category tiles**; **Verified badge =
  subtle green** (✓, muted green on soft green tint), Curated = quiet neutral.
- **Don't:** yellow-on-black (or any accent-on-black) button styling; **no glow/colored shadows on
  buttons**; no oversized tile grids.

## 4b. Page structure *(as important as visual style — owner directive 2026-07-07)*

Every hero page gets a **structural blueprint before any styling or implementation** — zones,
ordering, and the registry features each zone serves — recorded in `docs/page-blueprints.md`.
The hero design pass is therefore two checkpoints: 🧑 approve the **blueprint** (structure), then
🧑 approve the **prototype** (style applied to that structure).

## 5. Hero surfaces *(design pass required — never built without your visual approval)*

**Structure + status live in `docs/page-blueprints.md` (source of truth).** Quick reference:

| Page | Release | Structure | Style prototype |
|---|---|---|---|
| Landing | R1 | ✅ approved | round 2 (Inter, flat buttons, tuned cards) — awaiting final sign-off |
| Competitions (listing) | R1 | ✅ approved | not started |
| Competition detail | R1 | ✅ approved | not started |
| Tracker ("My Competitions") | R2 | ⛔ deferred | — |
| Parent dashboard | R2 | ⛔ deferred | — |

*Anything not listed here is a utility page (assembled from `packages/ui` primitives, no design pass).*

## 6. Assets *(inventory — placeholders until finals, swapped in place)*

- Logo/icon/favicon (light + dark variants) — live in `packages/ui` (architecture §8).
- **Category cover-art system** (owner-approved 2026-07-07): generated category-based default
  covers for CompetitionCards — built alongside F7; real per-competition art overrides when available.
- **Landing hero SVGs**: child illustration + two satellites (competition-card graphic,
  tracker-timeline graphic) — placeholders until owner supplies finals.
- **Demo video** (Landing §4) — placeholder until produced.
- **Value-prop & stats imagery** (Landing §3/§5) — stock/placeholder until finals; stats copy is
  `TODO(owner)` until sourced numbers are supplied (required before the R1 gate).
