/** Env-driven config. Secrets come from env only — nothing is hardcoded. */

export interface Config {
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  apiBase: string;
  adminToken: string | undefined;
  userAgent: string;
  fetchTimeoutMs: number;
}

/**
 * Default model id (H1). Overridable via ANTHROPIC_MODEL; if Anthropic retires this id the
 * extract step fails with an explicit "set ANTHROPIC_MODEL" error instead of a bare 404.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

export function loadConfig(): Config {
  return {
    anthropicApiKey: emptyToUndefined(process.env.ANTHROPIC_API_KEY),
    anthropicModel: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    apiBase: (process.env.BEECOMPETE_API_BASE || 'http://localhost:8080').replace(/\/+$/, ''),
    adminToken: emptyToUndefined(process.env.ADMIN_API_TOKEN),
    userAgent:
      process.env.SEEDING_USER_AGENT ||
      'BeeCompeteSeedingBot/0.1 (+https://beecompete.com/about/crawler)',
    fetchTimeoutMs: intFromEnv(process.env.SEEDING_FETCH_TIMEOUT_MS, 15000),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
