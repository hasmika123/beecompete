// Sign-in probe for the admin forms (2026-09-03). Answers 204 and touches NOTHING — no API call,
// no database — so it is safe to hit at any frequency (setup-runbook "Neon cost controls").
//
// Why it exists: in production every /admin request passes through Cloudflare Access first. When
// a curator's Access session expires while they are mid-form, the server-action POST is answered
// by Access with a redirect to its login page, which the browser's fetch cannot follow cross-origin
// — the action rejects with a bare "TypeError: Failed to fetch". lib/form-action-guard fetches this
// route with `redirect: 'manual'` after such a failure: an `opaqueredirect` (or 401/403) means the
// session is gone, a 204 means the site is reachable and something else dropped the request.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

export function GET() {
  return new Response(null, { status: 204, headers: NO_STORE });
}

export function HEAD() {
  return new Response(null, { status: 204, headers: NO_STORE });
}
