'use server';

import {
  brevoEmailEnabled,
  brevoListEnabled,
  getBrevoConfig,
  isValidEmail,
  reportBrevoError,
  sendTransactionalEmail,
  subscribeToBrevoList,
} from '@/lib/brevo';
import { isHoneypotTripped } from '@/lib/honeypot';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import { absoluteUrl } from '@/lib/site';
import { confirmationPath } from '@/lib/subscription-flows';
import type { FormState } from '@/lib/admin-types';

// "Claim this competition" (H46 claim-INTEREST — actual claiming is H1/Phase 3 behind Host
// Verification, DQ11, and is NOT built here).
//
// This is a FORM → INBOX, deliberately not a mailing list (owner 2026-07-18). A claim is a 1:1
// support conversation that needs context — which listing, who's asking, what their role is — and
// it gets a human reply. A Brevo list is a broadcast tool: it would drop the context, give us no
// way to reply-thread, and park a business contact on a marketing list they never asked to join.
// The optional opt-in checkbox is the ONLY thing that puts them on a list, and it's the general
// host waitlist, which is a separate flow with its own double opt-in.

/** Where claim requests land. Falls back to the general support inbox so a missing env var can
 *  never silently drop a claim on the floor. */
function claimInbox(): string {
  return process.env.HOST_CLAIM_EMAIL || LEGAL_CONTACT_EMAIL;
}

const MAX_MESSAGE = 2000;
const MAX_FIELD = 200;

const CLAIM_SUCCESS =
  'Thanks — your claim request is with our team. We’ll reply to your email, usually within a few business days.';

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '')
    .trim()
    .slice(0, MAX_FIELD);
}

/**
 * Submit a claim request for a seeded listing. Emails the request to the claims inbox via Brevo
 * transactional mail (same path as feedback, R1-16) with the submitter as Reply-To so an admin can
 * respond directly. Honeypot drops bots. Inert without Brevo → tells the visitor which address to
 * email instead, so a claim is never silently lost.
 *
 * `joinWaitlist` additionally subscribes them to the host waitlist list (double opt-in). That
 * subscription is best-effort: a Brevo list failure must not fail the claim itself, which is the
 * thing the visitor actually came to do.
 */
export async function submitClaimRequest(_prev: FormState, form: FormData): Promise<FormState> {
  if (isHoneypotTripped(form)) return { ok: true, error: CLAIM_SUCCESS };

  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };

  const name = field(form, 'name');
  if (name.length < 2) return { ok: false, error: 'Please add your name.' };

  const role = field(form, 'role');
  if (!role) return { ok: false, error: 'Please tell us your role.' };

  const competition = field(form, 'competitionName') || '(unknown listing)';
  const message = String(form.get('message') ?? '')
    .trim()
    .slice(0, MAX_MESSAGE);
  const joinWaitlist = form.get('joinWaitlist') === 'on';

  const cfg = getBrevoConfig();
  if (!brevoEmailEnabled(cfg)) {
    return {
      ok: false,
      error: `Claim requests aren’t wired up yet — please email ${claimInbox()} and mention “${competition}”.`,
    };
  }

  try {
    await sendTransactionalEmail(cfg, {
      to: claimInbox(),
      subject: `[Claim] ${competition}`,
      textContent: [
        `Competition: ${competition}`,
        `Name: ${name}`,
        `Role: ${role}`,
        `Email: ${email}`,
        `Host waitlist opt-in: ${joinWaitlist ? 'yes' : 'no'}`,
        '',
        message || '(no message)',
      ].join('\n'),
      replyToEmail: email,
    });
  } catch (e) {
    reportBrevoError('claim-request', e);
    return {
      ok: false,
      error: `Sorry — we couldn’t send that just now. Please try again, or email ${claimInbox()}.`,
    };
  }

  // Best-effort, post-send: the claim is already delivered, so a list failure here is logged and
  // swallowed rather than shown as a failure for something that actually succeeded.
  if (joinWaitlist && brevoListEnabled(cfg, cfg.hostWaitlistListId)) {
    try {
      await subscribeToBrevoList(cfg, {
        email,
        listId: cfg.hostWaitlistListId,
        redirectUrl: absoluteUrl(confirmationPath('hosts')),
        attributes: { COMPETITION: competition },
      });
    } catch (e) {
      reportBrevoError('claim-waitlist-optin', e);
    }
  }

  return { ok: true, error: CLAIM_SUCCESS };
}
