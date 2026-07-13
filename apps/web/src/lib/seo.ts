import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl, indexingEnabled } from '@/lib/site';

// One place that builds page metadata (R1-10): canonical URL, OpenGraph, Twitter card, and the
// env-gated robots directive. Called from each public page's generateMetadata so the robots
// value reflects the RUNTIME indexing flag (a static `export const metadata` would freeze it at
// build). OG *images* come from the file-convention opengraph-image routes, not from here, so
// they aren't duplicated.
//
// LANDMINE (L1): this only tracks the runtime flag for pages that are dynamically rendered. A
// STATICALLY prerendered page (no dynamic APIs — e.g. a future page with no searchParams/params)
// bakes the BUILD-time `indexingEnabled()` and won't respond to a runtime flag flip. Today every
// public page is either dynamic (searchParams / revalidate=0) or on-demand ISR, and the only
// build-static pages are hard-`noindex`, so it's masked — but if you add a static public page
// meant to be indexable, force it dynamic (`export const revalidate = 0`) or it'll be stuck at
// its build-time robots value.

interface PageSeoInput {
  /**
   * UNBRANDED title — the root layout's title.template appends "· BeeCompete" exactly once.
   * Never bake the brand into this string (that's the "… — BeeCompete · BeeCompete" bug).
   */
  title: string;
  description: string;
  /** Site-relative canonical path (no query string). */
  path: string;
  /** Force noindex regardless of the global flag — admin/utility/dev pages. */
  noindex?: boolean;
  /** OpenGraph type; defaults to "website". */
  ogType?: 'website' | 'article';
  /** Title already carries the brand (e.g. the Landing) — skip the template + og suffix. */
  absoluteTitle?: boolean;
}

export function pageMetadata({
  title,
  description,
  path,
  noindex,
  ogType = 'website',
  absoluteTitle,
}: PageSeoInput): Metadata {
  const index = indexingEnabled() && !noindex;
  // og/twitter titles don't get the layout template, so brand them here to match <title>.
  const socialTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
    openGraph: {
      title: socialTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      type: ogType,
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description },
  };
}
