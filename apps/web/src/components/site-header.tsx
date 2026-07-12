import Link from 'next/link';
import { Logo, ThemeToggle } from '@beecompete/ui';

/**
 * App-shell header. Real nav (Browse, Categories, How It Works) is wired when those
 * routes land in R1.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {/* TODO(R1-6b): real nav (Browse, Categories, How It Works) — no placeholder
              text meanwhile; the literal "Nav" was visible on the live site. */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
