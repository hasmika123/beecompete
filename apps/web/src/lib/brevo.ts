// Brevo (email) integration for the weekly-digest signup (R1-15). Server-only — the API key is a
// secret and must never reach the browser (so these are plain env vars, never NEXT_PUBLIC_*).
// Inert without config: the digest server action falls back to a friendly "opening soon" message
// when Brevo isn't wired, so local/CI/pre-launch stay side-effect-free (same posture as analytics).
//
// COMPLIANCE: the digest is pitched to parents/educators/16+ (a K-12-directed newsletter to a child
// would trigger COPPA). We default to Brevo DOUBLE OPT-IN when a DOI template is configured — the
// subscriber must click a confirmation email before anything is stored on the list, which is both
// the consent record (CAN-SPAM / prudent COPPA posture) and good deliverability hygiene.

const BREVO_BASE = 'https://api.brevo.com/v3';

export interface BrevoConfig {
  apiKey?: string;
  digestListId?: number;
  /** When set, subscribe via double opt-in using this Brevo DOI template. */
  doiTemplateId?: number;
  /** Where Brevo sends the subscriber after they confirm (defaults to the site root). */
  doiRedirectUrl?: string;
}

export function getBrevoConfig(): BrevoConfig {
  const listId = Number(process.env.BREVO_DIGEST_LIST_ID);
  const templateId = Number(process.env.BREVO_DIGEST_DOI_TEMPLATE_ID);
  return {
    apiKey: process.env.BREVO_API_KEY || undefined,
    digestListId: Number.isFinite(listId) && listId > 0 ? listId : undefined,
    doiTemplateId: Number.isFinite(templateId) && templateId > 0 ? templateId : undefined,
    doiRedirectUrl: process.env.BREVO_DOI_REDIRECT_URL || undefined,
  };
}

/** Wired enough to subscribe (needs a key + a target list). */
export function brevoEnabled(cfg: BrevoConfig): boolean {
  return Boolean(cfg.apiKey && cfg.digestListId);
}

export type SubscribeResult = 'confirm' | 'subscribed';

/**
 * Add a contact to the digest list. Returns 'confirm' when a double-opt-in email was sent (the
 * contact isn't on the list until they click) or 'subscribed' for single opt-in. Throws on a
 * non-2xx Brevo response so the caller can show a generic error.
 *
 * `attributes` must be pre-created in the Brevo account (e.g. GRADE, INTEREST, STATE) — Brevo
 * rejects unknown attributes. Callers should omit empty values.
 */
export async function subscribeToDigest(
  cfg: BrevoConfig,
  { email, attributes }: { email: string; attributes: Record<string, string> },
): Promise<SubscribeResult> {
  if (!cfg.apiKey || !cfg.digestListId) throw new Error('Brevo is not configured');

  const headers = {
    'api-key': cfg.apiKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const hasAttributes = Object.keys(attributes).length > 0;

  // Double opt-in when a template is configured — preferred for a minors-adjacent newsletter.
  if (cfg.doiTemplateId) {
    const res = await fetch(`${BREVO_BASE}/contacts/doubleOptinConfirmation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        includeListIds: [cfg.digestListId],
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
      listIds: [cfg.digestListId],
      updateEnabled: true,
      ...(hasAttributes ? { attributes } : {}),
    }),
  });
  // 201 created, 204 updated — both fine.
  if (!res.ok) throw new Error(`Brevo contact create failed: ${res.status}`);
  return 'subscribed';
}
