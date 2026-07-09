// Sentry — server runtime (Node). Loaded by src/instrumentation.ts.
// Inert unless SENTRY_DSN is set (dev/CI stay quiet).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? 'local',
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  // PRIVACY (minors + COPPA): never attach request bodies, headers, cookies, or user
  // identity to events — data minimization (compliance.md).
  sendDefaultPii: false,
});
