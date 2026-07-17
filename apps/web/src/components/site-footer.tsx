import Link from 'next/link';
import { Logo } from '@beecompete/ui';
import { LEGAL_PAGES } from '@/lib/legal';

// Blueprint footer (shared component). Explore + Contribute + Legal nav columns; the beta line is
// R1-13's surface. Legal links (Privacy · Terms · Cookie Policy · Affiliate Disclosure) land here
// with R1-12, sourced from the single LEGAL_PAGES list so the footer and each policy page's
// cross-links never drift.
const EXPLORE = [
  { href: '/competitions', label: 'Competitions' },
  { href: '/categories', label: 'Categories' },
  { href: '/how-it-works', label: 'How It Works' },
];

// Title Case both, consistent with each other and the Explore links ("How It Works").
const CONTRIBUTE = [
  { href: '/suggest-a-competition', label: 'Request a Competition' },
  { href: '/suggest-a-correction', label: 'Suggest a Correction' },
];

// The three policy pages surfaced compactly in the bottom bar (Affiliate Disclosure already gets
// its own line in the copyright text below, so it's covered in the Legal column only).
const BOTTOM_BAR_LEGAL = LEGAL_PAGES.filter((p) => p.href !== '/affiliate-disclosure');

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="max-w-xs text-sm text-muted">
          <Logo />
          <p className="mt-3">
            One place to find K-12 academic competitions — curated listings, real dates, honest
            details.
          </p>
          <p className="mt-3 text-xs">
            {/* Literal ’ (not &apos;) — an HTML entity anywhere in this text block makes SWC
                drop the space after the inline element ("beta— the"). */}
            BeeCompete is in <strong className="font-medium text-foreground">beta</strong> — the
            catalog is growing and details can change; always confirm dates on the organizer’s
            official site.
          </p>
        </div>
        <nav aria-label="Explore" className="text-sm">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Explore</h2>
          <ul className="grid gap-2">
            {EXPLORE.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-muted hover:text-foreground">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Contribute" className="text-sm">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
            Contribute
          </h2>
          <ul className="grid gap-2">
            {CONTRIBUTE.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-muted hover:text-foreground">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Legal" className="text-sm">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Legal</h2>
          <ul className="grid gap-2">
            {LEGAL_PAGES.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-muted hover:text-foreground">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} BeeCompete. Some resource links may be affiliate links —
            they never affect what we list.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {BOTTOM_BAR_LEGAL.map(({ href, short }) => (
              <li key={href}>
                <Link href={href} className="hover:text-foreground">
                  {short}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
