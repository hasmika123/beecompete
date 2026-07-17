'use client';

import { useActionState } from 'react';
import {
  Alert,
  Button,
  CheckCircle,
  FormField,
  Honeypot,
  Input,
  Select,
  Textarea,
} from '@beecompete/ui';
import { submitFeedback } from './actions';
import { FEEDBACK_CATEGORIES } from './categories';
import type { FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

// In-app feedback form (R1-16). Reuses shared primitives (no new UI element type). Message is
// required; email is optional (only used so support can reply). → Brevo email to support@.
export function FeedbackForm() {
  const [state, formAction, submitting] = useActionState(submitFeedback, INITIAL);

  if (state.ok) {
    return (
      <Alert
        tone="success"
        icon={<CheckCircle aria-hidden="true" weight="fill" className="size-5 text-success" />}
      >
        Thanks — your feedback went straight to our team. If you left an email, we may follow up.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      <Honeypot />

      <FormField label="What's this about?">
        <Select name="category" defaultValue="Bug" options={FEEDBACK_CATEGORIES} />
      </FormField>

      <FormField label="Tell us more">
        <Textarea
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder="What happened, or what would make BeeCompete better?"
        />
      </FormField>

      <FormField
        label="Your email (optional)"
        hint="Only if you'd like a reply — we won't add you to anything."
      >
        <Input type="email" name="email" placeholder="you@example.com" autoComplete="email" />
      </FormField>

      {state.error && <Alert tone="info">{state.error}</Alert>}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  );
}
