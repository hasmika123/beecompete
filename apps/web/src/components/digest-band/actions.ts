'use server';

import {
  brevoListEnabled,
  getBrevoConfig,
  reportBrevoError,
  subscribeToBrevoList,
} from '@/lib/brevo';
import type { FormState } from '@/lib/admin-types';

/**
 * Weekly digest signup (Landing §5 → R1-15). Adds the email to the Brevo digest list with the
 * optional grade / interest / state preferences as contact attributes (for segmentation), using
 * DOUBLE OPT-IN when configured. Inert without Brevo env → a friendly "opening soon" message, so
 * nothing is stored pre-launch. The hidden `website` input is a honeypot (bots fill it → silently
 * dropped). Real rate-limiting is the edge WAF (R1-17).
 */
export async function subscribeDigest(_prev: FormState, form: FormData): Promise<FormState> {
  // Honeypot filled → pretend success, store nothing.
  if (String(form.get('website') ?? '').trim()) {
    return { ok: true, error: 'Thanks! Check your inbox to confirm.' };
  }

  const email = String(form.get('email') ?? '').trim();
  // Light client-mirroring check; Brevo does the authoritative validation.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const cfg = getBrevoConfig();
  if (!brevoListEnabled(cfg, cfg.digestListId)) {
    return {
      ok: false,
      error: 'Signups open soon — the weekly digest is almost ready. Check back shortly!',
    };
  }

  // Only send attributes that were actually chosen (Brevo rejects empty/unknown attributes).
  const attributes: Record<string, string> = {};
  const grade = String(form.get('grade') ?? '').trim();
  const interest = String(form.get('interest') ?? '').trim();
  const state = String(form.get('state') ?? '').trim();
  if (grade) attributes.GRADE = grade;
  if (interest) attributes.INTEREST = interest;
  if (state) attributes.STATE = state;

  try {
    const result = await subscribeToBrevoList(cfg, { email, listId: cfg.digestListId, attributes });
    return {
      ok: true,
      error:
        result === 'confirm'
          ? 'Almost there! Check your inbox and confirm your email to start getting the digest.'
          : 'You’re in! Watch for your first weekly digest soon.',
    };
  } catch (e) {
    reportBrevoError('digest-subscribe', e);
    return {
      ok: false,
      error: 'Sorry — we couldn’t sign you up just now. Please try again in a moment.',
    };
  }
}
