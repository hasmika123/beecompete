import Link from 'next/link';
import {
  CompetitionCard,
  EmptyState,
  Search as SearchIcon,
  X,
  buttonClasses,
  cn,
} from '@beecompete/ui';
import { MarketplaceFrame } from '@/components/marketplace/marketplace-frame';
import { fetchRegions, searchCompetitions, type SearchParams } from '@/lib/catalog-api';
import { toCardData } from '@/lib/catalog-display';
import { GRADE_BANDS, type CategoryContent } from '@/lib/category-content';
import type { CompetitionSummary, SearchFacets } from '@/lib/catalog-types';
import { itemListJsonLd, jsonLdScript } from '@/lib/structured-data';
import {
  MAX_PAGE,
  PAGE_SIZE,
  RELAX_ORDER,
  activeBand,
  activeChips,
  hasActiveRefinement,
  marketplaceHref,
  parseMarketplaceParams,
  type MarketplaceParams,
} from '@/lib/marketplace-params';

// The Page-2 marketplace renderer, shared by /competitions and the category hubs
// (/competitions/<category-slug>, hybrid decision #16). Server component: filters are URL
// state, pages are fetched cumulatively behind the "Load more" button (decision #13 — never
// auto-loads), and zero results always show near-miss cards (decision #14).

interface MarketplacePageProps {
  rawSearchParams: Record<string, string | string[] | undefined>;
  /** Set on category hubs: locks the category and renders the header + SEO block. */
  hub?: CategoryContent;
}

function toApiParams(params: MarketplaceParams, categorySlug: string | undefined): SearchParams {
  return {
    q: params.q,
    category: categorySlug,
    minGrade: params.minGrade,
    maxGrade: params.maxGrade,
    region: params.region,
    cost: params.cost,
    delivery: params.delivery,
    participation: params.participation,
    pathway: params.pathway,
    deadlineWithinDays: params.deadlineWithinDays,
    sort: params.sort,
  };
}

/** Relax the least-important active filter until something matches (single relaxation). */
async function nearMiss(params: MarketplaceParams, categorySlug: string | undefined) {
  for (const { key, label } of RELAX_ORDER) {
    const active =
      key === 'grade'
        ? params.minGrade !== undefined || params.maxGrade !== undefined
        : params[key as keyof MarketplaceParams] !== undefined;
    if (!active) continue;
    const relaxed: MarketplaceParams =
      key === 'grade'
        ? { ...params, minGrade: undefined, maxGrade: undefined }
        : { ...params, [key]: undefined };
    const result = await searchCompetitions({
      ...toApiParams(relaxed, categorySlug),
      size: 3,
    });
    if (result.content.length > 0) {
      return { label, items: result.content };
    }
  }
  return null;
}

