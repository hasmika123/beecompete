'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, FormResult, Honeypot, Input, Select } from '@beecompete/ui';
import { subscribeDigest } from './actions';
import { GRADE_OPTIONS, INTEREST_OPTIONS, STATE_OPTIONS } from '@/lib/digest-options';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Weekly personalized digest capture band (Landing §5, reused on How It Works + Categories;
 * decision #9). R1-15: real Brevo capture + segmentation. Pitched to parents/educators/16+ (a
 * newsletter to a child would trigger COPPA); the 3 preference questions are optional and stored
 * as Brevo contact attributes. Inert until Brevo env is set — see actions.ts / lib/brevo.ts.
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

        {state.ok ? (
          <FormResult
            ok
            message={state.error ?? 'You’re in! Watch for your first weekly digest soon.'}
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

              {/* Optional preferences → Brevo segmentation. */}
              <fieldset className="grid gap-2 text-left">
                <legend className="text-xs font-medium text-muted">
                  Personalize your digest{' '}
                  {/* Full-strength muted (not /80): at 80% over the gold-soft band this small
                      text fell to ~3.4:1, under AA 4.5:1 (WCAG 1.4.3). */}
                  <span className="font-normal text-muted">(optional)</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    name="grade"
                    options={GRADE_OPTIONS}
                    placeholder="Grade"
                    aria-label="Your student’s grade"
                  />
                  <Select
                    name="interest"
                    options={INTEREST_OPTIONS}
                    placeholder="Interest"
                    aria-label="Subject interest"
                  />
                  <Select
                    name="state"
                    options={STATE_OPTIONS}
                    placeholder="State"
                    aria-label="Your state"
                  />
                </div>
              </fieldset>

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
                  {submitting ? 'Signing up…' : 'Get the digest'}
                </Button>
              </div>
            </form>

            <p className="max-w-md text-xs text-muted">
              For parents, educators, and students 16+. We’ll send the weekly digest and nothing
              else — unsubscribe anytime. See our{' '}
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
