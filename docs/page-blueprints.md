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
Sizing (owner 2026-08-15, #49 as retuned by #50/#52): bar **h-14**, logo **30px**, **full-width
(no `max-w-6xl`)** with **px-4 / sm:px-6** — the bar deliberately does NOT align with the body's
content column. Shrinking padding under a max-width was a no-op on desktop (the auto side margins
set the 72px inset, not the padding) and only ever bit on phones; full-width makes the inset *be*
the padding at every size — 16px on phones, **32px from sm up** (#53 gave some back after 24px
read as too tight). ⚠ **Capped at `max-w-[1600px]` above that** (owner 2026-08-15, #69): full-width
is right up to a laptop, but past ~1600px it pinned the logo and the theme toggle to opposite
extremes of a 2560px screen — ~2500px apart and nowhere near the content below. The cap engages
only above 1600px, so every size that motivated the full-width change is untouched (logo inset at
2560: **504px**, was 32px). Links **15px** at
**`text-foreground/95`** — charcoal `#31302a` in light mode, 13:1 contrast (was `text-muted` at
~5.3:1); 12:1 in dark. Kept as a `foreground` alpha rather than a charcoal hex so it stays
theme-aware — a literally darker gray in dark mode would *reduce* contrast, not deepen it.
⚠ **`h-14` is coupled to the landing hero's `--hero-available`** (`calc(100svh-4rem-1px)` =
56px bar + 1px border + 8px clearance). Change the two together or the hero stops ending exactly
at the fold.
- **Left:** logo, immediately followed by a **"Beta" tag** (→ R1-13).
- **Center:** links — **Competitions · Categories · Articles** *(the third slot was "About Us" →
  "How It Works" 2026-07-08 → **"Articles" 2026-08-15, #66**, when How It Works was discarded
  whole — see Page 4)*. A **"For Educators"**
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
Styling (owner 2026-08-15, #63): **one flat 4-column grid** — brand track pinned to **26rem**, the
three nav columns `1fr` each, a single `gap-8` governing every boundary. The brand track is pinned
because a `1.5fr` track wider than its capped content left a 126px hole before "Explore" against
32px between the nav columns; 26rem also keeps the beta disclaimer to two lines (it needs 392px).
Column headings are **bold sentence case at 14px**, not uppercase+tracked. All footer body text —
links, fine print, copyright, social icons — is **`text-foreground/95`**, the same charcoal
`#31302a` as the NavBar (13:1 light / 12:1 dark), replacing `text-muted`. Kept as a `foreground`
alpha, never a charcoal hex, so it stays theme-aware.
*(Gap: contact/support is specced here but not yet built. **Social links added 2026-08-15, #61** —
they sit in the bottom bar as **inert, aria-hidden icons** (Instagram · X · YouTube · Facebook · LinkedIn)
until real URLs exist, rather than dead `href="#"` links; the placeholder set is a guess and the
owner can swap it. ⚠ They **replaced the bottom bar's Privacy/Terms/Cookies links**, which was safe
only because those duplicated the Legal column — all four LEGAL_PAGES still render there. Never
free up footer space by trimming the Legal column instead.)*

**One footer, `SiteFooter`, on every page**, rendered from the shared public layout. Structure:
brand column (logo + beta/independence disclaimer) + Contribute / Legal, then a bottom bar carrying
the copyright + affiliate note on the left and the social icons on the right. *(The Explore column
was removed 2026-08-19, #114 — see the decision log.)*

⚠ Keep it in the **shared layout**, never in individual pages — the mandated links must appear on
every page, and a per-page footer makes it possible to ship one without them.

The public shell’s `<main>` is **`pt-12 pb-20`**, not `py-12` (owner 2026-08-15, #64): content sat
48px off the footer’s top rule and read as crammed; the bottom is now 80px (48 → 64 → 80 across #64/#65). ⚠ The **top must
stay 48px** — it is a term in the landing hero's `--hero-available` (`calc(100svh-4rem-1px)`,
paired with `lg:-mt-10` which cancels 40 of those 48). Splitting `py` into `pt`/`pb` is precisely
what lets the bottom move without breaking the hero's one-screen rule; never collapse it back.

*A two-variant experiment (`FooterSwitch` + a compact `SiteFooterCompact` for How It Works) was
built and then **reverted at the owner's request on 2026-08-15**; it is not in the codebase. If it
is ever revived, the constraint that made it non-trivial still stands: a "compact" footer has to be
**REDUCED, NOT LIGHTER** — it must still carry all four legal links (Affiliate Disclosure included;
FTC, compliance §DQ10) and the full R1-13 disclaimer **verbatim**. Only the non-mandated
Explore/Contribute navigation may be dropped. Shortening the disclaimer to hit a height target
trades a legal position for layout.*

---

## Page 1: Landing *(job: convert traffic into browsing + email capture; establish trust fast)*

**1. Hero** *(directly below nav)*
- **Layout:** 50/50 at md; **1fr : 1.25fr from lg** so the cutout column is the wider one
  (owner 2026-08-15, #40 — the cutout is width-bound there, so this is what makes it bigger).
  **Left half:** large bold headline — **"Search. Prepare. Compete."** (owner 2026-08-15, #40;
  supersedes "Search. Compete. Participate." — the last word carries the italic serif accent) —
  with **subtext that carries the value proposition** (owner 2026-07-08): names the audience
  (K-12 / "your student"), names 2–3 subjects (math, science, debate…), and states the
  one-place promise. Subtext is **16px** (`text-base`, reduced from 18px — owner 2026-08-15, #40). **Two CTAs** below: primary **"Browse competitions"** → a plain button that
  navigates to /competitions (→ M1) — **no dropdown, no panel** (owner 2026-07-09, supersedes the
  hover quick-match panel). Secondary **"Browse by category"** → /categories (owner 2026-08-15,
  #66 — was "How it works" → Page 4, which has been discarded; /articles is a coming-soon stub and
  a dead end for hero traffic). **Below the CTAs: browse quick-links** (owner 2026-08-15, #41;
  trimmed to **3** by #42; grade **+ category** since #54) — `+ 7th grade competitions`,
  `+ 🤖 Robotics competitions` (the "+" then that category's own **coloured** icon),
  `+ High school competitions` in a labelled `<nav>`, at **30px / 13px**. Every entry leads with
  the "+" so the row stays uniform; the category mark follows it. The middle slot is a **category** link so the row
  advertises both browse axes rather than three variants of grade; it points at the **hub route**
  `/competitions/<slug>` (decision #16), the indexable surface for that taxonomy, not a
  `?category=` query. ⚠ The slug must be one of the 11 seeded R1-2 categories
  (`CATEGORY_CONTENT`) — an invented one 404s. Sample, not an index — the marketplace filter panel
  remains the complete surface.
  **Right half (owner 2026-08-15, supersedes the three-HeroCard
  plan — decision #38):** a **single bottom-anchored photographic cutout** (student holding a
  trophy over the brand's gold hexagon motif). It **stands on the hero's baseline** — flush with
  the hero's bottom edge, no longer hanging into the section gap (that overhang was removed by
  #39) — with a **linear alpha mask fading its lower part to nothing** so it dissolves instead of
  ending on a hard edge. The
  source PNG has its **white studio background knocked out**, so it sits on both the light and
  dark ground with no plate. **Decorative** (`alt=""`) and `pointer-events-none`. **Not
  admin-managed** — a static asset in `apps/web/public/landing/`.
- **Hero base strip:** ~~a horizontally scrolling row of compact category tiles~~ **removed**
  (owner 2026-08-15, decision #38). Per-category entry now lives in the nav's **Categories** link
  and the Categories index page (Page 5).
- **Height (owner 2026-08-15, #39, capped by #67):** from **lg** the hero fills whatever the sticky
  header leaves of the viewport — **header + hero = exactly one screen** — but only up to a
  **`min(…, 52rem)` ceiling**. Below lg it is content-height.
  ⚠ **The cap is not cosmetic.** `--hero-available` tracks viewport HEIGHT without limit while the
  content filling it is bounded by the 1152px shell WIDTH, so a tall monitor stretched the hero
  into a void — at 1920×1080 it was 1015px tall around a 725px cutout (71% fill, ~390px dead).
  **52rem (832px) is set just above the cutout's natural height of 826px**: the asset is 784×826
  and already renders downscaled on a laptop, so it physically cannot fill a taller hero without
  upscaling into blur. The hero stops growing where its own artwork runs out.
  The cap only binds above ~897px of viewport height, so **laptops are untouched** and still end
  exactly at the fold; on tall monitors the hero now ends above the fold and reveals the next
  section, which is the intended trade.
- **Left column's vertical position is height-driven** (owner 2026-08-15, #68): **under ~900px tall
  it is raised** (`self-start` + a top pad, per the owner's earlier "move it up" asks); **taller
  viewports fall through to the section's own `items-center`**. Past ~900px the #67 cap stops the
  hero growing while the text block does not, so at 1920×1080 the block sat with **0px above and
  209px below** — stranded at the top against a bottom-anchored cutout. Centred it is ~120px either
  side. ⚠ There is deliberately **no `min-height:900px` counterpart**. Pairing `max-height:899px`
  with `min-height:900px` *looks* exclusive but leaves a real hole: a 1440×899 viewport reports a
  **fractional 899.5px**, so both queries evaluate false and the rules silently stop applying.
  Gating only the raised case makes the untouched default the state tall screens want, so any
  fractional boundary lands somewhere correct. Do not "complete" the pair.
- **Column gap is 24px at every size** (owner 2026-08-15, #69, after #47–#51 had chased it down to
  4px, which was too tight). ⚠ Gap comes **straight out of the text track**: at 1280 the headline
  needs 447px of a 460px column, so the 24px was paid for by stepping the headline 116 → 112. Move
  one and re-check the other.
- **Headline scale: 84 / 96 / 112px** (base · lg+700h · 1280+700h). There is deliberately **no step
  above 1280** — under #71 the shell caps the text column at ~460px for every width from 1280 up, so
  112px is simply the largest that fits, and a monitor gets the same headline as a laptop.
- **The hero has NO breakouts and NO bleeds** (owner 2026-08-15, **#71 — supersedes #69/#70**). It
  sits inside the shell's `max-w-6xl` exactly like every other section, so it is capped at 1104px
  and simply centres with growing side padding as the screen widens. **Laptop proportions ARE the
  maximum** — a monitor shows the *same* hero, not a bigger one:

  | | 1280×800 | 1920×1080 | 2560×1440 |
  |---|---|---|---|
  | Hero height | 735 | 736 | 736 |
  | Text column | 460 | 460 | 460 |
  | Headline | 112px | 112px | 112px |
  | Cutout | 620×654 | 620×654 | 620×654 |
  | Side padding | 80 / 81 | 400 / 401 | 720 / 721 |

  ⚠ **Do not reintroduce a `-mr` on the cutout or a `-mx` on the section.** Both were tried: #69
  bled the cutout rightward (one-sided, so at 1920 it left 400px of space left of the text against
  121px right of the cutout — the hero read as shifted); #70 fixed the symmetry with a symmetric
  section breakout but made the hero wider than every section below it. #71 discards both in favour
  of the hero sharing its edges with Featured at every size.
- **Desktop right-nudge** (owner 2026-08-15, #72): from **xl** the hero shifts **24px right** via
  `xl:ml-6 xl:-mr-6`, trimming the space to the right of the cutout (at 1280: 104px left / 57px
  right; at 1920: 424 / 377). ⚠ The two margins are **equal and opposite on purpose** — they cancel,
  so the content box, both grid tracks, the 24px column gap and the cutout size are all unchanged.
  It is a pure translation, which is what satisfies "shift it, don't shrink the gap". Gated at
  **xl, not lg**: the offset pushes the right edge 24px past the shell and only from 1280 is there
  gutter to absorb it — at 1152 the cutout would sit flush against the viewport edge. This is the
  one intentional asymmetry in the hero; everything below xl stays symmetric.
- The **height ceiling is `46rem` (736px)** — the height a 1280×800 laptop produces. That is what
  makes "laptop is the maximum" true in the vertical axis too, and it pairs with the width cap: the
  cutout is only ~654px tall inside the shell, so a taller ceiling re-opens the void #67 closed.
- The cutout carries **`max-w-[min(100%,49rem)]`** — 49rem is its natural 784px. The breakout widens
  its wrapper, and without that ceiling it would follow and upscale into blur; the height cap alone
  does not prevent this, as it only binds on short heroes.
- Note the **fallback serif is ~100px wider** than Fraunces at the large steps, so a brief reflow on
  font load is inherent there — not something a few px of trimming fixes.
- **Cutout size ceiling:** the cutout renders at **620×654** from lg up — its column width inside
  the shell — and keeps `max-w-[min(100%,49rem)]` (49rem = its natural 784px) as a hard guard so it
  can never upscale into blur if a future change widens its wrapper. ⚠ #67's `2xl:-mr-38` bleed,
  which pushed it to the full 784×826 on monitors, was **removed by #71** along with every other
  breakout — see above for why.
- **Cutout visibility (owner 2026-08-15, #39):** the cutout shows only where it can sit **beside**
  the headline — **md (768px, portrait iPad) and up**. Phones get a text-only hero, and the image
  is **not downloaded** there (media-gated `<picture>` source, not just `hidden`).
- **Spacing:** the hero takes the **same section gap** as every other boundary on the page — no
  negative margin, nothing bleeding into the Featured section (#39, supersedes #38's overhang).
- **Motion:** the cutout rises in on load (single `animate-rise-in`, short delay).
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

**3. Value-proposition split** — ~~"Competing changes what's possible"~~ **REMOVED from Landing
2026-08-15 (owner, decision #39).** The section and its heading no longer render; Landing goes
Featured carousel → Audience cards. The spec below is kept for history only. ⚠ Its two
`ValuePropCard`s and two `LandingStat`s are still admin-editable at `/admin/landing` and still ship
in the `/landing` API payload, so that surface is now **orphaned** (same follow-up as the
`HeroCard` panel under #38). The owner-supplied sourced-stats TODO that gated R1 dies with it.
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
- **Admin-managed (2026-07-16):** both image cards (image + link + label) and both stats (value +
  text + source) are now editable from `/admin/landing` (`ValuePropCard`/`LandingStat`, M36) — the
  owner supplies the final images, links, and sourced numbers through the panel rather than in code.
  A card with no uploaded image keeps the code-defined gradient+icon fallback, so the approved look
  is the default. Kept at exactly **two** cards + **two** stats to match this layout.

**4. Audience cards** (→ H46) — section heading **"Get the weekly competition digest"**
(owner 2026-08-15, #57; was "Built for the whole team behind a student").
- **Layout:** three cards in one row — **"For Students & Parents"** (broadened from "For Parents",
  #57) **· "For Educators" · "For Organizers"** — each with an image and a CTA. Organizers CTA =
  interest capture ("Get early access") → host waitlist.
- **Cards are DISCLOSURES, not links** (#57): each is a `<button aria-expanded/aria-controls>` that
  opens its capture panel **in place**; the two digest cards open §5, the organizers card opens the
  organizer early-access panel. The For Parents / For Educators pages remain deferred.
- **Cards + panel are ONE page-grid child** (#58), gap **24px** between them — not the 80px page
  section rhythm. As a bare fragment they became two separate grid children and inherited the full
  section gap, which read as an unrelated band floating below rather than something a card opened.
- **Interaction:** hover = card expands/grows.

**5. Weekly digest signup** (→ R1-15) *(reframed — owner 2026-07-08)*
- **Layout:** capture band branded as a **weekly personalized competitions digest** — heading
  promises a weekly list of **new competitions matching the reader's preferences**; email input +
  submit (Brevo).
- **Flow:** subscribing asks 2–3 quick preference questions (grade, category/interests, region);
  the weekly send lists new/matching competitions. *(Also segments the list for R2 activation.)*
- **Heading sits on ONE line from md up** (owner 2026-08-15, #56) — it may wrap on phones only.
  Two things together achieve that, and neither works alone: the wrapper went `max-w-2xl →
  max-w-4xl` (the 672px cap, not the section, was breaking the line — the heading needs **737px**
  at 30px), and the `text-3xl` step is held back to **lg**, because 30px only fits from lg's 896px
  while 24px fits md's 640px. Re-measure both if this copy changes.
- The preference selects' **"Personalize your digest (optional)" label is visually removed** (#56)
  but kept as an **`sr-only` legend** — it is the fieldset's accessible name, and deleting it would
  leave AT announcing an unlabelled group of three selects.
- **On Landing the band is hidden until a card opens it** (owner 2026-08-15, #57) and carries an
  **X to dismiss**. ⚠ It is still **always visible on How It Works**, which renders `<DigestBand />`
  with no props — `onClose` is optional precisely so that page is unaffected, and the X only appears
  where there is something to close. Do not make it required. *(Categories carried it too until #59
  removed that placement.)*
  ⚠ **`/#digest` deep links** (How It Works links to one) no longer land on markup that is already
  in the DOM, so the landing section opens the panel from the hash on mount **and** on
  `hashchange` — the latter covers clicking such a link while already on Landing, where there is no
  remount. Removing that hash handling silently breaks those links.
- **Organizer early-access panel** (#57): same `CapturePanel` shell and same Brevo `host` list as
  the detail page's host capture, but a **separate action** (`registerHostEarlyAccess`) because the
  detail-page copy is written for claiming a specific listing, which is meaningless from Landing.
  Asks for organization instead of grade/interest/state.

**6. Footer** — shared component.

*Moved to the How It Works page (owner 2026-07-08): the demo video, the stats & imagery grid, and
the How It Works timeline. Removed: the full-bleed Category highlight section (replaced by the
hero category strip — itself removed 2026-08-15, decision #38).*

**Mobile:** single column; the hero is **text-only** — the cutout is hidden and not downloaded
below md (#39); carousel & related rows become swipe; audience cards stack. Headline size is
**fluid** (`clamp(3.25rem, 22vw, 5.25rem)`) so "Compete." cannot overflow a 320px screen; the two
CTAs share **one row** (they wrap only when the width genuinely denies it); the browse quick-links
use **short labels** below sm (#109) and sit on **one row from ~344px up** (#113), falling back to
2 + 1 only on the narrowest phones.

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
  scroll horizontally as **one non-wrapping row**; grid 1–2 per row. The toolbar is **two rows,
  not three** — the result count rides the sort/filter line (#109).

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
  **Grades · Registration/Next deadline · Cost · Location/Online · Format · Delivery · Prize**
  (owner 2026-07-08; regrouped 2026-08-18, #82: Format + Delivery moved UP from the Details tab;
  Entry pathway moved OUT — to the Register button + the Eligibility group. The deadline slot
  shows **"Opens {date}"** while a future reg_open exists — a bare close date implied you could
  enter now. Prize folds in the typed prize_value when curated: "$5,000 — Scholarships").
  ⚠ **The strip OWNS the scan** (#82 repetition rule): a field shown here may reappear below only
  at a decision point (deadline → sticky bar/timeline; pathway → Register CTA + Eligibility).
  Small **Share** icon (→ M21).
- **Right:** **cover-image card** with a **"Register" button below it** → official external
  registration page (`registration_url`, opens ↗). **Microcopy under the button:** the entry-pathway line (#82 — "Entry is through a participating
  school or chapter." / "Register directly — no school or chapter needed.", shown in every CTA
  state: it is the go/no-go fact at the moment of action), then "Registration happens on the
  organizer's official site ↗" (owner 2026-07-08 — frames the handoff as a feature, preserves
  trust at the redirect moment). **[R2]** after click-through, prompt "Did you
  register? Track it" (→ M23).

**3. Main content — left column (majority width)**
- **a. Tabbed section** — default tab **"Details"** (renamed from "Key Facts & Details", #82),
  three grouped sub-sections: **Eligibility** (age + cutoff date, how to enter, and the standard
  eligibility JSONB keys — citizenship / eligible countries / student status — pulled out of the
  generic bag), **Format & judging** (team size, evaluation, recurrence), **{Category} details**
  (remaining attributes from the Category Template → X9). Grades/Cost/Format/Delivery deliberately
  absent — the At-a-glance strip owns them. Eligibility becomes its own TAB once Tier-2 keys are
  commonly populated (post-seeding call). Second tab: **"About"** (long description). Third tab: **"FAQ" [R1]** (owner
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
- **b. Vertical timeline** — panel heading **"Timeline · {cycle}"** (renamed from "Key dates",
  owner 2026-08-18, #84; past milestones show a **check marker + "(completed)"**, no strikethrough —
  strikethrough reads as *cancelled*, a passed milestone is *done*) — of the edition's key
  dates/events (reg opens → closes → rounds → results,
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

**Mobile:** the sidebar is **interleaved with the main column, not stacked after it** (#109,
supersedes the 2026-07-08 "left column then sidebar remainder"). Phone order is **follow panel →
cover → title/byline/description → tabs → Timeline → trust/claim → resources → related** — the
cover image sits **above the title** (#112), and the trust/claim panel rides with the Timeline
rather than sitting last (#115) and the Timeline is near the top rather than ~1800px down a
3200px page. Below lg the cover card is **the image ALONE** (#111): its Register/official-site block
and the how-to-enter note are `max-lg:hidden`, because the sticky bar carries Register on exactly
those widths. **Follow and Share do not appear on the page below sm at all** (#112) — the sticky bar
is their only home there; the labelled Follow + Share pills return at sm. The **slim sticky bottom
bar** appears once its sentinel scrolls out — the sentinel sits at the END of the cover card — and
is laid out as **Register taking all available width + Follow/Share icon circles on the right**
(owner 2026-07-08, retargeted #109/#110/#112).

---

## Page 4: ~~How It Works~~ → Articles *(DISCARDED 2026-08-15, #66)*

> **The How It Works page was deleted whole** at the owner's request and its nav slot given to
> **Articles** (`/articles`) — currently a **coming-soon stub**: an "Articles" eyebrow, a
> "Coming soon" h1, and CTAs into the catalog. It is **`noindex` and deliberately absent from
> `sitemap.ts`**; drop both only in the change that ships real articles, or the site advertises an
> empty page while it is still trying to get its catalog indexed (R1-17).
>
> **What went with it, and where it landed:**
> - the landing hero's secondary CTA was **"How it works" → this page**; it now reads
>   **"Browse by category" → /categories** (Articles is a dead end for hero traffic);
> - this page held the **last standalone `<DigestBand />`**. The digest capture now exists *only*
>   as the on-demand panel behind the landing audience cards (#57). Its `onClose`-optional design
>   has no remaining always-visible caller;
> - it was also the only thing linking **`/#digest`**. The hash handling in `audience-section` is
>   kept for bookmarks but nothing on the site points there now;
> - its content is gone: mission intro, the how-it-works timeline, the demo-video slot, the stats
>   grid, and the contact/feedback block. **Recover from git history** if any is wanted for
>   Articles later.
>
> The original blueprint is kept below for that reason — as a record of what was built, **not** as a
> spec of anything currently shipping.

### *(historical — the discarded page)* How It Works *(new 2026-07-08 — replaced "About Us" in the nav; job: explain the model honestly, build trust, capture email)*

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

**7.** ~~Weekly digest band~~ **removed** (owner 2026-08-15, #59) → **Footer**. The page now ends
on Closing soon. The band still renders on **How It Works** (§7 there) and opens on demand from the
Landing audience cards, so the digest capture is not lost — only this placement.

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
3. ~~**Hero category strip** (horizontal scroll, side buttons) **replaces the full-bleed Category highlight section**.~~ **Superseded 2026-08-15 (#38)** — the strip is removed; per-category entry lives in the nav's Categories link + the Categories index page.
4. **Relocations:** demo video, stats & imagery grid, and the How It Works timeline move to the new **How It Works page** (nav tab renamed from "About Us"); Landing keeps the admissions-stats value-prop split.
5. **Landing order** is now: Hero → Featured carousel → ~~Value-prop split~~ → Audience cards (capture panels open on demand, #57) → Footer. *(Value-prop split removed 2026-08-15 — #39.)*
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
24. **Hero "Browse competitions" is a plain button** → /competitions. No hover dropdown / side panel / quick-match (supersedes decision #2). ~~Category entry stays in the hero category strip (#3).~~ *(Strip removed 2026-08-15 — #38; category entry is the nav Categories link + Categories index.)*

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
25. *(Superseded 2026-08-15 — #38: replaced by a single bottom-anchored fading cutout, not admin-managed.)* **Hero right half = image cards, not SVG illustrations** (supersedes the child-SVG + satellite-SVG plan): one **main HeroCard** (a link; hover/focus = translucent WCAG-AA scrim + short destination description) + two satellite HeroCards (top-right, bottom-left, image-only). **All three admin-managed** (→ M36) — image/alt on all, link + description on the main card.
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
34. **Card width is invariant** to the filter-panel toggle: fixed grid tracks from `sm:` up,
    and the desktop panel is exactly one track wide, so opening it drops exactly one column at
    identical card width. Mobile stays a fluid single column. *(Amended at build, same day:
    the track is the shared **`--card-w` token = 264px** (258px until #74) — shell-derived so
    4 tracks + gaps EXACTLY fill the `max-w-6xl` content width (4 ↔ 3 per row; the original
    270px only fit 3 ↔ 2). Every card row — marketplace grid, landing featured, categories
    closing-soon, detail related — consumes the same token.)*
    ⚠ **`--card-w` is locked to the grid gap**: `(1104 − 3 × gap) / 4`. #74 widened the card by
    narrowing the gap **24 → 16px**, giving **264px**. Three gaps must agree or a row silently
    drops to 3 cards — the marketplace grid, the detail *related* grid, and the marketplace
    **frame** (panel ↔ grid). That last one is the subtle one: the frame gap must *equal* the
    grid gap, because panel-plus-frame-gap is what has to equal card-plus-grid-gap for the panel
    to drop exactly one column instead of resizing every card. Re-derive the token whenever the
    gap changes — at the old gap-6 these 264px cards would need 1128px and overflow the shell.
35. **Card refinements:** the title is **one line, truncated** (supersedes the two-line clamp);
    the facts row pins to the card bottom above the footer. **Prize and region swapped**
    (owner 2026-08-17, #75): the row is now **Cost + PRIZE**, the footer **region + deadline**.
    Prize keeps its gold-bold treatment in the new slot — the swap moves the fields, not the
    hierarchy, so the standout fact moved up a row with it. ⚠ The facts row also changed from
    r10's **even halves** to **`auto minmax(0,1fr)`**, and that is required by the swap rather
    than cosmetic: halves were sized for short region labels, so at 50/50 every prize truncated
    to 87px of the ~281px it wants. Cost is a two-state word, so giving it only its intrinsic
    width and handing the remainder to prize takes the visible prize to 146px and halves the
    number of truncated cards. (`auto` varies the cost column by just 1px between "Free" and
    "Paid" — measured, imperceptible.) Gap widened to `gap-x-5` by #76 to nudge prize right.
    The top-right corner ships **Share-only at R1** (ShareMenu icon variant, popover rendered
    through a portal; hover/focus-revealed, always visible on touch devices) — the corner is
    the R2 slot for Save (M7) and the social-proof pill (M31, #18), added without relayout.
    *(Extended at build, same day — **fixed-slot anatomy**: every card renders the same rows at
    the same heights — 1 line tags · 1 line title · 1 line organizer · exactly 2 lines
    description · facts · footer. Missing data leaves BLANK reserved space (owner: an
    unattributed card never implies an organizer), so mixed sparse/full rows stay
    pixel-aligned.)*
36. **Panel facets are collapsed by default** (the first facet plus any facet with an active
    filter open); the desktop panel has no internal scroll — the page grows instead (the mobile
    bottom sheet keeps its own scroll). *(Amended at build, same day — **panel stickiness is
    bottom-edge, never top** (owner): a panel taller than the viewport scrolls with the page
    and pins only when its bottom touches the viewport bottom (−24px margin); a shorter panel
    stays in normal flow and scrolls away (a bottom-pin offset would displace it downward at
    rest). Height is measured (ResizeObserver + resize fallback) into a `--panel-h` var
    feeding the sticky `top` calc. Panel dropdowns are the design-system `Select` custom
    listbox — native `<select>` popups can't match the universal dropdown styling.)*
37. **Prize fallback (sweep item 16, 2026-07-16):** when a competition has no `prize_summary` on
    record, the card footer's bold prize slot and the detail "At a glance" Prize slot render
    **"Bragging rights"** instead of sitting empty (`prizeSummary ?? 'Bragging rights'` in
    `lib/catalog-display.ts` + `lib/detail-display.ts`), so the bold slot always renders. Note
    a null summary means *uncurated*, not guaranteed no-prize — curators fill in a real prize
    where one exists.

**2026-08-15 (owner — landing hero simplification; built same day):**
38. **Hero right half = one bottom-anchored fading cutout** (supersedes #25's main + two
    satellite HeroCards) **and the hero category-tag strip is removed** (supersedes #3 /
    2026-07-08's "hero base strip"). The cutout stands on the hero baseline, hangs the full
    section gap, and is masked to transparent at its lower edge so the hero **fades into the
    Featured section**. Overhang is pinned to exactly the shell's `gap-16`/`sm:gap-20` so the
    faint tail dies at the next section's top edge and never paints over its text (WCAG).
    Asset: `apps/web/public/landing/hero-section-image-1.png`, white background flood-filled to
    alpha so it works on both grounds; served by a plain `<img>` (the standalone
    `node:20-alpine` runner carries no `sharp`, so `next/image`'s optimizer is unavailable).
    ⚠ **Leaves the `HeroCard` admin editor + API orphaned** — the R1-3 hero-card panel and
    `GET/PUT /hero-cards` still exist and now render nowhere; removing them (and the
    deferred PR C hero-card image upload) is a follow-up.
39. **Landing trimmed + hero made full-height** (owner 2026-08-15, same day as #38):
    (a) **the value-prop split is removed** — "Competing changes what's possible", its two image
    cards and its two admissions stats no longer render (see §3 above; kills the sourced-stats
    TODO that gated R1, and orphans the `ValuePropCard`/`LandingStat` admin surface the same way
    #38 orphaned `HeroCard`);
    (b) **the hero fills the screen from lg** — `min-h: calc(100svh - 4rem - 1px - 3rem)`, the
    subtrahend being the sticky header (`h-16` + border) plus the public shell's `py-12`. Kept off
    md, where the columns are only ~332px and a screen-tall hero would strand the content;
    (c) **the cutout is hidden below md** and, critically, **not fetched** there — `hidden` alone
    does not stop the download, because React emits a `<link rel="preload">` for a
    `fetchPriority="high"` image and preloads ignore CSS, so the real file hangs off a
    `<source media="(min-width: 48rem)">` (rem, to stay locked to Tailwind's `md:`);
    (d) **section spacing is uniform** — #38's negative-margin overhang is gone, so hero→Featured
    gets the same `gap-16`/`sm:gap-20` as every other section boundary.
40. **Hero copy + cutout scale** (owner 2026-08-15, same day):
    (a) headline is **"Search. Prepare. Compete."** (was "Search. Compete. Participate."); the
    italic serif accent stays on the final word. Changed in the hero, the **OG share image**
    (`opengraph-image.tsx` — otherwise social cards keep the old tagline) and the `/design` type
    specimen, so the wording is consistent everywhere it appears;
    (b) subtext drops 18px → **16px** (`text-lg` → `text-base`);
    (c) **cutout enlarged ~15% linear / ~31% area** at lg (591×623 vs 516×544 at 1280×800), by
    widening its column to 1.25fr and removing the fixed `svh` cap that used to bind before the
    column did. ⚠ It is now capped by **`--hero-available`** — the same
    `calc(100svh - 7rem - 1px)` the hero uses as its min-height, declared once on the section and
    inherited by the image. That cap is load-bearing: `max-h-full` does NOT work here (the hero is
    sized by *min*-height, so a percentage max-height has no definite parent to resolve against),
    and without it the cutout's width-derived height pushed the hero 135px past one screen on a
    short laptop (1280×600), breaking (b) of #39.
41. **Hero headline scale + grade quick-links** (owner 2026-08-15, same day):
    (a) headline steps up to **48 / 60 / 72px** (`text-5xl` → `sm:text-6xl` → 72px). ⚠ The 72px
    step is gated on **width AND height** (`min-width:1280px and min-height:700px`), not a plain
    `xl:`. Because #39 locks the hero to one screen, the left column has a fixed height budget:
    72px needs ~522px, which fits a 1280×800 laptop but overflowed a 1280×**600** one and pushed
    the hero 35px past the fold. Anything that grows the left column (a 5th tag, a third CTA,
    longer subtext) must re-check that budget;
    (b) **grade quick-links** under the CTAs — see §1. Rendered as `sm`/`secondary`
    `buttonClasses` links, matching the marketplace's own grade quick-chips. The shared `Chip` is
    deliberately not used: it renders a `<button aria-pressed>`, which would misreport a plain
    navigation link as a toggle to AT. Ranges for the band entries derive from `GRADE_BANDS` so an
    arriving visitor sees that band's quick-chip highlighted (A10) rather than a stray custom-range
    tag; the single-grade entries (7th, 8th) required `activeChips` to label `min === max` as
    "Grade 7" instead of the nonsense "Grades 7–7" (covered by a unit test).
42. **Hero left column — trim, retune, raise, enlarge** (owner 2026-08-15, same day):
    (a) grade quick-links cut from 4 to **3** (Elementary dropped);
    (b) their **tone** retuned — outline on a transparent ground, muted label lifting to
    foreground on hover, `buttonClasses` still the base so shape/focus/icon sizing stay shared.
    ⚠ A brand-gold "+" was tried and **rejected**: #F5C330 measures **1.6:1** on the light ground.
    `tokens.css` already encodes this exact finding (`--ring` is neutral because "gold fails 3:1
    on light"). The glyph is decorative and so exempt from WCAG 1.4.11, but a brand accent that
    only reads in dark mode is not worth the inconsistency — it inherits the label colour (5.33:1
    in both themes) instead. **Do not reintroduce gold here without a darker light-mode token;**
    (c) the column is **top-aligned** instead of row-centred, so it no longer floats low beside
    the bottom-anchored cutout. Pad **32px → 8px** by #43 ("up by a bit more"), which puts the
    headline 8px from the hero's top edge (it was 82px when centred). Note the pad no longer
    carries the `min-height:700px` gate: 32px overflowed a 1280×600 hero, 8px clears it by ~95px.
    Raise it again and the gate has to come back;
    (d) type scale up again to **60 / 72 / 96px** with **`leading-[1.05]`**, at **weight 700**
    (#43). 700 overrides the `.font-display` base weight of 560 — tokens.css puts that default in
    `@layer base` specifically so weight utilities can win — and Fraunces is a variable font
    (wght 100–900), so it is a real 700, not a synthesized faux-bold. Bold widens the type, so the
    binding check is the **widest single word** ("Compete.") against the column. Grade tags
    dropped a notch to **28px / 12px** (#43).
43. **Headline at the width ceiling** (owner 2026-08-15, #44): sizes are now **68 / 88 / 108px**
    with **`leading-[1]`**. ⚠ These are **arbitrary values on purpose, not scale steps** — unlike
    everything else in this column, the constraint here is **WIDTH, not the height budget**. The
    widest word "Compete." at weight 700 stops fitting past **76px** in the ~332px md column,
    **96px** at lg (~409px) and **112px** at the top step (~473px); the chosen sizes leave
    31 / 53 / 41px. Rounding up to the nearest Tailwind steps (72/96/**128**) overflows by 37px at
    the top. Fraunces has an `opsz` axis with optical sizing on, so it sets relatively **narrower**
    as it grows — the ceiling must be **re-measured, not extrapolated** from a smaller size.
    **The height budget is now nearly spent:** at 1280×600 the column clears the fold by only
    **25px** (it was 103px). The hero still fits one screen everywhere, but this is the practical
    end of the road — growing the type further, or adding anything to this column, needs the
    left/right column split reworked or the cutout shrunk, and the owner has asked for the cutout
    to be **larger** (#40).
44. **Cutout +7.5%, left column raised again** (owner 2026-08-15, #45):
    (a) cutout **591×623 → 635×669** at 1280 (~15% more area), from two sources, because after
    #44 the headline had claimed most of the row: the split moved **1.25fr → 1.35fr**, and the
    cutout takes a **`lg:-mr-6` bleed** into the shell's own right padding. The bleed is the
    safer half — it is width the headline is not competing for, and since the shell is
    `max-w-6xl px-6`, −24px exactly cancels that padding and lands the cutout on the container
    edge, never past the viewport (checked at 1024/1280/1440; it is `lg:`-only so md and phones
    are untouched). **The ratio is now pinned:** the left column must stay ≥ ~440px for
    "Compete." at 108px, and 1.35fr leaves it 453px — 21px of margin. Past this, the two
    standing asks (bigger type #44, bigger cutout #45) are in direct conflict over one fixed row
    width, and one of them has to give;
    (b) `self-end` is what holds the bottom edge still while the cutout grows upward — the owner's
    "don't move where the bottom starts from". Verified flush (0px) at every size;
    (c) left column raised again, `lg:pt-2` → **`lg:-mt-3`**, so the headline now sits 12px ABOVE
    the hero's top edge, inside the shell's 48px top padding (36px clear of the sticky header).
    Raising a top-aligned column only frees space beneath it, so unlike the old pad this needs no
    height gate — 1280×600 slack went 25px → 45px.
45. **Cutout at its ceiling** (owner 2026-08-15, #46): bleed extended with **`xl:-mr-16`** (64px
    past the container edge, on top of the `lg:-mr-6` that cancels the shell padding). Result:
    **652×687 at 1280×800** (+2.7%) and **675×711 at 1440×900** (+6.3%).
    Safe by arithmetic, not luck: with the `max-w-6xl` box centred, clearance is
    `(viewport − 1152) / 2 − 40`, which break-evens at **1232px** — the bleed is tied to `xl:`
    (1280px) so it always has ≥24px. Applied any lower it starts a horizontal scrollbar.
    ⚠ **The cutout is now DONE growing at 1280×800.** It is no longer width-bound there — at
    652×687 it exactly equals `--hero-available`, i.e. the full height of the one-screen hero, so
    extra width now buys nothing (`max-h` simply clamps it). The aspect ratio is 784:826, so any
    further size needs more HEIGHT, and the only sources of that are breaking the one-screen rule
    (#39), re-introducing the section-gap overhang the owner rejected in #45 ("don't move where
    the bottom starts from"), or reducing the shell's `py-12`. Taller viewports still have room —
    1440×900 is width-bound and would keep growing — but do not promise a bigger cutout on a
    standard 800px-tall laptop without changing one of those three things first.
46. **Gap tightened, hero reclaims shell padding** (owner 2026-08-15, #47): column gap **40 → 24px**
    ("too much gap between the left section and right image"), and the cutout grows again —
    **682×719 at 1280×800** (+4.7%), **493×519 at 1280×600** (+6.6%), 684×721 at 1440×900.
    This took the third option listed in #46, the only one that does not break a standing decision:
    **`lg:-mt-8` pulls the hero 32px up into the shell's 48px top padding, and `--hero-available`
    drops `7rem → 5rem` to match.** ⚠ Those two numbers are a **matched pair** — the negative
    margin must equal the padding removed from the subtrahend, or the hero stops ending exactly at
    the fold. The left column's `-mt-3` became `pt-4` to absorb the shift, so the headline keeps
    the same 32px of clearance under the sticky header: **net change to the text is nil by design**,
    all the reclaimed height went to the cutout. Read the three together before touching any one.
    Hero top now clears the header by 16px at lg (`-mt-8` is lg-only; md and phones keep the full
    48px). Inter-section rhythm is unaffected — still 80px/64px.
47. **Gap 24 → 16px, headline 76 / 96 / 112px** (owner 2026-08-15, #48). Tightening the column gap
    widens both tracks, which is what funded the type step — the left column went 460 → 463px at
    1280, and re-measuring the ceilings gave 80 / 100 / 116px, so the sizes sit ~16px under each.
    Spacing is now deliberately **opposed**: line gap INSIDE the headline tightened
    `leading-[1]` → **`leading-[0.9]`**, while the gap between the headline and the body paragraph
    widened `mt-4` → **`mt-8`**, so the paragraph reads as a separate element rather than a fourth
    headline line.
    ⚠ **`leading-[0.9]` is under 1em and that is fine — do not "fix" it.** The usual check (font
    max-ascent vs max-descent) reports a collision here and is WRONG: it ignores glyph position.
    The only descender is the "p" of "Prepare." and the tall glyph beneath it is the "C" of
    "Compete.", which sits in a different pixel column. Rasterising both lines and diffing ink
    per column gives the true worst-case gap: **22px at 0.9**, 27px at 0.95. Use that test — not
    the metrics one — before tightening further.
    Budget note: 1280×600 slack is **32px**. The tighter leading paid for the larger type there
    (it would otherwise have overflowed), so the two must move together.
48. **Header retune + hero at its limits** (owner 2026-08-15, #49).
    **NavBar:** logo `h-8 → h-7`, header side padding `px-4/sm:px-6 → px-3/sm:px-4` (the header's
    own padding only — the content shell keeps its own), nav links `text-sm → text-base`, and
    inactive links darkened `text-muted → text-foreground/85`. That is **9.44:1** in light mode
    (was ~5.3) and **9.91:1** in dark. `foreground/85` rather than a literal gray so it stays
    theme-aware: "much darker gray" in light mode, and its correct analogue in dark, where a
    literally darker gray would have *reduced* contrast. ⚠ Header height stays **h-16** — the hero's
    `--hero-available` hardcodes it as `4rem`, so changing it silently breaks the one-screen hero.
    **Hero:** gap `16 → 12px`; `-mt-8/5rem` → **`-mt-10/4.5rem`**, i.e. 40 of the shell's 48px top
    padding reclaimed, leaving the cutout 8px under the header. Cutout **690×727** (+1.2%),
    headline base **76 → 80px**.
    ⚠ **The hero is now out of road, and the next request to enlarge either element should start
    here.** The cutout is HEIGHT-bound with 7px of spare width, and every height source is spent
    (shell padding gone, header fixed, one-screen rule and the section-gap overhang both ruled
    out). The headline is WIDTH-bound with ~3px of margin at lg and xl — 96/112px are hard
    ceilings for these columns, and they cannot both grow because the split that feeds one starves
    the other. Real gains need a **structural** change: full-bleed the hero past `max-w-6xl`
    (biggest win — ~128px more row at 1280, but the hero stops aligning with the sections below),
    shorten the header, or let the hero exceed one screen. That is an owner call, not a tweak.
49. **NavBar retune** (owner 2026-08-15, #50): links **16 → 15px**, logo **28 → 30px**, grey
    deepened to charcoal (`foreground/85 → /95`, `#31302a`, 13:1 light / 12:1 dark), and the bar's
    vertical padding cut via **`h-16 → h-14`**. That last one took the "shorten the header" option
    #49 had listed, so `--hero-available` moved `4.5rem → 4rem` in the same pass to keep the pair
    matched (verified: hero still ends at the fold, 0px).
    Note the freed 8px did **not** reach the cutout: it grew 690 → 691px only, because the extra
    height flipped it from height-bound to **width**-bound, and width is pinned by the headline.
    The hero's two elements remain in the deadlock described in #49 — this is the same wall from
    the other side, not progress toward removing it.
50. **Streak, inward cutout, lower text block** (owner 2026-08-15, #51):
    (a) **gold highlight streak under "Compete."** — an `em`-sized bar on an inline-block `<em>`,
    so it spans exactly the word and tracks all three type steps. ⚠ Its `-0.28em` offset is
    load-bearing: `leading-[0.9]` makes the em's box **shorter than its own glyphs**, so the "p"
    hangs ~0.15em BELOW the box and an underline anchored near the box (-0.06em) is drawn straight
    **through the descender**. Verified clearing it by 3–4.4px at every step. Brand gold is allowed
    here only because the streak is purely decorative (aria-hidden, conveys nothing) — the same
    gold was rejected for the grade tags' "+" in #42, which sat beside meaningful text;
    (b) cutout moved **inward** — 8px off the column gap (12 → 4px) paired with 8px more right
    padding (`lg:-mr-6/xl:-mr-16` → `lg:-mr-4/xl:-mr-14`). **Matched pair**: change one alone and
    the cutout resizes instead of shifting;
    (c) left column pushed down `pt-4 → pt-8`, **height-gated** — at pt-8 a 1280×600 laptop was
    left 13px of slack, so short screens keep pt-4 (restores 29px). Paragraph `mt-8 → mt-10`, which
    also buys the streak its clearance;
    (d) NavBar side padding `px-3/sm:px-4 → px-2/sm:px-3`.
51. **NavBar full-width + right-group bug fix; streak restyled** (owner 2026-08-15, #52):
    (a) header dropped `max-w-6xl` for **full-width `px-4/sm:px-6`** — see the NavBar section above
    for why padding-under-max-width could never move the desktop inset;
    (b) 🐛 **fixed a pre-existing mobile layout bug**, not introduced by the padding work: the
    centre nav is `hidden` below sm, and a `display:none` child is removed from grid layout
    entirely, so auto-placement dropped the theme-toggle/menu group into the MIDDLE track and left
    the third empty — the controls sat at x≈157 on a 390px phone instead of the right edge. Fixed
    with an explicit **`col-start-3`**. The old code comment claimed "the two 1fr tracks split",
    which was the intent but never the behaviour. Now symmetric 16px insets;
    (c) streak moved **behind** the word and up under it (marker-highlight style), so it now
    crosses the "p" descender by design and the earlier clearance offset is gone. Colour is a
    literal light yellow **`#f9dc85`**, NOT `bg-brand-gold/50`: alpha DARKENS over the dark ground
    and rendered `#8d742a` olive there. Stacking is by DOM order (streak first, word in a
    `relative` span after) rather than `-z-10`, which would also have pushed it behind any
    ancestor background.
52. **Headline 84 / 100 / 116px; navbar padding eased** (owner 2026-08-15, #53). Header side
    padding `sm:px-6 → sm:px-8` (24 → 32px). Headline took the one 4px step each column still had.
    ⚠ **This is the end of the line for the headline.** Measured margins are now **5 / 6 / 6px**
    against the probe, and the next 4px step overflows all three columns (−6 / −9 / −10px).
    (Rendered margins read a little wider — 24 / 17 / 18px — because the last word is *italic*,
    which sets narrower than the upright probe; the probe is the conservative number, so size on
    it.) Any further increase requires more column, which means shrinking the cutout or the
    structural changes listed in #49 — it is no longer a matter of picking a bigger value.
53. **Quick-links: grade + category** (owner 2026-08-15, #54). Tags up a notch to **30px / 13px**
    (from 28/12), and the middle `8th grade` link replaced by a **`Robotics competitions`** link
    carrying the `Robot` icon — so the row now shows both axes the catalog browses on. Each entry
    supplies its own icon and href, rather than the row assuming a grade filter and a "+".
    ⚠ The category slug must exist in `CATEGORY_CONTENT` (the 11 seeded R1-2 slugs); the hub route
    resolves by slug and an invented one 404s. Note there is still **no per-category icon map** in
    the codebase — this one icon is chosen inline. If category icons are needed anywhere else,
    build the map in `packages/ui` rather than repeating the choice.
54. **"+" kept on the category tag; category icon coloured** (owner 2026-08-15, #55). Every tag now
    leads with the "+" and the category mark follows it, so the row reads uniformly instead of one
    tag starting differently. The category icon is `text-sky-600 dark:text-sky-400` —
    **3.95:1 light / 6.96:1 dark**, both clear of the 3:1 non-text threshold. Note the shape of the
    rule this follows: a **paired light/dark ramp** (the convention already used for resource-type
    chips in `components/detail/resources-row.tsx`), NOT a single fixed hex — that pairing is
    exactly what brand gold lacked when it was rejected for this row in #42, and it is what makes
    a coloured icon workable here. Colour is still decorative (aria-hidden); the label carries the
    meaning. When a real per-category colour map is built, it belongs beside the icon map in
    `packages/ui`.
55. **Capture panels open on demand** (owner 2026-08-15, #57). Audience heading renamed to
    **"Get the weekly competition digest"**; **"For Parents" → "For Parents & Students"**; the
    digest band no longer sits permanently on Landing — each audience card discloses a panel in
    place, with an **X** to dismiss, and the organizers card opens a **new organizer early-access
    panel**. Details and the two things that are easy to break (the optional `onClose` that keeps
    How It Works always-visible, and the `#digest` hash handling) are in §4–§5 above.
  *(#59 removed the Categories placement; How It Works is now the only standalone render.)*
    Focus is moved into the panel on open and returned to the triggering card on close; Escape
    closes, matching the header's mobile menu. The tight leading is
    what pays for the size: at 96px the old `leading-tight` (1.25) spent ~58px more on line gaps.
    ⚠ Both step-ups AND the top pad are gated on **`min-height:700px`**, not width alone. Every
    one of them independently overflowed the one-screen hero at 1280×**600**. The 72px step is
    also held to `min-width:1024px` because "Compete." overflows the ~332px md column above that
    size. Treat this column as a **fixed height budget** — anything added to it must be re-measured
    at 1280×600, which is the binding case, not 1280×800.
56. **Region label: country dropped; state abbreviates ONLY beside a city** (owner 2026-08-17,
    #76 as corrected by #77). The catalog is US-only at R1, so "United States" is noise on every
    card. Forms: **"Texas"** (lone state, full name — a bare "TX" next to Free/Paid read like a
    stray tag), **"Austin, TX"** (city+state pair — the code earns its place qualifying a longer
    label), **"Texas +2"**, **"Online"** (the seeded Virtual / Online region, shortened for the
    slot; never composed as a city — no "Online, TX"). ⚠ The country tag is dropped only when a
    **region survives it**. Tagged at country level *only* renders **"Nationwide"** — a real
    statement (not state-restricted) — and it must NOT collapse into the untagged case, which still
    returns **undefined**. Untagged is missing data; the original "no Nationwide guess" rule was
    about *that*, and still holds. Pinned by 11 tests in `catalog-display.test.ts`.
    ⚠ The name→code map (`lib/us-states.ts`) **duplicates data the API already has**: `Region`
    carries a `code`, but the public `CompetitionSummary.regions` is a flat `string[]` of names, so
    the web cannot read it. The real fix is to expose region code + level on that DTO and delete the
    map. It is also the single source for the digest form's state picker, so the two cannot drift.
57. **Detail page regrouped — the strip owns the scan** (owner 2026-08-18, #82). At-a-glance is now
    **Grades · Registration/Deadline · Cost · Location · Format · Delivery · Prize**; the default
    tab is **"Details"** with three groups (Eligibility / Format & judging / {Category} details);
    the entry-pathway line sits under the Register CTA in every state. **Repetition rule:** a field
    in the strip may reappear below only at a decision point — pathway at the CTA + Eligibility is
    the one approved duplication ("How to enter" left the strip for it). Also surfaced, all from
    existing data: **"Opens {date}"** in the deadline slot while reg_open is future; **age cutoff**
    ("11–14 (as of Jun 1, 2027)"); **typed prize value** ("\$5,000 — Scholarships"; amount leads,
    summary captions). The standard eligibility JSONB keys render under Eligibility with proper
    labels (`ELIGIBILITY_ATTR_LABELS` in key-facts.tsx) instead of humanized into the category bag
    — ⚠ their **promotion to filterable Spine columns is planned**, sweep-remediation-plan §16;
    the display labels survive that move. Helpers pinned by `detail-display.test.ts`.
58. **Detail header + register box polish** (owner 2026-08-18, #84): organizer byline is now
    **letter-Avatar + name as a LINK** (drops "By") → the competition's officialUrl with an ↗
    mark — ⚠ OrganizerRef carries no URL and there is no org page until the **M32 org directory**
    (Phase 3); retarget the byline there when it ships, and never fabricate a destination when
    officialUrl is absent (renders unlinked). Register box order: **button → "Registration
    happens on the organizer's official site ↗" (glued to the button, owner) → entry-pathway
    CHIP** (outlined, Users icon — reads as an info fact, not more microcopy; same in the
    closed/no-link states). Timeline panel renamed + past-milestone treatment — see §3.4b.
59. **Detail page polish + reserved tabs** (owner 2026-08-18, #85):
    (a) **Prep resources & Related competitions are horizontal ScrollRows** (Related was a
    wrapping grid) — same rail pattern as the landing Featured row;
    (b) **right rail bottom-pins**: scrolls with the page, then sticks when its bottom reaches the
    viewport bottom (StickyRail, same measured technique as the marketplace filter panel; rails
    shorter than the viewport keep the top-24 pin). Same no-internal-scroll rule as that panel;
    (c) organizer byline drops the ↗ mark (hover underline is the affordance);
    (d) **Follow button rides the breadcrumb row** (right-aligned, no vertical cost) → anchors to
    the follow capture panel (#follow-cta), matching the mobile sticky bar; hidden below sm where
    the sticky bar already provides Follow.
    **Reserved tabs (intent recorded, NOT designed):** the owner wants future tabs for **Judging**
    (rubric, judges, process) and **Prize breakdown**, and **Eligibility promoted from a Details
    sub-section to its own tab**. Target tab set: Details · Eligibility · Prizes · Judging ·
    About · FAQ. ⚠ **Judging is 🛑 gated** (H12–H17/H25, Gate A/B — CLAUDE.md hard stop): no
    rubric/judge schema, no tab skeleton, nothing until its Phase-3 deep-dive. Prize breakdown =
    **H47** (sweep plan §15) — build the tab when Award data exists. Eligibility tab = when the
    Tier-2 keys are commonly populated (post-seeding), simply lifting the existing group.
60. **One Follow, Share beside it** (owner 2026-08-18, #86): the rail's Follow **disclosure
    button** is gone — the breadcrumb-row Follow is the single trigger — and **Share moved out of
    the byline row onto that same row**. ⚠ The rail panel itself STAYS: it is the anchor target for
    both the breadcrumb button and the mobile sticky bar, and it holds the actual capture, so
    deleting it would have removed the conversion event rather than a duplicate button. It renders
    via `alwaysOpen` (form shown directly, label as a heading, autoFocus suppressed so it cannot
    steal focus on load). ⚠ Do NOT pass `alwaysOpen` to the Claim/host capture — that one has no
    external trigger, so its button is the only way in.
61. **Follow becomes a real disclosure + header/rail rearrangement** (owner 2026-08-18, #87) —
    supersedes the placement halves of #58 (register-box order), #59(d) and #60:
    (a) **Follow capture is hidden until asked for.** The breadcrumb-row Follow button no longer
    anchors to an always-visible panel — it TOGGLES one (`aria-expanded`), and the panel carries
    its own **✕ close**. The mobile sticky bar's Follow opens the same panel (it is a button now,
    not an `#follow-cta` anchor). State lives in `FollowProvider`
    (`components/detail/follow-disclosure.tsx`) because the trigger and the panel sit in different
    branches of the tree; the page stays a server component. The capture still renders with
    `alwaysOpen` — the PANEL is the disclosure now, so a button inside it would be a second layer
    to click through — and its input **autofocuses on mount** (reversing #60's suppression, which
    only existed because the panel used to be present at page load; autofocus is also what carries
    the viewport to the panel when the mobile bar opens it). ⚠ The `alwaysOpen`-on-Claim warning in
    #60 still stands.
    (b) **Panel position: top of the rail, directly under the Follow button and ABOVE the cover
    image box** — it reads as that button's panel rather than as another rail card.
    (c) **Category + status tags move onto the title's line, right-aligned to the main column's
    edge** (were stacked above the title). Title stays first in the DOM for reading order/SEO; the
    tag group wraps to its own right-aligned line when the two can't share one, and is nudged down
    so it tracks the FIRST line of a title that wraps.
    (d) **Entry-pathway ("How to enter") chip leaves the cover/Register card** and becomes its own
    panel directly beneath it — the card holds only the image + CTA + its microcopy. It now renders
    in the no-link branch too (the fact is true regardless of registration state).
62. **⚠ TRIAL — Category + Status become At-a-glance items, not tags** (owner 2026-08-18, #88;
    explicitly "I just want to test out, but if it doesn't look good we can revert"): the
    CategoryTag and the status Badge are **removed from the header** and re-enter the At-a-glance
    strip as its first two items, so the strip carries every scannable fact rather than two of them
    living as tags above the title. Supersedes #61(c) (the right-aligned tag row) for as long as
    the trial stands.
    - **Order** is now Category · Status · Grades · Registration/Deadline · Cost · Location ·
      Format · Delivery · Prize — 9 items, which happens to fill the 3-col desktop grid as three
      clean rows instead of leaving a ragged tail.
    - **Category keeps its own accent icon** (`categoryArt(slug).icon`, the one its tag and cover
      art use) so it stays recognisable; its **tint does not survive** — strip icons are uniformly
      muted and Prize's gold is the only exception.
    - **Status wording shortened** — `editionStatusLabel` (lifted out of the page into
      `detail-display.ts`, pinned by `detail-display.test.ts`) now says **Open / Upcoming /
      In progress / Closed / Archived**, not "Registration open|closed". A standalone badge had to
      name what was open; a strip item is already labelled "Status", and the long strings truncated
      to "Registration o…" in the 2-column mobile grid. Status is omitted entirely when the
      competition has no current edition.
    - **To revert:** restore the right-aligned tag group in the header per #61(c) (CategoryTag +
      `<Badge variant="outline">`), drop the `category`/`status` items from `at-a-glance.tsx`, and
      point the Badge at `editionStatusLabel` — restoring its long wording, since a bare "Open"
      badge has no context.
63. **At-a-glance panel restyle** (owner 2026-08-18, #89 — "improve the UI of the preview box"):
    the strip keeps its content and order, and gains real panel craft. Independent of the #62
    trial — reverting that does not revert this.
    - **It is a named panel now.** `<section aria-labelledby>` + a quiet **"At a glance"** h2, and
      the border/ground/padding moved OUT of the page into `at-a-glance.tsx`, so the component owns
      its box like Timeline / Prep resources / Trust do. It was the only unlabelled panel on the
      page — which is why it kept getting referred to as "the preview box" — and the dl had no
      accessible name.
    - **Icons sit in 36px tiles** (`rounded-xl`, hairline border, `surface` ground) instead of
      floating as bare glyphs: every cell gets a fixed anchor, so a value that wraps to two lines
      can no longer shove its label out of alignment with the neighbouring cells.
    - **Values wrap instead of truncating.** `line-clamp-2 + break-words` replaces `truncate` —
      "Medals, trophies, and scholarship awards" was cut mid-word on EVERY viewport, and the
      deadline was cut on phones. Two lines is the ceiling so rows stay even.
    - **Prize spans both columns on phones** (`col-span-2 sm:col-span-1`) — it is the one value
      long enough to need the width, and it fills what was a half-empty last row.
    - **Urgent deadlines tint their tile** (`danger-soft` ground + `danger` icon), so urgency is
      visible in the icon scan and not only in the value's colour. Threshold is unchanged
      (`URGENT_DAYS = 3`, `catalog-display.ts`).
    - Labels are **11px uppercase tracked muted** (5.4:1 on the panel ground, AA), values
      `text-sm font-semibold leading-snug`. Prize keeps its gold fill icon on a NEUTRAL tile — a
      gold icon on the `brand-gold-soft` ground washes out in light mode.
64. **At-a-glance, second pass** (owner 2026-08-18, #90 — "improve the UI even more"): content
    and order still unchanged; this pass buys information and affordance, not decoration.
    - **The heading carries the cycle** — "At a glance · 2026–27", the way Timeline does. The strip
      mixes competition-level facts (grades, format) with edition-level ones (cost, location,
      deadline) and nothing in it said which edition those belonged to.
    - **A relative deadline now shows its date.** Inside `deadlineDisplay`'s 14-day window the
      value goes relative ("11 days to go") and the actual date vanished — you had to open the
      Timeline to recover it. New `deadlineFact()` in `detail-display.ts` pairs them: relative
      value, absolute date as a hint line under it. Beyond the window the value already IS the
      date, so no hint. ⚠ Calendar-day math runs in the DEADLINE's zone, not UTC (H1/M6) — pinned
      by `detail-display.test.ts`, including the today/tomorrow zone boundary.
    - **Category is a link** to its hub, with an ↗ mark, and **its tile wears the category accent**
      (`categoryArt().tag` — the exact class bundle the old CategoryTag used, dark variants
      included). The tag's whole identity survives the #62 move instead of going grey, and the
      panel ties back to the colour-coded card grid.
    - **Tile tints rank: urgent > category accent > gold prize.** A closing deadline must win the
      eye; the others are identity, not alarm.
    - **Prize is unclamped** (`line-clamp-none`). With an amount AND a summary
      ("$5,000 — Medals, trophies, and scholarship awards") it overran even three lines. It is
      always the last item, so letting it run only grows the final row — and truncating the reward
      is the worst possible thing in this panel to cut.
65. **At-a-glance trims** (owner 2026-08-18, #91): the visible "At a glance · <cycle>" heading is
    REMOVED (panel back to self-evident; `aria-label="At a glance"` keeps the region named for
    screen readers at zero visual cost), and every value is **one line + ellipsis** again
    (`truncate`, prize included — uniform cell heights beat showing the whole prize string).
    `title` on each `dd` carries the full value on hover; it is the only place the truncated tail
    is recoverable, so do not drop it. Prize keeps its phone-width `col-span-2`. The deadline hint
    line and tile tints from #63/#64 are unaffected.
66. **Detail tabs go physical** (owner 2026-08-18, #92 — "file tabs in real life"): DetailTabs
    switches from the default `underline` variant to the existing **`attached` folder-tab
    variant** (built to the owner's 2026-07-08 reference — reused, not restyled from scratch),
    left-aligned via `justify-start px-3.5` (the px keeps the first tab's left fillet inside the
    list). The variant itself gained the physical model in `packages/ui/tabs.tsx`: **inactive
    tabs are now risers too** — dimmer `bg-border/45` fill, tucked 6px lower (`mt-1.5`), tighter
    `rounded-t-[10px]` — instead of bare text, so the strip reads as a stack of file tabs with
    the active one pulled to the front and merged into the card by its fillets. Applies wherever
    `attached` is used (currently: detail page + design demo); `underline` untouched.
67. **Folder tabs, second pass + At-a-glance becomes the first tab** (owner 2026-08-18, #93/#94):
    - **Smoother merge (#93):** fillets grow 14px → 18px with a 1.5px soft gradient edge (the old
      0.5px stop read as an aliased kink); the active tab label goes semibold. **Geometry
      contract:** a LEFT-ALIGNED TabList needs horizontal padding ≥ card radius (16) + fillet (18)
      = 34px or the first tab's fillet paints over the card's rounded corner — detail-tabs uses
      `px-9`. Selecting a tab now ANIMATES the pull-forward (margin/radius/color ride a 200ms
      transition); inactive risers brighten to `bg-border/55` (hover /85 + a 2px lift).
    - **At-a-glance is tab #1 (#94), default-selected:** tab set is now **At a glance · Details ·
      About · FAQ**. The strip lost its standalone header panel — `AtAGlance` renders a bare `dl`
      inside the folder card (TabPanel supplies box/padding; the tab supplies the accessible name
      via aria-labelledby, continuing #91's no-visible-heading rule). Its neutral icon tiles
      flipped `bg-surface` → `bg-surface-raised` because the card under them is `bg-surface` now.
      SEO unaffected: TabPanels stay mounted (hidden), so the dl ships in the HTML either way.
    - **The attached TabList scrolls horizontally** when tabs outgrow the viewport (four tabs no
      longer fit 375px) — ScrollRow's hidden-scrollbar recipe; fillets live inside the list's
      content box so the scroll container never clips them.
68. **Folder tabs: manila + no straight sides** (owner 2026-08-18, #95):
    - **Color:** the attached variant's fill goes `surface`-gray → **warm manila**
      (`color-mix(brand-gold-soft 60%, transparent)` — the landing capture panel's exact recipe).
      Card, active tab, and fillet gradients share one value (`FOLDER_BG` in `tabs.tsx`) — the
      merge seam shows if they ever diverge. Inactive risers: `brand-gold-soft/30`, hover `/50`.
      AA verified on the cream composite (light: muted 4.98:1, foreground 14.1:1, inactive-tab
      text ≈5.1:1). ⚠ Tailwind's scanner needs COMPLETE class literals — never rebuild these via
      template interpolation.
    - **Curves:** top corners are **elliptical, ry = the riser's full height** (16×42 active,
      14×36 inactive — keep in sync with py/text size), so each side is one continuous arc from
      vertical at the base to horizontal at the top: no straight vertical anywhere. On the active
      tab the base tangent meets the fillet's vertical tangent — card-to-tab is a single smooth
      S-curve. Tab padding px-5 → px-6 (the ellipse eats horizontal room near the top).
69. **Folder tabs: outlined, whiter, curves on every riser** (owner 2026-08-18, #96 — supersedes
    #95's colors):
    - **Every riser now has base fillets** (18px front / 12px back), so inactive tabs curve into
      the drawer exactly like the open one — no straight lines down anywhere. Back flares sit 1px
      higher (`mb-px`) so the card's outline passes IN FRONT of back folders (drawer occlusion);
      the active tab's solid fill covers that outline instead, "opening" the folder. `z-10` lets
      the front folder's flares overlap its neighbours' — deliberate drawer look. List gap 1 → 2.
    - **Whiter fill, darker-grey pen line:** fills became SOLID color-mixes (front:
      `gold-soft 25% → background`; back: `gold-soft 18% → surface`, greyer = in shadow) — solid
      because overlapping flares must not double-darken. Everything is OUTLINED in
      LINE = `muted 45% → border`; each fillet gradient paints a ~1px LINE ring before its fill,
      continuing the outline through the curve: card border → tangent → arc → elliptical side.
    - ry values are now 44/37 (border-top joined the box). AA on the near-white card: muted
      5.18:1 light / 6.25:1 dark; inactive tab text 4.89 / 5.71.
    - Constants: `FOLDER_BG` / `FOLDER_BACK_BG` / `FOLDER_BORDER` + two fillet strings in
      `tabs.tsx` — the color expressions repeat verbatim inside the gradients; change together.
70. **Folder tabs: de-cluttered** (owner 2026-08-18, #97 — "looks really bad. Fix" on #96):
    root cause was #96's per-riser 1px outlines + the pen line faked through the fillet arcs as
    gradient stroke-rings — the stroke/curve junctions produced jogs and notches at every riser
    base. Fix = subtraction, not more drawing:
    - **Tabs are unbordered solid shapes.** The pen line (LINE, unchanged color) lives on the
      CARD only; the active tab + its flares mask their segment of it (= the open folder), and
      back risers still sit 1px above it (mb-px) so the line passes in front of them.
    - **Curves tamed:** full-height ellipse bulges are gone. New geometry rule — fillet radius +
      corner-ellipse ry = riser height with matching vertical tangents at the joint (front
      14+29=43, back 10+26=36): each side is still one continuous S-curve, no straight run, but
      it reads as a folder tab, not a dome. Fillets back to plain soft-edged fills.
    - Colors (#96's whiter FRONT/BACK mixes) and everything else (#93 transition, #94 order,
      scroll list) unchanged.
71. **Folder-tab outlines go SVG** (owner 2026-08-18, #98 — "I need a border for the tabs
    themselves too but lines don't get the curve correctly with a consistent thickness"):
    riser outlines are now real SVG path strokes — the only primitive that keeps 1px thickness
    along a compound curve (CSS borders only track border-radius; #96's gradient stroke-rings
    jogged at every arc junction). Each attached Tab measures itself (ResizeObserver + a 250ms
    settle timeout for starved frame loops + re-measure on selection) and draws fill + outline
    as ONE cubic bézier per side, card line to top edge — flare and side are a single curve, so
    no junction exists to jog. Bottom edge unstroked = the folder stays open into the card; the
    active tab's fill masks the card's border segment. Fill/stroke classes repeat the
    FOLDER_BG/BACK/LINE color-mixes verbatim (scanner rule). Pre-measure fallback: plain rounded
    fill (SSR is never naked text). TAB_CURVE=16 → left-aligned list padding ≥ 32 (px-9 ✓).
    The rounded-t ellipse geometry + fillet pseudo-elements from #95–#97 are deleted.
72. **Tabs → pill bar** (owner REFERENCE IMAGE 2026-08-18, #99 — recorded in design-brief §1;
    supersedes the whole folder-tab experiment #92–#98): `Tabs variant="pill"` replaces
    `attached` everywhere. Ink `primary` pill bar (full-width, `p-1.5` inset, justify-between,
    hidden-scrollbar overflow for narrow phones); **active tab = `brand-gold` pill + `brand-ink`
    text** (the brand-button pairing — the reference's yellow pill IS our gold accent); inactive
    = `primary-foreground/70`, hover full. In dark mode the bar inverts with the button system
    (warm-light bar, gold pill unchanged). Panel = detached standard card (`surface-raised` +
    `border`, `mt-4`) — no more merge seam, so ALL the geometry machinery is deleted (SVG
    outlines, fillets, elliptical corners, measurement effects, px-9 contract). At-a-glance
    neutral tiles flip back to `bg-surface` (gray on the white card). Focus ring on the bar uses
    `primary-foreground` inset — the page ring token vanishes against the ink fill. Tab order,
    default (At a glance), SEO-mounted panels: unchanged.
73. **Pill tabs, integration pass** (owner 2026-08-18, #100 — "improve colors, UI, integration
    with the content box"):
    - **One object, not two:** the pill variant's ROOT is the content card now (surface-raised +
      border + `overflow-hidden`); the ink bar docks inside it (`mx-3 mt-3`) and panels are plain
      `p-5` regions — no more bar floating 16px above a separate card, and no double chrome.
    - **States borrow the Button system verbatim:** active gold pill gets `hover:brightness-95
      active:brightness-90` (same as `variant="brand"`); inactive labels get a ghost pill on
      hover (`hover:bg-primary-foreground/10`, pressed /15) instead of a text-only brighten.
    - Verified both themes: light = white card / graphite bar / gold+ink pill; dark = #2b2b29
      card / warm-light bar / same gold pill. Bar inset 12px + 1px card border.
74. **Pill bar recolored to the page palette** (owner 2026-08-18, #101 — "colors seem too dark
    and not in sync with the rest of the page"): the reference's ink bar came from a dark-themed
    app; on our near-white page it read as a heavy slab. The bar is now the SECONDARY-BUTTON
    material system: `surface` well + hairline `border` (light: #f4f4f1 in the white card; dark:
    the same well relationship), inactive labels `text-muted` with the secondary hover fills
    (`hover:bg-border/60`, pressed `bg-border`), and the standard `ring` focus token works again.
    The gold active pill (brand pairing) is unchanged — it is now the only saturated element in
    the control. Structure from #100 (single card, docked bar) unchanged.
75. **Pill bar detached again** (owner 2026-08-18, #102 — "move the tabs outside the box, box
    right under the tabs"; reverses #100's single-card structure, keeps #101's colors): the
    `surface`-well bar is free-standing at full column width; each panel is its own
    surface-raised+border card sitting `mt-2` (8px) below — tight, so the pair still reads as
    one unit, unlike #99's detached-feeling `mt-4`. Root wrapper is chrome-free again.
    **#103 (owner, same day): the bar's fill = the box's** — `surface-raised`, same hairline
    border, so bar and card are one material; the ghost-pill hovers + the gold pill supply the
    contrast the `surface` well used to.
76. **Detail tabs → basic underline** (owner 2026-08-18, #104 — "change the tabs to a basic
    tailwind css ui"): DetailTabs drops `variant="pill"` for the component-default `underline`
    look — transparent strip on a hairline `border-b`, 2px `primary` underline + foreground text
    on the active tab, muted labels otherwise, plain `pt-4` content below (no card). Ends the
    styled-tab experiments (#92–#103). The `pill` variant remains available in `packages/ui`
    (shown on the design demo page); At-a-glance's icon tiles (`bg-surface` + border) sit
    directly on the page ground and still separate.
77. **At-a-glance field order** (owner 2026-08-18, #105 — supersedes the #82/#88 order): the
    strip is sequenced as the question a parent actually works through, with each group
    contiguous —
    **Category** (what is it) · **Grades · Format** (who can enter, alone or on a team) ·
    **Status · Next deadline** (can we still enter, by when) · **Cost** ·
    **Delivery · Location** (do we travel, how far) · **Prize** (payoff).
    Fixes two splits in the old order: Status sat apart from the deadline it qualifies (Grades was
    wedged between), and Location was separated from Delivery by Format. Bonus: at the sm+
    3-column width the groups land as whole rows — identity+eligibility / timing+cost /
    logistics+payoff — when every field is present (verified). Prize stays last: it is the reward,
    and its phone-width `col-span-2` only works cleanly on the final row. Conditional fields
    (Status, deadline, Prize) still drop out silently; the order of whatever remains is fixed.
78. **Description to the header · About becomes the overflow bin · breadcrumbs pulled up**
    (owner 2026-08-18, #106):
    - **Description moved under the organizer byline** (`DescriptionExcerpt`), clamped to 2 lines
      (#107; was 3) with the **See more** toggle sitting AT THE END OF LINE 2 rather than on its
      own line — absolutely positioned bottom-right over a left-to-right gradient of the page
      ground so the clipped tail fades under it, and carrying its own decorative ellipsis because
      line-clamp's is masked. Expanded, the label becomes **See less** and returns to normal flow.
      Clamping keeps a long description from pushing At-a-glance off screen. The
      clamp is VISUAL only (`line-clamp`) — the full text is always in the DOM, which this page
      needs as the primary SEO surface. The toggle only renders when the text actually overflows
      (measured; re-measured on resize, and deliberately NOT re-measured while expanded, or the
      "See less" button would delete itself). The gradient uses `var(--background)` because the
      block sits directly on the page ground (verified in both themes) — ⚠ if it ever moves onto a
      card, that gradient must switch to the card's fill or a hard edge appears.
    - **About tab = the dump for data with no designed home.** It kept its slot but swapped
      payload: the free-form `{Category} details` JSONB bag (moved OFF the Details tab) + **Tags**
      (curator keywords, previously rendered nowhere). Details is now only the two designed
      groups, Eligibility and Format & judging. New fields with nowhere to go land in About rather
      than being wedged into a designed group; promote them out as they earn a home. The tab is
      omitted entirely when both sources are empty (`hasAboutData`).
    - Bag helpers (`ELIGIBILITY_ATTR_LABELS`, `humanizeAttrKey`, `renderAttrValue`,
      `categoryAttributeRows`) moved to `lib/detail-display` since both tabs read the bag; the
      shared label/value list moved to `detail/definition-grid.tsx`. Pinned by new tests —
      ⚠ `humanizeAttrKey`'s `/\b\w/g` silently degrades to "uppercase EVERY letter" if the `\b`
      is lost, which a test now catches.
    - **Breadcrumb pages start 24px higher** (`-mt-6` on the detail page's breadcrumb row and on
      the marketplace hub header). ⚠ The shell's `pt-12` can NOT be reduced — it is a term in the
      landing hero's `--hero-available` calc (layout.tsx) — so breadcrumb pages claw the space
      back locally; keep the two offsets in step. On the detail page the row carries Follow +
      Share too, so they rise with the breadcrumb and stay aligned with it; the content grid below
      tightened `mt-6` → `mt-4`, and everything under it follows up.
79. **Categories page: "By category" caps at two rows** (owner 2026-08-18, #108): with 11
    categories the tile grid spilled onto a short third row (4+4+3 at lg). It now stops after row
    2 and spends that row's LAST CELL on a dashed **Show more** tile ("11 categories in total");
    pressing it reveals the rest and the tile becomes **Show less** (11 tiles + toggle = 12 =
    exactly 3 full rows at lg). New client component `components/categories/category-grid.tsx`;
    the page merges counts into plain tile data server-side and passes that down.
    - ⚠ **Overflow tiles are hidden with CSS, never sliced out of the array** — every category
      link must stay in the HTML, since this page exists to be "every browse angle as a crawlable
      entry point" (Page 5) and crawlers do not press buttons. Verified: 11 `/competitions/*`
      links in the DOM while collapsed.
    - The cutoff is CSS because the column count is responsive: keep **3 at base / 5 at sm / 7 at
      lg** — always (columns × 2) − 1, leaving the last cell for the toggle. Hidden tiles are
      `display:none` so they leave grid flow and the toggle (always last child, exempted via
      `:not(:last-child)`) lands in that slot by itself.
    - ⚠ **Implementation trap, measured:** the obvious "hide everything past 3, then un-hide at
      sm/lg" does NOT work — Tailwind emits `hidden` after `block`, so at equal specificity the
      hide rule wins at every width and the grid silently stays at 3 tiles. The working form is
      one hide rule per column zone in MUTUALLY EXCLUSIVE media ranges (`max-sm:` / `sm:max-lg:` /
      `lg:`), so exactly one ever applies and there is no cascade fight.

80. **Mobile pass across the public surface** (owner 2026-08-19, #109 — "the mobile view has a
    lot of odd things"). A measured audit at 375px and 320px, then 16 fixes. The structural one is
    **Page 3's phone order** (see that page's Mobile line): below `lg` the detail grid is a single
    ordered flex column, the main column and the sticky rail are dissolved with `contents`, and
    each panel carries a `max-lg:order-*`. Duplicated markup behind `lg:hidden` was rejected — it
    would ship the Register link and the whole date list to crawlers twice and force every id
    inside them to be parameterised.
    - ⚠ **Any new child of either detail column needs a `max-lg:order-*`.** Without one it
      defaults to `order-0` and silently jumps to the TOP of the phone layout.
    - **Site-wide:** the `Logo` is `shrink-0` (it was being compressed to 100×30 from a natural
      164×30 in the header flex row — `w-auto` sets the used width but does not opt out of flex
      shrinking); `ScrollRow` arrows are `sm:` only (absolutely positioned over the track, they
      covered the card and its share button on a one-card-wide row); the footer's nav columns go
      **2-up** below sm (731px → 583px, a whole viewport of chrome recovered).
    - **Wrapping is arithmetic, not a guess.** The CTA pairs use `flex-1 basis-36`: a nowrap label
      sets each item's min-content width and `min-width:auto` refuses to shrink past it, so
      `flex-1` alone overflowed a 320px screen by 21px instead of stacking. At a 144px basis the
      pair asks for 300px — granted at 375 (one row), denied at 320 (two rows).
    - **At-a-glance truncation is now `sm:truncate`**, not `truncate`. The one-line lattice (#91)
      holds on a wide grid; on a phone the cells are ~114px and ordinary values lost their tails
      ("Opens Aug 25, 2026" → "Opens Aug 25,"), and the `title` fallback is unreachable on touch.
    - The underline `TabList` scrolls (`overflow-x-auto`, tabs `shrink-0`): four tabs need 300px of
      a 312px column at 320px, so FAQ was simply cut off with no way to reach it.
    - ⚠ **Not verifiable in the Browser pane on this box:** the sticky bottom bar. The pane runs
      with `document.visibilityState === 'hidden'`, so IntersectionObserver never delivers — a
      freshly-created observer also got 0 callbacks with the sentinel at `top: -338`. Geometry was
      verified instead; the show/hide transition needs a real device.

81. **Detail page, second mobile pass** (owner 2026-08-19, #110). Five changes, all on Page 3:
    - **Cover + Register moves above the title.** #109 had put it second, under the header; the
      owner wants the image and the CTA to be the first thing on the page. Phone order is now
      follow-panel → cover+Register → header → pathway → tabs → Timeline → resources → related →
      trust. Desktop is untouched (title first, card in the rail).
    - **Follow and Share are icon-only below sm**, in the grey circle the secondary Button already
      uses (`border-border` + `bg-surface`, bent to a 36px round), and they sit **inline with the
      breadcrumb** — the row is `flex-nowrap` below sm with the nav `min-w-0`, so the breadcrumb is
      what gives rather than the actions dropping to a second line.
    - New shared variant **`ShareMenu variant="icon-secondary"`**. The existing `icon` variant is
      built for CARD CORNERS over cover art (translucent raised fill, blur, shadow) and reads as a
      floating chip on a plain page ground; this one wears the secondary Button's material so it is
      visibly the twin of the Follow circle beside it. ⚠ The variant is a PROP, not a class, so it
      cannot be switched responsively — the breadcrumb row renders two `ShareMenu`s behind
      `sm:hidden` / `hidden sm:inline-block`. Only one is ever in the a11y tree.
    - **Sticky bar re-laid out**: Register is `flex-1` (it is the conversion action and now gets
      the whole bar) with the Follow + Share circles `shrink-0` on the right. ⚠ The icon group
      carries `ml-auto`, which matters only in the no-registration-link branch — with Register
      present its `flex-1` has already taken the slack.
    - **Timeline heading leaves its box** and takes the `font-display text-xl` section-title style,
      structurally mirroring `ResourcesRow` (section > h2 > panel). Applied at EVERY width, not
      just phones: it is a styling decision, and leaving the rail on the old inline
      `text-sm font-semibold` label would make one panel look like two different components.

82. **Detail page, third mobile pass** (owner 2026-08-19, #111).
    - **The edition/cycle label is a `Badge` beside the Timeline heading**, no longer part of its
      text. ⚠ It sits OUTSIDE the `<h2>` on purpose: inside, "2026–27" would join the accessible
      name `aria-labelledby="dates-heading"` gives the whole section, so the region would announce
      as "Timeline 2026-27". The heading names the section; the edition is an attribute of it.
    - **The cover card returns below the title on phones**, reverting #110's promotion above it,
      and is reduced to **the cover image alone** — the Register/official-site block is
      `max-lg:hidden`. ⚠ **Matched pair:** a phone now has no Register control until the sticky bar
      slides in, so if that bar is ever removed or gated differently this block must come back.
    - **The how-to-enter note is desktop-only.** It exists to qualify the Register button at the
      point of action (#84); below lg that button is not there, so it read as a stray disclaimer
      box. The same fact still reaches phones via the Eligibility group in the Details tab.
    - `max-lg:mt-3` above the Timeline section — 32px of clearance against the column's 20px gap,
      so the heading is not glued to the tab panel above it.
    - **Shell bottom padding is halved below sm** (`pb-10 sm:pb-20`, layout.tsx). #65's
      "reads as crammed" was a desktop judgement; 80px of nothing is a quarter of a phone screen,
      and the detail page stacked its own 80px sticky-bar clearance on top for a 160px void. Now
      40px everywhere and 120px on the detail page, of which 80 is functional clearance. ⚠ `pt-12`
      is still untouchable — it is a term in the landing hero's `--hero-available`.

83. **Detail + Categories, fourth mobile pass** (owner 2026-08-19, #112).
    - **Follow/Share leave the page below sm.** The icon circles #110 put on the breadcrumb line
      are gone; the group is `hidden sm:flex` and the sticky bar is the single home for both on a
      phone. `FollowTrigger` is therefore a plain labelled pill again — it is only ever rendered at
      sm+. ⚠ 768–1023px deliberately shows BOTH (the bar is `lg:hidden`, this appears at sm): that
      width has room for the labelled pills and is where the bar starts reading as a phone
      affordance.
    - **Cover image above the title** on phones (order 1/2/3 = follow panel / cover / header),
      reinstating #110's promotion that #111 had reverted.
    - `max-lg:mt-5` above the Timeline section — 40px of clearance against the column's 20px gap.
    - **The detail page's `pb-20 lg:pb-0` is gone entirely.** It was nominally sticky-bar
      clearance, but the bar is FIXED and the footer is ~583px tall on a phone, so the article
      never ends near it — the 80px only ever stacked on the shell's own bottom padding for a
      120px void. The page now matches every other at 40px.
    - ⚠ **Pre-existing and NOT fixed by any of this (measured 2026-08-19):** with the bar showing,
      the bottom of the document leaves its last 61px under the bar — which is the footer's
      copyright + **FTC affiliate-disclosure line** and the social row. Padding *above* the footer
      cannot reach that (at scroll-bottom the footer's bottom always coincides with the document's).
      Fixing it needs either bottom padding on the footer itself or hiding the bar while the footer
      is in view. Flagged to the owner; unresolved.
    - **Categories "By category" is ONE TILE PER ROW below sm**, each tile a landscape row (icon
      left, name + meta right; 343×96) instead of a full-width 217px portrait slab. `sm:contents`
      on the text wrapper dissolves it at sm so the portrait card is the original markup, not a
      re-implementation. ⚠ The base keep-count is a flat **4**, breaking the "(columns × 2) − 1"
      identity sm/lg still follow: at one column that formula keeps a single tile, so 11 categories
      would preview as one. KEEP_BASE and the `max-sm:` nth-child rule must be kept in step by
      hand. All 11 category links remain in the HTML while collapsed (verified) — the page exists
      to be a crawlable entry point and crawlers do not press buttons.

84. **Landing hero quick-links fit one row on a phone** (owner 2026-08-19, #113). #109's short
    labels still left the set at 366px against a 343px row, so it broke 2 + 1. Two levers, in this
    order:
    - **Chrome first** (row gap 10 → 6px, tag padding 10/14 → 8/10, icon gap 6 → 4px) — worth 34px
      and enough for a 375px iPhone at 332px.
    - **Then the label, 13 → 12px**, because 332px still missed the **328px** a 360px Android gets
      by 4px, and 360 is one of the most common widths there is. 12px is `text-xs`, the size the
      shared `Badge` already uses, so the tags join an existing step rather than getting an
      arbitrary shrink; icons follow for free via `[&_svg]:size-[1.1em]`.
    - Lands at **313px**: one row from **~344px** up (measured: 0.6px spare at 344, 14.6 at 360,
      29.6 at 375). Below that `flex-wrap` still returns 2 + 1 rather than overflowing — the ask
      was "one row *if they fit*", not "never wrap". Every value is restored at sm, so the desktop
      tags are unchanged (their own 2-row wrap there is pre-existing: the hero's left column is
      only ~468px and the full labels need ~618px).

85. **Footer drops the Explore column** (owner 2026-08-19, #114). Competitions · Categories ·
    Articles are gone from the footer, leaving brand + **Contribute + Legal**.
    - Safe by the footer's own rule (see the compact-footer note above): Explore is the one group
      marked droppable. **Legal is mandated on every page** (all four links, Affiliate Disclosure
      included — compliance §DQ10) and Contribute is the only route into the correction/request
      queues. Verified after the change: 4 legal links still render.
    - Nothing left the site's link graph — all three Explore destinations are in the header nav on
      every page.
    - `sm:grid-cols-3` is dropped with it: with exactly two navs, three tracks would leave a
      visible empty third cell, so `grid-cols-2` now seats the pair on one row at every width below
      lg, and lg goes `[26rem_1fr_1fr]`. Measured — phone footer 583px → **447px**, tablet 439px,
      desktop 246px with brand + both navs on a single row.

86. **Trust/claim panel moves under the Timeline on phones** (owner 2026-08-19, #115). It was last
    on the page, after Related; it now sits directly beneath the Timeline, pushing Prep resources
    and Related down one slot each (`max-lg:order-` 9 → 7, 7 → 8, 8 → 9). Both the Timeline and the
    trust/claim panel are statements ABOUT this listing, so they read as one block ahead of the two
    outward-linking sections. Desktop is untouched — the rail keeps its source order (Register →
    how-to-enter → Timeline → trust), since these are `max-lg:` variants only.

## Status
| Page | Blueprint | Style prototype | Built |
|---|---|---|---|
| Landing | ✅ approved (2026-07-07 · rev 2026-07-09 · hero image-cards rev 2026-07-08 #25–26 · **hero cutout + no category strip rev 2026-08-15 #38** · **full-height hero + value-prop removed rev 2026-08-15 #39** · **hero copy + larger cutout rev 2026-08-15 #40** · **bigger headline + grade quick-links rev 2026-08-15 #41** · **left-column trim/retune/raise rev 2026-08-15 #42** · **headline at width ceiling rev 2026-08-15 #43** · **cutout +7.5% / column raised rev 2026-08-15 #44** · **cutout at height ceiling rev 2026-08-15 #45** · **gap tightened / hero reclaims shell padding rev 2026-08-15 #46** · **gap 16px / headline 112px / opposed spacing rev 2026-08-15 #47** · **header retune + hero at its limits rev 2026-08-15 #48** · **navbar retune / h-14 rev 2026-08-15 #49** · **gold streak + inward cutout rev 2026-08-15 #50** · **full-width navbar + mobile grid fix rev 2026-08-15 #51** · **headline 116px at column ceiling rev 2026-08-15 #52** · **quick-links grade + category rev 2026-08-15 #53** · **coloured category icon rev 2026-08-15 #54** · **on-demand capture panels rev 2026-08-15 #55**) | delegated (#29 — supersedes the round-2 prototype review) | ✅ R1-6b (2026-07-12; digest wiring done R1-15. PR C hero-card image upload is moot under #38; the sourced-stats TODO(owner) is moot under #39) |
| Competitions (listing) | ✅ approved (2026-07-07 · rev 2026-07-08) | delegated (#29) | ✅ R1-6 (2026-07-12, incl. category hubs #16 + interim /c/ detail stub #30) |
| Competition details | ✅ approved (2026-07-07 · rev 2026-07-08) | delegated (#29) | ✅ R1-7 (2026-07-12; at-a-glance · tabs+FAQ · key-dates timeline w/ add-to-calendar · trust panel · Event/BreadcrumbList/FAQPage JSON-LD · mobile sticky bar · **resources row + affiliate disclosure (R1-8) + Follow/Claim email capture (R1-15b) — both done**) |
| How It Works | ✅ approved (2026-07-08) | delegated (#29) | ✅ R1-6b (2026-07-12; demo video placeholder) |
| Categories (index) | ✅ approved (2026-07-08, may be tuned) | delegated (#29) | ✅ R1-6b (2026-07-12) |
| Request a Competition | ✅ approved (2026-07-08) | — | ✅ R1-15b (2026-07-17; 5-step wizard → import/curation queue) |
| For Parents / For Educators | ⛔ deferred (2026-07-08) | — | — |
| Community (article index + detail) [Phase 2] | ⛔ deferred (2026-07-08, #27) — blueprint before build | — | — |
| Tracker | ⛔ deferred — do not design yet | — | — |
| Parent dashboard | ⛔ deferred — do not design yet | — | — |
