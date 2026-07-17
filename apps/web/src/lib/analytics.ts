// Server-side analytics config (R1-14). Reads RUNTIME env — deliberately NOT NEXT_PUBLIC_*: the
// F6 pipeline builds the web image once and promotes it to staging + prod, so a NEXT_PUBLIC_ token
// would be frozen at build time (and empty, since CI has no keys). Instead the (public) server
// layout reads these at request time and hands them to the client <Analytics> component, so the
// tokens reflect whatever's in the per-stack runtime env (same pattern as SITE_URL / SENTRY_DSN).
//
// Everything is inert without env: no POSTHOG_KEY and no CF token → the layout renders no analytics
// at all. That keeps local dev, CI, and any un-configured stack completely analytics-free.
//
// PRIVACY (minors + COPPA): both tools are cookieless and configured for anonymous, aggregate
// measurement only — no behavioral ad profiling, no cross-site tracking, no person profiles. This
// is what the Cookie/Privacy policy pages (R1-12) promise. See the client component for the
// hardened PostHog config.

export interface AnalyticsConfig {
  /** PostHog project API key (write-only, safe to expose to the browser). Undefined = PostHog off. */
  posthogKey?: string;
  /** PostHog ingestion host. Defaults to the EU cloud (architecture §10 — EU host). */
  posthogHost: string;
  /** Cloudflare Web Analytics beacon token. Undefined = the CF beacon isn't injected. */
  cfBeaconToken?: string;
}

export function getAnalyticsConfig(): AnalyticsConfig {
  return {
    posthogKey: process.env.POSTHOG_KEY || undefined,
    posthogHost: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
    cfBeaconToken: process.env.CF_WEB_ANALYTICS_TOKEN || undefined,
  };
}

/** True when at least one analytics tool is configured — the gate for rendering <Analytics>. */
export function analyticsEnabled(cfg: AnalyticsConfig): boolean {
  return Boolean(cfg.posthogKey || cfg.cfBeaconToken);
}
