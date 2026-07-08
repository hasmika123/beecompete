# BeeCompete — Page Blueprints

**Status:** ✅ Owner-approved structure (2026-07-07) · Depends on: `feature-registry.md`, `phase-1-plan.md`, `design-brief.md`

Structural specs for the public pages: **layout, content, interactions, and component reuse per
section — no code.** These are the implementation contract; structure doesn't change during build
without coming back here. Visual style comes from `design-brief.md` §3 (B-base blend, gold
`#F5C330` + ink `#030201`).

Legend: **[R1]** ships in R1 · **[R2]** R2 (zone hidden/reserved at R1) · *(→ ID)* registry item · ⚠ build note.
All motion respects `prefers-reduced-motion`.

---

## Shared components *(build once in `packages/ui`, reuse everywhere)*

**NavBar** — identical on all pages. Sticky on scroll with a subtle shadow once scrolled.
- **Left:** logo, immediately followed by a **"Beta" tag** (→ R1-13).
- **Center:** links — **Competitions · Categories · About Us** *(Categories → category index page,
  part of the M15 landing-page set; owner addition 2026-07-07)*. *(Organizations link deferred to
  Phase 3 with the org directory, → M32. Persistent nav search also deferred to Phase 3.)*
- **Right:** Sign In / Sign Up buttons **[R2]** — hidden at R1 (no accounts exist); slot reserved.

**CompetitionCard** — used in: Landing §2 (carousel), Competitions §4 (grid), Details §3c (related row).
- **Top:** cover image — **default = generated category-based cover art** (owner-approved; asset
  system built alongside F7), real art when a listing has it.
- **Below image:** competition name (one line, truncate).
- **Next row:** organization logo avatar + organization name. ⚠ Logo = nominative use at avatar
  scale; fallback letter-avatar; honor takedowns (compliance §8).
- **Bottom:** key details in one consistent, regular format across every card: grade band · next
  deadline · format chip (individual/team) · **trust badge** (→ DQ13).
- **Interaction:** whole card clicks through to the Details page; hover = slight lift/scale.

**Footer** — all pages: Privacy · Terms · Cookie Policy · **affiliate disclosure** (→ DQ10) · beta
disclaimer (→ R1-13) · contact/support · social links (→ R1-12).

---

## Page 1: Landing *(job: convert traffic into browsing + email capture; establish trust fast)*

**1. Hero** *(directly below nav)*
- **Layout:** 50/50 split. **Left half:** large bold headline — "Search. Compete. Participate." —
  smaller subtext below, **two CTAs** below that: primary **"Browse competitions"** → /competitions
  (→ M1); secondary "How it works" → anchor to §7. **Right half:** placeholder SVG of a child
  (final asset later), with **two satellite SVGs**: competition-card graphic **top-right**,
  tracker/timeline graphic **bottom-left**.
- **Motion:** satellites animate in on load (staggered fade/slide).
- *(No search here or in the nav at launch — search lives on the Competitions page; nav search
  revisited in Phase 3.)*

**2. Featured Competitions carousel** (→ M4, M6; *later:* labeled Promoted slots → M28)
- **Layout:** section row — heading **"Featured Competitions"** left-aligned, **"See More"**
  right-aligned on the same row → /competitions. Below: a **carousel of CompetitionCards**
  (Material-carousel style reference).
- **Content @R1:** curated picks — deadline-closing-soon + editor selections (urgency lives here).
- **Motion:** subtle scroll-triggered entrance as the section enters the viewport.

**3. Value-proposition split**
- **Layout:** section title on top; body split into **quarters** — **left half (2 quarters): two
  rounded, portrait-oriented full-image cards side by side**; **right half: 2–4 large stats** about
  how competing improves college-admissions odds (numbers large/prominent, labels smaller).
- **Interaction:** each image card, on hover, shows an opaque tint overlay with link text →
  relevant page/section.
- ⚠ **Temp copy at build** (owner-approved): placeholder numbers clearly marked in code as
  `TODO(owner)`; owner supplies final sourced stats before the R1 gate.

**4. Demo video**
- **Layout:** full-width rectangular card, short height: title → video → subtext.
- **Interaction:** on click, the video expands/pops up to roughly a quarter of the screen.
- ⚠ **Placeholder asset** (owner-approved) until the real demo video is produced.

*(Logo marquee — **deferred to Phase 3**, owner decision 2026-07-07: re-enters between §4 and §5
once real partners/permissions exist. Compliance §8: permission-based logos only.)*

**5. Stats & imagery grid**
- **Layout:** heading + subtext on top; **four rounded landscape cards in a 2×2 grid** — Row 1:
  image (left) · stat with graph/visual (right); Row 2: stat with visual (left) · image (right).
- ⚠ Same temp-copy rule as §3.

**6. Category highlight** (→ M15)
- **Layout:** full-width, **full-bleed background image** (not a card). **Left:** **9 square cards**
  in a grid — frosted/translucent background, rounded corners, icon + category name, each → its
  category landing page. **Right:** large bold white headline, subtext, CTA button(s) — "Explore
  all categories" → /competitions.
- *(We seed ~10 categories; 9 tiles + the CTA covers the rest.)*

**7. How It Works**
- **Layout:** heading "How It Works"; horizontal visual timeline — Step 1 → arrow → Step 2 → arrow
  → Step 3 — the process of finding and registering for a competition through BeeCompete (register
  step is outbound-to-host at R1; honest about that).

