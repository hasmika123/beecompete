'use server';

import { captureToList } from '@/lib/brevo-capture';
import type { FormState } from '@/lib/admin-types';

// Listing-page email captures (R1-15b): per-competition follow (M29) and host-interest (H46).
// Both go to Brevo lists (owner decision 2026-07-17), pitched to parents/educators/16+ with double
// opt-in. The competition the visitor acted on is stored as the COMPETITION contact attribute; the
// honeypot / validation / gate / error handling all live in captureToList.

function competitionAttribute(form: FormData): Record<string, string> {
  const label = String(form.get('competitionName') ?? '').trim();
  return label ? { COMPETITION: label.slice(0, 200) } : {};
}

export async function followByEmail(_prev: FormState, form: FormData): Promise<FormState> {
  return captureToList(form, {
    list: 'follow',
    attributes: competitionAttribute(form),
    notReady: 'Email reminders are almost ready — check back shortly!',
    confirm: 'Almost there! Check your inbox and confirm to get reminders for this competition.',
    done: 'You’re following this competition — we’ll email you about key dates.',
  });
}

export async function registerHostInterest(_prev: FormState, form: FormData): Promise<FormState> {
  return captureToList(form, {
    list: 'host',
    attributes: competitionAttribute(form),
    notReady: 'Host tools are on the way — check back shortly!',
    confirm:
      'Thanks! Check your inbox to confirm, and we’ll be in touch about claiming this listing.',
    done: 'Thanks! We’ll be in touch about claiming this listing and early host access.',
  });
}
