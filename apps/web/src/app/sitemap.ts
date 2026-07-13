import type { MetadataRoute } from 'next';
import { fetchSitemapEntries } from '@/lib/catalog-api';
import { CATEGORY_CONTENT } from '@/lib/category-content';
import { absoluteUrl } from '@/lib/site';

// XML sitemap (R1-10). Only CANONICAL, clean-path URLs — static pages, the 11 category hubs,
// and every live competition detail page (with its real <lastmod>). Grade/state hubs are
// query-param variants of /competitions that canonicalize back to it, so they're deliberately
// excluded to avoid duplicate-content signals.
//
// <lastmod> honesty (review M4/M5): competition entries carry the row's real updatedAt; category
// hubs carry the newest updatedAt among their competitions; static pages carry NO lastmod
// (there's no meaningful value — a perpetually-"now" lastmod on the hourly-revalidated route is
// exactly what makes Google distrust lastmod site-wide).
//
// Cached hourly, and build-safe: the web image builds with no API reachable (build-once-
// promote), so a failed fetch falls back to the static + category URLs instead of breaking the
// build — the first runtime request then regenerates the full list.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let entries: { slug: string; categorySlug: string; updatedAt: string }[] = [];
  try {
    entries = await fetchSitemapEntries();
  } catch {
    // API unreachable (e.g. at image-build time) — ship the static + category URLs; the next
    // runtime revalidation fills in the competitions.
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/competitions'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.6 },
    { url: absoluteUrl('/how-it-works'), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Newest competition per category → an honest category-hub lastmod.
  const newestByCategory = new Map<string, number>();
  for (const e of entries) {
    const t = new Date(e.updatedAt).getTime();
    if (!Number.isNaN(t)) {
      newestByCategory.set(e.categorySlug, Math.max(newestByCategory.get(e.categorySlug) ?? 0, t));
    }
  }

  const categoryEntries: MetadataRoute.Sitemap = CATEGORY_CONTENT.filter(
    (c) => c.slug !== 'other',
  ).map((c) => {
    const newest = newestByCategory.get(c.slug);
    return {
      url: absoluteUrl(`/competitions/${c.slug}`),
      ...(newest ? { lastModified: new Date(newest) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    };
  });

  const competitionEntries: MetadataRoute.Sitemap = entries.map((e) => ({
    url: absoluteUrl(`/c/${e.slug}`),
    lastModified: new Date(e.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...competitionEntries];
}
