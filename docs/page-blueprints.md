# BeeCompete — Page Blueprints

**Status:** ✅ Owner-approved structure (2026-07-07 · revised 2026-07-08) · Depends on: `feature-registry.md`, `phase-1-plan.md`, `design-brief.md`

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
- **Center:** links — **Competitions · Categories · How It Works** *(renamed from "About Us" —
  owner 2026-07-08; the page is restructured as How It Works, see Page 4)*. A **"For Educators"**
  link joins the nav **when that page ships** (page deferred — see Deferred pages).
  *(Organizations link deferred to Phase 3 with the org directory, → M32. Persistent nav search
  also deferred to Phase 3.)*
- **Right:** Sign In / Sign Up buttons **[R2]** — hidden at R1 (no accounts exist); slot reserved.

**CompetitionCard** — used in: Landing §2 (carousel), Competitions §4 (grid), Details §3c (related row), Categories index §6.
- **Top:** cover image — **default = generated category-based cover art** (owner-approved; asset
  system built alongside F7), real art when a listing has it. **Each category has an assigned
  accent hue** used in its generated default cover **and** its tinted meta tag (owner 2026-07-08)
  — keeps card grids scannable (no wall-of-sameness) and visually reinforces cross-subject breadth.
- **Below image:** competition name (one line, truncate).
- **Next row:** organization logo avatar + organization name. ⚠ Logo = nominative use at avatar
  scale; fallback letter-avatar; honor takedowns (compliance §8).
- **Bottom:** key details in one consistent, regular format across every card: grade band · next
  deadline · prize (when any) · format chip (individual/team) · **trust badge** (→ DQ13).
  **Deadline and prize render bold, always in the same position on every card** (owner
  2026-07-08). Deadline renders **relative ("Closes in 9 days") inside a proximity window
  (~14 days)**, absolute date otherwise — factual urgency only; countdown timers stay banned
  (design-brief anti-references).
- **Interaction:** whole card clicks through to the Details page; hover = slight lift/scale.

**Footer** — all pages: Privacy · Terms · Cookie Policy · **affiliate disclosure** (→ DQ10) · beta
disclaimer (→ R1-13) · contact/support · social links (→ R1-12) · Request a Competition (Page 6).

---

## Page 1: Landing *(job: convert traffic into browsing + email capture; establish trust fast)*

**1. Hero** *(directly below nav)*
- **Layout:** 50/50 split. **Left half:** large bold headline — "Search. Compete. Participate." —
  with **subtext that carries the value proposition** (owner 2026-07-08): names the audience
  (K-12 / "your student"), names 2–3 subjects (math, science, debate…), and states the
  one-place promise. **Two CTAs** below: primary **"Browse competitions"** → a plain button that
  navigates to /competitions (→ M1) — **no dropdown, no panel** (owner 2026-07-09, supersedes the
  hover quick-match panel). Secondary **"How it works"** → the How It Works page (Page 4; the
  section moved off Landing). **Right half (owner 2026-07-08, supersedes the SVG-illustration
  plan):** a **main HeroCard image card** with **two satellite HeroCards** hovering **top-right**
  and **bottom-left**. The **main card is a link**: on hover/focus a **translucent scrim** (WCAG-AA
  darkening, per design-brief §4) covers it with **short text describing the destination**.
  Satellites are image-only. **All three cards are admin-managed** (image, alt text; main card also
  link + description) via R1-3 (→ M36, `HeroCard`); placeholder images until the owner supplies
  finals.
- **Hero base strip:** a **horizontally scrolling row of compact category tiles** (icon + name)
  with side arrow buttons, each → its category URL (→ M15). **Replaces the former full-bleed
  Category highlight section** (owner 2026-07-08). *(This strip is where per-category entry now
  lives, since the Browse button no longer surfaces categories.)*
- **Motion:** satellites animate in on load (staggered fade/slide).
- *(No search here or in the nav at launch — search lives on the Competitions page; nav search
  revisited in Phase 3.)*

