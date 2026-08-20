import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CompetitionCard, Plus, Robot, buttonClasses, cn } from '@beecompete/ui';
import { AudienceSection } from '@/components/landing/audience-section';
import { HeroImage } from '@/components/landing/hero-image';
import { ScrollRow } from '@/components/scroll-row';
import { fetchLanding } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { GRADE_BANDS } from '@/lib/category-content';
import { marketplaceHref } from '@/lib/marketplace-params';
import { pageMetadata } from '@/lib/seo';
import { jsonLdScript, siteJsonLd } from '@/lib/structured-data';

// Always dynamically rendered (R1-10) — not prerendered at build, since the web image builds
// with no API reachable (build-once-promote). revalidate=0 is the doc-guaranteed way to force
// dynamic rendering while PRESERVING each fetch's own revalidate data-cache — unlike
// force-dynamic, which the Next docs define as forcing every fetch to no-store. So the catalog
// reads (fetchLanding/fetchCategories) are still served from the hourly data cache, not a fresh
// API round-trip per visitor. The high-volume SEO surfaces — detail pages — are true on-demand
// ISR via the dynamic [slug].
export const revalidate = 0;

export function generateMetadata(): Metadata {
  return pageMetadata({
    // Brand-led title — absolute so the layout template doesn't append "· BeeCompete" again.
    absoluteTitle: true,
    title: 'BeeCompete: Find K-12 Academic Competitions',
    description:
      'One place to find K-12 academic competitions: math, science, coding, debate, writing, and more. Curated listings with real dates, grade ranges, and costs.',
    path: '/',
  });
}

// Hero grade quick-links (owner 2026-08-15, #41): a few example grade filters under the CTAs, so
// visitors discover the catalog can be browsed BY GRADE and not only by category. Deliberately a
// sample, not a full index — the marketplace's own filter panel is the complete surface.
//
// Two things keep these honest rather than decorative:
//  - hrefs are built with marketplaceHref, not hand-written query strings, so they still point at
//    real filtered result sets if the param names are ever renamed;
//  - the two band entries derive their ranges from the canonical GRADE_BANDS instead of repeating
//    the numbers. That is what makes the marketplace highlight the matching quick-chip on arrival
//    (activeBand is an exact min/max match) rather than showing a stray custom-range tag — A10.
//    If a band key ever disappears the range degrades to undefined and the link simply lands on
//    unfiltered /competitions, which is a harmless fallback rather than a broken URL.
const bandRange = (key: (typeof GRADE_BANDS)[number]['key']) => {
  const band = GRADE_BANDS.find((b) => b.key === key);
  return { minGrade: band?.minGrade, maxGrade: band?.maxGrade };
};

// #54 swaps the middle grade link for a CATEGORY one, so the row now advertises both axes the
// catalog can be browsed on — grade and category — rather than three variations of grade. The
// category entry points at the hub route (`/competitions/<slug>`, blueprint decision #16), not a
// `?category=` query, because the hub is the indexable surface for that taxonomy. `robotics` is a
// seeded R1-2 slug (see CATEGORY_CONTENT) — do not invent one here; an unseeded slug 404s.
// Every entry leads with the "+" (it reads as "add this filter", and #55 keeps it on the category
// tag too so the row stays visually uniform); `icon` is an ADDITIONAL category mark shown after
// it. Colour follows the existing per-type convention in components/detail/resources-row.tsx —
// `text-<hue>-600 dark:text-<hue>-400`, a paired light/dark ramp rather than one fixed hex, which
// is what keeps it legible on both grounds.
// `shortLabel` is the phone rendering (mobile pass, owner: two tags on the first row and one on
// the second). At the full labels every tag ran 189-204px against a 343px row, so all three
// stacked one per line — three rows of one tag reads as a list, not as a row of tags. Dropping the
// repeated "competitions" (which the section around them already establishes) brings each to
// ~105-120px, so two fit the first row and the third wraps: the asked-for 2 + 1.
// The full label is NOT lost to assistive tech — each link carries it as `aria-label`, so the
// accessible name is identical at every width and only the visible text shortens.
const HERO_BROWSE_LINKS: {
  label: string;
  shortLabel: string;
  href: string;
  icon?: typeof Robot;
  iconClass?: string;
}[] = [
  {
    label: '7th grade competitions',
    shortLabel: '7th grade',
    href: marketplaceHref('/competitions', { page: 0 }, { minGrade: 7, maxGrade: 7 }),
  },
  {
    label: 'Robotics competitions',
    shortLabel: 'Robotics',
    href: '/competitions/robotics',
    icon: Robot,
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'High school competitions',
    shortLabel: 'High school',
    href: marketplaceHref('/competitions', { page: 0 }, bandRange('high')),
  },
];

