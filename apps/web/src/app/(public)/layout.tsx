import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Analytics } from '@/components/analytics/analytics';
import { analyticsEnabled, getAnalyticsConfig } from '@/lib/analytics';

// Public marketing/marketplace chrome (Landing, Competitions, How It Works…). The admin
// section deliberately does NOT use this shell — it has its own in app/admin/layout.tsx, so
// privacy-first analytics (R1-14) load on public pages only, never in the auth-walled admin console.
export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Runtime env (build-once-promote) → passed to the client component. Renders nothing when no
  // tokens are configured, so local/CI/un-configured stacks stay completely analytics-free.
  const analytics = getAnalyticsConfig();

  return (
    <>
      {/* Skip link for keyboard/AT users (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-gold focus:px-3 focus:py-2 focus:text-brand-ink"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        {/* tabIndex=-1 so the skip link reliably lands keyboard focus here across browsers
            (a bare #main fragment doesn't move focus in all engines) — WCAG 2.4.1. */}
        {/* pt-12 / pb-20 rather than py-12 (#64, taken from pb-16 to pb-20 by #65): the content sat
            48px off the footer's top rule and read as crammed, so the BOTTOM is now 80px.
            ⚠ The top stays exactly 48px (pt-12) on purpose — it is one of the terms in the landing
            hero's `--hero-available` (`calc(100svh-4rem-1px)` paired with `lg:-mt-10`, which
            cancels 40 of these 48). Splitting py-12 into pt/pb is what lets the bottom move without
            disturbing that; changing pt here stops the hero ending exactly at the fold.
            The bottom is HALVED to 40px below sm (owner 2026-08-19). #65's "reads as crammed" was a
            desktop judgement, and 80px of nothing is a quarter of a phone screen; the detail page
            was worse still, since its `pb-20` sticky-bar clearance stacks on top of this for a
            160px void. sm+ keeps the 80px #65 asked for. */}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-10 outline-none sm:px-6 sm:pb-20"
        >
          {children}
        </main>
        <SiteFooter />
      </div>
      {analyticsEnabled(analytics) && <Analytics {...analytics} />}
    </>
  );
}
