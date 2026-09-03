import * as Sentry from '@sentry/nextjs';
import { unstable_rethrow } from 'next/navigation';
import type { FormFailure, FormState } from '@/lib/admin-types';

/**
 * Transport guard for useActionState-driven admin forms (2026-09-03).
 *
 * A server action reaches the server as a browser `fetch` that Next performs for us. When THAT
 * fetch fails — the connection dropped, the site was mid-deploy, or (the case that prompted this)
 * Cloudflare Access answered with a login redirect because the curator's session expired while
 * they were filling in a long listing — the action's promise rejects with something like
 * "TypeError: Failed to fetch". /admin has no error boundary of its own, so the rejection used to
 * reach the root global-error page: the whole form vanished, and with it everything typed. It also
 * looked button-specific ("Submit for review broke, Save as draft worked") when it was purely a
 * matter of WHEN the session ran out — the server treats both intents identically.
 *
 * Wrapping the action converts such a failure into an ordinary {@link FormState} error, so the form
 * stays mounted with every field intact and the message says what to do. Errors the action itself
 * returns are untouched, and Next's own control-flow errors (a `redirect()` after a successful
 * create is delivered to the client as a rejection) are re-thrown so the router still handles them.
 */

/** Same-origin path of the no-op probe (app/admin/session/route.ts). */
export const ADMIN_SESSION_PROBE_PATH = '/admin/session';

export type SessionProbeResult = 'ok' | 'expired' | 'offline' | 'error';

/**
 * Asks whether the browser can still reach /admin as a signed-in curator. `redirect: 'manual'` is
 * the whole trick: an Access login redirect surfaces as an `opaqueredirect` instead of being
 * followed into a cross-origin page (which is what makes the real request fail).
 */
export async function probeAdminSession(): Promise<SessionProbeResult> {
  let res: Response;
  try {
    res = await fetch(ADMIN_SESSION_PROBE_PATH, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    return 'offline';
  }
  if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) return 'expired';
  return res.ok ? 'ok' : 'error';
}

/** Short heading for the inline alert and the toast. */
export const FAILURE_TITLES: Record<FormFailure, string> = {
  'session-expired': 'Your admin sign-in expired',
  unreachable: 'BeeCompete couldn’t be reached',
  'bad-response': 'The server didn’t accept the request',
  'stale-deploy': 'The admin was updated while this page was open',
};

/** What happened and what to do, in the curator's terms. Every message says the work is kept. */
export const FAILURE_MESSAGES: Record<FormFailure, string> = {
  'session-expired':
    'The save was stopped at the sign-in gate, so nothing reached the server. Sign in again in a new tab, then come back here and press the button once more — everything you typed is still here.',
  unreachable:
    'The request didn’t get through, so this save most likely didn’t happen. Everything you typed is still here — check your connection, then press the button again. If the listing already shows up in the list, it did go through.',
  'bad-response':
    'Something between you and the server answered instead of it (a deploy in progress, or a blocked request), so nothing was saved. Everything you typed is still here — wait a moment and press the button again. If it keeps happening, copy your work before reloading.',
  'stale-deploy':
    'This page belongs to an older build and can no longer save. Copy anything you can’t retype, then reload the page and enter it again.',
};

function nextErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object' || !('__NEXT_ERROR_CODE' in error)) {
    return undefined;
  }
  return String((error as { __NEXT_ERROR_CODE: unknown }).__NEXT_ERROR_CODE);
}

/**
 * Names the failure. Only errors the action's transport produced get here (the wrapper has already
 * re-thrown Next's own). A stale action id needs no probe — the page must be reloaded regardless.
 * Everything else is probed first, because an expired session explains a dropped request AND a
 * non-action response (Access can answer either way), and it has one specific remedy.
 */
export async function classifyActionFailure(
  error: unknown,
  probe: () => Promise<SessionProbeResult> = probeAdminSession,
): Promise<FormFailure> {
  if (
    nextErrorCode(error) === 'E715' ||
    (error instanceof Error && error.name === 'UnrecognizedActionError')
  ) {
    return 'stale-deploy';
  }
  const session = await probe();
  if (session === 'expired') return 'session-expired';
  // A TypeError is the browser's own "the fetch never completed" (Failed to fetch / Load failed /
  // NetworkError). With the site answering the probe normally that was a blip; with the probe
  // itself erroring, the site is up but unwell — say so rather than "check your connection".
  if (error instanceof TypeError) return session === 'error' ? 'bad-response' : 'unreachable';
  return 'bad-response';
}

/**
 * Wraps a server action (or a bound one) for `useActionState`. The result type is the action's own
 * state; a transport failure is returned as `{ ok: false, error, failure }` in that shape.
 */
export function guardFormAction<S extends FormState, A extends unknown[]>(
  action: (...args: A) => Promise<S>,
  probe: () => Promise<SessionProbeResult> = probeAdminSession,
): (...args: A) => Promise<S> {
  return async (...args: A): Promise<S> => {
    try {
      return await action(...args);
    } catch (error) {
      unstable_rethrow(error);
      const failure = await classifyActionFailure(error, probe);
      // An expired session and a dropped connection are the curator's environment, not a defect;
      // the other two are worth a look (a deploy that broke actions, a WAF rule biting a form).
      if (failure === 'bad-response' || failure === 'stale-deploy') {
        Sentry.captureException(error, { tags: { area: 'admin-form', failure } });
      }
      return { ok: false, error: FAILURE_MESSAGES[failure], failure } as S;
    }
  };
}
