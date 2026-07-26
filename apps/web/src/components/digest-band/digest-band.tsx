'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  FormField,
  FormResult,
  Honeypot,
  Input,
  Modal,
  Select,
  buttonClasses,
} from '@beecompete/ui';
import { subscribeDigest } from './actions';
import { GRADE_OPTIONS, INTEREST_OPTIONS, STATE_OPTIONS } from '@/lib/digest-preferences';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/**
 * Weekly Digest capture band (Landing §5, reused on How It Works + Categories; decision #9).
 *
 * TWO-STEP CAPTURE (owner 2026-07-26): the band itself asks for the email only — lowest possible
 * friction — and submitting it opens a popup with the three OPTIONAL preference questions
 * (grade / interest / state). The digest is still ONE curated send for everyone (owner
 * 2026-07-18); preferences are stored as Brevo attributes for curator insight + M26 (Phase 2)
 * personalization, and the popup copy says exactly that.
 *
 * WHY THE POPUP IS BEFORE THE SUBSCRIBE CALL, NOT AFTER: with double opt-in the Brevo contact
 * doesn't exist until the confirmation email is clicked, so attributes can only ride along on the
 * one subscribe call — there is no attach-later API path. Every way out of the popup (Save, Skip,
 * Escape, backdrop, ✕) therefore fires that single call; dismissal subscribes email-only, because
 * the visitor already clicked "Get the digest" and closing an optional extra must not cancel the
 * thing they asked for. Only a hard tab-close while the popup is open loses the signup.
 *
 * The popup's inputs live in their OWN form: the shared Modal portals to document.body, so fields
 * placed "inside" the band's form would be outside it in the DOM and never reach its FormData.
 * Without JS the band form posts directly (email-only subscribe) — graceful degradation.
 *
 * Still pitched to parents/educators/16+ — a marketing email to a child would trigger COPPA.
 * Inert until Brevo env is set — see actions.ts / lib/brevo.ts.
 */
export function DigestBand() {
  const [state, formAction, submitting] = useActionState(subscribeDigest, INITIAL);
  const [email, setEmail] = useState('');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const modalFormRef = useRef<HTMLFormElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  // JS path: intercept the band submit (after native email validation passes) and open the popup.
  // Without JS this handler never runs and the form posts email-only via `action` — by design.
  const onBandSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmail(String(new FormData(e.currentTarget).get('email') ?? ''));
    setPrefsOpen(true);
  };

  // Escape / backdrop / ✕ — subscribe without preferences via the Skip submitter (its
  // intent=skip value tells the action to drop any half-selected answers).
  const dismiss = () => {
    if (submitting) return;
    if (skipRef.current) modalFormRef.current?.requestSubmit(skipRef.current);
    else setPrefsOpen(false);
  };

  return (
    <section
      id="digest"
      aria-labelledby="digest-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-brand-gold-soft/60 p-6 sm:p-10"
    >
      <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
        <h2 id="digest-heading" className="font-display text-2xl text-foreground sm:text-3xl">
          New competitions, <em>every week</em>
        </h2>
        <p className="text-sm text-muted">
          One short email a week with newly added and closing-soon competitions, hand-picked by our
          curators. No spam, unsubscribe anytime.
        </p>

        {state.ok ? (
          <FormResult
            ok
            message={state.error ?? 'You’re in! Watch for your first Weekly Digest soon.'}
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
            <form
              action={formAction}
              onSubmit={onBandSubmit}
              className="mt-1 grid w-full max-w-md gap-3"
            >
              <Honeypot />

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
              For parents, educators, and students 16+. We’ll send the Weekly Digest and nothing
              else — unsubscribe anytime. See our{' '}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-2 hover:text-brand-gold"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <Modal
              open={prefsOpen}
              onClose={dismiss}
              title="Make your digest more relevant"
              description="Optional — helps our curators know who they’re picking for, and powers personalized picks when they arrive. Skip if you’d rather not say."
            >
              {/* Any submit closes the popup immediately; pending / success / error all render in
                  the band, so feedback has one home. */}
              <form
                ref={modalFormRef}
                action={formAction}
                onSubmit={() => setPrefsOpen(false)}
                className="grid gap-4"
              >
                <Honeypot />
                <input type="hidden" name="email" value={email} />

                <FormField label="Your student’s grade">
                  <Select name="grade" options={GRADE_OPTIONS} placeholder="Select a grade…" />
                </FormField>
                <FormField label="Subject interest">
                  <Select
                    name="interest"
                    options={INTEREST_OPTIONS}
                    placeholder="Select a subject…"
                  />
                </FormField>
                <FormField label="Your state">
                  <Select name="state" options={STATE_OPTIONS} placeholder="Select a state…" />
                </FormField>

                <div className="mt-1 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  {/* Native button (not <Button>): dismiss() needs a ref to it as the submitter,
                      and the shared Button doesn't forward refs. */}
                  <button
                    ref={skipRef}
                    type="submit"
                    name="intent"
                    value="skip"
                    disabled={submitting}
                    className={buttonClasses({ variant: 'ghost' })}
                  >
                    Skip for now
                  </button>
                  <Button type="submit" disabled={submitting}>
                    Save &amp; subscribe
                  </Button>
                </div>

                <p className="text-xs text-muted">
                  Either way, we’ll send a confirmation email to {email || 'your address'} first.
                </p>
              </form>
            </Modal>
          </>
        )}
      </div>
    </section>
  );
}
