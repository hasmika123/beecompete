import 'server-only';
import {
  brevoListEnabled,
  getBrevoConfig,
  isValidEmail,
  reportBrevoError,
  subscribeToBrevoList,
} from '@/lib/brevo';
import { isHoneypotTripped } from '@/lib/honeypot';
import type { FormState } from '@/lib/admin-types';

type ListName = 'digest' | 'follow' | 'host';

interface CaptureOptions {
  list: ListName;
  /** Non-empty attributes to segment on (Brevo attaches best-effort — see subscribeToBrevoList). */
  attributes?: Record<string, string>;
  /** Shown when the list isn't wired (inert). */
  notReady: string;
  /** Success copy for double opt-in (confirmation email sent). */
  confirm: string;
  /** Success copy for single opt-in (added immediately). */
  done: string;
}

/**
 * The shared email → Brevo-list capture flow behind the digest / follow / host actions: honeypot →
 * validate email → gate on the list being wired → subscribe → confirm-vs-done copy. Each caller
 * supplies only its list, copy, and attributes, so the anti-bot / validation / error handling can't
 * drift between the three captures.
 */
export async function captureToList(form: FormData, opts: CaptureOptions): Promise<FormState> {
  if (isHoneypotTripped(form)) return { ok: true, error: 'Thanks! Check your inbox to confirm.' };

  const email = String(form.get('email') ?? '').trim();
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };

  const cfg = getBrevoConfig();
  const listId = { digest: cfg.digestListId, follow: cfg.followListId, host: cfg.hostListId }[
    opts.list
  ];
  if (!brevoListEnabled(cfg, listId)) return { ok: false, error: opts.notReady };

  try {
    const result = await subscribeToBrevoList(cfg, { email, listId, attributes: opts.attributes });
    return { ok: true, error: result === 'confirm' ? opts.confirm : opts.done };
  } catch (e) {
    reportBrevoError(`${opts.list}-capture`, e);
    return { ok: false, error: 'Sorry — we couldn’t sign you up just now. Please try again.' };
  }
}
