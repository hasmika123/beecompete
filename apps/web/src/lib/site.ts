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
