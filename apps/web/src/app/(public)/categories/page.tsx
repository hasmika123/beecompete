import type { Metadata } from 'next';
import Link from 'next/link';
import { CompetitionCard, MapPin, buttonClasses, categoryArt, cn } from '@beecompete/ui';
import { DigestBand } from '@/components/digest-band/digest-band';
import { ScrollRow } from '@/components/scroll-row';
import { fetchCategories, fetchRegions, searchCompetitions } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { CATEGORY_CONTENT, GRADE_BANDS } from '@/lib/category-content';

export const metadata: Metadata = {
  title: 'Browse Competitions by Category, Grade & State — BeeCompete',
  description:
    'Every way into the catalog: K-12 competitions by subject category, by grade level, by state, and by closing-soon deadlines.',
};

// Page 5: Categories index (approved 2026-07-08) — every browse angle as a crawlable entry
// point: category tiles → hub URLs (#16), grade-band hubs, state tiles, closing-soon row.
export default async function CategoriesPage() {
  const [categories, regions, closingSoon] = await Promise.all([
    fetchCategories(),
    fetchRegions(),
    searchCompetitions({ deadlineWithinDays: 30, sort: 'deadline', size: 8 }),
  ]);
  const countBySlug = new Map(categories.map((c) => [c.slug, c.count]));
  const stateRegions = regions.filter((r) => r.level === 'state');

  return (
    <div className="grid gap-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">Browse every angle</h1>
        <p className="mt-3 text-lg text-muted">
          By subject, by grade, by state, by deadline — pick the door that fits how you search.
        </p>
      </header>

      <section aria-labelledby="by-category">
        <h2 id="by-category" className="font-display text-2xl text-foreground">
          By category
        </h2>
        <ul className="mt-5 grid list-none grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORY_CONTENT.map((category) => {
            const art = categoryArt(category.slug);
            const Icon = art.icon;
            return (
              <li key={category.slug}>
                <Link
                  href={`/competitions/${category.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <span
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full bg-linear-to-br',
                      art.cover,
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      weight="duotone"
                      className={cn('size-5', art.coverIcon)}
                    />
                  </span>
                  <span className="font-display text-lg text-foreground">{category.name}</span>
                  <span className="text-xs text-muted">
                    {countBySlug.get(category.slug) ?? 0} listed · {category.oneLiner}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
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
              <div key={item.id} role="listitem" className="w-[270px] shrink-0 snap-start">
                <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
              </div>
            ))}
          </ScrollRow>
        </section>
      )}

      <DigestBand />
    </div>
  );
}