function CardGrid({ items }: { items: CompetitionSummary[] }) {
  // Fixed --card-w tracks (auto-fill) — card width is 258px by construction (the token is
  // derived to fill the shell EXACTLY: 4 tracks + 3 gaps = the 1104px content width; see
  // tokens.css), so it stays IDENTICAL whether the filter panel is open or closed: the panel
  // is one track wide, so opening it drops exactly one column (4 ↔ 3 per row, blueprints #34).
  // Single full-width column on phones.
  return (
    <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,var(--card-w))]">
      {items.map((item) => (
        <li key={item.id}>
          <CompetitionCard data={toCardData(item)} linkComponent={Link} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

export async function MarketplacePage({ rawSearchParams, hub }: MarketplacePageProps) {
  const path = hub ? `/competitions/${hub.slug}` : '/competitions';
  const params = parseMarketplaceParams(rawSearchParams);
  if (hub) params.category = undefined; // hubs are locked to the path's category
  const categorySlug = hub?.slug ?? params.category;

  // Cumulative pages behind "Load more" (decision #13) + facet counts + region options.
  const pageNumbers = Array.from({ length: params.page + 1 }, (_, i) => i);
  const [pages, regions] = await Promise.all([
    Promise.all(
      pageNumbers.map((page) =>
        searchCompetitions({
          ...toApiParams(params, categorySlug),
          facets: page === 0,
          page,
          size: PAGE_SIZE,
        }),
      ),
    ),
    fetchRegions(),
  ]);
  const firstPage = pages[0];
  if (!firstPage) throw new Error('unreachable: at least one page is always fetched');
  const total = firstPage.totalElements;
  const facets: SearchFacets | null = firstPage.facets;
  const items = pages.flatMap((p) => p.content);
  const shown = items.length;

  const regionName = params.region
    ? regions.find(
        (r) => r.code?.toLowerCase() === params.region?.toLowerCase() || r.id === params.region,
      )?.name
    : undefined;
  const categoryName = params.category
    ? facets?.categories.find((c) => c.slug === params.category)?.name
    : undefined;
  const chips = activeChips(path, params, regionName, categoryName);
  const band = activeBand(params);
  const miss = total === 0 ? await nearMiss(params, categorySlug) : null;
  // ItemList only on the canonical listing (no refinement, first page) — the same page whose
  // canonical is self-referential (R1-10 L7). Filtered/paged variants canonicalize away, so
  // emitting their differing lists is noise.
  const itemList =
    !hasActiveRefinement(params) && params.page === 0 ? itemListJsonLd(items) : undefined;

  return (
    <div className="grid gap-6">
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(itemList) }}
        />
      )}
      {hub ? (
        <header className="grid gap-2">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/competitions" className="hover:text-foreground">
              Competitions
            </Link>{' '}
            › <span className="text-foreground">{hub.name}</span>
          </nav>
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            {hub.name} competitions
          </h1>
          <p className="max-w-2xl text-muted">
            {hub.oneLiner} <span className="text-sm">· {total} listed</span>
          </p>
        </header>
      ) : (
        <header className="grid gap-2">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            Find your next <em>competition</em>
          </h1>
          <p className="max-w-2xl text-muted">
            Every listing is curated — real dates, honest details, and a link straight to the
            organizer.
          </p>
        </header>
      )}

      <MarketplaceFrame
        path={path}
        params={params}
        total={total}
        facets={facets}
        regions={regions}
        categoryFilter={hub ? undefined : { active: params.category }}
        chips={
          chips.length > 0 ? (
            <ul className="flex list-none flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={chip.href}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface',
                      'px-3 py-1 text-xs font-medium text-foreground hover:border-danger hover:text-danger',
                    )}
                  >
                    {chip.label}
                    <X aria-hidden="true" className="size-3" />
                    <span className="sr-only"> — remove filter</span>
                  </Link>
                </li>
              ))}
              {/* Clear all refinements but KEEP the search text + sort (A10). */}
              <li>
                <Link
                  href={marketplaceHref(path, params, {
                    category: undefined,
                    minGrade: undefined,
                    maxGrade: undefined,
                    region: undefined,
                    cost: undefined,
                    delivery: undefined,
                    participation: undefined,
                    pathway: undefined,
                    deadlineWithinDays: undefined,
                  })}
                  className="px-1 text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </Link>
              </li>
            </ul>
          ) : undefined
        }
        quickChips={
          <div
            className="flex flex-wrap items-center gap-2 overflow-x-auto"
            aria-label="Grade levels"
          >
            <Link
              href={marketplaceHref(path, params, { minGrade: undefined, maxGrade: undefined })}
              aria-current={!band && params.minGrade === undefined ? 'true' : undefined}
              className={buttonClasses({
                variant: !band && params.minGrade === undefined ? 'primary' : 'secondary',
                size: 'sm',
              })}
            >
              All
            </Link>
            {GRADE_BANDS.map((b) => (
              <Link
                key={b.key}
                href={marketplaceHref(path, params, { minGrade: b.minGrade, maxGrade: b.maxGrade })}
                aria-current={band === b.key ? 'true' : undefined}
                className={buttonClasses({
                  variant: band === b.key ? 'primary' : 'secondary',
                  size: 'sm',
                })}
              >
                {b.label}
              </Link>
            ))}
          </div>
        }
      >
        {total > 0 ? (
          <div className="grid gap-6">
            <CardGrid items={items} />
            <div className="grid justify-items-center gap-2 pb-2">
              <p className="text-xs text-muted">
                Showing {shown} of {total}
              </p>
              {shown < total && params.page < MAX_PAGE && (
                <Link
                  href={marketplaceHref(path, params, { page: params.page + 1 })}
                  scroll={false}
                  className={buttonClasses({ variant: 'secondary' })}
                >
                  Load more
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            <EmptyState
              icon={<SearchIcon aria-hidden="true" className="size-6" />}
              title="No competitions match"
              description={
                miss
                  ? `Nothing matches every filter — but relaxing the ${miss.label} filter finds these.`
                  : 'Nothing matches every filter. Try removing a filter — or tell us what we’re missing.'
              }
              action={
                <Link href="/suggest-a-competition" className={buttonClasses({ variant: 'brand' })}>
                  Request a competition
                </Link>
              }
            />
            {miss && <CardGrid items={miss.items} />}
          </div>
        )}
      </MarketplaceFrame>

      {hub && (
        <section aria-labelledby="about-category" className="max-w-3xl border-t border-border pt-8">
          <h2 id="about-category" className="font-display text-xl text-foreground">
            About {hub.name.toLowerCase()} competitions
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{hub.about}</p>
        </section>
      )}
    </div>
  );
}
