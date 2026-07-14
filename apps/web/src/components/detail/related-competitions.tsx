import Link from 'next/link';
import { ArrowRight, CompetitionCard } from '@beecompete/ui';
import { searchCompetitions } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';

// Related competitions (blueprints Page 3.3c, → M25): same-category picks, excluding the one
// being viewed. R1 = a simple category match (personalized recs are R2-15). Renders nothing
// when the category has no other live listings.

export async function RelatedCompetitions({
  categorySlug,
  categoryName,
  excludeId,
}: {
  categorySlug: string;
  categoryName: string;
  excludeId: string;
}) {
  const result = await searchCompetitions({ category: categorySlug, size: 5, sort: 'newest' });
  const items = result.content.filter((c) => c.id !== excludeId).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="related-heading" className="font-display text-xl text-foreground">
          {/* "Other" is a catch-all bucket, not an adjective — "More other competitions" reads
              as a grammar error, so give it a neutral heading. */}
          {categorySlug === 'other'
            ? 'More competitions to explore'
            : `More ${categoryName.toLowerCase()} competitions`}
        </h2>
        <Link
          href={`/competitions/${categorySlug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          See more
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {/* Same fixed --card-w tracks as the marketplace grid — pixel-identical cards everywhere
          (blueprints #34) instead of the old stretchy lg:grid-cols-4. */}
      <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,var(--card-w))]">
        {items.map((item) => (
          <li key={item.id}>
            <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}
