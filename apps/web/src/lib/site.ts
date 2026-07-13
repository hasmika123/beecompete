// Canonical public origin — used for absolute URLs in structured data (schema.org
// Event/BreadcrumbList, R1-7) and metadata (OpenGraph/canonical, R1-10). No trailing slash.
//
// Plain SITE_URL, NOT NEXT_PUBLIC_*: this module is server-only, and a NEXT_PUBLIC_ var is
// inlined at image BUILD time — the F6 pipeline builds once and promotes the same image to
// staging and prod, so staging could never override it (review fix M7). Runtime env comes
// from the per-stack compose files; the prod apex is the fallback.
export const SITE_URL = (process.env.SITE_URL ?? 'https://beecompete.com').replace(/\/$/, '');

/** Absolute URL for a site-relative path (leading slash expected). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// Search-indexing gate (R1-10). OFF by default: this is a minors-facing site and the R1-17
// launch gate (legal pages live, COPPA sign-off, content gate) must be met before search
// engines index anything. R1-10 ships the full SEO machinery — sitemap, canonical, OG,
// structured data — but robots.txt serves Disallow:/ and every page emits noindex until this
// flag is flipped to "on" in the prod runtime env at R1-17. Runtime env (read per request),
// never NEXT_PUBLIC_ (build-once-promote — see SITE_URL note above).
export function indexingEnabled(): boolean {
  return process.env.SEARCH_INDEXING === 'on';
}

/** The site name used in OpenGraph / titles. */
export const SITE_NAME = 'BeeCompete';
