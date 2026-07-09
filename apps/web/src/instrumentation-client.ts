// Sentry — browser runtime. Uses the PUBLIC DSN (exposed to the client), inert unless set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'local',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0.1,
  // PRIVACY (minors + COPPA): NO Session Replay — a minor's screen/inputs must never be
  // recorded — and no default PII on events. Data minimization (compliance.md).
  sendDefaultPii: false,
  integrations: [],
});

// Instrument App Router client navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
