// Brevo (email) integration. Server-only — the API key is a secret and must never reach the browser
// (so these are plain env vars, never NEXT_PUBLIC_*). Inert without config: each capture's server
// action falls back to a friendly "opening soon" when its list isn't wired, so local/CI/pre-launch
// stay side-effect-free (same posture as analytics).
//
// FOUR DISTINCT FLOWS (R1-15c), deliberately not one blended list:
//   1. Weekly Digest      → digest list       (R1-15)
//   2. Follow competition → follow list       (R1-15b, M29)
//   3. Host waitlist      → host waitlist list (H46)
//   4. Claim a listing    → admin INBOX, no list at all (H46 claim-interest, claim-actions.ts)
// (4) is transactional rather than a subscription because a claim is a 1:1 support conversation,
// not a broadcast audience — see claim-actions.ts for the full reasoning.
//
// COMPLIANCE: the reader-facing captures are pitched to parents/educators/16+ — unchanged by the
// 2026-08-25 repositioning away from "K-12 audience". The site is a general-audience catalog now,
// but the reason this framing exists never depended on that: an email capture aimed at a child
// under 13 triggers COPPA regardless of who the rest of the site is for, and we expect some
// under-13 visitors. Host captures use organizer framing. We default to Brevo
// DOUBLE OPT-IN when a DOI template is configured — the subscriber must click a confirmation email
// before anything is stored on the list, which is both the consent record (CAN-SPAM / prudent COPPA
// posture) and good deliverability hygiene.

import * as Sentry from '@sentry/nextjs';
import {
  addToAttributeList,
  encodeAttributeList,
  parseAttributeList,
  sanitizeEntry,
} from '@/lib/brevo-attribute-list';

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

// Shared email shape check for the capture/feedback actions (client-mirroring; Brevo does the
// authoritative validation). One spelling of "valid email" instead of a copy per action.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export interface BrevoConfig {
  apiKey?: string;
  /** Weekly digest list (R1-15). */
  digestListId?: number;
  /** Per-competition follow list (R1-15b, M29). */
  followListId?: number;
  /** General host waitlist — "host tools early access" (R1-15c, H46). */
  hostWaitlistListId?: number;
  /** When set, subscribe via double opt-in using this shared Brevo DOI template. */
  doiTemplateId?: number;
  /** Verified "from" sender for transactional mail (feedback → support@, R1-16). */
  senderEmail: string;
  senderName: string;
  /** True only when BREVO_SENDER_EMAIL was EXPLICITLY set (not the default) — the gate for feedback. */
  senderConfigured: boolean;
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
    // BREVO_HOST_LIST_ID is the pre-R1-15c name for what is now the host WAITLIST list. Kept as a
    // fallback so a deploy that lands before the VPS env is renamed doesn't silently un-wire the
    // capture (the contacts already on that list are host-interest signups either way).
    hostWaitlistListId:
      positiveInt(process.env.BREVO_HOST_WAITLIST_LIST_ID) ??
      positiveInt(process.env.BREVO_HOST_LIST_ID),
    // Shared confirmation template across all list captures. The post-confirm landing page is NOT
    // configured here — it's a per-call `redirectionUrl` (see postSubscribe), so each flow can send
    // the subscriber somewhere different using this one template.
    doiTemplateId: positiveInt(process.env.BREVO_DOI_TEMPLATE_ID),
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'no-reply@beecompete.com',
    senderName: process.env.BREVO_SENDER_NAME || 'BeeCompete',
    senderConfigured: Boolean(process.env.BREVO_SENDER_EMAIL),
  };
}

/**
 * Brevo can send transactional mail (feedback, R1-16) when there's a key AND an explicitly-set
 * sender. We require BREVO_SENDER_EMAIL rather than trusting the no-reply@ default, because Brevo
 * 4xxs a send from an unverified sender — so without this gate feedback would report itself "wired"
 * and then hard-fail every send. Unset sender → the form shows the "email support@ directly" inert
 * fallback instead (feedback is never silently lost).
 */
