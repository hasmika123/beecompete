'use server';

import {
  brevoListEnabled,
  getBrevoConfig,
  reportBrevoError,
  subscribeToBrevoList,
} from '@/lib/brevo';
import type { FormState } from '@/lib/admin-types';

// Listing-page email captures (R1-15b): per-competition follow (M29) and host-interest (H46).
// Both go to Brevo lists (owner decision 2026-07-17), pitched to parents/educators/16+ with
// double opt-in, and are inert without their list env. The competition the visitor acted on is
// stored as the COMPETITION contact attribute for later segmentation / R2 account conversion.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(form: FormData): string {
  return String(form.get('email') ?? '').trim();
}

function competitionAttribute(form: FormData): Record<string, string> {
  const label = String(form.get('competitionName') ?? '').trim();
  return label ? { COMPETITION: label.slice(0, 200) } : {};
}

function successMessage(
  result: 'confirm' | 'subscribed',
  confirmMsg: string,
  doneMsg: string,
): string {
  return result === 'confirm' ? confirmMsg : doneMsg;
}

export async function followByEmail(_prev: FormState, form: FormData): Promise<FormState> {
  if (String(form.get('website') ?? '').trim())
    return { ok: true, error: 'Thanks! Check your inbox.' };

  const email = readEmail(form);
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const cfg = getBrevoConfig();
  if (!brevoListEnabled(cfg, cfg.followListId)) {
    return { ok: false, error: 'Email reminders are almost ready — check back shortly!' };
  }

  try {
    const result = await subscribeToBrevoList(cfg, {
      email,
      listId: cfg.followListId,
      attributes: competitionAttribute(form),
    });
    return {
      ok: true,
      error: successMessage(
        result,
        'Almost there! Check your inbox and confirm to get reminders for this competition.',
        'You’re following this competition — we’ll email you about key dates.',
      ),
    };
  } catch (e) {
    reportBrevoError('follow-subscribe', e);
    return { ok: false, error: 'Sorry — we couldn’t sign you up just now. Please try again.' };
  }
}

export async function registerHostInterest(_prev: FormState, form: FormData): Promise<FormState> {
  if (String(form.get('website') ?? '').trim())
    return { ok: true, error: 'Thanks! Check your inbox.' };

  const email = readEmail(form);
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const cfg = getBrevoConfig();
  if (!brevoListEnabled(cfg, cfg.hostListId)) {
    return { ok: false, error: 'Host tools are on the way — check back shortly!' };
  }

  try {
    const result = await subscribeToBrevoList(cfg, {
      email,
      listId: cfg.hostListId,
      attributes: competitionAttribute(form),
    });
    return {
      ok: true,
      error: successMessage(
        result,
        'Thanks! Check your inbox to confirm, and we’ll be in touch about claiming this listing.',
        'Thanks! We’ll be in touch about claiming this listing and early host access.',
      ),
    };
  } catch (e) {
    reportBrevoError('host-interest', e);
    return { ok: false, error: 'Sorry — something went wrong. Please try again.' };
  }
}
