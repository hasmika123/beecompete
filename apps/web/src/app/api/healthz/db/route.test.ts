import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// The security property under test is NOT just "401 on a bad token" — it's that an unauthorized
// request never reaches the upstream fetch. That fetch is what wakes Neon for ~5 min, so a gate
// that rejected only AFTER calling it would leave the quota-burn lever fully intact (the July 2026
// outage mechanism). Hence every rejection case asserts the fetch spy was never called.

const URL_BASE = 'https://beecompete.com/api/healthz/db';
const TOKEN = 'test-token-abc123';

/** Stubbed upstream — `ok` drives the API's /actuator/health verdict. */
function stubUpstream(ok: boolean) {
  const spy = vi.fn(async () => new Response(null, { status: ok ? 200 : 503 }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const req = (init?: RequestInit, query = '') => new Request(`${URL_BASE}${query}`, init);
const withHeader = (token: string) => req({ headers: { 'X-Healthz-Token': token } });

beforeEach(() => {
  vi.stubEnv('HEALTHZ_TOKEN', TOKEN);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/healthz/db — token gate', () => {
  it('rejects a request with no token, without touching the upstream', async () => {
    const upstream = stubUpstream(true);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects a wrong token in the header, without touching the upstream', async () => {
    const upstream = stubUpstream(true);
    const res = await GET(withHeader('wrong-value'));
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejects a wrong token in the query fallback', async () => {
    const upstream = stubUpstream(true);
    const res = await GET(req({}, '?token=wrong-value'));
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  // Fail-closed: an unset secret must mean "nobody", not "everybody" — otherwise a missing env
  // var in prod silently reopens the hole this gate exists to close.
  it.each([
    ['unset', undefined],
    ['blank', ''],
  ])('rejects everyone when HEALTHZ_TOKEN is %s (fail closed)', async (_label, value) => {
    vi.stubEnv('HEALTHZ_TOKEN', value as string);
    const upstream = stubUpstream(true);
    expect((await GET(withHeader(TOKEN))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('never lets a rejection be cached', async () => {
    stubUpstream(true);
    const res = await GET(req());
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /api/healthz/db — authorized probe', () => {
  it('reports UP (200) via the header when the upstream health aggregate is ok', async () => {
    const upstream = stubUpstream(true);
    const res = await GET(withHeader(TOKEN));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'UP' });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('accepts the query-param fallback for monitors that cannot set headers', async () => {
    const upstream = stubUpstream(true);
    const res = await GET(req({}, `?token=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('reports DOWN (503) when the upstream health aggregate fails', async () => {
    stubUpstream(false);
    const res = await GET(withHeader(TOKEN));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: 'DOWN' });
  });

  // A dead/unreachable API must read as DOWN, not crash the route — an exception here would
  // surface to the monitor as a 500 and muddy the 401-vs-503 signal the runbook documents.
  it('reports DOWN (503) when the upstream throws (API unreachable / timed out)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const res = await GET(withHeader(TOKEN));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: 'DOWN' });
  });
});