**2. Featured Competitions carousel** (→ M4, M6; *later:* labeled Promoted slots → M28)
- **Layout:** section row — heading **"Featured Competitions"** left-aligned, **"See More"**
  right-aligned on the same row → /competitions, **carrying a live count** ("184 more
  competitions"; owner 2026-07-08). Below: a **carousel of CompetitionCards**.
- **Carousel rules (owner 2026-07-08):** **no auto-advance** (user-driven only) · the next card
  visibly **peeks** at the edge so scrollability is obvious · **6–10 cards max** — overflow lives
  behind "See More".
- **Content @R1:** curated picks — deadline-closing-soon + editor selections (urgency lives here).
  **Picks are admin-managed, ordered slots** (→ M36, `FeaturedSlot`; CRUD in R1-3) — not
  algorithmic at R1.
- **Motion:** subtle scroll-triggered entrance as the section enters the viewport.

**3. Value-proposition split**
- **Layout:** section title on top; body split into **quarters** — **left half (2 quarters): two
  rounded, portrait-oriented full-image cards side by side**; **right half: 2–4 large stats** about
  how competing improves college-admissions odds (numbers large/prominent, labels smaller).
- **Interaction:** each image card, on hover, shows an opaque tint overlay with link text →
  relevant page/section (⚠ overlay text follows the scrim rule, design-brief §4).
- ⚠ **Stat credibility rules (owner 2026-07-08), folded into the TODO(owner) gate:** every stat
  carries a **small source-attribution line** (e.g., "— NACAC survey") and phrasing **avoids
  causal claims** — prefer "X% of admissions officers say…" over "competing makes you 3× more
  likely…". Placeholder numbers clearly marked `TODO(owner)`; owner supplies final sourced stats
  before the R1 gate.

**4. Audience cards** (→ H46)
- **Layout:** three cards in one row — **"For Parents" · "For Educators" · "For Organizers"** — each
  with an image and a CTA. Organizers CTA = interest capture ("Get early access") → host waitlist.
  The For Parents / For Educators pages are **deferred**; until they exist, those two cards link to
  the weekly-digest band (§5 anchor; owner 2026-07-08).
- **Interaction:** hover = card expands/grows.

**5. Weekly digest signup** (→ R1-15) *(reframed — owner 2026-07-08)*
- **Layout:** capture band branded as a **weekly personalized competitions digest** — heading
  promises a weekly list of **new competitions matching the reader's preferences**; email input +
  submit (Brevo).
- **Flow:** subscribing asks 2–3 quick preference questions (grade, category/interests, region);
  the weekly send lists new/matching competitions. *(Also segments the list for R2 activation.)*

**6. Footer** — shared component.

*Moved to the How It Works page (owner 2026-07-08): the demo video, the stats & imagery grid, and
the How It Works timeline. Removed: the full-bleed Category highlight section (replaced by the
hero category strip).*

**Mobile:** single column; hero stacks (text above image); category strip stays a swipe row;
carousel & related rows become swipe; audience cards stack.

---

## Page 2: Competitions (Listing) *(job: filter 200+ listings to "mine" in under a minute)*

**1. NavBar** — shared component.

**2. Page heading.**

**3. Toolbar** (→ M2, M3, M4)
- **Layout:** one row — **Search** input · **Sort** (deadline / popularity / newest) · **Filter**
  button · **total count** ("184 competitions").
- When filters are active, a removable-chip row appears directly below the toolbar.
- **Grade quick-chips** directly above the grid: **All · Elementary · Middle School · High School**
  — one-tap coarse narrowing (owner 2026-07-08); fine-grained grades stay in the filter panel.

**4. Competition listings** (→ M1, X10)
- **Layout:** grid of **CompetitionCards** — **4 per row** default; clicking **Filter** opens a
  **left filter panel** and the grid reflows to **3 per row**. **Facet order (owner 2026-07-08;
  entry pathway added same day, legacy review): Grade → Category → State/Region → Deadline window →
  Cost → Format (individual/team) → Entry pathway (individual / school-or-chapter / either) →
  Delivery** (→ M3). **Per-option result counts on the Grade and Category facets only**
  ("Grade 5 (37)").
- **Scroll:** **"Load more" button** — loads the next page inline (never auto-loads on scroll),
  with crawlable `?page=N` pagination URLs behind it (owner 2026-07-08 — refines the 2026-07-07
  continuous-scroll decision; keeps the footer reachable and back-button position stable).
- **Zero-results state:** friendly message + **"Request a competition"** CTA (→ DQ15, links to
  Page 6) + **2–3 near-miss cards** — relax the least-important active filter and explain the
  relaxation ("Nothing for Grade 3 in Debate — these accept Grade 4"); the grid is never literally
  empty (owner 2026-07-08). Query logged (→ X20).
- **Category URLs (owner 2026-07-08 — hybrid model, → M15):** canonical category paths
  (`/competitions/<category-slug>`) render this same page pre-filtered **plus** a category header
  (icon · name · one-liner · live count) and an indexable **"About [category] competitions" text
  block below the grid** — the per-category SEO surface without a separate page to maintain.
- **Mobile:** filter panel becomes a bottom sheet behind the Filter button; grade quick-chips
  scroll horizontally; grid 1–2 per row.

---

## Page 3: Competition Details *(job: answer "is this for me?" in 10 seconds, capture intent; the SEO landing surface — schema.org Event + BreadcrumbList structured data, → M15/R1-10)*

**1. NavBar** — shared component.

**2. Header section**
- **Visible breadcrumb** — `Competitions › [Category] › [Competition]` — small and quiet, above
  the title; **replaces the back button** (owner 2026-07-08, supersedes the 2026-07-07 decision).
  Matches the BreadcrumbList structured data and gives every Details page crawlable links up to
  its category hub (organic landers have no in-site "back").
- **Left/main:** competition title · org avatar + name + **verification badge** (→ DQ13) ·
  **"At a glance" strip** — icons + values in the identical order on every competition:
  **Grades · Next deadline · Cost · Location/Online · Prize · Entry pathway** (owner 2026-07-08;
  entry pathway added same day, legacy review — "how do you enter" is a top parent question; the
  10-second answer — the Spine tab below stays the full version) · small **Share** icon (→ M21).
- **Right:** **cover-image card** with a **"Register" button below it** → official external
  registration page (`registration_url`, opens ↗). **Microcopy under the button:** "Registration
  happens on the organizer's official site ↗" (owner 2026-07-08 — frames the handoff as a
  feature, preserves trust at the redirect moment). **[R2]** after click-through, prompt "Did you
  register? Track it" (→ M23).

