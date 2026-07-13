import type { Metadata } from 'next';
import { MarketplacePage } from '@/components/marketplace/marketplace-page';
import { canonicalPath } from '@/lib/marketplace-params';
import { pageMetadata } from '@/lib/seo';

// Canonical (R1-10): filter/search/sort variants fold to the clean /competitions path; a
// page-only variant (?page=N) self-canonicalizes so paginated pages aren't declared duplicates.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  return pageMetadata({
    title: 'Browse K-12 Academic Competitions',
    description:
      'Search and filter curated K-12 academic competitions by grade, category, cost, deadline, and more — math, science, coding, debate, writing, and beyond.',
    path: canonicalPath('/competitions', await searchParams),
  });
}

// Page 2: Competitions (Listing) — the marketplace. Category hubs render the same page
// pre-filtered at /competitions/<category-slug> (hybrid decision #16).
export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketplacePage rawSearchParams={await searchParams} />;
}
