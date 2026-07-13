import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ImportReview } from '@/components/admin/import-review';
import { ReviewOutcome } from '@/components/admin/review-outcome';
import { AdminApiError, adminFetch } from '@/lib/admin-api';
import type { ImportRecord } from '@/lib/admin-types';

/** Fetches by id (any status) — deep links + back-after-decision always resolve; reviewed
 * records render a read-only outcome panel instead of the review form. */
export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record: ImportRecord;
  try {
    record = await adminFetch<ImportRecord>(`/import-records/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }
  const pending = record.status === 'PENDING';

  return (
    <>
      <Link
        href="/admin/import-records"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Import queue
      </Link>
      <PageHeader title={pending ? 'Review import' : 'Import record'} />
      {pending ? (
        <ImportReview record={record} />
      ) : (
        <div className="grid gap-6">
          <ReviewOutcome status={record.status} note={record.note} reviewedAt={record.reviewedAt} />
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted">Source:</dt>
              <dd>
                {record.sourceUrl ? (
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {record.sourceUrl}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Confidence:</dt>
              <dd>{record.confidence ?? '—'}</dd>
            </div>
          </dl>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Payload as reviewed{record.status === 'APPROVED' ? ' (created the competition)' : ''}
            </h2>
            <pre className="overflow-x-auto rounded-[var(--radius-panel)] border border-border p-4 font-mono text-xs">
              {JSON.stringify(record.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
