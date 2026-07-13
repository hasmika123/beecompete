import { ReviewStatusBadge } from '@/components/admin/status-badges';
import { formatInZone } from '@/lib/dates';

/**
 * Read-only outcome panel for a reviewed queue record (import or correction): status badge +
 * reviewed date + the review note. Deep links to non-PENDING records land here instead of a
 * 404 (sweep item 1 — the queue detail pages fetch by id for ANY status).
 */
export function ReviewOutcome({
  status,
  note,
  reviewedAt,
}: {
  status: string;
  note: string | null;
  reviewedAt: string | null;
}) {
  return (
    <section
      aria-label="Review outcome"
      className="grid gap-2 rounded-[var(--radius-panel)] border border-border bg-surface p-4 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ReviewStatusBadge status={status} />
        {reviewedAt && (
          <span className="text-xs text-muted">Reviewed {formatInZone(reviewedAt)}</span>
        )}
      </div>
      {note && <p className="whitespace-pre-wrap text-muted">{note}</p>}
    </section>
  );
}
