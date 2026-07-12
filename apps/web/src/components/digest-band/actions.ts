'use server';

import type { FormState } from '@/lib/admin-types';

/**
 * Weekly digest signup (Landing §5 → R1-15). The Brevo wiring + the 2–3 preference questions
 * land at R1-15 — until then this is an honest placeholder: no address is stored anywhere.
 */
export async function subscribeDigest(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  // TODO(R1-15): Brevo double-opt-in + preference questions (grade, interests, region).
  return {
    ok: false,
    error: 'Signups open soon — the weekly digest is almost ready. Check back shortly!',
  };
}
