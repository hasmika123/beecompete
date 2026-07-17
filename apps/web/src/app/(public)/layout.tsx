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
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </div>
      {analyticsEnabled(analytics) && <Analytics {...analytics} />}
    </>
  );
}
