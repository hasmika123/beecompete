'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, FormResult, Honeypot, Input } from '@beecompete/ui';
import { joinHostWaitlist } from './actions';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Host waitlist capture band (R1-15c, H46). Anchored #hosts so the Landing "For Organizers" card
 * has a real destination — it previously pointed at /#digest, dropping an organizer who clicked
 * "Get early access" onto the parent-facing Weekly Digest signup.
 *
 * Organizer framing, not parent/16+: this audience is adults acting for an organization, so the
 * consent microcopy differs from the digest/follow captures by design.
 * Inert until Brevo env is set — see actions.ts / lib/brevo.ts.
 */
export function HostWaitlistBand() {
  const [state, formAction, submitting] = useActionState(joinHostWaitlist, INITIAL);

  return (
    <section
      id="hosts"
      aria-labelledby="hosts-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 sm:p-10"
    >
      <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
        <h2 id="hosts-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          Run a competition? <em>Get early access</em>
        </h2>
        <p className="text-sm text-muted">
          Host tools — claiming your listing, managing editions, reaching the families already
          searching for what you run — are on the way. We’ll email you when they open up.
        </p>

        {state.ok ? (
          <FormResult
            ok
            message={state.error ?? 'You’re on the list.'}
            className="mt-2 w-full max-w-md text-left"
          />
        ) : (
          <>
            <FormResult
              ok={false}
              message={state.error}
              errorTone="info"
              className="w-full max-w-md text-left"
            />
            <form action={formAction} className="mt-1 grid w-full max-w-md gap-3">
              <Honeypot />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@organization.org"
                  aria-label="Email address"
                />
                <Button type="submit" disabled={submitting} className="shrink-0">
                  {submitting ? 'Joining…' : 'Join the waitlist'}
                </Button>
              </div>
            </form>

            <p className="max-w-md text-xs text-muted">
              For competition organizers. We’ll email you about host access and nothing else —
              unsubscribe anytime. See our{' '}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-2 hover:text-brand-gold"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </section>
  );
}
