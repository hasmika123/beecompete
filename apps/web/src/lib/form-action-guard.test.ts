import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';
import {
  classifyActionFailure,
  FAILURE_MESSAGES,
  guardFormAction,
  probeAdminSession,
  type SessionProbeResult,
} from './form-action-guard';
import type { FormState } from './admin-types';

// The guard decides whether a curator sees "sign in again in a new tab" with their form intact, or
// the root error page with it gone — worth pinning each branch without a browser.

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const probeWith = (result: SessionProbeResult) => vi.fn(async () => result);

/** The browser's own rejection when a fetch never completes. */
const failedToFetch = () => new TypeError('Failed to fetch');

/** What Next throws for a non-action response (its error code rides on a non-enumerable prop). */
const withNextCode = (message: string, code: string, name?: string) => {
  const e = new Error(message);
  if (name) e.name = name;
  Object.defineProperty(e, '__NEXT_ERROR_CODE', { value: code, enumerable: false });
  return e;
};

beforeEach(() => {
  captureException.mockReset();
});

describe('guardFormAction', () => {
  it('passes the action’s own result through untouched', async () => {
    const action = async (_prev: FormState, _form: FormData): Promise<FormState> => ({
      ok: false,
      error: 'slug is taken',
    });
    const guarded = guardFormAction(action, probeWith('ok'));
    await expect(guarded({ ok: false }, new FormData())).resolves.toEqual({
      ok: false,
      error: 'slug is taken',
    });
  });

  it('re-throws Next’s redirect so a successful create still navigates', async () => {
    const action = async (): Promise<FormState> => redirect('/admin/competitions/abc');
    const probe = probeWith('ok');
    await expect(guardFormAction(action, probe)()).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(probe).not.toHaveBeenCalled();
  });

  it('turns an expired-session fetch failure into an inline error, and keeps Sentry quiet', async () => {
    const action = async (): Promise<FormState> => {
      throw failedToFetch();
    };
    const result = await guardFormAction(action, probeWith('expired'))();
    expect(result).toEqual({
      ok: false,
      failure: 'session-expired',
      error: FAILURE_MESSAGES['session-expired'],
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a bad response to Sentry with the failure tagged', async () => {
    const boom = withNextCode('An unexpected response was received from the server.', 'E394');
    const action = async (): Promise<FormState> => {
      throw boom;
    };
    const result = await guardFormAction(action, probeWith('ok'))();
    expect(result.failure).toBe('bad-response');
    expect(captureException).toHaveBeenCalledWith(boom, {
      tags: { area: 'admin-form', failure: 'bad-response' },
    });
  });
});

describe('classifyActionFailure', () => {
  it('names a stale deployment without probing — a reload is needed either way', async () => {
    const probe = probeWith('ok');
    const stale = withNextCode(
      'Server Action "x" was not found',
      'E715',
      'UnrecognizedActionError',
    );
    await expect(classifyActionFailure(stale, probe)).resolves.toBe('stale-deploy');
    expect(probe).not.toHaveBeenCalled();
  });

  it('lets an expired session explain a non-action response too', async () => {
    const e394 = withNextCode('An unexpected response was received from the server.', 'E394');
    await expect(classifyActionFailure(e394, probeWith('expired'))).resolves.toBe(
      'session-expired',
    );
  });

  it('calls a dropped fetch "unreachable" whether the probe passes or the browser is offline', async () => {
    await expect(classifyActionFailure(failedToFetch(), probeWith('ok'))).resolves.toBe(
      'unreachable',
    );
    await expect(classifyActionFailure(failedToFetch(), probeWith('offline'))).resolves.toBe(
      'unreachable',
    );
  });

  it('calls a dropped fetch a bad response when the site itself answers with an error', async () => {
    await expect(classifyActionFailure(failedToFetch(), probeWith('error'))).resolves.toBe(
      'bad-response',
    );
  });
});

describe('probeAdminSession', () => {
  const stubFetch = (impl: () => Promise<unknown>) => vi.stubGlobal('fetch', vi.fn(impl));

  it('reads an Access login redirect as an expired session', async () => {
    stubFetch(async () => ({ type: 'opaqueredirect', status: 0, ok: false }));
    await expect(probeAdminSession()).resolves.toBe('expired');
    expect(fetch).toHaveBeenCalledWith(
      '/admin/session',
      expect.objectContaining({ redirect: 'manual', cache: 'no-store' }),
    );
  });

  it('reads 401/403 as expired, 204 as ok, 5xx as error, and a throw as offline', async () => {
    stubFetch(async () => new Response(null, { status: 401 }));
    await expect(probeAdminSession()).resolves.toBe('expired');
    stubFetch(async () => new Response(null, { status: 204 }));
    await expect(probeAdminSession()).resolves.toBe('ok');
    stubFetch(async () => new Response(null, { status: 502 }));
    await expect(probeAdminSession()).resolves.toBe('error');
    stubFetch(async () => {
      throw failedToFetch();
    });
    await expect(probeAdminSession()).resolves.toBe('offline');
  });
});
