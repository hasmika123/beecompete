import type { Competition, Edition, Faq, Resource } from '@/lib/admin-types';

// Derived "is this listing complete?" checklist for the admin competition page (A4). Purely
// informational — never blocks a save. Answers the owner's "should organizer/deadline be
// required?" as UX (a visible nudge) rather than a hard constraint: organizer must stay nullable
// (imports start unattributed) and deadlines live on Edition key dates, not the competition.
//
// v1 uses only data the page already fetches (competition + editions + faqs + resources). The
// per-edition "has a deadline key date" + "has a region" checks need the edition-list payload to
// carry a key-date/region summary (a small API add) — tracked as a follow-up, not done here.

export interface HealthCheck {
  key: string;
  label: string;
  ok: boolean;
}

export function listingHealth(
  competition: Competition,
  editions: Edition[],
  faqs: Faq[],
  resources: Resource[],
): HealthCheck[] {
  const liveEditions = editions.filter((e) => e.archivedAt == null);
  return [
    { key: 'organizer', label: 'Organizer attributed', ok: competition.organizerOrgId != null },
    { key: 'summary', label: 'Card summary written', ok: Boolean(competition.summary) },
    { key: 'description', label: 'Full description written', ok: Boolean(competition.description) },
    { key: 'edition', label: 'At least one active edition', ok: liveEditions.length > 0 },
    {
      key: 'regUrl',
      label: 'An edition has a registration URL',
      ok: liveEditions.some((e) => Boolean(e.registrationUrl)),
    },
    { key: 'faq', label: 'At least one FAQ', ok: faqs.length > 0 },
    { key: 'resources', label: 'At least one prep resource', ok: resources.length > 0 },
  ];
}
