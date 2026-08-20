/**
 * Pure helpers behind the import-review Edition & timeline panel (S3 v1, phase 3).
 *
 * They live here rather than inside the component so the rules that actually matter — which
 * milestones count as a deadline, and what "TBD" means — are unit-testable without a DOM, matching
 * how the rest of apps/web is tested.
 */

/**
 * The card and search read a listing's deadline from REG_CLOSE, falling back to SUBMISSION_DUE
 * (blueprint #31). A timeline without one of these shows no deadline at all, which is the single
 * most useful thing to tell a curator before they approve.
 */
export const DEADLINE_KEY_DATE_TYPES = ['REG_CLOSE', 'SUBMISSION_DUE'] as const;

/** A key-date row as it arrives in an untrusted extracted payload — every field may be anything. */
export interface RawKeyDateRow {
  type?: unknown;
  label?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  timezone?: unknown;
}

/** Non-empty string, or null. Extraction payloads are untyped JSON, so everything is checked. */
export function asText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Converts an ISO instant to a `datetime-local` input value in the BROWSER's zone, or '' when the
 * date is TBD/unparseable. Deliberately lossy about zone: the input edits wall-clock time locally
 * and the caller stores an absolute instant, which is why the panel states whose clock it means.
 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses a `datetime-local` value into an ISO instant; null for '' (TBD) or garbage. */
export function fromLocalInputValue(local: string): string | null {
  if (local === '') return null;
  const ms = Date.parse(local);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export interface TimelineFlags {
  /** No REG_CLOSE / SUBMISSION_DUE row — the listing will show no deadline anywhere. */
  missingDeadline: boolean;
  /**
   * Every row is undated. NOT a defect: it is the correct extraction for a page that announces
   * milestones without dating them, since the pipeline emits TBD rather than guessing. It does mean
   * a human has to go find the dates.
   */
  allTbd: boolean;
}

/** Review flags for an extracted timeline. Rows with a non-string `type` are ignored as unusable. */
export function timelineFlags(rows: RawKeyDateRow[]): TimelineFlags {
  const typed = rows.filter((r) => r != null && typeof r.type === 'string');
  return {
    missingDeadline: !typed.some((r) =>
      (DEADLINE_KEY_DATE_TYPES as readonly string[]).includes(r.type as string),
    ),
    allTbd: typed.length > 0 && typed.every((r) => asText(r.startsAt) === null),
  };
}