**3. Main content — left column (majority width)**
- **a. Tabbed section** — default tab **"Key Facts & Details"**: the standardized, easy-to-scan
  Spine layout identical across all competitions (grades, region/scope, cost, format, evaluation
  type, recurrence → M5) + the category-specific attributes block rendered from the Category
  Template (→ X9). Second tab: **"About"** (long description). Third tab: **"FAQ" [R1]** (owner
  2026-07-08) — 3–5 curated per-competition Q&As ("how do I prepare," "can homeschoolers enter,"
  "when are results announced") rendered with **FAQPage structured data** — the long-tail SEO
  block on the primary SEO surface.
- **b. Resources row** (→ M11) — horizontally scrollable row of resource cards with side scroll
  buttons; each resource (document, video, textbook…) shows a preview image. ⚠ **Affiliate
  disclosure displayed with this row** (→ DQ10).
- **c. Related competitions** (→ M25) — heading + "See More" right-aligned → filtered /competitions;
  below, a row of **CompetitionCards**.

**4. Main content — right column (sidebar), top to bottom — sticky on desktop once scrolled**
*(owner 2026-07-08: the Follow CTA is the page's conversion event; it never leaves view)*
- **a. "Follow this Competition" button** — R1 = follow-by-email capture (→ M29); R2 = Save (→ M7).
- **b. Vertical timeline** of the edition's key dates/events (reg opens → closes → rounds → results,
  → M6), current/next date emphasized **with an add-to-calendar link (ics + Google Calendar) at
  R1** — no account needed (owner 2026-07-08).
- **c. Trust & attribution panel** (→ DQ1, DQ13) — trust tier badge · source + confidence · "Last
  verified …" · **"Listing maintained by BeeCompete Curation Team"** (flips to the host org after
  claim; locked wording — *maintained*, never *managed*).
