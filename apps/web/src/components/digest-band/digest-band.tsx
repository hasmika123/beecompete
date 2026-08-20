'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, FormResult, Honeypot, Input, Select } from '@beecompete/ui';
import { subscribeDigest } from './actions';
import { CapturePanel } from '@/components/landing/capture-panel';
import { GRADE_OPTIONS, INTEREST_OPTIONS, STATE_OPTIONS } from '@/lib/digest-options';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Weekly personalized digest capture band (Landing §5, reused on How It Works + Categories;
 * decision #9). R1-15: real Brevo capture + segmentation. Pitched to parents/educators/16+ (a
 * newsletter to a child would trigger COPPA); the 3 preference questions are optional and stored
 * as Brevo contact attributes. Inert until Brevo env is set — see actions.ts / lib/brevo.ts.
 *
 * `onClose` is passed ONLY by the landing page, where #57 made this band open on demand from the
 * audience cards. How It Works and Categories render it with no props and it stays permanently
 * visible there, exactly as before — do not make the prop required.
 */
export function DigestBand({ onClose }: { onClose?: () => void } = {}) {
  const [state, formAction, submitting] = useActionState(subscribeDigest, INITIAL);

  return (
    <CapturePanel
      id="digest"
      headingId="digest-heading"
      onClose={onClose}
      closeLabel="Close the weekly digest signup"
    >
      <>
        {/* One line from md up (#56). Both halves of this are needed: `whitespace-nowrap` alone
            would overflow, and the size step alone would still wrap. 30px needs 737px, which only
            fits from lg (896px available); 24px needs 590px, which fits md's 640px — so the 3xl
            step is held back to lg. Below md it wraps by design, per the owner: phones may split
            it. Re-measure both numbers if this copy ever changes. */}
        <h2
          id="digest-heading"
          className="font-display text-2xl text-foreground md:whitespace-nowrap lg:text-3xl"
        >
          New competitions, <em>matched to your student</em>, every week
        </h2>
        <p className="max-w-2xl text-sm text-muted">
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
                {/* Legend hidden VISUALLY only (#56 removed the on-screen text), not deleted: it
                    is the fieldset's accessible name, so dropping it would leave AT announcing an
                    unlabelled group of three selects. Each Select keeps its own aria-label, but
                    the group still needs to say what the three are for. */}
                <legend className="sr-only">Personalize your digest (optional)</legend>
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
              else. Unsubscribe anytime. See our{' '}
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
