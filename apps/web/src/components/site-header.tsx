import Link from 'next/link';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

/**
 * App-shell header. F3 skeleton: logo + placeholder nav + theme toggle. Real nav
 * (Browse, Categories, How It Works) is wired when those routes land in R1.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted" aria-hidden="true">
            {/* TODO(R1): real nav */}
            Nav
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
