'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

/**
 * Weekly Digest signup (Landing §5 → R1-15). Email only — the digest is one curated send that goes
 * to every subscriber alike (owner 2026-07-18). It deliberately collects NO preferences: R1 sends
 * are hand-curated, so promising a personalized match would be a promise we can't keep weekly.
 * Per-subscriber matching arrives with M26 in Phase 2 and re-collects preferences then.
 *
 * Honeypot / normalization / validation / inert-when-unwired / DOI redirect all live in
 * captureToList (shared with the follow + host-waitlist captures). Rate-limiting = edge WAF (R1-17).
 */
export async function subscribeDigest(_prev: FormState, form: FormData): Promise<FormState> {
  return captureToList(form, {
    flow: 'digest',
    notReady: 'Signups open soon — the Weekly Digest is almost ready. Check back shortly!',
    confirm: (email) =>
      `Almost there — we sent a confirmation link to ${email}. Click it to start getting the Weekly Digest.`,
    done: 'You’re in! Watch for your first Weekly Digest soon.',
  });
}
