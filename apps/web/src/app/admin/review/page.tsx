import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { ReviewListingActions } from '@/components/admin/review-listing-actions';
import { adminFetch } from '@/lib/admin-api';
import { formatDate } from '@/lib/dates';
import type { Competition, ImportRecord, Page } from '@/lib/admin-types';

// THE approval queue (§8a / item 14, owner-requested 2026-08-25): one page for everything waiting
// on a decision, from BOTH intake paths —
//   · listings a curator submitted for review (listing_status = IN_REVIEW; publish/send-back
//     happen right here — the listing itself is the review surface, its edit page one click away)
//   · queued imports (seeding pipeline + public suggestions; PENDING import_records — deep review
//     stays on the import screen, which pre-fills the full form from the payload)
// Deliberately a COMPOSED view, not a merged table: the two kinds keep their own machinery and
// this page just makes "what needs looking at" one URL instead of two.

export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage() {
  const [inReview, pendingImports] = await Promise.all([
    adminFetch<Page<Competition>>('/competitions?listingStatus=IN_REVIEW&size=100'),
    adminFetch<Page<ImportRecord>>('/import-records?status=PENDING&size=1'),
  ]);

  return (
    <>
      <PageHeader
        title="Review queue"
        description={`${inReview.totalElements} listing${inReview.totalElements === 1 ? '' : 's'} awaiting review · ${pendingImports.totalElements} pending import${pendingImports.totalElements === 1 ? '' : 's'}`}
      />

      <section aria-labelledby="review-listings" className="mb-8 grid gap-3">
        <h2 id="review-listings" className="text-sm font-semibold text-foreground">
          Listings submitted for review
        </h2>
        <AdminTable
          rows={inReview.content}
          rowKey={(c) => c.id}
          empty="Nothing waiting — listings submitted for review from the add-competition form land here."
          columns={[
            {
              header: 'Name',
              cell: (c) => (
                <Link href={`/admin/competitions/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
              ),
            },
            { header: 'Slug', cell: (c) => <span className="text-muted">{c.slug}</span> },
            {
              header: 'Submitted',
              cell: (c) => <span className="text-xs text-muted">{formatDate(c.updatedAt)}</span>,
            },
            {
              header: '',
              align: 'right',
              cell: (c) => <ReviewListingActions id={c.id} />,
            },
          ]}
        />
      </section>

      <section aria-labelledby="review-imports" className="grid gap-3">
        <h2 id="review-imports" className="text-sm font-semibold text-foreground">
          Imports awaiting approval
        </h2>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            {pendingImports.totalElements === 0
              ? 'The import queue is clear.'
              : `${pendingImports.totalElements} record${pendingImports.totalElements === 1 ? '' : 's'} from the seeding pipeline and public suggestions.`}
          </span>
          {pendingImports.totalElements > 0 && (
            <Link
              href="/admin/import-records?status=PENDING"
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              Review imports
            </Link>
          )}
        </p>
      </section>
    </>
  );
}