export function brevoEmailEnabled(cfg: BrevoConfig): boolean {
  return Boolean(cfg.apiKey && cfg.senderConfigured);
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

export type SubscribeResult =
  /** Double-opt-in email sent; nothing is stored until they click. */
  | 'confirm'
  /** Single opt-in — added to the list immediately. */
  | 'subscribed'
  /** Already a confirmed member of this list; a value was appended WITHOUT emailing them again. */
  | 'added'
  /** Already a confirmed member and the value was already recorded — nothing to do. */
  | 'already';

export interface BrevoContact {
  id: number;
  email: string;
  attributes: Record<string, unknown>;
  listIds: number[];
}

/**
 * Fetch one contact by email. Returns null when Brevo has never seen the address (404) — with
 * double opt-in that also covers "signed up but never clicked confirm", since the contact isn't
 * created until they do. Throws on any other non-2xx so the caller can decide how to degrade.
 */
export async function getBrevoContact(
  cfg: BrevoConfig,
  email: string,
): Promise<BrevoContact | null> {
  if (!cfg.apiKey) throw new Error('Brevo is not configured');

  const res = await fetch(`${BREVO_BASE}/contacts/${encodeURIComponent(email)}`, {
    headers: { 'api-key': cfg.apiKey, accept: 'application/json' },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Brevo get contact failed: ${res.status}`);

  const data = (await res.json()) as Partial<BrevoContact>;
  return {
    id: data.id ?? 0,
    email: data.email ?? email,
    attributes: data.attributes ?? {},
    listIds: data.listIds ?? [],
  };
}

/**
 * Update an existing contact's attributes and/or add it to lists. Sends NO email — which is the
 * whole point: someone who already double-opted into this list should not be re-confirmed just
 * because they followed a second competition. `listIds` ADDS lists (removal is `unlinkListIds`).
 */
export async function updateBrevoContact(
  cfg: BrevoConfig,
  email: string,
  { listIds, attributes }: { listIds?: number[]; attributes?: Record<string, string> },
): Promise<void> {
  if (!cfg.apiKey) throw new Error('Brevo is not configured');

  const res = await fetch(`${BREVO_BASE}/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: {
      'api-key': cfg.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      ...(listIds && listIds.length > 0 ? { listIds } : {}),
      ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
    }),
  });
  // 204 is the documented success for an update.
  if (!res.ok) throw new Error(`Brevo update contact failed: ${res.status}`);
}

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
    redirectUrl,
    attributes = {},
  }: { email: string; listId: number; redirectUrl: string; attributes?: Record<string, string> },
): Promise<SubscribeResult> {
  if (!cfg.apiKey) throw new Error('Brevo is not configured');
  const hasAttributes = Object.keys(attributes).length > 0;

  try {
    return await postSubscribe(
      cfg,
      email,
      listId,
      redirectUrl,
      hasAttributes ? attributes : undefined,
    );
  } catch (e) {
    // Attributes are sent inline, so a single unknown/mis-typed one (e.g. a COMPETITION attribute
    // never created in Brevo) 400s the WHOLE call. Don't lose a valid signup to a segmentation
    // field — retry once without attributes so the email is still captured, and log so the bad
    // attribute gets fixed. (No attributes → nothing to salvage, so rethrow.)
    if (!hasAttributes) throw e;
    reportBrevoError(`subscribe-attributes (retrying without) list=${listId}`, e);
    return await postSubscribe(cfg, email, listId, redirectUrl, undefined);
  }
}

/**
 * Subscribe to a list where one contact can accumulate MANY values in a single text attribute —
 * the per-competition Follow case, where a contact attribute's single slot would otherwise mean
 * each new follow silently overwrote the last.
 *
 * Reads the contact first and branches:
 *   - not a confirmed member of this list  → normal subscribe (double opt-in), carrying over any
 *     values they already had, so a digest subscriber's first follow still gets a consent record
 *     for the FOLLOW list specifically. Consent is per-list, so this must not be skipped.
 *   - already a confirmed member           → PUT the appended value. No email: their existing
 *     double opt-in already covers this list, so re-confirming would just be spam.
 *   - already a member AND already has it  → 'already', no write at all (handles double-submits
 *     and re-following the same competition).
 *
 * If the read fails (rate limit, transient network), we fall back to a plain subscribe rather than
 * dropping a real signup — that degrades to the old overwrite behaviour for this one call, which is
 * strictly better than losing the person.
 */
export async function subscribeWithAttributeList(
  cfg: BrevoConfig,
  {
    email,
    listId,
    redirectUrl,
    attribute,
    value,
  }: { email: string; listId: number; redirectUrl: string; attribute: string; value: string },
): Promise<SubscribeResult> {
  let existing: BrevoContact | null = null;
  try {
    existing = await getBrevoContact(cfg, email);
  } catch (e) {
    reportBrevoError(`get-contact (falling back to overwrite) list=${listId}`, e);
    return subscribeToBrevoList(cfg, {
      email,
      listId,
      redirectUrl,
      attributes: { [attribute]: encodeAttributeList([sanitizeEntry(value)]) },
    });
  }

  const current = parseAttributeList(existing?.attributes?.[attribute]);
  const next = addToAttributeList(current, value);

  // Not on this list yet (brand-new contact, or one who only ever joined a different list) → the
  // subscribe path, so this list gets its own consent record.
  if (!existing || !existing.listIds.includes(listId)) {
    return subscribeToBrevoList(cfg, {
      email,
      listId,
      redirectUrl,
      attributes: { [attribute]: encodeAttributeList(next) },
    });
  }

  // addToAttributeList returns the SAME array reference when the value was already present.
  if (next === current) return 'already';

  await updateBrevoContact(cfg, email, { attributes: { [attribute]: encodeAttributeList(next) } });
  return 'added';
}

/**
 * One subscribe POST (double opt-in when a template is configured, else single opt-in).
 *
 * `redirectUrl` is where Brevo drops the subscriber after they click confirm. It's a per-CALL
 * field, not a template setting — which is what lets all flows share one DOI template while each
 * lands on its own confirmation page (R1-15c).
 */
async function postSubscribe(
  cfg: BrevoConfig,
  email: string,
  listId: number,
  redirectUrl: string,
  attributes: Record<string, string> | undefined,
): Promise<SubscribeResult> {
  const headers = {
    'api-key': cfg.apiKey as string,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const attrs = attributes && Object.keys(attributes).length > 0 ? { attributes } : {};

  // Double opt-in when a template is configured — preferred for a minors-adjacent audience.
  if (cfg.doiTemplateId) {
    const res = await fetch(`${BREVO_BASE}/contacts/doubleOptinConfirmation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        includeListIds: [listId],
        templateId: cfg.doiTemplateId,
        redirectionUrl: redirectUrl,
        ...attrs,
      }),
    });
    if (!res.ok) throw new Error(`Brevo DOI failed: ${res.status}`);
    return 'confirm';
  }

  // Single opt-in fallback: create/update the contact directly on the list.
  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, listIds: [listId], updateEnabled: true, ...attrs }),
  });
  // 201 created, 204 updated — both fine.
  if (!res.ok) throw new Error(`Brevo contact create failed: ${res.status}`);
  return 'subscribed';
}
