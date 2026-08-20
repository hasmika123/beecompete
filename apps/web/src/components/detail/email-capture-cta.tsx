'use client';

import { useActionState, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, FormResult, Honeypot, Input } from '@beecompete/ui';
import type { ButtonVariant } from '@beecompete/ui';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

interface EmailCaptureCtaProps {
  /** The server action (follow / host-interest). */
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  /** Stored as the COMPETITION attribute so we know which listing was acted on. */
  competitionName: string;
  label: string;
  /** A rendered icon element (server → client can't pass a component type, an element is fine). */
  icon: ReactNode;
  variant: ButtonVariant;
  /** One line explaining what they'll get. */
  blurb: ReactNode;
  /** Consent / audience microcopy shown under the input (parent/16+ or organizer framing). */
  consent: ReactNode;
  submitLabel: string;
  /**
   * Render the form directly, with no disclosure button (#86). Used by the Follow capture, whose
   * trigger lives in the breadcrumb row and whose whole panel is the disclosure (follow-disclosure
   * .tsx) — a second button inside it would be a second layer to click through. The label becomes
   * a heading instead.
   * ⚠ Do NOT set this on the Claim/host capture: that one has no external trigger, so its button
   * is the only way in.
   */
  alwaysOpen?: boolean;
}

/**
 * Present-but-honest listing-page email capture (R1-15b): the CTA button reveals an inline email
 * form (Brevo, double opt-in). Replaces the R1-7 StubAction for Follow (M29) and Claim/host (H46).
 * Inert without the Brevo list env → the action returns a friendly "almost ready" message.
 */
export function EmailCaptureCta({
  action,
  competitionName,
  label,
  icon,
  variant,
  blurb,
  consent,
  submitLabel,
  alwaysOpen = false,
}: EmailCaptureCtaProps) {
  const [state, formAction, submitting] = useActionState(action, INITIAL);
  const [open, setOpen] = useState(alwaysOpen);

  if (state.ok) {
    return <FormResult ok message={state.error ?? 'Thanks!'} className="text-left" />;
  }

  return (
    <div>
      {alwaysOpen ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {label}
        </p>
      ) : (
        <Button
          variant={variant}
          className="w-full justify-center"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {icon}
          {label}
        </Button>
      )}

      {open && (
        <form action={formAction} className="mt-2 grid gap-2">
          <Honeypot />
          <input type="hidden" name="competitionName" value={competitionName} />

          <p className="text-xs text-muted">{blurb}</p>
          <FormResult ok={false} message={state.error} errorTone="info" className="text-left" />
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* autoFocus: the form is revealed on click either way — by this component's own
                button, or (alwaysOpen) by the Follow disclosure that mounts the whole panel — so
                moving focus in announces it, and its consent/COPPA framing, to screen-reader users
                instead of a silent "expanded". It also carries the viewport to the panel when the
                mobile sticky bar is what opened it. */}
            <Input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <Button type="submit" disabled={submitting} className="shrink-0">
              {submitting ? 'Sending…' : submitLabel}
            </Button>
          </div>
          <p className="text-xs text-muted">{consent}</p>
        </form>
      )}
    </div>
  );
}
