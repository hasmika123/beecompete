// DB-liveness probe for EXTERNAL monitoring (UptimeRobot) — the one public URL that always
// does a real database round-trip. It exists because nothing else does: the docker
// healthchecks deliberately probe liveness only (Neon autosuspend — see the compose files),
// and every public page serves from Next's data cache, which keeps returning stale 200s
// when the DB is dead. That combination made the July 2026 Neon quota outage invisible to
// the homepage monitor for days. This route proxies the API's /actuator/health aggregate,
// whose db indicator runs a validation query against Neon: 200 = api + db up, 503 = down.
//
// 🔒 TOKEN-GATED, FAIL CLOSED (2026-08-19). Every hit wakes Neon's compute for ~5 min, so an
// UNGATED public URL is a free quota-burn lever for any /api/*-sweeping scanner — the exact
// mechanism behind the July outage. Nothing upstream absorbs it either: the route is
// force-dynamic + no-store, so Cloudflare never serves it from cache, and the single free CF
// rate-limit rule is scoped to /suggest-a-. The gate rejects BEFORE the upstream fetch, so an
// unauthorized hit costs zero DB round-trips. A blank/unset HEALTHZ_TOKEN rejects everything
// (same posture as the API's AdminTokenFilter): a monitor that goes red is loud and
// self-correcting, a silently-open quota hole is not.
//
// ⚠️ Monitor interval: still poll at 30–60 min, NOT 5 min. The token limits WHO can wake Neon,
// not how often your own monitor does.
import { createHash, timingSafeEqual } from 'node:crypto';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

/**
 * Preferred transport. The `?token=` fallback below exists only for monitors that can't set
 * custom headers — prefer this one: query strings land in access logs, proxy logs, and
 * Referer headers, so the secret travels further than it needs to.
 */
const TOKEN_HEADER = 'x-healthz-token';

/** Compare over fixed-length digests: timingSafeEqual throws on a length mismatch, and the
 *  raw length would itself leak. Mirrors AdminTokenFilter's constant-time compare. */
function constantTimeEquals(expected: string, presented: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(expected).digest(),
    createHash('sha256').update(presented).digest(),
  );
}

function tokenAccepted(request: Request): boolean {
  const expected = process.env.HEALTHZ_TOKEN ?? '';
  if (!expected) return false; // fail closed — unset means nobody, not everybody
  const presented =
    request.headers.get(TOKEN_HEADER) ?? new URL(request.url).searchParams.get('token') ?? '';
  if (!presented) return false;
  return constantTimeEquals(expected, presented);
}

export async function GET(request: Request): Promise<Response> {
  // 401 rather than 404: the value here is that a wrong/missing token is instantly readable in
  // the monitor's alert ("401" = token problem, "503" = real DB outage). Hiding the route's
  // existence buys little — the threat is the DB round-trip, and this path never makes one.
  if (!tokenAccepted(request)) {
    return Response.json(
      { status: 'UNAUTHORIZED' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  let up = false;
  try {
    const res = await fetch(`${API_BASE_URL}/actuator/health`, {
      cache: 'no-store',
      // Generous: a suspended Neon cold-starts on this request (API connection-timeout 20s).
      signal: AbortSignal.timeout(30_000),
    });
    up = res.ok;
  } catch {
    // API unreachable/timed out — DOWN.
  }
  return Response.json(
    { status: up ? 'UP' : 'DOWN' },
    { status: up ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
