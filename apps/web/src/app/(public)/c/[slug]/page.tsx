import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Avatar,
  Badge,
  Bell,
  CategoryCover,
  ExternalLink,
  Pencil,
  ShareMenu,
  Users,
  VerifiedSeal,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { MorePanel, hasMoreData } from '@/components/detail/more-panel';
import { AtAGlance } from '@/components/detail/at-a-glance';
import { DescriptionExcerpt } from '@/components/detail/description-excerpt';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { FaqList } from '@/components/detail/faq-list';
import { EligibilityPanel, JudgingPanel, hasJudgingData } from '@/components/detail/key-facts';
import { LogisticsPanel } from '@/components/detail/logistics-panel';
import { ContactCard, hasContactData } from '@/components/detail/contact-card';
import { AwardsPanel, hasAwardsData } from '@/components/detail/awards-panel';
import { KeyDatesTimeline } from '@/components/detail/key-dates-timeline';
import { RelatedCompetitions } from '@/components/detail/related-competitions';
import { ResourcesRow } from '@/components/detail/resources-row';
import { TagRow } from '@/components/detail/tag-row';
import { StickyBottomBar } from '@/components/detail/sticky-bottom-bar';
import { StickyRail } from '@/components/detail/sticky-rail';
import { EmailCaptureCta } from '@/components/detail/email-capture-cta';
import { FollowPanel, FollowProvider, FollowTrigger } from '@/components/detail/follow-disclosure';
import { followByEmail } from '@/components/detail/capture-actions';
import { ClaimListingCta } from '@/components/detail/claim-listing-cta';
import { TrustPanel } from '@/components/detail/trust-panel';
import { fetchCompetition } from '@/lib/catalog-api';
import type { CompetitionDetail } from '@/lib/catalog-types';
import { currentEdition, editionStatusLabel } from '@/lib/detail-display';
import { PublicApiError } from '@/lib/public-api';
import { pageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd, eventJsonLd, faqJsonLd, jsonLdScript } from '@/lib/structured-data';

/** Status tag tone: open reads as the brand invitation; done states go quiet. */
/**
 * Status → badge color (owner 2026-08-24): a traffic-light read at a glance — green while you
 * can still get in (open), gold while the season is running (ongoing = brand-warm, not an
 * invitation to register), quiet outline before it starts, red tint once entry is closed, and
 * neutral for archived history.
 */
function statusBadgeVariant(status: string): 'gold' | 'outline' | 'neutral' | 'success' | 'danger' {
  if (status === 'open') return 'success';
  if (status === 'ongoing') return 'gold';
  if (status === 'upcoming') return 'outline';
  if (status === 'closed') return 'danger';
  return 'neutral';
}

// Competition detail — page-blueprints Page 3, the primary SEO landing surface (schema.org
// Event + BreadcrumbList + FAQPage, per-competition OG image, canonical). Route locked to
// /c/<slug> (decision #30). Robots is env-gated via pageMetadata (R1-10): the markup ships
// SEO-ready but stays noindex until SEARCH_INDEXING flips on at R1-17. Resources row (3b) =
// R1-8; Follow/Claim capture backends = R1-15b.

// ISR (R1-10): statically rendered per slug + revalidated hourly (curated data changes slowly).
// Trade-off (L2): relative-deadline strings in the At-a-glance strip ("Closes today"/urgent
// tint) are cached up to 1h, so they can lag the wall clock by up to an hour around midnight —
// acceptable for a curated catalog; the absolute dates in the timeline are unaffected.
export const revalidate = 3600;

const SENTINEL_ID = 'detail-header-sentinel';

