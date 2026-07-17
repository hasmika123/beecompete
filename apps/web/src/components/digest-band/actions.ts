'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

/**
 * Weekly digest signup (Landing §5 → R1-15). Adds the email to the Brevo digest list with the
 * optional grade / interest / state preferences as contact attributes (for segmentation), using
 * DOUBLE OPT-IN when configured. Honeypot / validation / inert-when-unwired / error handling all
 * live in captureToList (shared with the follow + host captures). Real rate-limiting = edge WAF (R1-17).
 */
export async function subscribeDigest(_prev: FormState, form: FormData): Promise<FormState> {
  // Only send attributes that were actually chosen (Brevo rejects empty/unknown attributes).
  const attributes: Record<string, string> = {};
  const grade = String(form.get('grade') ?? '').trim();
  const interest = String(form.get('interest') ?? '').trim();
  const state = String(form.get('state') ?? '').trim();
  if (grade) attributes.GRADE = grade;
  if (interest) attributes.INTEREST = interest;
  if (state) attributes.STATE = state;

  return captureToList(form, {
    list: 'digest',
    attributes,
    notReady: 'Signups open soon — the weekly digest is almost ready. Check back shortly!',
    confirm: 'Almost there! Check your inbox and confirm your email to start getting the digest.',
    done: 'You’re in! Watch for your first weekly digest soon.',
  });
}
