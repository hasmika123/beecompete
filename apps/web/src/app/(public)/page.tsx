import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Card,
  CompetitionCard,
  GraduationCap,
  Medal,
  Users,
  buttonClasses,
  categoryArt,
  cn,
} from '@beecompete/ui';
import { DigestBand } from '@/components/digest-band/digest-band';
import { HeroCards } from '@/components/landing/hero-cards';
import { ScrollRow } from '@/components/scroll-row';
import { fetchCategories, fetchLanding } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { CATEGORY_CONTENT } from '@/lib/category-content';
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
    title: 'BeeCompete — Find K-12 Academic Competitions',
    description:
      'One place to find K-12 academic competitions: math, science, coding, debate, writing, and more — curated listings with real dates, grade ranges, and costs.',
    path: '/',
  });
}

// Page 1: Landing (approved blueprint, rev 2026-07-09; section order per decision #5:
// Hero → Featured carousel → Value-prop split → Audience cards → Digest band → Footer).
export default async function LandingPage() {
  const [landing, categories] = await Promise.all([fetchLanding(), fetchCategories()]);
  const countBySlug = new Map(categories.map((c) => [c.slug, c.count]));
  const orderedCategories = CATEGORY_CONTENT.filter((c) => c.slug !== 'other');
  const moreCount = Math.max(0, landing.totalCompetitions - landing.featured.length);
  // The value-prop split's right half is 2–4 admissions stats (blueprint §3). The numbers are
  // still placeholders ("—%") clearly marked TODO(owner) with a source line + non-causal,
  // survey framing (the §3 credibility rule) until the owner supplies sourced figures before
  // the R1 gate (R1-17). Shown by default so the section keeps its quarters layout; set
  // SHOW_LANDING_STATS=false to hide the right half until the real figures land.
  const showStats = process.env.SHOW_LANDING_STATS !== 'false';

  return (
    // grid-cols-1 (minmax(0,1fr)) — a bare `grid` auto track grows to the ScrollRows'
    // intrinsic width and hands the whole page a horizontal scrollbar.
    <div className="grid grid-cols-1 gap-16 sm:gap-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd()) }}
      />
      {/* 1. Hero — 50/50 split; plain Browse button (decision #24); image cards right (#25). */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="animate-rise-in">
          <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
            Search. Compete. <em>Participate.</em>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Every K-12 academic competition — math, science, coding, debate, and more — in one
            place, so your student never misses the right one.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/competitions" className={buttonClasses({ variant: 'brand', size: 'lg' })}>
              Browse competitions
            </Link>
            <Link
              href="/how-it-works"
              className={buttonClasses({ variant: 'secondary', size: 'lg' })}
            >
              How it works
            </Link>
          </div>
        </div>
        <HeroCards cards={landing.heroCards} />
      </section>

      {/* Hero base strip — compact category tiles (decision #3). */}
      <section aria-label="Browse by category" className="-mt-8 sm:-mt-10">
        <ScrollRow label="Categories">
          {orderedCategories.map((category) => {
            const art = categoryArt(category.slug);
            const Icon = art.icon;
            return (
              // role="listitem" belongs on a wrapper, not the <a> — putting it on the link
              // replaces the implicit link role, so AT announces a nameless list item (a11y).
              <div key={category.slug} role="listitem" className="shrink-0 snap-start">
                <Link
                  href={`/competitions/${category.slug}`}
                  className={cn(
                    'flex items-center gap-2 rounded-full border border-border',
                    'bg-surface-raised px-4 py-2.5 text-sm font-medium text-foreground',
                    'transition-colors hover:border-foreground/30',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    weight="duotone"
                    className={cn('size-4.5', art.coverIcon)}
                  />
                  {category.name}
                  <span className="text-xs text-muted">{countBySlug.get(category.slug) ?? 0}</span>
                </Link>
              </div>
            );
          })}
        </ScrollRow>
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
              See more{moreCount > 0 && ` — ${moreCount} more competitions`}
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

      {/* 3. Value-proposition split — image cards left, stats right. Stat copy is
          TODO(owner): sourced, non-causal numbers required before the R1 gate (§3 rule). */}
      <section aria-labelledby="value-heading" className="grid gap-6">
        <h2 id="value-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          Competing changes what&apos;s possible
        </h2>
        <div className={cn('grid gap-6', showStats && 'lg:grid-cols-2')}>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                href: '/competitions',
                label: 'Explore the catalog',
                className:
                  'from-blue-100 via-violet-100 to-fuchsia-200/70 dark:from-blue-950 dark:via-violet-950 dark:to-fuchsia-900/50',
                icon: (
                  <Medal aria-hidden="true" weight="duotone" className="size-12 text-violet-500" />
                ),
              },
              {
                href: '/how-it-works',
                label: 'See how BeeCompete works',
                className:
                  'from-amber-100 via-brand-gold-soft to-orange-200/70 dark:from-stone-800 dark:via-amber-900/40 dark:to-orange-900/50',
                icon: (
                  <GraduationCap
                    aria-hidden="true"
                    weight="duotone"
                    className="size-12 text-brand-gold"
                  />
                ),
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={cn(
                  'group relative flex aspect-[3/4] items-center justify-center overflow-hidden',
                  'rounded-[var(--radius-panel)] border border-border bg-linear-to-br',
                  card.className,
                )}
              >
                {card.icon}
                {/* Hover/focus overlay: an opaque tint with the link text (blueprint §3).
                    bg-black/70 is the darkening scrim the §4 rule requires for white text
                    over imagery (well above WCAG AA); the arrow reads it as a link. */}
                <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/70 p-4 text-center text-sm font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {card.label}
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </span>
              </Link>
            ))}
          </div>
          {/* Right half: 2–4 admissions stats (numbers prominent, labels smaller). Values are
              placeholders — TODO(owner): replace with real, attributed, survey-framed numbers
              before the R1 gate (R1-17). Each keeps a source line and non-causal phrasing per
              the §3 credibility rule. Set SHOW_LANDING_STATS=false to hide until sourced. */}
          {showStats && (
            <div className="grid content-center gap-4">
              {[
                {
                  value: '—%',
                  label:
                    'of admissions officers weigh sustained commitment to an activity in their review',
                },
                {
                  value: '—%',
                  label:
                    'of students who compete report stronger study habits, per national survey data',
                },
              ].map((stat) => (
                <Card key={stat.label} className="p-5">
                  <p className="font-display text-4xl leading-none text-foreground sm:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm text-muted">{stat.label}</p>
                  <p className="mt-2 text-xs text-muted italic">
                    — Source: TODO(owner), before launch
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Audience cards (H46). Parents/Educators pages are deferred → digest anchor;
          Organizers CTA = interest capture (host waitlist wiring lands at R1-15b). */}
      <section aria-labelledby="audience-heading" className="grid gap-5">
        <h2 id="audience-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          Built for the whole team behind a student
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'For Parents',
              copy: 'Find competitions that fit your kid — grade, budget, and interests.',
              cta: 'Get the weekly digest',
              icon: (
                <Users aria-hidden="true" weight="duotone" className="size-8 text-brand-gold" />
              ),
            },
            {
              title: 'For Educators',
              copy: 'Point your students and clubs at vetted, current opportunities.',
              cta: 'Get the weekly digest',
              icon: (
                <GraduationCap
                  aria-hidden="true"
                  weight="duotone"
                  className="size-8 text-brand-gold"
                />
              ),
            },
            {
              title: 'For Organizers',
              copy: 'Reach the families searching for exactly what you run.',
              cta: 'Get early access',
              icon: (
                <Medal aria-hidden="true" weight="duotone" className="size-8 text-brand-gold" />
              ),
            },
          ].map((audience) => (
            <Link
              key={audience.title}
              href="/#digest"
              className="group block rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              {audience.icon}
              <h3 className="mt-3 font-display text-xl text-foreground">{audience.title}</h3>
              <p className="mt-2 text-sm text-muted">{audience.copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                {audience.cta} <ArrowRight aria-hidden="true" className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Weekly digest band (R1-15 wiring). */}
      <DigestBand />
    </div>
  );
}
