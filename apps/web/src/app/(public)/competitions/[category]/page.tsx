import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketplacePage } from '@/components/marketplace/marketplace-page';
import { CATEGORY_CONTENT, categoryContent } from '@/lib/category-content';

// Category hub (hybrid decision #16): canonical /competitions/<category-slug> renders the
// marketplace pre-filtered + a category header + the indexable "About …" block. Slugs are the
// 11 launch categories; anything else 404s (competition detail lives at /c/<slug>, #30).

export function generateStaticParams() {
  return CATEGORY_CONTENT.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const content = categoryContent(category);
  if (!content) return {};
  return {
    title: `${content.name} Competitions for K-12 Students — BeeCompete`,
    description: `${content.oneLiner} Browse curated ${content.name.toLowerCase()} competitions by grade, cost, and deadline.`,
  };
}

export default async function CategoryHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;
  const content = categoryContent(category);
  if (!content) notFound();
  return <MarketplacePage rawSearchParams={await searchParams} hub={content} />;
}
