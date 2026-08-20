'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

/**
 * Organizer early-access capture for the landing audience cards (#57 → H46 host waitlist).
 *
 * Goes to the SAME Brevo `host` list as the detail page's registerHostInterest, but is a separate
 * action because the copy differs: that one is written for someone claiming a specific listing
 * ("we'll be in touch about claiming this listing"), which is nonsense from the landing page where
 * no competition is in context. Honeypot / validation / inert-when-unwired all live in
 * captureToList, so the two captures cannot drift on anti-bot or error handling.
 */
export async function registerHostEarlyAccess(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const organization = String(form.get('organization') ?? '').trim();

  return captureToList(form, {
    list: 'host',
    attributes: organization ? { COMPANY: organization.slice(0, 200) } : {},
    notReady: 'Host tools are on the way. Check back shortly!',
    confirm: 'Almost there! Check your inbox and confirm, and we’ll be in touch about host access.',
    done: 'Thanks! We’ll be in touch about early host access.',
  });
}
