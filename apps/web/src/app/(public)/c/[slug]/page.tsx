import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Bell,
  CategoryCover,
  CategoryTag,
  ExternalLink,
  Flag,
  Pencil,
  ShareMenu,
  VerifiedSeal,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { AtAGlance } from '@/components/detail/at-a-glance';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { FaqList } from '@/components/detail/faq-list';
import { KeyDatesTimeline } from '@/components/detail/key-dates-timeline';
import { KeyFacts } from '@/components/detail/key-facts';
import { RelatedCompetitions } from '@/components/detail/related-competitions';
import { ResourcesRow } from '@/components/detail/resources-row';
import { StickyBottomBar } from '@/components/detail/sticky-bottom-bar';
import { EmailCaptureCta } from '@/components/detail/email-capture-cta';
import { followByEmail, registerHostInterest } from '@/components/detail/capture-actions';
import { TrustPanel } from '@/components/detail/trust-panel';
import { fetchCompetition } from '@/lib/catalog-api';
import type { CompetitionDetail } from '@/lib/catalog-types';
import { currentEdition } from '@/lib/detail-display';
import { PublicApiError } from '@/lib/public-api';
import { pageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd, eventJsonLd, faqJsonLd, jsonLdScript } from '@/lib/structured-data';

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
    competition.summary ??
    competition.description?.slice(0, 200) ??
    `${competition.name} — grades, deadlines, cost, and how to enter.`;
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

  const event = eventJsonLd(competition);
  const breadcrumb = breadcrumbJsonLd(competition);
  const faqLd = faqJsonLd(competition.faqs);

  return (
    <article className="pb-20 lg:pb-0">
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

      {/* Breadcrumb — replaces the back button; matches the BreadcrumbList data. */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/competitions" className="hover:text-foreground">
          Competitions
        </Link>{' '}
        ›{' '}
        <Link href={`/competitions/${competition.category.slug}`} className="hover:text-foreground">
          {competition.category.name}
        </Link>{' '}
        › <span className="text-foreground">{competition.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryTag slug={competition.category.slug} name={competition.category.name} />
              {edition && <Badge variant="outline">{statusLabel(edition.effectiveStatus)}</Badge>}
            </div>
            <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
              {competition.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {competition.organizer ? (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  By {competition.organizer.name}
                  {competition.organizer.verificationState === 'verified' && (
                    <VerifiedSeal
                      weight="fill"
                      role="img"
                      aria-label="Verified organizer"
                      className="size-4 text-success"
                    />
                  )}
                </p>
              ) : (
                <span />
              )}
              <ShareMenu title={competition.name} path={path} />
            </div>

            <div className="mt-6 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5">
              <AtAGlance competition={competition} />
            </div>
          </header>

          <span id={SENTINEL_ID} aria-hidden="true" />

          <div className="mt-8">
            <DetailTabs
              keyFacts={<KeyFacts competition={competition} />}
              about={
                competition.description ? (
                  <div className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-foreground">
                    {competition.description}
                  </div>
                ) : undefined
              }
              faq={competition.faqs.length > 0 ? <FaqList faqs={competition.faqs} /> : undefined}
            />
          </div>

          {competition.resources.length > 0 && (
            <div className="mt-12">
              <ResourcesRow resources={competition.resources} />
            </div>
          )}

          <div className="mt-12">
            <RelatedCompetitions
              categorySlug={competition.category.slug}
              categoryName={competition.category.name}
              excludeId={competition.id}
            />
          </div>
        </div>

        {/* Sidebar — sticky on desktop once scrolled (owner 2026-07-08). */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-5">
            {/* Cover + Register */}
            <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised">
              <CategoryCover
                slug={competition.category.slug}
                src={competition.logo}
                className="h-40 w-full"
              />
              <div className="grid gap-2 p-4">
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
                        ? 'Registration is closed for this edition — follow below to hear about the next one.'
                        : 'No registration link yet — the official site has the latest.'}
                    </p>
                  </>
                ) : (
                  <p className="text-center text-xs text-muted">
                    No registration link yet — check back, or{' '}
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
            </div>

            {/* Follow — the page's conversion event (R1-15b: follow-by-email → Brevo, M29).
                tabIndex + scroll-margin: the mobile bar's anchor jump lands focus here
                cleanly under the sticky header (review fix L5). */}
            <div id="follow-cta" tabIndex={-1} className="scroll-mt-24 focus-visible:outline-none">
              <EmailCaptureCta
                action={followByEmail}
                competitionName={competition.name}
                label="Follow this competition"
                icon={<Bell aria-hidden="true" className="size-4" />}
                variant="primary"
                submitLabel="Follow"
                blurb="Get an email when key dates for this competition are coming up — no account needed."
                consent={
                  <>
                    For parents, educators, and students 16+. We’ll only email you about this
                    competition — unsubscribe anytime. See our{' '}
                    <Link href="/privacy" className="underline hover:text-foreground">
                      Privacy Policy
                    </Link>
                    .
                  </>
                }
              />
            </div>

            {/* Key dates */}
            {edition && edition.keyDates.length > 0 && (
              <section
                aria-labelledby="dates-heading"
                className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5"
              >
                <h2 id="dates-heading" className="mb-4 text-sm font-semibold text-foreground">
                  Key dates{edition.cycleLabel ? ` · ${edition.cycleLabel}` : ''}
                </h2>
                <KeyDatesTimeline
                  edition={edition}
                  competitionName={competition.name}
                  competitionSlug={competition.slug}
                />
              </section>
            )}

            {/* Trust & attribution */}
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5">
              <TrustPanel competition={competition} />
              <div className="mt-4 grid gap-2 border-t border-border pt-4">
                <EmailCaptureCta
                  action={registerHostInterest}
                  competitionName={competition.name}
                  label="Claim this competition"
                  icon={<Flag aria-hidden="true" className="size-4" />}
                  variant="secondary"
                  submitLabel="Notify me"
                  blurb="Are you the organizer? Host tools are on the way — join the early-access list for this listing."
                  consent={
                    <>
                      For competition organizers. We’ll email you about claiming this listing and
                      host access. See our{' '}
                      <Link href="/privacy" className="underline hover:text-foreground">
                        Privacy Policy
                      </Link>
                      .
                    </>
                  }
                />
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
        </aside>
      </div>

      <StickyBottomBar sentinelId={SENTINEL_ID} registerUrl={registerUrl} />
    </article>
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

function statusLabel(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'open':
      return 'Registration open';
    case 'upcoming':
      return 'Upcoming';
    case 'ongoing':
      return 'In progress';
    case 'closed':
      return 'Registration closed';
    case 'archived':
      return 'Archived';
    default:
      return effectiveStatus;
  }
}
