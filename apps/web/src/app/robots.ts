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
        // Only /admin is robots-BLOCKED (auth-walled; nothing crawlable behind it). The
        // utility pages (suggest-a-*, /design) are deliberately NOT listed here: they rely on
        // their noindex meta, and a robots block would HIDE that meta from crawlers — with
        // site-wide footer links pointing at them, that's the "indexed, though blocked by
        // robots.txt" URL-only-result trap (review M1). Never both for a linked page.
        disallow: ['/admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
