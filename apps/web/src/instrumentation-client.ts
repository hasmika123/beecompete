// Sentry — browser runtime. Uses the PUBLIC DSN (exposed to the client), inert unless set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Staging and prod run the SAME image (build-once-promote), so a baked environment can't
// distinguish them — infer from the hostname at runtime instead.
function inferEnvironment(): string {
  if (process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) return process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  if (typeof window === 'undefined') return 'local';
  const host = window.location.hostname;
  if (host === 'beecompete.com' || host === 'www.beecompete.com') return 'production';
  if (host.startsWith('staging.')) return 'staging';
  return 'local';
}

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: inferEnvironment(),
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  // PRIVACY (minors + COPPA): NO Session Replay — a minor's screen/inputs must never be
  // recorded — and no default PII on events. Data minimization (compliance.md).
  // Errors only in the browser: no tracing integration, so no tracesSampleRate (it was
  // dead config without browserTracingIntegration — deliberately not added).
  sendDefaultPii: false,
  integrations: [],
});

// Instrument App Router client navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
