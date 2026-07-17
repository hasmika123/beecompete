'use client';

import { Suspense, useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

// Client analytics (R1-14) — privacy-first + cookieless, for a minors-facing site (COPPA/SOPIPA).
// Rendered only when the (public) server layout passes tokens from runtime env; renders nothing
// otherwise.
//
// PostHog is configured for anonymous, aggregate product analytics ONLY, and is NOT started when
// the visitor signals Do-Not-Track / Global Privacy Control:
//   • persistence 'memory'    → no cookies, no localStorage (truly cookieless; nothing survives the tab)
//   • person_profiles 'never' → never creates a person profile; events are anonymous
//   • autocapture + dead-clicks + performance + session recording + surveys OFF → no silent DOM capture
//   • capture_pageview off     → we send explicit pageviews on route change (this is an SPA)
//   • respect_dnt true         → belt-and-suspenders with the DNT/GPC gate below
// Cloudflare Web Analytics is a cookieless, aggregate traffic beacon with no per-visitor data, so
// there's nothing individual to opt out of — it loads regardless of DNT (matches the Cookie Policy).

interface AnalyticsProps {
  posthogKey?: string;
  posthogHost: string;
  cfBeaconToken?: string;
}

// Module-level guard (the client bundle is a singleton) so React StrictMode's double-invoked
// effect can't double-init PostHog.
let posthogStarted = false;

function startPostHog(key: string, apiHost: string) {
  if (posthogStarted) return;
  posthogStarted = true;
  posthog.init(key, {
    api_host: apiHost,
    persistence: 'memory',
    person_profiles: 'never',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    // These load their own scripts and capture behavioral/DOM signals even with autocapture off,
    // so turn them off too — we want aggregate pageviews + explicit events only (minors/COPPA).
    capture_dead_clicks: false,
    capture_performance: false,
    respect_dnt: true,
  });
}

/** True when the visitor has asked not to be tracked (DNT header or Global Privacy Control). */
function privacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' ||
    nav.doNotTrack === 'yes' ||
    win.doNotTrack === '1'
  );
}

export function Analytics({ posthogKey, posthogHost, cfBeaconToken }: AnalyticsProps) {
  return (
    <>
      {cfBeaconToken && (
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token: cfBeaconToken })}
        />
      )}
      {posthogKey && (
        <Suspense fallback={null}>
          <PageviewTracker posthogKey={posthogKey} posthogHost={posthogHost} />
        </Suspense>
      )}
    </>
  );
}

// Starts PostHog (idempotent — module-level guard) and captures a $pageview on the initial load
// AND every client-side navigation. Init lives here rather than a parent effect so the first
// pageview can't be dropped to an effect-ordering race (child effects run before parent effects,
// and the Suspense boundary can reorder them further). Honors DNT/GPC. useSearchParams() requires
// the Suspense boundary in the App Router.
function PageviewTracker({ posthogKey, posthogHost }: { posthogKey: string; posthogHost: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (privacyOptOut()) return; // DNT / GPC opt-out → never start or capture
    startPostHog(posthogKey, posthogHost);
    // posthog derives $current_url from window.location itself; pathname/searchParams in the deps
    // just re-fire this on client-side navigations.
    posthog.capture('$pageview');
  }, [pathname, searchParams, posthogKey, posthogHost]);
  return null;
}

/**
 * Fire an anonymous custom event (e.g. X20 zero-result search tracking). No-op when analytics
 * isn't running (env unset, or the visitor opted out via DNT/GPC), so callers can use it freely.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !posthogStarted) return;
  posthog.capture(event, properties);
}
