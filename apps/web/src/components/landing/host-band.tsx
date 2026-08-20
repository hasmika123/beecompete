'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, FormResult, Honeypot, Input } from '@beecompete/ui';
import { CapturePanel } from './capture-panel';
import { joinHostWaitlist } from '@/components/host-waitlist/actions';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Organizer early-access capture (#57), the "Get early access" counterpart to the digest band.
 * Same shell and same Brevo plumbing, different audience: this one is pitched to the people who
 * RUN competitions, so it asks for an organization instead of a student's grade/interest/state.
 *
 * Unlike DigestBand this is never rendered standalone — it only ever opens from the audience
 * cards, so `onClose` is required rather than optional.
 */
export function HostBand({ onClose }: { onClose: () => void }) {
  const [state, formAction, submitting] = useActionState(joinHostWaitlist, INITIAL);

  return (
    <CapturePanel
      id="host-access"
      headingId="host-heading"
      onClose={onClose}
      closeLabel="Close the organizer early-access form"
    >
      <>
        <h2
          id="host-heading"
          className="font-display text-2xl text-foreground md:whitespace-nowrap lg:text-3xl"
        >
          Get your competition <em>in front of the right families</em>
        </h2>
        <p className="max-w-2xl text-sm text-muted">
          We’re opening host tools to organizers first: claim and manage your listing, keep dates
          accurate, and reach families already searching for what you run.
        </p>

        {state.ok ? (
          <FormResult
            ok
            message={state.error ?? 'Thanks! We’ll be in touch about early host access.'}
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
            <form action={formAction} className="mt-1 grid w-full max-w-xl gap-3">
              <Honeypot />
              <Input
                name="organization"
                autoComplete="organization"
                placeholder="Organization or competition name (optional)"
                aria-label="Organization or competition name"
                className="bg-background"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="bg-background"
                />
                <Button type="submit" disabled={submitting} className="shrink-0">
                  {submitting ? 'Sending…' : 'Get early access'}
                </Button>
              </div>
            </form>

            <p className="max-w-md text-xs text-muted">
              For competition organizers. We’ll only email you about host access. Unsubscribe
              anytime. See our{' '}
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
      </>
    </CapturePanel>
  );
}
