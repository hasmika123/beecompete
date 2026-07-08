import { APP_NAME } from '@beecompete/config';

/**
 * Placeholder home route for the F3 skeleton — proves the app shell, theming, and
 * workspace wiring (@beecompete/config / @beecompete/ui via transpilePackages).
 *
 * This is NOT the real Landing page. The Landing hero (R1-6b) is built only after
 * its design-pass prototype is approved (design-brief §5, page-blueprints Page 1).
 */
export default function Home() {
  return (
    <div className="max-w-2xl">
      <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
        Foundation · F3 skeleton
      </span>
      {/* Headlines use the display serif at regular weight (design-brief §3, rev 2026-07-08) —
          Georgia as the proxy until F7 self-hosts the real face. */}
      <h1 className="font-display mt-4 text-4xl font-normal text-foreground sm:text-5xl">
        {APP_NAME} web app is wired up.
      </h1>
      <p className="mt-4 text-lg text-muted">
        Next.js App Router · Tailwind v4 · light/dark theming via design tokens ·
        <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-sm">@beecompete/ui</code>
        consumed as source. Real pages land in R1.
      </p>
      <p className="mt-6 text-sm text-muted">
        Try the theme toggle in the header — the preference persists across reloads.
      </p>
    </div>
  );
}
