import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// Monorepo root (two levels up from apps/web). Pin it so Turbopack doesn't infer the
// wrong root from unrelated lockfiles elsewhere on the machine.
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: workspaceRoot },
  // Standalone server bundle for a lean production image (apps/web/Dockerfile).
  // outputFileTracingRoot points at the monorepo root so the trace includes the
  // workspace packages (@beecompete/ui, @beecompete/config).
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  // Shared workspace packages are consumed as source (architecture §16) — Next
  // compiles their TS/JSX rather than expecting a pre-built dist.
  transpilePackages: ['@beecompete/ui', '@beecompete/config'],
};

// Observability (F8): Sentry wraps the config for error monitoring + tunnel/route
// instrumentation. Runtime capture is env-driven (inert without a DSN). Source-map
// upload only runs when SENTRY_AUTH_TOKEN is set (CI/deploy) — a no-op locally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
