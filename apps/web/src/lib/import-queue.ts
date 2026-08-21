/**
 * Pure helpers for the import queue LIST: reading its URL params, and boiling an extracted payload
 * down to the few facts a curator triages on.
 *
 * The list exists to answer "which of these 400 rows do I open next?", and that answer comes from
 * things buried inside the JSON payload — did it get an edition, does it have a deadline, who runs
 * it. Pulling them out is the same untrusted-JSON reading as lib/import-seed, so it lives here with
 * tests rather than inline in the table.
 */

import { IMPORT_SORTS, type ImportSort } from '@/lib/admin-types';

export const IMPORT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ImportStatusFilter = (typeof IMPORT_STATUSES)[number];

export const IMPORT_ORIGINS = ['PIPELINE', 'USER_REQUEST'] as const;

/**
 * Sort is ONE url param (`sort=CONFIDENCE:desc`) rather than a key plus a direction, so the
 * dropdown offers whole orderings ("Confidence: highest first") instead of asking a curator to
 * assemble one out of two controls.
 */
export interface SortChoice {
  value: string;
  label: string;
  sort: ImportSort;
  desc: boolean;
}

export const SORT_CHOICES: SortChoice[] = [
  { value: 'CREATED_AT:asc', label: 'Oldest first (queue order)', sort: 'CREATED_AT', desc: false },
  { value: 'CREATED_AT:desc', label: 'Newest first', sort: 'CREATED_AT', desc: true },
  { value: 'CONFIDENCE:desc', label: 'Confidence: highest', sort: 'CONFIDENCE', desc: true },
  { value: 'CONFIDENCE:asc', label: 'Confidence: lowest', sort: 'CONFIDENCE', desc: false },
  { value: 'NAME:asc', label: 'Name A–Z', sort: 'NAME', desc: false },
  { value: 'NAME:desc', label: 'Name Z–A', sort: 'NAME', desc: true },
  { value: 'SOURCE_URL:asc', label: 'Source site', sort: 'SOURCE_URL', desc: false },
];

const DEFAULT_SORT = SORT_CHOICES[0] as SortChoice;

/** Unknown / absent values fall back to queue order rather than erroring on a hand-typed URL. */
export function parseSort(value: string | undefined): SortChoice {
  if (!value) return DEFAULT_SORT;
  const [key = '', dir = ''] = value.split(':');
  if (!(IMPORT_SORTS as readonly string[]).includes(key)) return DEFAULT_SORT;
  return (
    SORT_CHOICES.find((c) => c.sort === key && c.desc === (dir === 'desc')) ??
    SORT_CHOICES.find((c) => c.sort === key) ??
    DEFAULT_SORT
  );
}

export function parseStatus(value: string | undefined): ImportStatusFilter {
  return (IMPORT_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as ImportStatusFilter)
    : 'PENDING';
}

/** '' (all origins) is a legitimate choice, so this returns null rather than a default. */
export function parseOrigin(value: string | undefined): string | null {
  return (IMPORT_ORIGINS as readonly string[]).includes(value ?? '') ? (value as string) : null;
}

// --- row summary ------------------------------------------------------------------------------

/** The deadline the public card would show, or the fact that there isn't one. */
export type DeadlineSummary =
  { kind: 'none' } | { kind: 'tbd' } | { kind: 'dated'; startsAt: string; timezone: string | null };

export interface ImportRowSummary {
  /** Falls back to the slug, then a placeholder — the row still has to be openable. */
  title: string;
  slug: string | null;
  categoryId: string | null;
  organizerName: string | null;
  organizerOrgId: string | null;
  cycleLabel: string | null;
  hasEdition: boolean;
  keyDateCount: number;
  deadline: DeadlineSummary;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function summarizeImportRow(payload: Record<string, unknown>): ImportRowSummary {
  const edition =
    payload.edition !== null &&
    typeof payload.edition === 'object' &&
    !Array.isArray(payload.edition)
      ? (payload.edition as Record<string, unknown>)
      : null;
  const rows = Array.isArray(payload.keyDates)
    ? (payload.keyDates.filter(
        (r) => r !== null && typeof r === 'object' && !Array.isArray(r),
      ) as Record<string, unknown>[])
    : [];
  // REG_CLOSE first, SUBMISSION_DUE as the fallback — the same precedence the public card and
  // search use (blueprint #31), so what the queue previews is what would actually be published.
  const deadlineRow =
    rows.find((r) => text(r.type) === 'REG_CLOSE') ??
    rows.find((r) => text(r.type) === 'SUBMISSION_DUE') ??
    null;

  return {
    title: text(payload.name) ?? text(payload.slug) ?? '(untitled)',
    slug: text(payload.slug),
    categoryId: text(payload.categoryId),
    organizerName: text(payload.organizerName),
    organizerOrgId: text(payload.organizerOrgId),
    cycleLabel: edition ? text(edition.cycleLabel) : null,
    hasEdition: edition !== null,
    keyDateCount: rows.filter((r) => text(r.type) !== null).length,
    deadline: !deadlineRow
      ? { kind: 'none' }
      : text(deadlineRow.startsAt) === null
        ? { kind: 'tbd' }
        : {
            kind: 'dated',
            startsAt: text(deadlineRow.startsAt) as string,
            // No zone means the extractor gave a bare day as T00:00:00Z; reading that in Eastern
            // shows the previous calendar day, so the list renders it in UTC (same rule as review).
            timezone: text(deadlineRow.timezone) ?? 'UTC',
          },
  };
}
