import { ExternalLink } from '@beecompete/ui';
import { ImportOriginBadge } from '@/components/admin/status-badges';
import { ConfidenceMeter } from '@/components/admin/confidence-meter';
import { formatDate } from '@/lib/dates';
import type { ImportRecord } from '@/lib/admin-types';

/**
 * Where a queued record came from — origin, source page, extraction confidence, when it landed.
 *
 * Shared by the review screen and the reviewed-record view so the provenance a curator judges by
 * is identical before and after the decision. Origin especially: the approve path overwrites the
 * note, so on a reviewed record this badge is the only remaining user-request-vs-pipeline signal.
 */
export function ImportRecordMeta({ record }: { record: ImportRecord }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <div className="flex items-center gap-2">
        <dt className="text-muted">Origin</dt>
        <dd>
          <ImportOriginBadge origin={record.origin} />
        </dd>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <dt className="text-muted">Source</dt>
        <dd className="min-w-0">
          {record.sourceUrl ? (
            <a
              href={record.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[38ch] items-center gap-1 truncate align-bottom hover:underline"
            >
              <span className="truncate">{record.sourceUrl}</span>
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
            </a>
          ) : (
            <span className="text-muted">–</span>
          )}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-muted">Confidence</dt>
        <dd>
          <ConfidenceMeter value={record.confidence} />
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-muted">Queued</dt>
        <dd className="text-muted">{formatDate(record.createdAt)}</dd>
      </div>
    </dl>
  );
}
