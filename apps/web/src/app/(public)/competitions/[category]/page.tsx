import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketplacePage } from '@/components/marketplace/marketplace-page';
import { CATEGORY_CONTENT, categoryContent } from '@/lib/category-content';
import { canonicalPath } from '@/lib/marketplace-params';
import { pageMetadata } from '@/lib/seo';

// Category hub (hybrid decision #16): canonical /competitions/<category-slug> renders the
// marketplace pre-filtered + a category header + the indexable "About …" block. Slugs are the
// 11 launch categories; anything else 404s (competition detail lives at /c/<slug>, #30).

export function generateStaticParams() {
  return CATEGORY_CONTENT.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { category } = await params;
  const content = categoryContent(category);
  if (!content) return {};
  return pageMetadata({
    title: `${content.name} Competitions for K-12 Students`,
    description: `${content.oneLiner} Browse curated ${content.name.toLowerCase()} competitions by grade, cost, and deadline.`,
    path: canonicalPath(`/competitions/${content.slug}`, await searchParams),
  });
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