**8. Audience cards** (→ H46)
- **Layout:** three cards in one row — **"For Parents" · "For Educators" · "For Organizers"** — each
  with an image and a CTA. Organizers CTA = interest capture ("Get early access") → host waitlist.
- **Interaction:** hover = card expands/grows.

**9. Email subscription** (→ R1-15)
- **Layout:** simple capture band — heading, input, submit (Brevo).

**10. Footer** — shared component.

**Mobile:** single column; hero stacks (text above image); carousel & related rows become swipe;
category grid 3×3 → 2-col; audience cards stack.

---

## Page 2: Competitions (Listing) *(job: filter 200+ listings to "mine" in under a minute)*

**1. NavBar** — shared component.

**2. Page heading.**

**3. Toolbar** (→ M2, M3, M4)
- **Layout:** one row — **Search** input · **Sort** (deadline / popularity / newest) · **Filter**
  button · **total count** ("184 competitions").
- When filters are active, a removable-chip row appears directly below the toolbar.

**4. Competition listings** (→ M1, X10)
- **Layout:** grid of **CompetitionCards** — **4 per row** default; clicking **Filter** opens a
  **left filter panel** and the grid reflows to **3 per row**. Filter facets: category, grade,
  state/region, cost, individual/team, delivery, deadline window (→ M3).
- **Scroll:** continuous scroll **with pagination links** (owner decision — keeps crawlable
  paginated URLs for SEO while browsing stays fluid).
- **Zero-results state:** friendly message + **"Suggest a competition"** CTA (→ DQ15); query
  logged (→ X20).
- **Mobile:** filter panel becomes a bottom sheet behind the Filter button; grid 1–2 per row.

---

## Page 3: Competition Details *(job: answer "is this for me?" in 10 seconds, capture intent; the SEO landing surface — schema.org Event + BreadcrumbList structured data, → M15/R1-10)*

**1. NavBar** — shared component.

**2. Header section**
- **Back button** (breadcrumb exists only as structured data, not visually).
- **Left/main:** competition title · org avatar + name + **verification badge** (→ DQ13) · basic key
  details · small **Share** icon (→ M21).
- **Right:** **cover-image card** with a **"Register" button below it** → official external
  registration page (`registration_url`, opens ↗). **[R2]** after click-through, prompt "Did you
  register? Track it" (→ M23).

**3. Main content — left column (majority width)**
- **a. Tabbed section** — default tab **"Key Facts & Details"**: the standardized, easy-to-scan
  Spine layout identical across all competitions (grades, region/scope, cost, format, evaluation
  type, recurrence → M5) + the category-specific attributes block rendered from the Category
  Template (→ X9). Second tab: **"About"** (long description). *(Further tabs only when real
  content demands them.)*
- **b. Resources row** (→ M11) — horizontally scrollable row of resource cards with side scroll
  buttons; each resource (document, video, textbook…) shows a preview image. ⚠ **Affiliate
  disclosure displayed with this row** (→ DQ10).
- **c. Related competitions** (→ M25) — heading + "See More" right-aligned → filtered /competitions;
  below, a row of **CompetitionCards**.

**4. Main content — right column (sidebar), top to bottom**
- **a. "Follow this Competition" button** — R1 = follow-by-email capture (→ M29); R2 = Save (→ M7).
- **b. Vertical timeline** of the edition's key dates/events (reg opens → closes → rounds → results,
  → M6), current/next date emphasized.
- **c. Trust & attribution panel** (→ DQ1, DQ13) — trust tier badge · source + confidence · "Last
  verified …" · **"Listing maintained by BeeCompete Curation Team"** (flips to the host org after
  claim; locked wording — *maintained*, never *managed*).
- **d. "Claim this Competition" button** (→ H46) — deliberately adjacent to the attribution line
  ("maintained by BeeCompete" + "claim it" = the host-recruitment hook).
- **e. "Suggest a Correction" button** (→ DQ6) — opens the correction form (task R1-3b).

**Mobile:** sidebar stacks below the header (Follow button stays visible in header area); left
column then sidebar remainder.

---

## Deferred pages *(do not design yet — owner, 2026-07-07)*

- **Tracker ("My Competitions") [R2]** and **Parent Dashboard [R2]** — prior feature inventories
  preserved in git history; re-blueprint when the owner picks them up.

---

## Decisions log (all open questions resolved 2026-07-07)

1. **Organizations page** → dropped until **Phase 3** (org directory + profiles, → M32); nav link removed at R1.
2. **Nav search** → deferred to **Phase 3** as a suggestion; search lives on the Competitions page at launch.
3. **Logo marquee** → dropped until **Phase 3** (permission-based partners only).
4. **Admissions stats** → temp placeholder copy at build (`TODO(owner)`); owner replaces with sourced numbers before the R1 gate.
5. **Demo video** → placeholder asset until produced.
6. **Cover images** → generated **category-based cover art** as the default (asset system alongside F7).

Also resolved by the owner's structural prompt: pagination (continuous scroll + pagination links) ·
Follow placement (sidebar top) · audience-band position (below how-it-works) · back button instead
of visual breadcrumb.

## Status
| Page | Blueprint | Style prototype | Built |
|---|---|---|---|
| Landing | ✅ approved (2026-07-07) | 🔍 round 2 in review (Inter locked; flat buttons; card/tile sizing tuned) | — |
| Competitions (listing) | ✅ approved (2026-07-07) | — | — |
| Competition details | ✅ approved (2026-07-07) | — | — |
| Tracker | ⛔ deferred — do not design yet | — | — |
| Parent dashboard | ⛔ deferred — do not design yet | — | — |
