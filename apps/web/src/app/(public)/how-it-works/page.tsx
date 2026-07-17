import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  Card,
  Globe,
  ListIcon,
  Search,
  Tag,
  Trophy,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { DigestBand } from '@/components/digest-band/digest-band';
import { fetchCategories, fetchLanding, fetchRegions } from '@/lib/catalog-api';
import { pageMetadata } from '@/lib/seo';

// Dynamic (no build prerender) but keeps the per-fetch data cache — see the Landing page's note
// on revalidate=0 vs force-dynamic (R1-10).
export const revalidate = 0;

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'How It Works',
    description:
      'How BeeCompete works: we curate K-12 academic competitions into one honest catalog — you find the right one and register on the organizer’s official site.',
    path: '/how-it-works',
  });
}

// Page 4: How It Works (approved 2026-07-08) — mission intro, 3-step timeline + ghosted R2
// tracker teaser, demo-video placeholder, stats & imagery grid on live catalog counts.
export default async function HowItWorksPage() {
  const [landing, categories, regions] = await Promise.all([
    fetchLanding(),
    fetchCategories(),
    fetchRegions(),
  ]);
  const statesCovered = regions.filter((r) => r.level === 'state').length;

  const steps = [
    {
      icon: Search,
      title: 'Search & filter',
      copy: 'Browse the catalog by grade, subject, cost, and deadline — every listing is curated by a human.',
    },
    {
      icon: ListIcon,
      title: 'Compare the details',
      copy: 'Real dates, fees, eligibility, and prizes on every page — no marketing fluff, no stale shells.',
    },
    {
      icon: Trophy,
      title: 'Register with the organizer',
      copy: 'When you’re ready, we send you straight to the organizer’s official site to sign up. We never sit in the middle.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-16">
      <section className="max-w-3xl">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">
          Competitions are scattered. <em>We gather them.</em>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Great K-12 competitions live on hundreds of separate websites — school newsletters, PDFs,
          and word of mouth. BeeCompete is one honest catalog: a small curation team reads the
          official sources, records the real dates and rules, and keeps listings current so families
          and educators don&apos;t have to.
        </p>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="relative">
              <Card className="h-full p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-gold-soft">
                  <step.icon
                    aria-hidden="true"
                    weight="duotone"
                    className="size-5 text-foreground"
                  />
                </span>
                <h3 className="mt-3 font-display text-lg text-foreground">
                  {i + 1}. {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{step.copy}</p>
              </Card>
              <ArrowRight
                aria-hidden="true"
                className="absolute top-1/2 -right-4 hidden size-4 -translate-y-1/2 text-muted lg:block"
              />
            </li>
          ))}
          {/* Ghosted 4th step — the R2 tracker teaser (removed when the tracker ships). */}
          <li>
            <Link
              href="/#digest"
              className={cn(
                'block h-full rounded-[var(--radius-panel)] border border-dashed border-border p-5',
                'text-left transition-colors hover:border-foreground/40',
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-surface">
                <Bookmark aria-hidden="true" className="size-5 text-muted" />
              </span>
              <h3 className="mt-3 font-display text-lg text-muted">
                4. Track it all — coming soon
              </h3>
              <p className="mt-2 text-sm text-muted">
                Deadlines, saved competitions, and reminders in one place. Join the digest to hear
                when it lands.
              </p>
            </Link>
          </li>
        </ol>
      </section>

      {/* Demo video — placeholder asset until produced (decision #5 relocation). */}
      <section aria-labelledby="demo-heading">
        <Card className="grid gap-2 p-6 sm:p-8">
          <h2 id="demo-heading" className="font-display text-2xl text-foreground">
            See it in action
          </h2>
          <div className="flex aspect-[16/5] items-center justify-center rounded-[var(--radius-field)] border border-dashed border-border bg-surface">
            <p className="text-sm text-muted">Demo video coming soon</p>
          </div>
          <p className="text-sm text-muted">
            A 60-second walkthrough: from &ldquo;what&apos;s out there for a 6th grader who loves
            robots?&rdquo; to registered.
          </p>
        </Card>
      </section>

      {/* Stats & imagery grid — live platform/catalog stats (no unsourced outcome claims). */}
      <section aria-labelledby="stats-heading" className="grid gap-5">
        <div>
          <h2 id="stats-heading" className="font-display text-2xl text-foreground sm:text-3xl">
            A catalog that keeps growing
          </h2>
          <p className="mt-2 text-sm text-muted">Live numbers, straight from the catalog.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex aspect-[2/1] items-center justify-center rounded-[var(--radius-panel)] border border-border bg-linear-to-br from-blue-100 to-violet-200/70 dark:from-blue-950 dark:to-violet-900/50">
            <Trophy aria-hidden="true" weight="duotone" className="size-14 text-violet-500" />
          </div>
          <Card className="grid grid-cols-2 content-center gap-6 p-6">
            <div>
              <p className="font-display text-4xl text-foreground">{landing.totalCompetitions}</p>
              <p className="mt-1 text-sm text-muted">competitions listed</p>
            </div>
            <div>
              <p className="font-display text-4xl text-foreground">{categories.length}</p>
              <p className="mt-1 text-sm text-muted">subject categories</p>
            </div>
          </Card>
          <Card className="grid grid-cols-2 content-center gap-6 p-6">
            <div>
              <p className="font-display text-4xl text-foreground">
                {statesCovered > 0 ? statesCovered : '—'}
              </p>
              <p className="mt-1 text-sm text-muted">states covered</p>
            </div>
            <div>
              <p className="font-display text-4xl text-foreground">Weekly</p>
              <p className="mt-1 text-sm text-muted">catalog review cadence</p>
            </div>
          </Card>
          <div className="flex aspect-[2/1] items-center justify-center rounded-[var(--radius-panel)] border border-border bg-linear-to-br from-amber-100 to-brand-gold/50 dark:from-stone-800 dark:to-amber-900/50">
            <Globe aria-hidden="true" weight="duotone" className="size-14 text-brand-gold" />
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-border p-6">
        <div>
          <h2 className="font-display text-xl text-foreground">Questions or feedback?</h2>
          <p className="mt-1 text-sm text-muted">
            We read everything — especially corrections and missing competitions.
          </p>
        </div>
        <Link href="/suggest-a-competition" className={buttonClasses({ variant: 'secondary' })}>
          <Tag aria-hidden="true" className="size-4" /> Request a competition
        </Link>
      </section>

      <DigestBand />
    </div>
  );
}