// cache(): generateMetadata and the page share one upstream fetch per request regardless of
// Next's fetch-memoization behavior for no-store requests (review fix L6).
const load = cache(async (slug: string): Promise<CompetitionDetail | null> => {
  try {
    return await fetchCompetition(slug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const competition = await load((await params).slug);
  if (!competition) return {};
  const description =
    competition.description?.slice(0, 200) ??
    `${competition.name}: grades, deadlines, cost, and how to enter.`;
  // The per-competition OG image comes from the sibling opengraph-image route (file convention).
  return pageMetadata({
    title: competition.name,
    description,
    path: `/c/${competition.slug}`,
    ogType: 'article',
  });
}

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await load(slug);
  if (!competition) notFound();

  const edition = currentEdition(competition.editions);
  const path = `/c/${competition.slug}`;

  // Register CTA only while registering is plausible (review fix M1): a closed/ongoing
  // edition gets a neutral official-site link instead of a gold "Register" pointing at a dead
  // form — and a missing registration URL is never papered over with the org homepage.
  const registrationOpen =
    edition?.effectiveStatus === 'open' || edition?.effectiveStatus === 'upcoming';
  const registerUrl = registrationOpen ? (edition?.registrationUrl ?? null) : null;
  const registrationClosed =
    edition?.effectiveStatus === 'closed' || edition?.effectiveStatus === 'ongoing';

  // Entry pathway at the point of action (#82): the moment a parent decides whether they can
  // click Register is exactly when "you need a school/chapter" matters. Rendered as its own panel
  // directly under the cover/Register card (owner 2026-08-18), so it is still at the point of
  // action. Deliberate 2nd/3rd appearance alongside the Eligibility group; removed from At-a-glance.
  // Derived from the SET since `0024`: the note used to key off composite tokens that no longer
  // exist. "Can they sign up alone?" is now simply whether INDIVIDUAL is one of the routes.
  const pathways = competition.entryPathways ?? [];
  const pathwayNote =
    pathways.length === 0
      ? null
      : pathways.includes('individual')
        ? pathways.length > 1
          ? 'Enter directly, or through your school or chapter.'
          : 'Register directly. No school or chapter needed.'
        : 'Entry is through a participating school or chapter.';

  const event = eventJsonLd(competition);
  const breadcrumb = breadcrumbJsonLd(competition);
  const faqLd = faqJsonLd(competition.faqs);

  return (
    // FollowProvider: the breadcrumb-row Follow button and the follow capture panel at the top
    // of the rail are in different branches, so the disclosure state lives here.
    <FollowProvider>
      {/* No bottom padding (owner 2026-08-19). It was `pb-20 lg:pb-0`, nominally sticky-bar
          clearance — but the bar is FIXED and the footer is ~583px tall on a phone, so the article
          never ends anywhere near the bar and the 80px only ever stacked onto the shell's own
          bottom padding for a 120px void above the footer. The detail page now matches every other
          page at 40px. ⚠ What this does NOT fix, and never did: at the very bottom of the document
          the bar still overlays the last ~60px of the FOOTER — padding above the footer cannot
          reach that. */}
      <article>
        {/* Structured data (inert until indexing flips on at the R1 gate). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
        />
        {event && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(event) }}
          />
        )}
        {faqLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd) }}
          />
        )}

        {/* Breadcrumb — replaces the back button; matches the BreadcrumbList data.
          Follow shares this ROW (owner #85: inline with the breadcrumb, above the cover image,
          costing no vertical space — a separate row would push the whole right rail down). It is
          the disclosure trigger for the follow email-capture panel at the top of the rail, which
          is also what the mobile sticky bar's Follow opens — no accounts at R1, so "follow" IS the
          email capture. Hidden below sm: phones already have the sticky bar's Follow, and two
          stacked affordances is noise. */}
        <div className="-mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/competitions" className="hover:text-foreground">
              Competitions
            </Link>{' '}
            <span aria-hidden="true">›</span>{' '}
            <Link
              href={`/competitions/${competition.category.slug}`}
              className="hover:text-foreground"
            >
              {competition.category.name}
            </Link>{' '}
            <span aria-hidden="true">›</span>{' '}
            <span aria-current="page" className="text-foreground">
              {competition.name}
            </span>
          </nav>
          {/* Follow + Share share this row (#86) — the two page-level actions sit together, out of
            the header, costing no vertical space above the cover image. Share stays visible on
            phones (the sticky bar carries Follow there, but not Share). */}
          {/* Desktop-only since 2026-08-19 (owner): below sm the sticky bottom bar is the ONE
              place Follow and Share live, so the page does not repeat them. That is why this is
              `hidden sm:flex` rather than the icon-circle pair that briefly sat here — with the
              bar carrying both, a second copy on the breadcrumb line was duplication, not access.
              ⚠ The bar is `lg:hidden` while this appears at sm, so 768–1023px deliberately shows
              both: that width has room for the labelled pills and is where the bar starts feeling
              like a phone affordance. */}
          <div className="flex items-center gap-2">
            {/* Status rides the action row (owner 2026-08-23) — a tag, not a strip tile. Visible
                on phones too (unlike Follow/Share, which the sticky bar carries there).
                size="action" (owner 2026-08-24): same box as the sm Follow/Share buttons beside
                it, so the row reads as one scale. */}
            {edition && (
              <Badge size="action" variant={statusBadgeVariant(edition.effectiveStatus)}>
                {editionStatusLabel(edition.effectiveStatus)}
              </Badge>
            )}
            <div className="hidden items-center gap-2 sm:flex">
              <FollowTrigger />
              <ShareMenu title={competition.name} path={path} />
            </div>
          </div>
        </div>

        {/* MOBILE ORDER (mobile pass) — the page's most-reported problem. Below lg this is not
            "main column, then rail": it is ONE ordered column, and the two wrappers are dissolved
            with `contents` so their children become direct flex items that `max-lg:order-*` can
            interleave. What that fixes: the cover image and Register sat ~1450px down a 3200px
            page (everything in the rail rendered after the whole main column), the Timeline ~1800px
            down, and the trust/claim panel was the only thing a phone reached quickly. The order is
            now follow panel → cover → header → tabs → Timeline → trust/claim → resources →
            related. The trust/claim panel rides WITH the Timeline (owner 2026-08-19) instead of
            sitting last: both are statements about this listing, so they read as one block ahead
            of the two outward-linking sections.
            `contents` rather than duplicated markup on purpose: the alternative is rendering the
            register card and Timeline twice behind `lg:hidden`/`hidden lg:block`, which ships the
            Register link and the whole date list to crawlers twice and forces every id inside them
            to be parameterised. Dissolving costs nothing at lg, where both wrappers become real
            boxes again (`lg:block` / the rail's own `lg:sticky`) and source order takes over —
            the desktop two-column layout is untouched.
            ⚠ If you add a child to either column, give it a `max-lg:order-*`. Without one it
            defaults to order-0 and silently jumps to the TOP of the phone layout. */}
        <div className="mt-4 flex flex-col gap-5 lg:mt-4 lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main column */}
          <div className="max-lg:contents lg:col-span-2">
            <header className="max-lg:order-3">
              {/* TRIAL (#88): the CategoryTag + status Badge that used to sit on this line are
                gone — both facts now ride the At-a-glance strip below, so the strip carries the
                whole scan and the header is just the title + byline. Reverting means restoring the
                right-aligned tag group here (#87c) and dropping the two strip items. */}
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                {competition.name}
              </h1>
              {/* Byline only — Share moved to the breadcrumb row beside Follow (#86), so this no
                longer needs justify-between or the empty <span/> spacer it balanced against. */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {competition.organizer ? (
                  // Organizer byline (#83): letter-avatar + name, linked. ⚠ The link target is the
                  // competition's officialUrl — the DTO's OrganizerRef carries no URL of its own,
                  // and there is no public org page until the M32 org directory (Phase 3); retarget
                  // this there when it ships. Plain (unlinked) when no officialUrl exists — never
                  // fabricate a destination.
                  <div className="flex items-center gap-2 text-sm">
                    {competition.officialUrl ? (
                      <a
                        href={competition.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Avatar
                          name={competition.organizer.name}
                          size="sm"
                          className="size-6 text-[10px]"
                        />
                        {/* No ↗ mark here (owner #85) — the byline stays visually quiet; the hover
                          underline is the link affordance. It still opens the external site. */}
                        <span className="font-medium text-foreground underline-offset-2 group-hover:underline">
                          {competition.organizer.name}
                        </span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={competition.organizer.name}
                          size="sm"
                          className="size-6 text-[10px]"
                        />
                        <span className="font-medium text-foreground">
                          {competition.organizer.name}
                        </span>
                      </span>
                    )}
                    {competition.organizer.verificationState === 'verified' && (
                      <VerifiedSeal
                        weight="fill"
                        role="img"
                        aria-label="Verified organizer"
                        className="size-4 text-success"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {/* Description, directly under the organizer byline (owner #106) — clamped to
                  three lines with See more, so a long one can't push At-a-glance off screen.
                  It used to BE the About tab; that tab is the leftovers bin now. */}
              {competition.description && <DescriptionExcerpt text={competition.description} />}
              {/* Tags ride WITH the description (owner 2026-08-26) — they were on the More tab
                  behind a "Tags" heading, which buried the one curated field that reads as part
                  of the pitch. Inside <header> so they stay glued to the description in the
                  phone's ordered column (the header is one `max-lg:order-3` item). */}
              <TagRow tags={competition.tags ?? []} />
            </header>

            {/* At-a-glance moved INTO the folder as its first tab (owner #94) — the header ends
                at the byline and the tabbed card is the page's single content container. */}
            {/* Base margin 0 / `lg:mt-6`, not `mt-6` + an override: below lg the flex column's own
                gap does the spacing, and stating the mobile value as the BASE keeps it independent
                of how Tailwind happens to order a variant against a plain utility. Same pattern on
                the two sections below. */}
            <div className="max-lg:order-5 lg:mt-6">
              <DetailTabs
                // Overview is the At-a-glance strip alone since #108 — the category-details
                // overflow that used to trail it moved out to the "More" tab.
                overview={<AtAGlance competition={competition} />}
                logistics={<LogisticsPanel competition={competition} />}
                eligibility={<EligibilityPanel competition={competition} />}
                judging={
                  hasJudgingData(competition) ? (
                    <JudgingPanel competition={competition} />
                  ) : undefined
                }
                awards={
                  hasAwardsData(competition) ? <AwardsPanel competition={competition} /> : undefined
                }
                // FAQ carries the organizer contact since #110 — the tab that answers questions
                // is where "how do I reach them" belongs. Either half alone still shows the tab:
                // a listing with contacts but no curated Q&As gets the card on its own.
                faq={
                  competition.faqs.length > 0 || hasContactData(competition) ? (
                    <div className="grid gap-5">
                      {competition.faqs.length > 0 && <FaqList faqs={competition.faqs} />}
                      <ContactCard competition={competition} />
                    </div>
                  ) : undefined
                }
                more={
                  hasMoreData(competition) ? <MorePanel competition={competition} /> : undefined
                }
              />
            </div>

            {competition.resources.length > 0 && (
              <div className="mt-4 max-lg:order-8 lg:mt-12">
                <ResourcesRow resources={competition.resources} />
              </div>
            )}

            <div className="mt-4 max-lg:order-9 lg:mt-12">
              <RelatedCompetitions competition={competition} />
            </div>
          </div>

          {/* Sidebar — sticky on desktop once scrolled (owner 2026-07-08). */}
          {/* StickyRail (#85): scrolls with the page, pins when its bottom hits the viewport
            bottom; short rails keep the old top-24 pin. */}
          <StickyRail className="max-lg:contents">
            <div className="max-lg:contents lg:grid lg:gap-5">
              {/* Follow — the page's conversion event (R1-15b: follow-by-email → Brevo, M29).
                Owner 2026-08-18: it is now a disclosure that renders ONLY after the breadcrumb-row
                Follow button (or the mobile sticky bar's) is pressed, and sits directly under that
                button, above the cover image — so it reads as that button's panel. Its ✕ closes it.
                alwaysOpen keeps the capture form itself un-nested (the panel IS the disclosure now,
                so a second button inside it would be a second layer to click through). */}
              <FollowPanel className="max-lg:order-1">
                <EmailCaptureCta
                  alwaysOpen
                  action={followByEmail}
                  competitionName={competition.name}
                  label="Follow this competition"
                  icon={<Bell aria-hidden="true" className="size-4 text-muted" />}
                  variant="primary"
                  submitLabel="Follow"
                  blurb="Get an email when key dates for this competition are coming up. No account needed."
                  consent={
                    <>
                      For parents, educators, and students 16+. We’ll only email you about this
                      competition, and you can unsubscribe anytime. See our{' '}
                      <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy Policy
                      </Link>
                      .
                    </>
                  }
                />
              </FollowPanel>

              {/* Cover + Register */}
              {/* ABOVE the title on phones (owner 2026-08-19) and reduced to the COVER ALONE —
                  the CTA block under it is `max-lg:hidden`,
                  because the sticky bottom bar already carries Register on exactly the widths where
                  this is hidden. ⚠ The trade that buys: a phone now has NO Register control until
                  the bar slides in (its sentinel is at the end of this card), so the two are a
                  matched pair — if the bar is ever removed or gated differently, this block has to
                  come back. */}
              <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised max-lg:order-2">
                <CategoryCover
                  slug={competition.category.slug}
                  src={competition.logo}
                  className="h-40 w-full"
                />
                <div className="grid gap-2 p-4 max-lg:hidden">
                  {registerUrl ? (
                    <>
                      <a
                        href={registerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonClasses({ variant: 'brand' }), 'w-full justify-center')}
                      >
                        Register
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                      <p className="text-center text-xs text-muted">
                        Registration happens on the organizer&apos;s official site ↗
                      </p>
                    </>
                  ) : competition.officialUrl ? (
                    <>
                      <a
                        href={competition.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonClasses({ variant: 'secondary' }),
                          'w-full justify-center',
                        )}
                      >
                        Visit official site
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                      <p className="text-center text-xs text-muted">
                        {registrationClosed
                          ? 'Registration is closed for this edition. Follow below to hear about the next one.'
                          : 'No registration link yet. The official site has the latest.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-center text-xs text-muted">
                      No registration link yet. Check back, or{' '}
                      <Link
                        href={correctionHref(competition)}
                        className="underline hover:text-foreground"
                      >
                        suggest one
                      </Link>
                      .
                    </p>
                  )}
                </div>
                {/* The sticky bar's sentinel lives at the END of this card (mobile pass; it used
                    to sit under the page header). The bar exists to re-offer Register once the
                    real one is gone, so the two should hand off exactly here: with the card now
                    second in the phone order, anchoring to the header instead would raise the bar
                    while the card it duplicates was still on screen. Inert at lg — the bar is
                    `lg:hidden` and this card is inside the sticky rail there. */}
                {/* A real 1px BLOCK, not a bare inline span: a zero-area target is the
                    fragile case for IntersectionObserver (engines disagree on whether an
                    empty box ever "intersects"), and this one only has to be observable. */}
                <span id={SENTINEL_ID} aria-hidden="true" className="block h-px" />
              </div>

              {/* How to enter (#84 pathway chip) — owner 2026-08-18: lifted OUT of the cover/Register
                card and made its own panel directly beneath it, so the card holds only the image +
                CTA. Rendered once for every branch (open, closed, no link): the fact is true
                regardless of registration state. */}
              {/* Desktop-only since 2026-08-19 (owner). It sits directly under the Register
                  button to qualify it at the point of action — and below lg that button is not
                  here, so the note had nothing to qualify and read as a stray disclaimer box. The
                  same fact still reaches phones through the Eligibility group in the Details tab. */}
              {pathwayNote && (
                <p className="flex items-center gap-2 rounded-[var(--radius-panel)] border border-border bg-surface-raised px-4 py-3 text-xs font-medium text-foreground max-lg:order-4 max-lg:hidden">
                  <Users aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  {pathwayNote}
                </p>
              )}

              {/* Timeline (renamed from "Key dates", #84) */}
              {edition && edition.keyDates.length > 0 && (
                // Heading OUTSIDE the panel and in the section-title style (owner 2026-08-19:
                // "make Timeline title look like prep resources"). Structure is deliberately the
                // same shape as ResourcesRow — section > h2 > box — so the two read as peer
                // sections of the page rather than one section and one labelled card. Applied at
                // every width, not just phones: it is a styling decision, and leaving the rail on
                // the old inline-label form would make the same panel look like two components.
                <section
                  aria-labelledby="dates-heading"
                  className="grid grid-cols-1 gap-3 max-lg:order-6 max-lg:mt-5"
                >
                  {/* The cycle label is a TAG beside the heading, not part of its text (owner
                      2026-08-19). Kept OUTSIDE the <h2> deliberately: inside, "2026–27" would join
                      the accessible name that `aria-labelledby="dates-heading"` gives this whole
                      section, so the region would announce as "Timeline 2026-27" — the heading
                      should name the section, and the edition is an attribute of it. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="dates-heading" className="font-display text-xl text-foreground">
                      Timeline
                    </h2>
                    {edition.cycleLabel && <Badge>{edition.cycleLabel}</Badge>}
                  </div>
                  <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised px-4 py-5">
                    <KeyDatesTimeline
                      edition={edition}
                      competitionName={competition.name}
                      competitionSlug={competition.slug}
                    />
                  </div>
                </section>
              )}

              {/* Trust & attribution */}
              <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised px-4 py-5 max-lg:order-7">
                <TrustPanel competition={competition} />
                <div className="mt-4 grid gap-2 border-t border-border pt-4">
                  {/* Claim is a FORM → admin inbox, not a list capture (R1-15c): it needs context
                      and gets a human reply, and the glossary is explicit that a Claim Request
                      "must never be answered by adding someone to a mailing list". Joining the
                      Host Waitlist is an optional checkbox inside it. See claim-actions.ts. */}
                  <ClaimListingCta competitionName={competition.name} />
                  <Link
                    href={correctionHref(competition)}
                    className={cn(
                      buttonClasses({ variant: 'ghost', size: 'sm' }),
                      'w-full justify-center',
                    )}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    Suggest a correction
                  </Link>
                </div>
              </div>
            </div>
          </StickyRail>
        </div>

        <StickyBottomBar
          sentinelId={SENTINEL_ID}
          registerUrl={registerUrl}
          competitionName={competition.name}
          path={path}
        />
      </article>
    </FollowProvider>
  );
}

function correctionHref(competition: CompetitionDetail): string {
  const q = new URLSearchParams({
    subject: 'competition',
    id: competition.id,
    name: competition.name,
  });
  return `/suggest-a-correction?${q.toString()}`;
}
