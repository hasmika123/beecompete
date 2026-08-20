'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Checkbox,
  FormField,
  FormResult,
  Honeypot,
  Input,
  Medal,
  Select,
  Textarea,
} from '@beecompete/ui';
import { submitClaimRequest } from './claim-actions';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

// Roles that map to "can plausibly speak for this competition". Free-text would be noise in the
// inbox; a short list makes triage fast and tells the submitter what we're actually asking.
const ROLE_OPTIONS = [
  { value: 'Organizer / director', label: 'Organizer / director' },
  { value: 'Staff / volunteer', label: 'Staff / volunteer' },
  { value: 'Sponsoring school or district', label: 'Sponsoring school or district' },
  { value: 'Sponsoring organization', label: 'Sponsoring organization' },
  { value: 'Other', label: 'Other' },
];

interface ClaimListingCtaProps {
  competitionName: string;
}

/**
 * "Claim this competition" (H46 claim-interest). A short FORM → admin inbox, not a list signup:
 * claiming is a 1:1 conversation that needs context and gets a human reply (see claim-actions.ts
 * for the full reasoning). The optional checkbox is the only thing that joins a mailing list.
 *
 * Actual claiming — verification, ownership transfer — is H1/DQ11 in Phase 3 and is NOT built here;
 * this collects the request so a human can act on it manually.
 */
export function ClaimListingCta({ competitionName }: ClaimListingCtaProps) {
  const [state, formAction, submitting] = useActionState(submitClaimRequest, INITIAL);
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return <FormResult ok message={state.error ?? 'Thanks!'} className="text-left" />;
  }

  return (
    <div>
      <Button
        variant="secondary"
        className="w-full justify-center"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Medal aria-hidden="true" weight="duotone" className="size-4" />
        Claim this competition
      </Button>

      {open && (
        <form action={formAction} className="mt-2 grid gap-3">
          <Honeypot />
          <input type="hidden" name="competitionName" value={competitionName} />

          <p className="text-xs text-muted">
            Are you the organizer? Tell us a little about yourself and we’ll get in touch about
            taking ownership of this listing.
          </p>

          <FormResult ok={false} message={state.error} errorTone="info" className="text-left" />

          {/* FormField generates and wires the control id itself — don't pass htmlFor/id. */}
          <FormField label="Your name" required>
            {/* autoFocus: the form is revealed on click, so moving focus in announces it — and its
                consent framing — to screen-reader users instead of a silent "expanded". */}
            <Input name="name" required autoFocus autoComplete="name" />
          </FormField>

          <FormField label="Your email" required>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@organization.org"
            />
          </FormField>

          <FormField label="Your role" required>
            <Select name="role" required options={ROLE_OPTIONS} placeholder="Select…" />
          </FormField>

          <FormField
            label="Anything else?"
            hint="A link to the official site, or how you’re connected to this competition."
          >
            <Textarea name="message" rows={3} />
          </FormField>

          <Checkbox name="joinWaitlist" label="Also email me when host tools are ready" />

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send claim request'}
          </Button>

          <p className="text-xs text-muted">
            For competition organizers. We’ll use your details only to verify and process this
            claim. See our{' '}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline underline-offset-2 hover:text-brand-gold"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
