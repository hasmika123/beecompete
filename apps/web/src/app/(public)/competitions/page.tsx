import type { Metadata } from 'next';
import { MarketplacePage } from '@/components/marketplace/marketplace-page';
import { pageMetadata } from '@/lib/seo';

// Canonical points at the clean /competitions path — filtered/paged variants (?grade=…&page=…)
// all canonicalize here so the facet combinations don't read as duplicate content (R1-10).
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Browse K-12 Academic Competitions — BeeCompete',
    description:
      'Search and filter curated K-12 academic competitions by grade, category, cost, deadline, and more — math, science, coding, debate, writing, and beyond.',
    path: '/competitions',
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
