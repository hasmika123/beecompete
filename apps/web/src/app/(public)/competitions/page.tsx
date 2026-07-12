import type { Metadata } from 'next';
import { MarketplacePage } from '@/components/marketplace/marketplace-page';

export const metadata: Metadata = {
  title: 'Browse K-12 Academic Competitions — BeeCompete',
  description:
    'Search and filter curated K-12 academic competitions by grade, category, cost, deadline, and more — math, science, coding, debate, writing, and beyond.',
};

// Page 2: Competitions (Listing) — the marketplace. Category hubs render the same page
// pre-filtered at /competitions/<category-slug> (hybrid decision #16).
export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketplacePage rawSearchParams={await searchParams} />;
}
