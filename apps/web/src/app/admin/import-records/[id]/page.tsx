import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ImportReview } from '@/components/admin/import-review';
import { ReviewOutcome } from '@/components/admin/review-outcome';
import { ImportOriginBadge } from '@/components/admin/status-badges';
import { AdminApiError, adminFetch } from '@/lib/admin-api';
import type { ImportRecord, Organization, Page } from '@/lib/admin-types';

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

  // Resolve-or-create: pre-fetch organizations matching the extracted organizerName so the review
  // panel can show "will be reused" vs "will be created" without a client round-trip. Only when the
  // payload names an organizer but hasn't already been resolved to an org id.
  const payload = record.payload as Record<string, unknown>;
  const organizerName = typeof payload.organizerName === 'string' ? payload.organizerName : null;
  const organizerOrgId = typeof payload.organizerOrgId === 'string' ? payload.organizerOrgId : null;
  let organizerMatches: Organization[] = [];
  if (pending && organizerName && !organizerOrgId) {
    try {
      const orgs = await adminFetch<Page<Organization>>(
        `/organizations?query=${encodeURIComponent(organizerName)}&size=10`,
      );
      organizerMatches = orgs.content;
    } catch {
      // Non-fatal — the panel falls back to "a new organization will be created".
    }
  }

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
        <ImportReview record={record} initialOrganizerMatches={organizerMatches} />
      ) : (
        <div className="grid gap-6">
          <ReviewOutcome status={record.status} note={record.note} reviewedAt={record.reviewedAt} />
          <dl className="grid gap-1 text-sm">
            {/* Origin survives review (the approve path overwrites the note, so this is the only
                remaining user-request-vs-pipeline signal on reviewed records). */}
            <div className="flex items-center gap-2">
              <dt className="text-muted">Origin:</dt>
              <dd>
                <ImportOriginBadge origin={record.origin} />
              </dd>
            </div>
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
