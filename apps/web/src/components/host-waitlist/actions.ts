'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

/**
 * General host waitlist (R1-15c, H46) — "tell me when host tools are ready", not tied to any one
 * listing. This is the supply-side counterpart to the Weekly Digest and it builds the warm list we
 * launch host tools into (go-to-market §3–4).
 *
 * Distinct from claiming a specific listing, which is a form → admin inbox (claim-actions.ts): this
 * is a broadcast audience, that is a support conversation. Keeping them apart is the whole point of
 * the R1-15c split — a claim buried in a marketing list is a claim nobody answers.
 */
export async function joinHostWaitlist(_prev: FormState, form: FormData): Promise<FormState> {
  return captureToList(form, {
    flow: 'hosts',
    notReady: 'Host tools are on the way — check back shortly!',
    confirm: (email) =>
      `Almost there — we sent a confirmation link to ${email}. Click it and you’ll be first to hear when host tools open up.`,
    done: 'You’re on the list — we’ll email you when host tools open up.',
  });
}
