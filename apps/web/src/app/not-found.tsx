import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

// Global 404. Arbitrary unmatched URLs AND notFound() thrown by any segment (e.g. a stale
// competition slug) land here. The root not-found renders inside the minimal root layout only,
// so — unlike (public) pages — it wires up the shared site chrome itself. Literal typographic
// apostrophes (not &apos;) so SWC doesn't drop the following space (same trap as the footer copy).
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="font-display text-6xl leading-none text-brand-gold">404</p>
        <h1 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
          We couldn’t find that page
        </h1>
        <p className="mt-3 max-w-md text-muted">
          The competition or page you’re after may have moved, been archived, or never existed —
          let’s get you back to the catalog.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/competitions" className={buttonClasses({ variant: 'brand' })}>
            Browse competitions
          </Link>
          <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
            Go home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
