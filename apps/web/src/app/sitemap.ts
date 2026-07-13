import type { MetadataRoute } from 'next';
import { fetchSitemapEntries } from '@/lib/catalog-api';
import { CATEGORY_CONTENT } from '@/lib/category-content';
import { absoluteUrl } from '@/lib/site';

// XML sitemap (R1-10). Only CANONICAL, clean-path URLs — static pages, the 11 category hubs,
// and every live competition detail page (with its real <lastmod>). Grade/state hubs are
// query-param variants of /competitions that canonicalize back to it, so they're deliberately
// excluded to avoid duplicate-content signals.
//
// Cached hourly, and build-safe: the web image builds with no API reachable (build-once-
// promote), so a failed fetch falls back to the static + category URLs instead of breaking the
// build — the first runtime request then regenerates the full list.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    {
      url: absoluteUrl('/competitions'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/categories'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: absoluteUrl('/how-it-works'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  const categoryEntries: MetadataRoute.Sitemap = CATEGORY_CONTENT.filter(
    (c) => c.slug !== 'other',
  ).map((c) => ({
    url: absoluteUrl(`/competitions/${c.slug}`),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  let competitionEntries: MetadataRoute.Sitemap = [];
  try {
    const entries = await fetchSitemapEntries();
    competitionEntries = entries.map((e) => ({
      url: absoluteUrl(`/c/${e.slug}`),
      lastModified: new Date(e.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    // API unreachable (e.g. at image-build time) — ship the static + category URLs; the next
    // runtime revalidation fills in the competitions.
  }

  return [...staticEntries, ...categoryEntries, ...competitionEntries];
}
