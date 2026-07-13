import Link from 'next/link';
import { Logo } from '@beecompete/ui';

// Blueprint footer (shared component). Legal links (Privacy · Terms · Cookie Policy · the
// affiliate-disclosure page) + contact/social land with R1-12; the beta line is R1-13's surface.
const EXPLORE = [
  { href: '/competitions', label: 'Competitions' },
  { href: '/categories', label: 'Categories' },
  { href: '/how-it-works', label: 'How It Works' },
];

// Title Case both, consistent with each other and the Explore links ("How It Works").
const CONTRIBUTE = [
  { href: '/suggest-a-competition', label: 'Suggest a Competition' },
  { href: '/suggest-a-correction', label: 'Suggest a Correction' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
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
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} BeeCompete. Some resource links may be affiliate links — they
          never affect what we list.
          {/* Legal pages (Privacy · Terms · Cookies) join here with R1-12. */}
        </p>
      </div>
    </footer>
  );
}
