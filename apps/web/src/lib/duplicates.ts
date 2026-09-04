import type {
  CompetitionDuplicates,
  DuplicateCandidate,
  ImportRecord,
  MatchReason,
  OrganizationCandidate,
} from '@/lib/admin-types';

/**
 * Duplicate detection, the web half (DQ4, docs/duplicate-detection-plan.md). The API decides what
 * IS a candidate; this module decides how each verdict reads — badge copy, what blocks a bulk
 * approve, whether the "not a duplicate" checkbox can help at all.
 */

/** How a match reason reads to a curator. */
export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  NAME_EXACT: 'same name',
  URL_EXACT: 'same official URL',
  DOMAIN_EXACT: 'same website',
  NAME_SIMILAR: 'similar name',
  SLUG_TAKEN: 'slug already taken',
};

export function describeReasons(reasons: MatchReason[]): string {
  return reasons.map((r) => MATCH_REASON_LABELS[r] ?? r.toLowerCase()).join(' · ');
}

/**
 * The one verdict the server refuses outright, override or not: a LIVE listing (or organization)
 * with the same normalized name. Everything else is a soft signal a curator can wave through.
 */
export function isLiveNameMatch(
  candidate: Pick<DuplicateCandidate, 'archivedAt' | 'reasons'> | null | undefined,
): boolean {
  return (
    candidate != null && candidate.archivedAt === null && candidate.reasons.includes('NAME_EXACT')
  );
}

/** The strongest candidate that would stop a save cold, if any. */
export function hardCompetitionMatch(
  duplicates: CompetitionDuplicates | null | undefined,
): DuplicateCandidate | null {
  return duplicates?.catalog.find(isLiveNameMatch) ?? null;
}

export function hardOrganizationMatch(
  candidates: OrganizationCandidate[] | null | undefined,
): OrganizationCandidate | null {
  return candidates?.find(isLiveNameMatch) ?? null;
}

export interface QueueDuplicateBadge {
  label: string;
  variant: 'danger' | 'gold';
}

/**
 * The queue row's one-glance flag, from the strongest match the list computed. Red = approving
 * as-is fails (a live same-name listing, or the slug is taken); gold = worth a look, and the
 * review form can confirm it through.
 */
export function queueDuplicateBadge(
  record: Pick<ImportRecord, 'duplicate'>,
): QueueDuplicateBadge | null {
  const d = record.duplicate;
  if (!d) return null;
  if (isLiveNameMatch(d)) return { label: 'already listed', variant: 'danger' };
  if (d.reasons.includes('SLUG_TAKEN')) return { label: 'slug taken', variant: 'danger' };
  if (d.reasons.includes('NAME_EXACT'))
    return { label: 'listed before (archived)', variant: 'gold' };
  if (d.reasons.includes('URL_EXACT')) return { label: 'same URL as a listing', variant: 'gold' };
  return { label: 'similar listing', variant: 'gold' };
}

/**
 * Whether a bulk approve — which skips the review form, and so can never carry the curator's
 * "not a duplicate" — would fail for this row. Any catalog match does it: the hard ones are a
 * 409 outright, the soft ones a 422 without the confirmation only the form can give.
 */
export function blocksBulkApprove(record: Pick<ImportRecord, 'duplicate'>): boolean {
  return record.duplicate !== null;
}
