import type { MetadataRoute } from 'next';
import { SITE_URL, indexingEnabled } from '@/lib/site';

// robots.txt (R1-10) — the authoritative crawl gate. Read at request time (force-dynamic) so
// it reflects the runtime SEARCH_INDEXING flag: until R1-17 flips it, the whole site is
// Disallow:/ (a minors-facing site must not be indexed before the launch gate). Once enabled,
// public paths are crawlable and only the admin console + query-param utility pages are blocked.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/suggest-a-correction', '/suggest-a-competition', '/design'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
