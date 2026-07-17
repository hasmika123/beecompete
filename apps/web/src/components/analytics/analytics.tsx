'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
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
      {posthogKey && <PageviewTracker posthogKey={posthogKey} posthogHost={posthogHost} />}
    </>
  );
}

// Starts PostHog (idempotent — module-level guard) and captures a $pageview on the initial load
// AND every client-side PATH change. Init lives here rather than a parent effect so the first
// pageview can't be dropped to an effect-ordering race (child effects run before parent effects).
// Honors DNT/GPC.
//
// Trigger is `pathname` only — NOT searchParams — on purpose: the marketplace filters are
// instant-apply and mutate the query string, and one filtered view is not a new pageview. posthog
// still records the full $current_url (incl. query) from window.location, so a real navigation to a
// different query (e.g. a category hub, which is a different path) is captured; a filter toggle is
// not. This avoids inflating the pageview counts R1-14 exists to measure.
function PageviewTracker({ posthogKey, posthogHost }: { posthogKey: string; posthogHost: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (privacyOptOut()) return; // DNT / GPC opt-out → never start or capture
    startPostHog(posthogKey, posthogHost);
    posthog.capture('$pageview');
  }, [pathname, posthogKey, posthogHost]);
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
