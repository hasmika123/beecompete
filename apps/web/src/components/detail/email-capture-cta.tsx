'use client';

import { useActionState, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, CheckCircle, Honeypot, Input } from '@beecompete/ui';
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
}: EmailCaptureCtaProps) {
  const [state, formAction, submitting] = useActionState(action, INITIAL);
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <Alert
        tone="success"
        className="text-left"
        icon={<CheckCircle aria-hidden="true" weight="fill" className="size-5 text-success" />}
      >
        {state.error ?? 'Thanks!'}
      </Alert>
    );
  }

  return (
    <div>
      <Button
        variant={variant}
        className="w-full justify-center"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
      </Button>

      {open && (
        <form action={formAction} className="mt-2 grid gap-2">
          <Honeypot />
          <input type="hidden" name="competitionName" value={competitionName} />

          <p className="text-xs text-muted">{blurb}</p>
          {state.error && (
            <Alert tone="info" className="text-left">
              {state.error}
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* autoFocus: the form is revealed on click, so moving focus in announces it (and its
                consent/COPPA framing) to screen-reader users instead of a silent "expanded". */}
            <Input
              type="email"
              name="email"
              required
              autoFocus
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
