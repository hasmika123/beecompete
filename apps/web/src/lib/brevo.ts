// Brevo (email) integration for the listing-page captures (R1-15 digest, R1-15b follow +
// host-interest). Server-only — the API key is a secret and must never reach the browser (so
// these are plain env vars, never NEXT_PUBLIC_*). Inert without config: each capture's server
// action falls back to a friendly "opening soon" when its list isn't wired, so local/CI/pre-launch
// stay side-effect-free (same posture as analytics).
//
// COMPLIANCE: every capture is pitched to parents/educators/16+ (a K-12-directed email to a child
// would trigger COPPA). We default to Brevo DOUBLE OPT-IN when a DOI template is configured — the
// subscriber must click a confirmation email before anything is stored on the list, which is both
// the consent record (CAN-SPAM / prudent COPPA posture) and good deliverability hygiene.

import * as Sentry from '@sentry/nextjs';

const BREVO_BASE = 'https://api.brevo.com/v3';

/**
 * Report a Brevo failure to the logs + Sentry (inert without a DSN). Callers still show the user a
 * friendly message, but this makes a prod misconfig (wrong key type, missing contact attribute,
 * unverified sender) OBSERVABLE instead of silently failing every capture. Never throws.
 */
export function reportBrevoError(context: string, error: unknown): void {
  console.error(`[brevo] ${context} failed`, error);
  Sentry.captureException(error, { tags: { area: 'brevo', context } });
}

export interface BrevoConfig {
  apiKey?: string;
  /** Weekly digest list (R1-15). */
  digestListId?: number;
  /** Per-competition follow list (R1-15b, M29). */
  followListId?: number;
  /** Host-interest / "claim your competition" waitlist (R1-15b, H46). */
  hostListId?: number;
  /** When set, subscribe via double opt-in using this shared Brevo DOI template. */
  doiTemplateId?: number;
  /** Where Brevo sends the subscriber after they confirm (defaults to the site root). */
  doiRedirectUrl?: string;
  /** Verified "from" sender for transactional mail (feedback → support@, R1-16). */
  senderEmail: string;
  senderName: string;
}

function positiveInt(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getBrevoConfig(): BrevoConfig {
  return {
    apiKey: process.env.BREVO_API_KEY || undefined,
    digestListId: positiveInt(process.env.BREVO_DIGEST_LIST_ID),
    followListId: positiveInt(process.env.BREVO_FOLLOW_LIST_ID),
    hostListId: positiveInt(process.env.BREVO_HOST_LIST_ID),
    // Shared confirmation template across digest/follow/host captures.
    doiTemplateId: positiveInt(process.env.BREVO_DOI_TEMPLATE_ID),
    doiRedirectUrl: process.env.BREVO_DOI_REDIRECT_URL || undefined,
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'no-reply@beecompete.com',
    senderName: process.env.BREVO_SENDER_NAME || 'BeeCompete',
  };
}

/** Brevo can send transactional mail (feedback, R1-16) as soon as the API key is set. */
export function brevoEmailEnabled(cfg: BrevoConfig): boolean {
  return Boolean(cfg.apiKey);
}

/**
 * Send one transactional email via Brevo (v3 /smtp/email). Used for the in-app feedback report
 * (R1-16) → support@. The `from` must be a VERIFIED sender/domain in Brevo or the send 4xxs.
 * Throws on a non-2xx so the caller can show a generic error.
 */
export async function sendTransactionalEmail(
  cfg: BrevoConfig,
  {
    to,
    subject,
    textContent,
    replyToEmail,
  }: { to: string; subject: string; textContent: string; replyToEmail?: string },
): Promise<void> {
  if (!cfg.apiKey) throw new Error('Brevo is not configured');

  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: cfg.senderEmail, name: cfg.senderName },
      to: [{ email: to }],
      subject,
      textContent,
      ...(replyToEmail ? { replyTo: { email: replyToEmail } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Brevo send failed: ${res.status}`);
}

/** Wired enough to subscribe to a specific list (needs a key + that list id). */
export function brevoListEnabled(cfg: BrevoConfig, listId: number | undefined): listId is number {
  return Boolean(cfg.apiKey && listId);
}

export type SubscribeResult = 'confirm' | 'subscribed';

/**
 * Add a contact to a Brevo list. Returns 'confirm' when a double-opt-in email was sent (the
 * contact isn't on the list until they click) or 'subscribed' for single opt-in. Throws on a
 * non-2xx Brevo response so the caller can show a generic error.
 *
 * `attributes` must be pre-created in the Brevo account (e.g. GRADE, INTEREST, STATE, COMPETITION)
 * — Brevo rejects unknown attributes. Callers should omit empty values.
 */
export async function subscribeToBrevoList(
  cfg: BrevoConfig,
  {
    email,
    listId,
    attributes = {},
  }: { email: string; listId: number; attributes?: Record<string, string> },
): Promise<SubscribeResult> {
  if (!cfg.apiKey) throw new Error('Brevo is not configured');

  const headers = {
    'api-key': cfg.apiKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const hasAttributes = Object.keys(attributes).length > 0;

  // Double opt-in when a template is configured — preferred for a minors-adjacent audience.
  if (cfg.doiTemplateId) {
    const res = await fetch(`${BREVO_BASE}/contacts/doubleOptinConfirmation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        includeListIds: [listId],
        templateId: cfg.doiTemplateId,
        redirectionUrl: cfg.doiRedirectUrl ?? 'https://beecompete.com/',
        ...(hasAttributes ? { attributes } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Brevo DOI failed: ${res.status}`);
    return 'confirm';
  }

  // Single opt-in fallback: create/update the contact directly on the list.
  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      ...(hasAttributes ? { attributes } : {}),
    }),
  });
  // 201 created, 204 updated — both fine.
  if (!res.ok) throw new Error(`Brevo contact create failed: ${res.status}`);
  return 'subscribed';
}
