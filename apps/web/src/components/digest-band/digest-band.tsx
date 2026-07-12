'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@beecompete/ui';
import { subscribeDigest } from './actions';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Weekly personalized digest capture band (Landing §5, reused on How It Works + Categories;
 * decision #9). Real capture + preference questions wire up at R1-15 (Brevo).
 */
export function DigestBand() {
  const [state, formAction, submitting] = useActionState(subscribeDigest, INITIAL);

  return (
    <section
      id="digest"
      aria-labelledby="digest-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-brand-gold-soft/60 p-6 sm:p-10"
    >
      <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
        <h2 id="digest-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          New competitions, <em>matched to your student</em> — weekly
        </h2>
        <p className="text-sm text-muted">
          One short email a week with new and closing-soon competitions that fit your student&apos;s
          grade and interests. No spam, unsubscribe anytime.
        </p>
        {state.error && (
          <Alert tone={state.ok ? 'success' : 'info'} className="w-full text-left">
            {state.error}
          </Alert>
        )}
        <form action={formAction} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            aria-label="Email address"
            className="bg-background"
          />
          <Button type="submit" disabled={submitting} className="shrink-0">
            {submitting ? 'Signing up…' : 'Get the digest'}
          </Button>
        </form>
      </div>
    </section>
  );
}
