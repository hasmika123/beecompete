import type { Metadata } from 'next';
import Link from 'next/link';
import { Article, ArrowRight, buttonClasses, cn } from '@beecompete/ui';
import { pageMetadata } from '@/lib/seo';

// Articles (owner 2026-08-15, #66) — replaces How It Works in the nav, which was discarded whole.
// A placeholder until there is anything to read.
//
// noindex while it is a coming-soon stub, and deliberately NOT in sitemap.ts: submitting an empty
// page to search engines is what earns a thin-content impression on a domain that is still trying
// to get its catalog indexed (R1-17). Drop `noindex` and add the sitemap entry in the same change
// that ships real articles — not before.
export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Articles',
    description:
      'Guides and explainers on academic competitions: how they work, how to prepare, and how to choose the right ones. Coming soon.',
    path: '/articles',
    noindex: true,
  });
}

export default function ArticlesPage() {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-4 py-12 text-center">
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-full border border-border bg-surface"
      >
        <Article weight="duotone" className="size-7 text-brand-gold" />
      </span>
      {/* "Coming soon" is the headline, not a footnote (#66): landing here should say what the
          page IS right now. "Articles" stays as a small eyebrow so the page still identifies the
          nav item it belongs to — dropping it entirely would leave a page whose only heading is a
          status, which reads as an error state rather than a section that isn't ready. */}
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Articles</p>
      <h1 className="font-display text-4xl text-foreground sm:text-5xl">Coming soon</h1>
      <p className="text-base text-muted">
        Guides and explainers on finding, preparing for, and choosing academic competitions are on
        the way. In the meantime, the catalog is live and growing.
      </p>
      {/* One row on phones — the same treatment as the landing hero's CTA pair (mobile pass);
          keep the two in step if either changes. */}
      <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-3">
        <Link
          href="/competitions"
          className={cn(
            buttonClasses({ variant: 'brand', size: 'lg' }),
            'max-sm:h-9 max-sm:flex-1 max-sm:basis-36 max-sm:px-3.5 max-sm:text-[0.8125rem] max-sm:whitespace-nowrap',
          )}
        >
          Browse competitions
        </Link>
        <Link
          href="/categories"
          className={cn(
            buttonClasses({ variant: 'secondary', size: 'lg' }),
            'max-sm:h-9 max-sm:flex-1 max-sm:basis-36 max-sm:px-3.5 max-sm:text-[0.8125rem] max-sm:whitespace-nowrap',
          )}
        >
          Browse by category
          {/* Dropped below sm (mobile pass): with the arrow, this pair's min-content came to 347px
              against a 343px row and the two CTAs wrapped to separate lines. It is decorative
              (aria-hidden) and the label already says where the link goes, so the 24px it costs is
              the cheapest thing on the row to give up. */}
          <ArrowRight aria-hidden="true" className="size-4 max-sm:hidden" />
        </Link>
      </div>
    </div>
  );
}
