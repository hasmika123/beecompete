import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl, indexingEnabled } from '@/lib/site';

// One place that builds page metadata (R1-10): canonical URL, OpenGraph, Twitter card, and the
// env-gated robots directive. Called from each public page's generateMetadata so the robots
// value reflects the RUNTIME indexing flag (a static `export const metadata` would freeze it at
// build). OG *images* come from the file-convention opengraph-image routes, not from here, so
// they aren't duplicated.

interface PageSeoInput {
  title: string;
  description: string;
  /** Site-relative canonical path (no query string). */
  path: string;
  /** Force noindex regardless of the global flag — admin/utility/dev pages. */
  noindex?: boolean;
  /** OpenGraph type; defaults to "website". */
  ogType?: 'website' | 'article';
}

export function pageMetadata({
  title,
  description,
  path,
  noindex,
  ogType = 'website',
}: PageSeoInput): Metadata {
  const index = indexingEnabled() && !noindex;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      type: ogType,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
