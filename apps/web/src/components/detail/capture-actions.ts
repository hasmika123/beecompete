'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

// Per-competition follow-by-email (R1-15b, M29) — the detail page's conversion event, and the R1
// bridge that builds a per-competition audience before accounts exist (they convert to accounts at
// R2). Brevo list, no schema; the competition acted on is stored as the COMPETITION attribute so a
// send can be segmented to exactly the people following that listing.
//
// Host-interest moved out of this file at R1-15c: "claim this competition" is now a form → admin
// inbox (claim-actions.ts) and the general host waitlist is its own capture
// (components/host-waitlist/actions.ts).

function competitionAttribute(form: FormData): Record<string, string> {
  const label = String(form.get('competitionName') ?? '').trim();
  return label ? { COMPETITION: label.slice(0, 200) } : {};
}

export async function followByEmail(_prev: FormState, form: FormData): Promise<FormState> {
  return captureToList(form, {
    flow: 'follow',
    attributes: competitionAttribute(form),
    notReady: 'Email updates are almost ready — check back shortly!',
    // Deliberately NOT "we'll remind you before each deadline": automated per-deadline reminders
    // are M30/X11 in Phase 2. What we can honor today is a manual send to this competition's
    // segment when its dates change, so that's what we promise (owner 2026-07-18).
    confirm: (email) =>
      `Almost there — we sent a confirmation link to ${email}. Click it and we’ll email you when this competition’s dates are announced or updated.`,
    done: 'You’re following this competition — we’ll email you when its dates are announced or updated.',
  });
}
