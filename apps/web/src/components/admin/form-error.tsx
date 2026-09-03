'use client';

import { Alert } from '@beecompete/ui';
import { FAILURE_TITLES } from '@/lib/form-action-guard';
import type { FormState } from '@/lib/admin-types';

/**
 * The server-error surface of an admin form. A plain action error renders as before (message
 * only); a transport failure from lib/form-action-guard gets its heading, and the expired-session
 * case gets the one link that fixes it — opened in a NEW tab, because reloading this one is exactly
 * what would lose the form.
 */
export function FormErrorAlert({ state, className }: { state: FormState; className?: string }) {
  if (!state.error) return null;
  return (
    <Alert
      tone="danger"
      className={className}
      title={state.failure ? FAILURE_TITLES[state.failure] : undefined}
    >
      {state.error}
      {state.failure === 'session-expired' && (
        <>
          {' '}
          <a
            href="/admin"
            target="_blank"
            rel="noopener"
            className="font-medium underline underline-offset-2"
          >
            Sign in again (opens a new tab)
          </a>
        </>
      )}
    </Alert>
  );
}
