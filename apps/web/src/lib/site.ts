// Canonical public origin — used for absolute URLs in structured data (schema.org
// Event/BreadcrumbList, R1-7) and metadata (OpenGraph/canonical, R1-10). Overridable per
// environment; the prod apex is the default. No trailing slash.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://beecompete.com').replace(
  /\/$/,
  '',
);

/** Absolute URL for a site-relative path (leading slash expected). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
