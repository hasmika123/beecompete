// Sentry — edge runtime (middleware, edge routes). Loaded by src/instrumentation.ts.
// Inert unless SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? 'local',
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  sendDefaultPii: false,
});
