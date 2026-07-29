// DB-liveness probe for EXTERNAL monitoring (UptimeRobot) — the one public URL that always
// does a real database round-trip. It exists because nothing else does: the docker
// healthchecks deliberately probe liveness only (Neon autosuspend — see the compose files),
// and every public page serves from Next's data cache, which keeps returning stale 200s
// when the DB is dead. That combination made the July 2026 Neon quota outage invisible to
// the homepage monitor for days. This route proxies the API's /actuator/health aggregate,
// whose db indicator runs a validation query against Neon: 200 = api + db up, 503 = down.
//
// ⚠️ Monitor interval: every hit wakes Neon's compute for ~5 min (its autosuspend window).
// Poll at 30–60 min, NOT 5 min, or the probe itself defeats autosuspend and re-burns the
// compute quota it exists to protect.

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
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
