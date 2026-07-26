'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

/**
 * Weekly Digest signup (Landing §5 → R1-15). The digest itself is one curated send that goes to
 * every subscriber alike (owner 2026-07-18) — but signup asks three OPTIONAL preference questions
 * (grade / interest / state) in a popup after the email step (owner 2026-07-26). They're stored as
 * Brevo contact attributes: no effect on the R1 send, but they give curators audience insight now
 * and power the M26 personalized digest in Phase 2 without re-collecting.
 *
 * `intent=skip` (the popup's Skip button, and any dismissal — Escape/backdrop/close) drops the
 * preference fields even if something was selected: dismissing the popup must mean "don't keep my
 * answers", not "keep whatever I happened to click first".
 *
 * With double opt-in the Brevo contact doesn't exist until the confirmation link is clicked, so
 * preferences MUST ride along on this one call — there is no "attach them later" API path. That's
 * why the popup sits between the email step and this action rather than after it.
 *
 * Honeypot / normalization / validation / inert-when-unwired / DOI redirect all live in
 * captureToList (shared with the follow + host-waitlist captures). Rate-limiting = edge WAF (R1-17).
 */
export async function subscribeDigest(_prev: FormState, form: FormData): Promise<FormState> {
  // Only send attributes that were actually chosen (Brevo rejects empty attribute values).
  const attributes: Record<string, string> = {};
  if (String(form.get('intent') ?? '') !== 'skip') {
    const grade = String(form.get('grade') ?? '').trim();
    const interest = String(form.get('interest') ?? '').trim();
    const state = String(form.get('state') ?? '').trim();
    if (grade) attributes.GRADE = grade;
    if (interest) attributes.INTEREST = interest;
    if (state) attributes.STATE = state;
  }

  return captureToList(form, {
    flow: 'digest',
    attributes,
    notReady: 'Signups open soon — the Weekly Digest is almost ready. Check back shortly!',
    confirm: (email) =>
      `Almost there — we sent a confirmation link to ${email}. Click it to start getting the Weekly Digest.`,
    done: 'You’re in! Watch for your first Weekly Digest soon.',
  });
}
