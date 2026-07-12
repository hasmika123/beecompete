import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, CategoryTag, ExternalLink, VerifiedSeal, buttonClasses } from '@beecompete/ui';
import { fetchCompetition } from '@/lib/catalog-api';
import { gradeLabel } from '@/lib/catalog-display';
import type { CompetitionDetail } from '@/lib/catalog-types';
import { PublicApiError } from '@/lib/public-api';

// INTERIM detail page (decision #30): a minimal, noindex placeholder at /c/<slug> so
// CompetitionCards never dead-link. The real Page-3 build (at-a-glance strip, tabs, FAQ,
// sticky sidebar, structured data) is R1-7 — replace this file there.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const competition = await load((await params).slug);
  if (!competition) return {};
  return {
    title: `${competition.name} — BeeCompete`,
    description: competition.summary ?? undefined,
    robots: { index: false }, // interim page — indexing starts with the real Page 3 (R1-7/R1-10)
  };
}

async function load(slug: string): Promise<CompetitionDetail | null> {
  try {
    return await fetchCompetition(slug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
}

export default async function CompetitionStubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await load(slug);
  if (!competition) notFound();

  const grades = gradeLabel(competition.minGrade, competition.maxGrade);
  const currentEdition = competition.editions.at(-1);

  return (
    <article className="mx-auto max-w-3xl">
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryTag slug={competition.category.slug} name={competition.category.name} />
        {grades && <Badge variant="outline">{grades}</Badge>}
        <Badge variant="outline">{competition.costType === 'free' ? 'Free' : 'Paid'}</Badge>
        {currentEdition && <Badge variant="neutral">{currentEdition.effectiveStatus}</Badge>}
      </div>

      <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">{competition.name}</h1>

      {competition.organizer && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
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
      )}

      {(competition.summary || competition.description) && (
        <p className="mt-5 leading-relaxed text-foreground">
          {competition.description ?? competition.summary}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {competition.officialUrl && (
          <a
            href={competition.officialUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: 'brand' })}
          >
            Official site <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
        <Link
          href={`/suggest-a-correction?subject=competition&id=${competition.id}&name=${encodeURIComponent(competition.name)}`}
          className={buttonClasses({ variant: 'ghost', size: 'sm' })}
        >
          Suggest a correction
        </Link>
      </div>

      <p className="mt-10 rounded-[var(--radius-panel)] border border-border bg-surface p-4 text-sm text-muted">
        The full competition page — dates timeline, key facts, FAQ, and resources — is on its way.
        Until then, everything official lives on the organizer&apos;s site.
      </p>
    </article>
  );
}
