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
- **Before styling any new UI element type (owner rule, 2026-07-08):** when an element or surface
  gets its *first* styling — buttons, sign-in/auth pages, dropdowns, modals, cards, empty states,
  etc. — **ask the owner for reference images** rather than inventing a look. This applies **even
  when a locked decision already covers the element** (owner, same day: re-confirm locked styles
  like buttons/cards/badges with references at first styling — the lock is the fallback if the
  owner has nothing new). **Sole exception: typography** — just settled from reference images
  (§3, rev 2026-07-08), don't re-ask. Record supplied references here so each element type is
  asked once. Detail execution (exact sizes/weights/spacing within a supplied direction) stays
  builder judgment, per the typography precedent.
- **Delegation in effect (owner 2026-07-08, answers the F7 reference request):** for the current
  styling pass — **F7 primitives and element/page styling generally** — the owner delegated the
  decisions to the builder: build to **trending, clean, organized, rounded** direction (§3/§4)
  without further pre-asking. The owner steers **reactively**: if a specific component misses,
  they supply reference photos and it gets revised (record them here when that happens). The
  pre-ask above still applies when a **genuinely new surface type** first appears in a later
  phase (e.g., sign-in/auth pages at R2).
- **Utility pages** (settings, admin, plain forms) need no entry here — they assemble from primitives
  *(whose styling followed the reference-image rule above)*.
- **Admin tooling (R1-3) delegated (owner 2026-07-12):** the internal admin surface — incl. its
  *new* element types (data tables, admin shell/sidebar layout, upload dropzone) — is **builder
  judgment**: clean/minimal on the existing tokens + primitives. Owner steers reactively with
  references if something misses. Internal-only; the public-surface pre-ask rule is unchanged.
- **R1-6/R1-6b public pages delegated (owner 2026-07-12):** for the marketplace + public page
  set build (Landing, Competitions listing, How It Works, Categories index, and their new
  element types — CompetitionCard, category tiles/strip, filter panel, hero image cards, nav/
  footer, digest band), **styling is builder judgment** on the locked direction (§2–§4) and the
  approved blueprints — the §5 style-prototype checkpoint is waived for these pages. Owner
  steers **reactively** with reference photos; record any supplied references here.

### Supplied reference photos *(record each here — element type asked once)*

- **Tabs → "attached" variant (owner 2026-07-08):** reference photo of a trading site (101Investing)
  showing **connected tabs** — the active tab is a filled rounded-top riser that merges seamlessly
  into a filled content card below it (a "folder tab" look), inactive tabs are plain muted text.
  Built as `Tabs variant="attached"` (the `underline` variant remains the default). Adapted to
  tokens: the card uses `surface` (soft grey in light, near-black in dark — matches the reference's
  dark card) rather than a hardcoded black, so it works in both modes.

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
  question is dead — gold IS the brand)*. Gold = primary accent; `#030201` = ink (a **brand/logo
  constant** — text-on-gold — not a UI fill). **Neutral foundation is WARM, not cool (owner
  feedback 2026-07-08, supersedes "cool Direction B ground"): no harsh #000 blacks anywhere** —
  warm paper ground (`#faf9f5`), warm charcoal text/fills (`#29281e`/`#3d3929`), and **dark mode
  is a warm Claude-style dark gray (`#262624` ground), never black.** Token values live in
  `packages/ui/src/styles/tokens.css`.
- **Buttons (owner delegated to builder 2026-07-08 — supersedes the round-2 "flat gold fill"
  lock):** treatment is the builder's call, guided by the reference aesthetic: **pill-rounded**;
  primary = **ink fill + white text** (Mindly-style); **gold moves to a "brand" variant** (gold
  fill + ink text) for standout CTAs; secondary = soft surface fill + hairline border. Still
  **NO glow/colored shadows**, and the banned looks stand (no yellow-on-black / accent-on-black
  text). Owner reacts with reference photos if a result misses.
