import type { Metadata } from 'next';
import Link from 'next/link';
import { CompetitionCard, MapPin, buttonClasses } from '@beecompete/ui';
import { CategoryGrid } from '@/components/categories/category-grid';
import { ScrollRow } from '@/components/scroll-row';
import { fetchCategories, fetchRegions, searchCompetitions } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { CATEGORY_CONTENT, GRADE_BANDS } from '@/lib/category-content';
import { pageMetadata } from '@/lib/seo';

// Dynamic (no build prerender) but keeps the per-fetch data cache — see the Landing page's note
// on revalidate=0 vs force-dynamic (R1-10).
export const revalidate = 0;

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Browse Competitions by Category, Grade & State',
    description:
      'Every way into the catalog: K-12 competitions by subject category, by grade level, by state, and by closing-soon deadlines.',
    path: '/categories',
  });
}

// Page 5: Categories index (approved 2026-07-08) — every browse angle as a crawlable entry
// point: category tiles → hub URLs (#16), grade-band hubs, state tiles, closing-soon row.
export default async function CategoriesPage() {
  const [categories, regions, closingSoon] = await Promise.all([
    fetchCategories(),
    fetchRegions(),
    searchCompetitions({ deadlineWithinDays: 30, sort: 'deadline', size: 8 }),
  ]);
  const countBySlug = new Map(categories.map((c) => [c.slug, c.count]));
  // Merged server-side: the grid is a client component (#108, the Show-more disclosure), so it
  // gets plain serialisable data rather than the Map.
  const categoryTiles = CATEGORY_CONTENT.map((c) => ({
    slug: c.slug,
    name: c.name,
    oneLiner: c.oneLiner,
    count: countBySlug.get(c.slug) ?? 0,
  }));
  const stateRegions = regions.filter((r) => r.level === 'state');

  return (
    // grid-cols-1: constrain the auto track — the Closing-soon ScrollRow's intrinsic width
    // otherwise stretches every section past the viewport.
    <div className="grid grid-cols-1 gap-14">
      {/* max-w-3xl, not 2xl (#73): the intro line needs 702px on one line at 18px and the 2xl cap
          (672px) was breaking "search." onto its own row — the page itself has 1104px to give.
          3xl (768px) clears it by 66px. Below ~750px of viewport the line no longer fits and wraps
          naturally, which is the intended behaviour on phones. Re-measure if this copy changes. */}
      <header className="max-w-3xl">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">Browse every angle</h1>
        <p className="mt-3 text-lg text-muted">
          By subject, by grade, by state, by deadline. Pick the door that fits how you search.
        </p>
      </header>

      <section aria-labelledby="by-category">
        <h2 id="by-category" className="font-display text-2xl text-foreground">
          By category
        </h2>
        <CategoryGrid categories={categoryTiles} />
      </section>

      <section aria-labelledby="by-grade">
        <h2 id="by-grade" className="font-display text-2xl text-foreground">
          By grade level
        </h2>
        <ul className="mt-5 grid list-none gap-4 sm:grid-cols-3">
          {GRADE_BANDS.map((band) => (
            <li key={band.key}>
              <Link
                href={`/competitions?minGrade=${band.minGrade}&maxGrade=${band.maxGrade}`}
                className="block rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 text-center transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="font-display text-xl text-foreground">{band.label}</span>
                <p className="mt-1 text-xs text-muted">
                  {band.key === 'elementary' && 'Pre-K through grade 5'}
                  {band.key === 'middle' && 'Grades 6–8'}
                  {band.key === 'high' && 'Grades 9–12'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {stateRegions.length > 0 && (
        <section aria-labelledby="by-state">
          <h2 id="by-state" className="font-display text-2xl text-foreground">
            By state
          </h2>
          <ul className="mt-5 flex list-none flex-wrap gap-2">
            {stateRegions.map((region) => (
              <li key={region.id}>
                <Link
                  href={`/competitions?region=${encodeURIComponent(region.code ?? region.id)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3.5 py-2 text-sm font-medium text-foreground hover:border-foreground/30"
                >
                  <MapPin aria-hidden="true" className="size-4 text-muted" />
                  {region.name} <span className="text-xs text-muted">{region.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {closingSoon.content.length > 0 && (
        <section aria-labelledby="closing-soon">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="closing-soon" className="font-display text-2xl text-foreground">
              Closing soon
            </h2>
            <Link
              href="/competitions?deadlineWithinDays=30&sort=deadline"
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              See all
            </Link>
          </div>
          <ScrollRow label="Closing soon">
            {closingSoon.content.map((item) => (
              <div key={item.id} role="listitem" className="w-(--card-w) shrink-0 snap-start">
                <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
              </div>
            ))}
          </ScrollRow>
        </section>
      )}
    </div>
  );
}
