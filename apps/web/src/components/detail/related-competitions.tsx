import Link from 'next/link';
import { ArrowRight, CompetitionCard } from '@beecompete/ui';
import { ScrollRow } from '@/components/scroll-row';
import { searchCompetitions } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { currentEdition } from '@/lib/detail-display';
import { RELATED_TARGET, currentRegionNames, rankRelated, topUpRelated } from '@/lib/related';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Related competitions (blueprints Page 3.3c, → M25; re-ranked by #109 — owner 2026-08-26).
// R1 shipped a plain same-category-newest pick; the row now aims to be FULL (RELATED_TARGET
// cards) and as SPECIFIC as it can, ranked category > organizer > grade band > location — the
// scoring and its rationale live in lib/related.ts, which is where to look before changing
// anything about the order.
//
// Two fetches at most: the same-category pool (scored client-side — the search API has no
// organizer filter, but the summary DTO carries organizer/grades/regions, so one fetch scores
// all three fields), and an unfiltered top-up ONLY when the category cannot fill the row.
// Still short after that = the catalog is nearly empty; the row shows what exists and the
// section hides entirely at zero, same as before.
//
// Deliberately NOT visitor-personalized — see the lib note; recommendations stay R2-15 (M25).

export async function RelatedCompetitions({ competition }: { competition: CompetitionDetail }) {
  const categorySlug = competition.category.slug;
  // Pool size trades breadth for payload: 50 covers every category at the 200-listing content
  // gate (~20/category) with headroom, within the API's size cap of 100.
  const pool = await searchCompetitions({ category: categorySlug, size: 50, sort: 'newest' });
  const regionNames = currentRegionNames(currentEdition(competition.editions));
  let items = rankRelated(competition, regionNames, pool.content);

  if (items.length < RELATED_TARGET) {
    // Category exhausted — top up from everything, newest first. Fetch a few beyond the target:
    // the unfiltered page contains this competition and the already-picked ones.
    const extras = await searchCompetitions({ size: RELATED_TARGET + 5, sort: 'newest' });
    items = topUpRelated(items, extras.content, competition.id);
  }
  if (items.length === 0) return null;

  // The heading names the category only while it is TRUE of every card — once the top-up mixes
  // categories in, claiming "More math competitions" over a science card would be wrong, so the
  // row falls back to the generic heading (which "other" always uses: it is a catch-all bucket,
  // not an adjective, and "More other competitions" reads as a grammar error). The See-more link
  // follows the same rule: category hub while pure, the full marketplace when mixed.
  const pure = categorySlug !== 'other' && items.every((c) => c.category.slug === categorySlug);
  const heading = pure
    ? `More ${competition.category.name.toLowerCase()} competitions`
    : 'More competitions to explore';
  const seeMoreHref = pure ? `/competitions/${categorySlug}` : '/competitions';

  return (
    <section aria-labelledby="related-heading" className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="related-heading" className="font-display text-xl text-foreground">
          {heading}
        </h2>
        <Link
          href={seeMoreHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          See more
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {/* Horizontal ScrollRow (#85, was a wrapping grid) — same --card-w cards, same pattern as
          the landing Featured row and Prep resources above, so the two rails on this page scroll
          identically instead of one wrapping to a second line. */}
      <ScrollRow label={heading}>
        {items.map((item) => (
          <div key={item.id} role="listitem" className="w-(--card-w) shrink-0 snap-start">
            <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
          </div>
        ))}
      </ScrollRow>
    </section>
  );
}