- **Direction (locked from round-1 tiles, 2026-07-07):** base = **Direction B** (crisp/modern —
  cool paper ground, hairline borders, tight tracking; **B's cards**), blended with: **A's button
  treatment** (filled accent + soft shadow — **never accent-on-black / yellow-on-black**), buttons
  **more rounded (~12px)**, and **A's card meta tags** (tinted, rounded).
- **Typography:** ✅ **revised 2026-07-08 (owner, from supplied reference images — supersedes
  "Inter everywhere" 2026-07-07 and the heavy-weight "headline energy" rule):** a **two-font
  pairing** in the style of the reference (Mindly-like editorial landing):
  - **Display serif for headlines** (hero, section headings, card question-style titles) —
    *similar* to the reference, not a clone. **Decided at F7 (owner feedback 2026-07-08):
    Fraunces** (OFL, variable weight + optical size) at **~560 weight — titles must never look
    thin** (Instrument Serif's single thin cut was rejected for exactly that). **Italic serif
    accents are welcome sparingly** — an italic word in a headline, a pull-quote — for the
    Airbnb-warm touch (owner). Sizes/tracking remain builder judgment; hero *prototype*
    approvals in §5 remain the owner checkpoint.
  - **Inter stays for body/UI** (paragraphs, buttons, forms, labels, nav — matches the sans in
    the reference images). Segoe UI remains the system proxy in prototypes (serif proxy:
    Georgia).
  - Unchanged: **self-host all font files in `packages/ui`** (no Google Fonts CDN — privacy +
    CSP); oversized friendly numerals for stats (now set in the display serif).
- **Density & shape:** ✅ (rev 2026-07-08, owner) airy-but-efficient spacing on an 8px scale;
  **rounded corners everywhere** — buttons **pill**, cards / dropdowns **and their expanded
  panels** / inputs / modals **≥ 12–16px radius**; **hairline 1px borders** as the primary
  separator; **minimal shadows** — a soft lift on card hover only, no ambient/glow shadows.
  Overall feel: **organized and clean — never overwhelming or messy, but never empty**; build to
  current trending styles per the delegation (§1).
- **Illustration/iconography:** ✅ *confirmed at F7, revised same day (owner: "better icons"):*
  **Phosphor** icons, re-exported through `@beecompete/ui` (`src/icons.ts` — app code never
  imports the icon lib directly). Regular weight by default; **bold/fill/duotone weights** for
  emphasis and active states (e.g., gold duotone trophy, filled verified seal). Small spot
  illustrations for hero/audience/empty states remain 🔶 (decided when those surfaces build).
  **Emoji in the prototypes are placeholders.** No mascot at launch (bee lives in the logo/mark).
- **Light + dark mode:** ✅ both required (architecture §8), delivered via design tokens. Prototypes
  are **light-first**; dark mode is a token swap in F7, not a separate design pass. The dark
  category-highlight band is a *section treatment*, not dark mode.
- **Primary buttons / dark fills (owner r5, 2026-07-08):** **neutral** dark gray (`#363636` —
  neither cool nor warm), **not black**. (Earlier warm `#3d3929` read brown, cool `#32343a` read
  blue — both rejected.) Light ground is near-white with only a hair of warmth (`#fdfdfc`).
- **Data-aware facts (owner r5–r10, 2026-07-08):** competition-card facts are styled by *what
  the data means to a family*, not uniformly. **Cards carry only two logistics facts — Cost +
  Region** (owner r10; format and entry pathway live on the details page and in filters),
  rendered as **icon + value pairs in fixed half-width slots on one row**: the ticket and map-pin
  icons carry the labels, values stay large and scannable, each truncates independently.
  **Cost = "Free" reads positive** (success green, icon included). **Footer follows the Kaggle
  competition-card pattern (owner r8): PRIZE is the bold prominent fact** (gold trophy +
  semibold, truncates) **and the deadline is quiet muted "N days to go" text** (nowrap; flips to
  a danger tint only in the final days, not at 14). Deadline + prize share the footer row, pinned
  to the card bottom. **Card corner (owner r9/r13):** the **top-right** corner shows the
  social-proof count ("N registered", → M31 thresholds) at rest and **crossfades on card hover to
  the quick actions — favorite (♥ → M7 save/follow) + share (→ M21)**; no view arrow. Everything
  sits in translucent pills over the cover (scrim rule). (page-blueprints Page 1/3.)
- **Shared component set (F7, owner-approved 2026-07-08):** beyond Button/Input/Select/Textarea/
  Card/Badge, `packages/ui` now also ships **FormField · Checkbox · Radio/RadioGroup · Chip
  (toggle + removable) · Avatar · Alert (info/success/warning/danger + `flush` banner) · Skeleton ·
  Spinner · EmptyState · Tooltip · Tabs · Modal · Toast (ToastProvider/useToast)**. These carry the
  cross-cutting a11y behavior (focus trap, roving tabindex, live regions) so features don't
  reinvent it. Modal/Tabs styling is intentionally light — owner may steer with reference photos;
  the behavior is the durable part. All on the live `/design` showcase. Feature-specific bits
  (CompetitionCard, category tiles, hero cards, wizard stepper, date pickers, admin tables) are
  built at their task on top of these.

- **Do:** pill buttons (neutral-graphite primary / gold brand variant, §3) on a crisp near-white
  ground; **CompetitionCards taller and narrower — 4 per row on desktop (~270px wide; owner r7
  2026-07-08, supersedes ~220px)**, generous cover + body, **all cards in a row equal height**
  (flex column, clamped text, footer pinned); **compact category tiles**; **Verified badge =
  subtle green** (✓, muted green on soft green tint), Curated = quiet neutral.
- **Do (owner 2026-07-08):** **per-category accent hues** — each of the ~10 categories gets an
  assigned hue used in its generated default cover **and** its tinted card meta tag (F7 asset
  system); **deadline + prize bold and in a fixed position** on every CompetitionCard; **any text
  over imagery gets a darkening scrim** sufficient for WCAG AA, verified per breakpoint (hover
  overlays, hero strips, image cards).
- **Don't:** yellow-on-black (or any accent-on-black) button styling; **no glow/colored shadows on
  buttons**; no oversized tile grids.
- **Don't (owner 2026-07-08):** **no harsh `#000`/near-black fills or text** — use warm charcoals;
  dark mode is warm dark gray (Claude-like), never black. No thin/spindly display type — serif
  titles carry real weight (~560).
- **Don't (owner 2026-07-08):** **gold `#F5C330` as text-on-white, thin icon strokes, or hairline
  borders** — gold is a fill/background/accent-shape color only (it fails WCAG contrast on white);
  text on gold is always ink. **No auto-advancing carousels** — user-driven only, with a peek
  affordance.

## 4b. Page structure *(as important as visual style — owner directive 2026-07-07)*

Every hero page gets a **structural blueprint before any styling or implementation** — zones,
ordering, and the registry features each zone serves — recorded in `docs/page-blueprints.md`.
The hero design pass is therefore two checkpoints: 🧑 approve the **blueprint** (structure), then
🧑 approve the **prototype** (style applied to that structure).

## 5. Hero surfaces *(design pass required — never built without your visual approval)*

**Structure + status live in `docs/page-blueprints.md` (source of truth).** Quick reference:

| Page | Release | Structure | Style prototype |
|---|---|---|---|
| Landing | R1 | ✅ approved (rev 2026-07-09; hero right half = admin-managed image cards, blueprints #25–26) | round 2 — re-prototype hero (plain Browse button + category strip + image-card right half) & new section order |
| Competitions (listing) | R1 | ✅ approved (rev 2026-07-08) | not started |
| Competition detail | R1 | ✅ approved (rev 2026-07-08) | not started |
| How It Works | R1 | ✅ approved (2026-07-08) | not started |
| Categories (index) | R1 | ✅ approved (2026-07-08, may be tuned) | not started |
| Suggest a Competition (wizard form) | R1 | ✅ approved (2026-07-08) | light pass (step-form interaction only) |
| For Parents / For Educators | — | ⛔ deferred (2026-07-08) | — |
| Community (article index + detail) | Phase 2 | ⛔ deferred (2026-07-08, blueprints #27) — blueprint before build | — |
| Tracker ("My Competitions") | R2 | ⛔ deferred | — |
| Parent dashboard | R2 | ⛔ deferred | — |

*Anything not listed here is a utility page (assembled from `packages/ui` primitives, no design pass).*

## 6. Assets *(inventory — placeholders until finals, swapped in place)*

- Logo/icon/favicon (light + dark variants) — live in `packages/ui` (architecture §8).
- **Category cover-art system** (owner-approved 2026-07-07): generated category-based default
  covers for CompetitionCards — built alongside F7; real per-competition art overrides when available.
- **Landing hero image cards** *(supersedes the hero SVG plan, 2026-07-08 — blueprints #25)*:
  one main + two satellite **HeroCards**, admin-managed (image/alt; main card adds link +
  hover-scrim description) — placeholder images until the owner supplies finals. Scrim must meet
  the WCAG-AA text-over-imagery rule (§4).
- **Demo video** (How It Works §4 — relocated from Landing 2026-07-08) — placeholder until produced.
- **Value-prop & stats imagery** (Landing §3 · How It Works §5) — stock/placeholder until finals;
  stats copy is `TODO(owner)` until sourced numbers are supplied (required before the R1 gate),
  **with a source-attribution line and non-causal framing per stat** (owner 2026-07-08).
