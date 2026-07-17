'use server';

import {
  brevoEmailEnabled,
  getBrevoConfig,
  isValidEmail,
  reportBrevoError,
  sendTransactionalEmail,
} from '@/lib/brevo';
import { isHoneypotTripped } from '@/lib/honeypot';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import { normalizeFeedbackCategory } from './categories';
import type { FormState } from '@/lib/admin-types';

const MAX_MESSAGE = 4000;

/**
 * In-app bug/feedback report (R1-16, DQ7 precursor). Emails the report to support@ via Brevo
 * transactional mail — no accounts/DB at R1. Optional reply email (set as Reply-To) so support
 * can respond; nothing else is collected. Honeypot drops bots. Inert without Brevo → asks the
 * visitor to email support directly (so feedback is never silently lost).
 */
export async function submitFeedback(_prev: FormState, form: FormData): Promise<FormState> {
  if (isHoneypotTripped(form)) return { ok: true };

  const message = String(form.get('message') ?? '').trim();
  if (message.length < 5) return { ok: false, error: 'Please add a little more detail.' };
  if (message.length > MAX_MESSAGE) return { ok: false, error: 'That message is a bit too long.' };

  const category = normalizeFeedbackCategory(String(form.get('category') ?? '').trim());
  const email = String(form.get('email') ?? '').trim();
  const replyToEmail = email && isValidEmail(email) ? email : undefined;

  const cfg = getBrevoConfig();
  if (!brevoEmailEnabled(cfg)) {
    return {
      ok: false,
      error: `Feedback isn’t wired up yet — please email ${LEGAL_CONTACT_EMAIL} directly for now.`,
    };
  }

  try {
    await sendTransactionalEmail(cfg, {
      to: LEGAL_CONTACT_EMAIL,
      subject: `[Feedback] ${category}`,
      textContent: `Category: ${category}\nFrom: ${email || '(not provided)'}\n\n${message}`,
      replyToEmail,
    });
  } catch (e) {
    reportBrevoError('feedback-email', e);
    return {
      ok: false,
      error: `Sorry — we couldn’t send that just now. Please try again, or email ${LEGAL_CONTACT_EMAIL}.`,
    };
  }
  return { ok: true };
}