- **d. "Claim this Competition" button** (→ H46) — deliberately adjacent to the attribution line
  ("maintained by BeeCompete" + "claim it" = the host-recruitment hook).
- **e. "Suggest a Correction" button** (→ DQ6) — opens the correction form (task R1-3b).
- **f. [R2] Social-proof counter** ("N students tracking this") — displayed **only above a
  cold-start threshold (~25)**; never shown below it (owner 2026-07-08).

**Mobile:** sidebar stacks below the header; a **slim sticky bottom bar with Follow + Register**
appears once the header scrolls out of view (owner 2026-07-08); left column then sidebar remainder.

---

## Page 4: How It Works *(new 2026-07-08 — replaces "About Us" in the nav; job: explain the model honestly, build trust, capture email)*

**1. NavBar** — shared component.

**2. Mission intro** — the one-line vision + a short, honest origin story ("competitions are
scattered across hundreds of sites…"); who maintains the catalog.

**3. How It Works timeline** — heading; horizontal visual timeline — Step 1 → arrow → Step 2 →
arrow → Step 3: finding and registering for a competition through BeeCompete (register step is
outbound-to-host at R1; honest about that) — **plus a ghosted/dashed 4th step** teasing the R2
tracker ("Track it all in one place — coming soon") linking to the digest band (owner 2026-07-08;
removed when the tracker ships).

**4. Demo video** *(moved from Landing)* — full-width rectangular card, short height: title →
video → subtext; on click, expands to ~quarter screen. ⚠ **Placeholder asset** until produced.

**5. Stats & imagery grid** *(moved from Landing)* — heading + subtext; **four rounded landscape
cards in a 2×2 grid** — Row 1: image (left) · stat with graph/visual (right); Row 2: stat with
visual (left) · image (right). Content leans on **platform/catalog stats** (live counts —
competitions, categories, states covered, update cadence). ⚠ temp-copy rule applies; any
outcome/admissions stats follow the source + framing rules (Landing §3).

**6. Contact + weekly digest band** → **Footer**.

**Mobile:** single column; timeline stacks vertically.

---

## Page 5: Categories (index) *(nav "Categories" target — owner-approved 2026-07-08, may be tuned at prototype; job: give every browse angle a crawlable entry point)*

**1. NavBar** — shared component.

**2. Page heading + subtext.**

**3. Browse by category** — tile per category (icon · name · live count · one-liner) → its
canonical category URL (`/competitions/<slug>`, Page 2 hybrid).

**4. Browse by grade level** — **Elementary · Middle School · High School** tiles → grade-filtered
competitions; crawlable grade-hub URLs (the "competitions for 5th graders" long-tail).

**5. Browse by state/region** — compact state list/tiles → region-filtered listings.

**6. Closing soon** — row of **CompetitionCards** with deadlines in the next ~30 days → the
deadline-filtered view.

**7. Weekly digest band** → **Footer**.

**Mobile:** single column; tile grids 2-col; closing-soon row becomes swipe.

---

## Page 6: Request a Competition *(→ DQ15 — owner-approved 2026-07-08; canonical label "Request a Competition" per owner 2026-07-13, supersedes "Suggest a Competition"; route slug stays `/suggest-a-competition` until R1-15b; linked from zero-results + footer)*

- **Multi-step wizard form** — one question per step, click/selection advances to the next step,
  with a progress indicator (owner 2026-07-08: designed to feel effortless, not like a form):
  competition name → organization → official URL → category → optional extras (grades, deadline,
  anything else) → submit.
- **Confirmation step** states what happens next ("our curation team reviews suggestions within
  X days") — closing that loop is what makes people submit.
- Zero-results referrals prefill the first step from the logged query when possible (→ X20).

---

## Deferred pages *(do not design yet — owner)*

- **Tracker ("My Competitions") [R2]** and **Parent Dashboard [R2]** — prior feature inventories
  preserved in git history; re-blueprint when the owner picks them up. *(2026-07-07)*
- **For Parents · For Educators** audience pages — deferred (owner 2026-07-08). Until they exist,
  the Landing audience cards link to the digest band; when For Educators ships it also gets the
  reserved NavBar link.
- **Community (article index + article detail) [Phase 2, → M19/M34/M35]** — public label
  "Community", entity **Article** (owner 2026-07-08). Admin-published articles with linked
  Competitions (in-article CompetitionCard row), reactions/share, and a comment section that is
  **adult-visible-only, read and write** (hidden from minors and logged-out visitors; moderated
  via DQ8). Articles themselves stay public (SEO). **Blueprint before build**; schema sketches
  live in `domain-model.md` §3e. Gets a nav link when it ships.

---

## Decisions log

**2026-07-07 (all open questions resolved):**
1. **Organizations page** → dropped until **Phase 3** (org directory + profiles, → M32); nav link removed at R1.
2. **Nav search** → deferred to **Phase 3** as a suggestion; search lives on the Competitions page at launch.
3. **Logo marquee** → dropped until **Phase 3** (permission-based partners only).
4. **Admissions stats** → temp placeholder copy at build (`TODO(owner)`); owner replaces with sourced numbers before the R1 gate.
5. **Demo video** → placeholder asset until produced.
6. **Cover images** → generated **category-based cover art** as the default (asset system alongside F7).

Also resolved by the owner's structural prompt: pagination (continuous scroll + pagination links) ·
Follow placement (sidebar top) · audience-band position (below how-it-works) · back button instead
of visual breadcrumb *(superseded 2026-07-08, see below)*.

**2026-07-08 (market/UX review — all owner-selected):**
1. **Hero:** slogan headline kept; **subtext carries the descriptive value prop** (K-12, named subjects, one-place promise).
2. ~~**Quick-match panel:** "Browse competitions" opens an animated Grade + Subject panel on hover/focus → pre-filtered /competitions.~~ **Superseded 2026-07-09** — the Browse button is a plain button that navigates to /competitions; no dropdown/panel (see 2026-07-09 entry below). Per-category entry lives in the hero category strip (decision #3).
3. **Hero category strip** (horizontal scroll, side buttons) **replaces the full-bleed Category highlight section**.
4. **Relocations:** demo video, stats & imagery grid, and the How It Works timeline move to the new **How It Works page** (nav tab renamed from "About Us"); Landing keeps the admissions-stats value-prop split.
5. **Landing order** is now: Hero → Featured carousel → Value-prop split → Audience cards → Digest band → Footer.
6. **Stat credibility:** every admissions stat needs a source-attribution line + non-causal (survey-opinion) framing before the R1 gate.
7. **Catalog count:** shown only as a live "N more competitions" label on "See More"; full platform stats live on How It Works.
8. **Carousel rules:** no auto-advance · peek affordance · 6–10 cards max.
9. **Digest reframe:** email capture = weekly personalized competitions digest with preference questions (grade, interests, region) on subscribe.
10. **Facet order:** Grade first (Grade → Category → State/Region → Deadline → Cost → Format → Delivery); per-facet counts on Grade + Category only.
11. **Grade quick-chips** (All · Elementary · Middle · High) above the listing grid.
12. **Card data:** deadline + prize bold, fixed position; relative deadline wording within ~14 days.
13. **Load more button** (never auto-load) + crawlable `?page=N` URLs — refines decision #(pagination) above.
14. **Zero-results near-miss cards** (2–3, with the relaxed-filter explanation).
15. **Per-category accent hues** on generated covers + meta tags (F7 asset system).
16. **Category URLs:** hybrid — canonical `/competitions/<slug>` = filtered listing + category header + indexable SEO text block.
17. **Details:** visible breadcrumb **replaces the back button** (supersedes 2026-07-07); "At a glance" strip (Grades · Deadline · Cost · Location · Prize); Register microcopy ("on the organizer's official site ↗"); **FAQ third tab at R1** with FAQPage schema; **sticky sidebar** on desktop; **add-to-calendar** (ics + Google) on the timeline at R1; mobile **sticky bottom bar** (Follow + Register).
18. **[R2] social-proof counter** with a ~25 cold-start threshold (hidden below it).
19. **New pages approved:** How It Works (Page 4) · Categories index (Page 5) · Request a Competition wizard (Page 6, labeled "Suggest a Competition" at approval; canonical "Request a Competition" per owner 2026-07-13). **Deferred:** For Parents / For Educators (audience cards → digest anchor meanwhile; educators nav link reserved).
20. **Cross-cutting style rules** recorded in `design-brief.md` §3/§4: ~~Inter Display + heavy-weight headline scale~~ *(typography superseded by #28)* · gold = fills/accents only (never text/strokes on white) · scrim required behind text over imagery.
21. **Student Privacy Pledge:** investigate during R1, target signing ~R2 — tracked in `go-to-market.md` §5.

**2026-07-08 (legacy-prototype review — registry Rev 7, `legacy-reference.md`):**
22. **Entry pathway** added to the filter facets (Page 2) and the Details at-a-glance strip (Page 3).
23. Prize on cards/at-a-glance is backed by typed `prize_summary`/`prize_value`/`prize_currency` on Edition (domain model 2026-07-08).

**2026-07-09 (owner):**
24. **Hero "Browse competitions" is a plain button** → /competitions. No hover dropdown / side panel / quick-match (supersedes decision #2). Category entry stays in the hero category strip (#3).

**2026-07-12 (owner — R1-6/R1-6b build kickoff):**
29. **Styling delegated to builder judgment** for the R1-6/R1-6b pages and their element types —
    the style-prototype checkpoint is waived; owner steers reactively with reference photos
    (recorded in `design-brief.md` §1).
30. **Competition-detail web route = `/c/<competition-slug>`** (builder, under #29): keeps the
    approved category hub at `/competitions/<category-slug>` (#16) collision-free, and matches
    the share-URL shape in the approved F7 card demo. The API detail path stays
    `/api/v1/competitions/{slug}`. R1-6 ships a minimal noindex placeholder at `/c/<slug>` so
    cards never dead-link; R1-7 builds the real Page 3 there.

**2026-07-12 (builder, under #29 — R1-7/R1-8 post-review fix pack):**
31. **Details-page behavior refinements** (recorded per the "blueprint first" rule; owner may
    override with references): (a) the **at-a-glance strip omits the Prize and Deadline slots
    when the data doesn't exist** rather than rendering a hollow "—" — the remaining items keep
    the fixed §2 order; (b) the **Register CTA renders only while the current edition's
    effective status is upcoming/open AND a registration URL exists** — closed/ongoing editions
    (and listings with no registration link) get a neutral "Visit official site" secondary
    button with an honest explanation, never a gold Register pointing at a dead or generic
    page; (c) **schema.org Event JSON-LD is emitted for virtual-delivery competitions only**
    until venue addresses exist in the data model (Google requires `location.address` for
    offline events; BreadcrumbList + FAQPage emit for all); (d) key dates display **in the key
    date's own timezone** (fallback Eastern), and add-to-calendar produces all-day events.

**2026-07-08 (owner — Community + admin-managed landing content, registry Rev 9):**
25. **Hero right half = image cards, not SVG illustrations** (supersedes the child-SVG + satellite-SVG plan): one **main HeroCard** (a link; hover/focus = translucent WCAG-AA scrim + short destination description) + two satellite HeroCards (top-right, bottom-left, image-only). **All three admin-managed** (→ M36) — image/alt on all, link + description on the main card.
26. **Featured-carousel picks are admin-managed ordered slots** (`FeaturedSlot`, → M36; CRUD in R1-3). Same carousel rules (#8); paid Promotion slots remain a separate, labeled, later thing (M28).
27. **Community pages approved as a Phase-2 surface** (public label "Community", entity Article — M19/M34/M35): admin-published articles with linked-competition cards, like/love + share, and comments that are **adult-visible-only, read and write** (hidden from minors and logged-out visitors; amended same day). Blueprint before build; added to Deferred pages meanwhile.
28. **Typography revised from owner reference images** (supersedes #20's Inter-Display clause; details `design-brief.md` §3): **display serif for headlines** — *similar* to the reference; **exact face/size/weight delegated to builder judgment at F7** (owner, same day — no blocking specimen approval; hero prototype approvals stay the checkpoint). **Inter stays for body/UI**. Self-hosted, no font CDN, as before. Hero/section headings across all blueprints render in the display serif.

**2026-07-13 (owner — marketplace/card sweep; built same day):**
32. **Filter panel is instant-apply** (amends the Page-2 interaction; the URL model is
    unchanged): every panel change navigates immediately — the Apply/Reset bar is gone; a quiet
    **"Clear all"** link on the active-tags row clears refinements but **keeps `q` + sort**.
    Every filter state remains a canonical, shareable GET-param URL (chips/quick-chips stay real
    links — crawlability unchanged). Pending navigation dims the results (`aria-busy`); the
    mobile sheet applies instantly too and closes via a primary **"Show {total} competitions"**
    button (the live count is the feedback loop that replaced Apply).
33. **Grade band ↔ quick-chip canonicalization:** a grade range that exactly matches a
    quick-chip band (Elementary −1–5 / Middle 6–8 / High 9–12) renders ONLY as the highlighted
    quick-chip — never as a removable tag; custom ranges still get a "Grades X–Y" tag. The rule
    is **value-canonical** (derived from the URL alone), so shared/reloaded URLs render
    identically. Clicking the already-active chip does nothing — "All" is the deselect.
34. **Card width is invariant** to the filter-panel toggle: fixed grid tracks
    (`repeat(auto-fill, 270px)` — the blueprint card width) from `sm:` up, and the desktop panel
    is exactly one track wide (270px), so opening it drops exactly one column at identical card
    width. Mobile stays a fluid single column.
35. **Card refinements:** the title is **one line, truncated** (supersedes the two-line clamp);
    the Cost/Region facts row pins to the card bottom above the prize/deadline footer; the
    top-right corner ships **Share-only at R1** (ShareMenu icon variant, popover rendered
    through a portal; hover/focus-revealed, always visible on touch devices) — the corner is
    the R2 slot for Save (M7) and the social-proof pill (M31, #18), added without relayout.
36. **Panel facets are collapsed by default** (the first facet plus any facet with an active
    filter open); the desktop panel has no internal scroll — the page grows instead (the mobile
    bottom sheet keeps its own scroll).

## Status
| Page | Blueprint | Style prototype | Built |
|---|---|---|---|
| Landing | ✅ approved (2026-07-07 · rev 2026-07-09 · hero image-cards rev 2026-07-08 #25–26) | delegated (#29 — supersedes the round-2 prototype review) | ✅ R1-6b (2026-07-12; hero-card images + digest wiring pending — PR C / R1-15; stats TODO(owner)) |
| Competitions (listing) | ✅ approved (2026-07-07 · rev 2026-07-08) | delegated (#29) | ✅ R1-6 (2026-07-12, incl. category hubs #16 + interim /c/ detail stub #30) |
| Competition details | ✅ approved (2026-07-07 · rev 2026-07-08) | delegated (#29) | ✅ R1-7 (2026-07-12; at-a-glance · tabs+FAQ · key-dates timeline w/ add-to-calendar · trust panel · Event/BreadcrumbList/FAQPage JSON-LD · mobile sticky bar · **resources row + affiliate disclosure = R1-8**. Follow/Claim capture = R1-15b) |
| How It Works | ✅ approved (2026-07-08) | delegated (#29) | ✅ R1-6b (2026-07-12; demo video placeholder) |
| Categories (index) | ✅ approved (2026-07-08, may be tuned) | delegated (#29) | ✅ R1-6b (2026-07-12) |
| Request a Competition | ✅ approved (2026-07-08) | — | interim stub only (R1-6; wizard = R1-15b) |
| For Parents / For Educators | ⛔ deferred (2026-07-08) | — | — |
| Community (article index + detail) [Phase 2] | ⛔ deferred (2026-07-08, #27) — blueprint before build | — | — |
| Tracker | ⛔ deferred — do not design yet | — | — |
| Parent dashboard | ⛔ deferred — do not design yet | — | — |
