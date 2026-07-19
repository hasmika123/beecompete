'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

// Per-competition follow-by-email (R1-15b, M29) — the detail page's conversion event, and the R1
// bridge that builds a per-competition audience before accounts exist (they convert to accounts at
// R2). Brevo list, no schema.
//
// The competition is APPENDED to the COMPETITION attribute rather than overwriting it: a Brevo
// contact attribute holds one value, so following a second competition used to wipe the first and
// silently stop mailing them about it. Encoding + the read-first branching live in
// lib/brevo-attribute-list.ts and brevo.ts#subscribeWithAttributeList; the payoff here is that
// following twice, or double-submitting the same form, can't lose data or trigger a second
// confirmation email.
//
// Host-interest moved out of this file at R1-15c: "claim this competition" is now a form → admin
// inbox (claim-actions.ts) and the general host waitlist is its own capture
// (components/host-waitlist/actions.ts).

export async function followByEmail(_prev: FormState, form: FormData): Promise<FormState> {
  const competition = String(form.get('competitionName') ?? '').trim();

  return captureToList(form, {
    flow: 'follow',
    appendAttribute: { name: 'COMPETITION', value: competition },
    notReady: 'Email updates are almost ready — check back shortly!',
    // Deliberately NOT "we'll remind you before each deadline": automated per-deadline reminders
    // are M30/X11 in Phase 2. What we can honor today is a manual send to this competition's
    // segment when its dates change, so that's what we promise (owner 2026-07-18).
    confirm: (email) =>
      `Almost there — we sent a confirmation link to ${email}. Click it and we’ll email you when this competition’s dates are announced or updated.`,
    done: 'You’re following this competition — we’ll email you when its dates are announced or updated.',
    // Already confirmed on the follow list, so no second confirmation email went out — saying
    // "check your inbox" here would send them looking for mail that will never arrive.
    added:
      'You’re following this competition too — no need to confirm again. We’ll email you when its dates are announced or updated.',
    already: 'You’re already following this competition — we’ll email you when its dates change.',
  });
}
