import 'server-only';
import {
  brevoListEnabled,
  getBrevoConfig,
  isValidEmail,
  reportBrevoError,
  subscribeToBrevoList,
  subscribeWithAttributeList,
} from '@/lib/brevo';
import { isHoneypotTripped } from '@/lib/honeypot';
import { absoluteUrl } from '@/lib/site';
import { confirmationPath, type SubscriptionFlow } from '@/lib/subscription-flows';
import type { FormState } from '@/lib/admin-types';

/** Appended to every double-opt-in success so the "where's my email?" hint can't drift per flow. */
const SPAM_HINT = 'No email within a minute or two? Check your spam or promotions folder.';

interface CaptureOptions {
  flow: SubscriptionFlow;
  /** Non-empty attributes to segment on (Brevo attaches best-effort — see subscribeToBrevoList). */
  attributes?: Record<string, string>;
  /**
   * Accumulate `value` into a multi-value text attribute instead of overwriting it, so one contact
   * can follow several competitions. Mutually exclusive with `attributes`.
   */
  appendAttribute?: { name: string; value: string };
  /** Shown when the list isn't wired (inert). */
  notReady: string;
  /** Success copy for double opt-in. Takes the address so we can echo it back — the single most
   *  useful thing to show someone who is about to go looking in their inbox for a typo'd address. */
  confirm: (email: string) => string;
  /** Success copy for single opt-in (added immediately, nothing to confirm). */
  done: string;
  /** Appended to an ALREADY-confirmed contact — no confirmation email was sent. Required with
   *  `appendAttribute`, unreachable without it. */
  added?: string;
  /** They already had this value recorded (double-submit / re-follow). Nothing was written. */
  already?: string;
}

/**
 * The shared email → Brevo-list capture flow behind the digest / follow / host-waitlist actions:
 * honeypot → normalize + validate email → gate on the list being wired → subscribe → confirm-vs-done
 * copy. Each caller supplies only its flow, copy, and attributes, so the anti-bot / validation /
 * error handling can't drift between the captures.
 */
export async function captureToList(form: FormData, opts: CaptureOptions): Promise<FormState> {
  const cfg = getBrevoConfig();

  // Lowercased so "Sam@X.com" and "sam@x.com" are one Brevo contact rather than two (Brevo treats
  // addresses case-insensitively, so the duplicate would silently collide on the second signup).
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();

  // Bots get a success that MATCHES what a human would have seen — including the echoed address, so
  // the response is indistinguishable from a real signup. (The previous unconditional "check your
  // inbox" was also a small lie to any human who tripped the trap via aggressive autofill.)
  if (isHoneypotTripped(form)) {
    return {
      ok: true,
      error: cfg.doiTemplateId ? `${opts.confirm(email)} ${SPAM_HINT}` : opts.done,
    };
  }

  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };

  const listId = {
    digest: cfg.digestListId,
    follow: cfg.followListId,
    hosts: cfg.hostWaitlistListId,
  }[opts.flow];
  if (!brevoListEnabled(cfg, listId)) return { ok: false, error: opts.notReady };

  // Absolute + built from SITE_URL, so a staging confirmation lands on staging instead of
  // bouncing the tester into production.
  const redirectUrl = absoluteUrl(confirmationPath(opts.flow));

  try {
    const result = opts.appendAttribute
      ? await subscribeWithAttributeList(cfg, {
          email,
          listId,
          redirectUrl,
          attribute: opts.appendAttribute.name,
          value: opts.appendAttribute.value,
        })
      : await subscribeToBrevoList(cfg, {
          email,
          listId,
          redirectUrl,
          attributes: opts.attributes,
        });

    switch (result) {
      case 'confirm':
        return { ok: true, error: `${opts.confirm(email)} ${SPAM_HINT}` };
      // Already confirmed on this list — no second confirmation email was sent, so don't tell them
      // to go check their inbox for one.
      case 'added':
        return { ok: true, error: opts.added ?? opts.done };
      case 'already':
        return { ok: true, error: opts.already ?? opts.done };
      default:
        return { ok: true, error: opts.done };
    }
  } catch (e) {
    reportBrevoError(`${opts.flow}-capture`, e);
    return { ok: false, error: 'Sorry — we couldn’t sign you up just now. Please try again.' };
  }
}
