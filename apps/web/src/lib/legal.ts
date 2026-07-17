// Cross-page constants for the legal surface (R1-12: Privacy · Terms · Cookies · Affiliate
// Disclosure). Kept server-safe (no JSX) so it's importable from footer, sitemap, and pages alike.
//
// ⚠️ COMPLIANCE (🔒): these pages are honest pre-launch DRAFTS scoped to the R1 browse-only
// marketplace (no accounts, no PII, no payments). They are NOT legal advice and MUST be reviewed
// by a qualified privacy attorney before the R1-17 launch gate flips the site public — see
// compliance.md §"Launch compliance gate" (#1 legal pages live, #6 attorney review) and
// docs/phase-1-plan.md R1-17. The account/consent/payments language belongs to R2 and is
// deliberately out of scope here.
//
// ┌─ R1-17 GO-LIVE CHECKLIST (everything the legal surface needs is in THIS file) ──────────────┐
// │ 1. OPERATING_ENTITY   → set to the LLC's registered legal name once formed.                 │
// │ 2. GOVERNING_LAW_STATE → set to the state of formation (Terms governing-law clause).        │
// │ 3. LEGAL_REVIEW_PENDING → flip to false AFTER counsel signs off (drops the "Draft" notice). │
// │ Then bump LEGAL_LAST_UPDATED. No page files need editing — they read these constants.       │
// └─────────────────────────────────────────────────────────────────────────────────────────────┘

/** Inbound support address (Cloudflare Email Routing → Gmail; architecture.md §Email). A
 *  dedicated privacy@ / legal@ alias can be pointed at the same inbox before launch. */
export const LEGAL_CONTACT_EMAIL = 'support@beecompete.com';

/** The operating entity's legal name — the party you contract with in the Terms and the owner of
 *  the site's IP. TODO(R1-17, checklist #1): set to the LLC's registered name once formed, e.g.
 *  'BeeCompete LLC' (setup-runbook §1b — entity is a pre-launch, pre-R2 requirement). Distinct
 *  from the BRAND name "BeeCompete", which stays as-is in product copy; the Terms establish
 *  "BeeCompete" as the short form for this entity. */
export const OPERATING_ENTITY = 'BeeCompete';

/** US state whose law governs the Terms and venues disputes. TODO(R1-17, checklist #2): set to the
 *  state of LLC formation, e.g. 'Delaware'. Left null until then — governingLawJurisdiction() falls
 *  back to neutral placeholder wording so the clause is never blank or wrong. */
export const GOVERNING_LAW_STATE: string | null = null;

/** The jurisdiction phrase for the Terms' governing-law clause. Resolves to the concrete state once
 *  GOVERNING_LAW_STATE is set; otherwise the honest placeholder. */
export function governingLawJurisdiction(): string {
  return GOVERNING_LAW_STATE
    ? `the State of ${GOVERNING_LAW_STATE}`
    : `the state in which ${OPERATING_ENTITY} is established`;
}

/** ISO date of the last substantive revision — shown as "Last updated" and bump on every edit. */
export const LEGAL_LAST_UPDATED = '2026-07-17';

/** True until a lawyer signs off (R1-17). Drives the on-page "under review" notice so the copy
 *  never silently reads as finalized before counsel has seen it. Flip to false at the launch gate. */
export const LEGAL_REVIEW_PENDING = true;

/** The four legal pages — the single source of truth for the footer's Legal column and each
 *  page's "related policies" cross-links. Icons are mapped in the LegalPage component (this
 *  module stays JSX-free so non-React callers like sitemap.ts can import it). */
export const LEGAL_PAGES = [
  { href: '/privacy', label: 'Privacy Policy', short: 'Privacy' },
  { href: '/terms', label: 'Terms of Use', short: 'Terms' },
  { href: '/cookies', label: 'Cookie Policy', short: 'Cookies' },
  { href: '/affiliate-disclosure', label: 'Affiliate Disclosure', short: 'Affiliate' },
] as const;

export type LegalPageLink = (typeof LEGAL_PAGES)[number];

/** "July 17, 2026" from an ISO date, rendered in UTC so it never drifts by the server's TZ. */
export function formatLegalDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
