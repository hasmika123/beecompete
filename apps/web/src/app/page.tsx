import Link from 'next/link';
import { APP_NAME } from '@beecompete/config';
import { Badge, buttonClasses } from '@beecompete/ui';

/**
 * Placeholder home route — proves the app shell, theming, and design-system wiring.
 *
 * NOT the real Landing page. The Landing hero (R1-6b) is built only after its
 * design-pass prototype is approved (design-brief §5, page-blueprints Page 1).
 */
export default function Home() {
  return (
    <div className="max-w-2xl">
      <Badge variant="gold">Foundation · F7 design system</Badge>
      <h1 className="font-display mt-4 text-4xl text-foreground sm:text-5xl">
        {APP_NAME} has a design system.
      </h1>
      <p className="mt-4 text-lg text-muted">
        Tokens, self-hosted type (Fraunces + Inter), and the core primitives now live in{' '}
        <code className="rounded bg-surface px-1.5 py-0.5 text-sm">@beecompete/ui</code>. Real pages
        land in R1.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/design" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          View the design system
        </Link>
        <Link href="/design" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          Browse primitives
        </Link>
      </div>
    </div>
  );
}
