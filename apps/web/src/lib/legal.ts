// Cross-page constants for the legal surface (R1-12: Privacy · Terms · Cookies · Affiliate
// Disclosure). Kept server-safe (no JSX) so it's importable from footer, sitemap, and pages alike.
//
// ⚠️ COMPLIANCE (🔒): these pages are honest pre-launch DRAFTS scoped to the R1 browse-only
// marketplace (no accounts, no PII, no payments). They are NOT legal advice and MUST be reviewed
// by a qualified privacy attorney before the R1-17 launch gate flips the site public — see
// compliance.md §"Launch compliance gate" (#1 legal pages live, #6 attorney review) and
// docs/phase-1-plan.md R1-17. The account/consent/payments language belongs to R2 and is
// deliberately out of scope here.

/** Inbound support address (Cloudflare Email Routing → Gmail; architecture.md §Email). A
 *  dedicated privacy@ / legal@ alias can be pointed at the same inbox before launch. */
export const LEGAL_CONTACT_EMAIL = 'support@beecompete.com';

/** How the service refers to itself. TODO(R1-17): replace with the operating entity's legal name
 *  once the LLC is formed (setup-runbook §1b — entity is a pre-launch, pre-R2 requirement). */
export const OPERATING_ENTITY = 'BeeCompete';

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