// Page 1: Landing (approved blueprint, rev 2026-07-09; section order per decision #5, as
// amended by #39: Hero → Featured carousel → Audience cards → Digest band → Footer. The
// value-prop split ("Competing changes what's possible") was removed 2026-08-15.).
export default async function LandingPage() {
  const landing = await fetchLanding();
  const moreCount = Math.max(0, landing.totalCompetitions - landing.featured.length);

  return (
    // grid-cols-1 (minmax(0,1fr)) — a bare `grid` auto track grows to the ScrollRows'
    // intrinsic width and hands the whole page a horizontal scrollbar.
    <div className="grid grid-cols-1 gap-16 sm:gap-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd()) }}
      />
      {/* 1. Hero — plain Browse button (decision #24); bottom-anchored cutout on the right
          (#25, rev 2026-08-15). Two DIFFERENT thresholds here, deliberately (#39):
          · md (portrait iPad, 768px) splits to two columns and is where the cutout starts
            showing — the narrowest width where headline and cutout sit side by side.
          · lg is where the hero starts filling the screen, so header + hero == one viewport on a
            laptop. The subtrahend covers the header (h-14 + its 1px border) and whatever of the
            shell's py-12 top padding is not reclaimed by the negative margin below — change
            either and this must follow.
          Between them (768–1023px) the hero stays content-height on purpose: the columns are only
          ~332px there, so a screen-tall hero would strand ~400px of content in ~900px of box.
          The lg split is deliberately NOT 50/50 (owner 2026-08-15: "make the image larger") — the
          cutout is width-bound at that size, so the only way to grow it is to hand its column more
          of the row. md stays even, where the text cannot spare the width.
          1.35fr (#45, was 1.25fr) is pinned by the headline, not chosen freely: the left column
          must stay wide enough for "Compete." at 108px (432px), so it cannot drop below ~440px.
          At 1.35fr it lands at ~453px. Push this ratio further and the headline clips — the two
          asks (bigger type, bigger cutout) compete for one fixed row width.
          `--hero-available` is the height left for the hero. It is declared ONCE here and consumed
          twice: as this section's min-height, and (inherited) as the cutout's max-height in
          hero-image.tsx. Both must agree or the cutout can drive the hero past one screen on a
          short laptop — keep it a single variable, not two literals.
          #47 reclaims height for the cutout WITHOUT breaking the one-screen rule: `lg:-mt-10`
          pulls the hero up into the shell's 48px top padding, and --hero-available subtracts only
          the header plus what is left of it. The two numbers are a **matched pair** — the negative
          margin must equal the padding removed from the subtrahend, or the hero stops ending
          exactly at the fold. -mt-10 reclaims 40px of the shell's 48. The subtrahend is
          `4rem` = the h-14 header (56px) + its 1px border + the last 8px of clearance — #50
          shortened the header, which is the height source #49 had flagged as still untapped, and
          the 8px it freed went straight to the cutout. ⚠ This value is COUPLED to `h-14` in
          site-header.tsx; change one without the other and the hero stops ending at the fold.
          Gap went 10 → 6 → 4 → 3 → 1 across #47–#51 chasing "too much gap", and 4px was too far —
          #69 puts it back to a legible **24px from lg**, with **16px at md** (#70). That is not
          free: gap comes straight out of the text track, and at 1280 the headline needs 462px of a
          468px column, so the 24px is paid for by stepping the headline 116 → 112. The two numbers
          move together. md gets less because the columns there are only ~340px — a flat 24px left
          the headline clearing by 6px. 16/344 at md and 24/460 at lg are both ~4.7% of the track,
          so the gap reads as consistent rather than merely equal.
          **Large screens (#71):** there is NO breakout and NO bleed. The hero lives inside the
          shell's `max-w-6xl` exactly like every other section, so it caps at 1104px and simply
          centres with growing side padding — 80px each side at 1280, 400 at 1920, 720 at 2560.
          **Laptop proportions ARE the maximum**: a monitor shows the same 736px-tall hero, 460px
          text column, 112px headline and 620x654 cutout as a 1280x800 laptop, just with more room
          around it.
          ⚠ Do not reintroduce a `-mr` on the cutout or a `-mx` on this section. Both were tried:
          #69 bled the cutout rightward, which is one-sided and left 400px of space left of the text
          against 121px right of the cutout at 1920 (the hero read as shifted); #70 fixed that with
          a symmetric section breakout but then made the hero wider than every section below it.
          #71 discards both so the hero shares its edges with Featured at every size.
          **#72 nudges the whole hero 24px right on desktop** (`xl:ml-6 xl:-mr-6`), trimming the
          space to the right of the cutout. The two margins are equal and opposite ON PURPOSE: they
          cancel, so the section's content box — and therefore both grid tracks, the 24px column
          gap and the cutout's size — are all untouched. It is a pure translation, which is what
          keeps "don't decrease the gap" true. Gated at xl, not lg: the offset pushes the right edge
          24px past the shell, and only from 1280 is there gutter to absorb it — at 1152 the cutout
          would sit flush against the viewport edge. */}
      {/* ⚠ The `min(…, 46rem)` cap is what stops the hero distorting on a monitor (#67, retuned by
          #71). Without it --hero-available grows with viewport HEIGHT without limit, while the
          content filling it is capped by the 1152px shell WIDTH — so the taller the screen, the
          emptier the hero. At 1920x1080 it was 1015px tall around a 725px cutout: ~390px of dead
          space.
          46rem (736px) is the height a 1280x800 laptop produces (100svh − 65px of header and
          clearance). Pinning the ceiling there is what makes #71's "laptop IS the maximum" true in
          both axes: a monitor gets the same 736px hero as a laptop, not a taller one. It pairs
          with the width cap — the cutout is ~653px tall inside the shell, so a taller ceiling would
          only re-open the void that #67 closed.
          Below ~800px of viewport height the cap never binds, so laptops and short laptops keep the
          exact header + hero == one screen behaviour; only taller screens are affected, where the
          hero ends above the fold and reveals the next section — the intended trade. */}
      <section className="grid items-center gap-4 lg:gap-6 [--hero-available:min(calc(100svh-4rem-1px),46rem)] md:grid-cols-2 lg:-mt-10 lg:min-h-(--hero-available) lg:grid-cols-[1fr_1.35fr] xl:ml-6 xl:-mr-6">
        {/* self-start rather than the row's default centering (owner 2026-08-15, #42: "move the
            left side up"), raised again to an 8px pad by #43 ("up by a bit more"). Centering
            pinned the text block to the middle of a screen-tall row, which sat low next to a
            bottom-anchored cutout.
            The pad is back to a positive 16px only because #47 moved the HERO itself 32px up: the
            text keeps the same ~32px of clearance below the sticky header it had at `-mt-3`, while
            the extra height the section gained goes to the cutout rather than to whitespace above
            the headline. Net effect on this column is nil by design — read the two together. */}
        {/* The push-down (#51) is height-gated for the same reason the type scale is: at pt-8 the
            column left only 13px under it on a 1280x600 laptop. Short screens keep pt-4. */}
        {/* Vertical placement is height-driven (#68). Short viewports RAISE this column —
            self-start plus a top pad, which is what the owner asked for twice — and everything
            taller simply FALLS THROUGH to the section's own `items-center`.
            That fall-through is the design, not laziness: there is deliberately no
            `min-height:900px` counterpart. Pairing `max-height:899px` with `min-height:900px`
            looks exclusive but leaves a real hole — a 1440x899 pane reports a *fractional* 899.5px
            viewport, so BOTH queries evaluate false and the rules silently stop applying. Gating
            only the raised case means the untouched default is already the state tall screens
            want, so any fractional boundary lands somewhere correct.
            Why tall screens want centring: past ~900px the #67 cap stops the hero growing while
            the text block does not, so at 1920x1080 it sat with 0px above and 209px below —
            stranded at the top against a bottom-anchored cutout. Centred it is ~120px either
            side, balanced against the artwork. */}
        <div className="animate-rise-in [@media(min-width:1024px)_and_(max-height:899px)]:self-start [@media(min-width:1024px)_and_(max-height:899px)]:pt-4 [@media(min-width:1024px)_and_(min-height:700px)_and_(max-height:899px)]:pt-8">
          {/* Sizes step 60 → 72 → 96px. Both steps up are gated on viewport HEIGHT as well as
              width, which plain `lg:`/`xl:` cannot express. The hero is locked to one screen from
              lg (#39), so this column has a fixed height budget: 96px needs ~592px, which fits a
              1280x800 laptop but not a 1280x600 one. Below 700px tall it stays at 60px, which is
              still larger than the pre-#42 size at that viewport.
              The width thresholds are NOT interchangeable with the type scale — 72px is held back
              to 1024px because the md columns are only ~332px wide and "Compete." overflows them
              at that size.
              leading-[1.05] is load-bearing: at 96px the previous `leading-tight` (1.25) spent an
              extra ~58px on line spacing across three lines. Tighter leading is what buys the
              bigger type (#42). */}
          {/* font-bold (700) overrides the .font-display base weight of 560 — tokens.css puts
              that default in @layer base precisely so weight utilities can win. Fraunces is a
              variable font (wght 100–900), so this is a real 700, not a synthesized faux-bold.
              Sizes are 84 / 100 / 116px — arbitrary values, not scale steps, because the limit
              here is WIDTH, not the height budget that gates everything else in this column.
              ⚠ **All three are now HARD AGAINST the ceiling.** Measured at #53's columns (350 /
              407 / 468px), "Compete." at weight 700 leaves **5 / 6 / 6px** of margin, and the very
              next 4px step overflows every one of them (-6 / -9 / -10px). There is no headroom
              left: raising these needs MORE COLUMN, not a bigger number, and the left column is
              pinned by the 1.35fr split which is itself pinned by the cutout. Do NOT round up to
              the nearest Tailwind step — the ceilings sit BETWEEN steps, which is the whole reason
              for arbitrary values here.
              Fraunces has an opsz axis with optical sizing on, so it sets relatively NARROWER as
              it grows; the ceiling must be re-measured, never extrapolated from a smaller size.
              leading-[0.9] is safe despite being under 1em. Comparing the font's max ascent to its
              max descent says the lines collide here — that test is wrong, because it ignores
              WHERE the glyphs sit: the only descender is the "p" of "Prepare.", and the tall
              glyph below it is the "C" of "Compete.", which is in a different column. Rasterising
              the two lines and diffing ink per pixel column gives the true worst-case gap: 22px at
              0.9 (27px at 0.95). Re-run that test, not the metrics one, before tightening again. */}
          {/* The base size is FLUID, not fixed (mobile pass). At a flat 5.25rem "Compete." sets
              334px wide, which overflows the 288px text column of a 320px phone and handed the
              whole PAGE a horizontal scrollbar — that word is the widest single token on the site,
              so it is what sets the floor. 22vw is the ratio that keeps it inside the column at
              every phone width (280px at 320, 328px at 375), and the clamp's upper bound is the
              previous fixed value, so nothing at or above ~384px moves at all. The two
              height-gated lg/xl steps below still win wherever they apply — do not fold them in. */}
          <h1 className="font-display text-[clamp(3.25rem,22vw,5.25rem)] leading-[0.9] font-bold text-foreground [@media(min-width:1024px)_and_(min-height:700px)]:text-[6rem] [@media(min-width:1280px)_and_(min-height:700px)]:text-[7rem]">
            Search. Prepare.{' '}
            {/* Gold highlight streak under the last word (#51). Decorative only — aria-hidden, and
                the word carries no meaning through it — so it is exempt from WCAG 1.4.11, which is
                what lets it use brand gold here even though gold fails 3:1 on the light ground
                (the same reason the grade tags' "+" could NOT be gold — that one sat next to text
                it was meant to reinforce).
                Sized in `em` so it tracks the headline across all three responsive steps, and
                placed on an inline-block <em> so the streak spans exactly the word. "Compete." is
                the LAST line, so a streak below the baseline cannot collide with a following line
                — do not reuse this on a word that wraps mid-headline.
                #52 moves it BEHIND the word and back up under it, marker-highlight style, so the
                descender-clearance problem that forced the old -0.28em offset no longer applies —
                the "p" of "Compete." is now meant to cross the streak and paints on top of it.
                Stacking is by DOM order, not a negative z-index: the streak is absolute and comes
                FIRST, the word sits in a `relative` span after it, so both are positioned at
                z-auto and the later one wins. A `-z-10` would also have sent the streak behind any
                ancestor that paints a background. */}
            <em className="relative inline-block">
              <span
                aria-hidden="true"
                // Literal light yellow, not `bg-brand-gold/50`: alpha DARKENS over the dark
                // ground, so the tint rendered #8d742a (olive) in dark mode instead of the light
                // yellow asked for. A fixed tint of the brand gold reads the same in both themes.
                // Arbitrary value because packages/ui has no light-yellow token — promote it to
                // one if this streak is ever reused elsewhere.
                className="absolute inset-x-0 -bottom-[0.06em] h-[0.13em] rounded-full bg-[#f9dc85]"
              />
              <span className="relative">Compete.</span>
            </em>
          </h1>
          {/* mt-10, not mt-4 (#48, widened again at #51). The headline's own line gap is tight
              (0.9), so without widening this the paragraph read as a fourth line of the headline
              block rather than a separate element — the two are deliberately opposed: tight INSIDE
              the headline, looser between it and the body copy. The last step to mt-10 also buys
              clearance for the gold streak, which hangs ~29px below the headline box at the 112px
              step; shrink this back and the streak collides with this paragraph. */}
          <p className="mt-10 max-w-xl text-base text-muted">
            Every K-12 academic competition, from math and science to coding and debate, in one
            place, so your student never misses the right one.
          </p>
          {/* One row on phones (mobile pass). At size=lg the two CTAs measure 188 + 182px against
              a 343px row, so they stacked and the primary action lost the weight that pairing them
              gives it. Below sm they share the row as equal halves (flex-1 on a flex-nowrap line)
              at the sm button's metrics — 4px shorter, a step down in type — which leaves each
              ~165px against ~158px of content. whitespace-nowrap is what keeps that a ONE-line
              button: without it a squeezed label wraps and silently breaks the fixed height.
              The row still WRAPS — `basis-36` (144px) is what decides when. flex-1 alone could not
              be trusted to fit: a nowrap label sets each item's min-content width, which
              `min-width:auto` refuses to shrink past, so on a 320px phone the pair overflowed the
              column by 21px and handed the page a horizontal scrollbar instead of stacking. With a
              144px basis the pair asks for 300px, which a 375px screen grants (one row, then flex-1
              grows each to ~165px) and a 320px one denies (two rows, each full width) — the
              breakpoint falls out of the arithmetic rather than being guessed at. */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/competitions"
              className={cn(
                buttonClasses({ variant: 'brand', size: 'lg' }),
                'max-sm:h-9 max-sm:flex-1 max-sm:basis-36 max-sm:px-3.5 max-sm:text-[0.8125rem] max-sm:whitespace-nowrap',
              )}
            >
              Browse competitions
            </Link>
            {/* Secondary CTA repointed to Categories (#66). It was "How it works" → that page,
                which has been discarded; /articles is a coming-soon stub, so sending hero traffic
                there would be a dead end. Categories is the nearest real "show me the shape of the
                catalog" destination and keeps the approved two-CTA hero intact. */}
            <Link
              href="/categories"
              className={cn(
                buttonClasses({ variant: 'secondary', size: 'lg' }),
                'max-sm:h-9 max-sm:flex-1 max-sm:basis-36 max-sm:px-3.5 max-sm:text-[0.8125rem] max-sm:whitespace-nowrap',
              )}
            >
              Browse by category
            </Link>
          </div>
          {/* Browse quick-links (#41; grade + category since #54). A <nav> because these are
              navigation into pre-filtered catalog views, not decoration — the landmark gives AT
              users a labelled way to skip to them. The shared Chip is deliberately NOT used: it
              renders a <button> with aria-pressed, which would misreport a plain link as a toggle.
              Styling (#42, "make the tags better") keeps buttonClasses as the base — shape,
              focus ring, and icon sizing stay shared — and only retunes the TONE on top: an
              outline on a transparent ground instead of a filled surface, so they read as tags
              rather than a row of small buttons competing with the two CTAs directly above. The
              label lifts muted → foreground on hover and the border strengthens with it.
              The icon inherits the label colour ON PURPOSE. Brand gold was tried here and dropped:
              #F5C330 lands at 1.6:1 on the light ground, which is the same reason tokens.css
              already picked a neutral --ring ("gold fails 3:1 on light"). A decorative glyph is
              exempt from WCAG 1.4.11, but an accent nobody can see on half the themes is not
              worth the inconsistency. (The hero's gold streak IS allowed to be gold — it carries
              no meaning at all, whereas these sit beside the label they reinforce.)
              Every entry leads with the "+"; the category link adds its own mark after it, and
              that one IS allowed colour (#55) — unlike the "+", it is a category identifier rather
              than a repeated affordance, and the light/dark ramp keeps it legible on both grounds
              where a single brand-gold value would not have been. */}
          {/* All three tags on ONE row on a phone (owner 2026-08-19). Measured, they wanted
              366px of a 343px row — 23px over — so the row broke 2 + 1. Tightening the chrome
              alone (row gap 10 → 6px, tag padding 10/14 → 8/10, icon gap 6 → 4px) frees 34px and
              fits a 375px iPhone, but lands at 332px against the **328px** a 360px Android gets —
              short by 4px on one of the most common widths there is. So the label also steps
              13 → 12px below sm, which is not an arbitrary shrink: 12px is `text-xs`, the size the
              shared Badge already uses, so the tags simply join the scale the rest of the chip
              vocabulary sits on. Icons follow automatically (`[&_svg]:size-[1.1em]`). Together
              that lands the set at ~313px — comfortable at 360 and 375 alike. Every value returns
              to its original at sm.
              Still `flex-wrap`, deliberately: at 320px the set needs 313px against 288px, so it
              falls back to 2 + 1 rather than overflowing. "Fit them on one row IF they fit." */}
          <nav aria-label="Browse competitions" className="mt-7 flex flex-wrap gap-1.5 sm:gap-2.5">
            {HERO_BROWSE_LINKS.map(({ label, shortLabel, icon: Icon, iconClass, href }) => (
              <Link
                key={label}
                href={href}
                aria-label={label}
                className={cn(
                  buttonClasses({ variant: 'secondary', size: 'sm' }),
                  // 30px tall, 13px label (#54) — a notch up from #43's 28/12, still a step below
                  // the sm button so the CTAs above keep priority. The icon tracks it
                  // automatically: buttonClasses sizes nested svg in em, not px.
                  'h-[1.875rem] gap-1 border-border/70 bg-transparent pr-2.5 pl-2 text-xs text-muted',
                  'sm:gap-1.5 sm:pr-3.5 sm:pl-2.5 sm:text-[0.8125rem]',
                  'hover:border-foreground/35 hover:bg-surface hover:text-foreground',
                )}
              >
                <Plus aria-hidden="true" weight="bold" />
                {Icon && <Icon aria-hidden="true" weight="fill" className={iconClass} />}
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <HeroImage />
      </section>

      {/* 2. Featured Competitions carousel (M36; no auto-advance, peek, 6–10 max — #8). */}
      {landing.featured.length > 0 && (
        <section aria-labelledby="featured-heading">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="featured-heading" className="font-display text-2xl text-foreground sm:text-3xl">
              Featured competitions
            </h2>
            <Link
              href="/competitions"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
            >
              {/* The long form wrapped onto its own line under the heading on a phone (mobile
                  pass), so below sm it collapses to "See all N" - same destination, same
                  total, one line. */}
              <span className="sm:hidden">See all {landing.totalCompetitions}</span>
              <span className="hidden sm:inline">
                See more{moreCount > 0 && ` · ${moreCount} more competitions`}
              </span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ScrollRow label="Featured competitions">
            {landing.featured.map((item) => (
              <div key={item.id} role="listitem" className="w-(--card-w) shrink-0 snap-start">
                <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
              </div>
            ))}
          </ScrollRow>
        </section>
      )}

      {/* 3. Audience cards + their capture panels (H46, R1-15 wiring). Client component because
          #57 made the panels open on demand: the digest band and the organizer early-access band
          are no longer always in the DOM, each card discloses one in place. The old always-visible
          <DigestBand /> that used to sit here as section 4 is gone — it still renders standalone
          on How It Works and Categories, which is why the component keeps working with no props. */}
      <AudienceSection />
    </div>
  );
}
