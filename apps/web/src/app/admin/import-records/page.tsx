import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { ReviewStatusBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { ImportRecord, Page } from '@/lib/admin-types';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export default async function ImportRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as string)
    : 'PENDING';
  const page = Math.max(0, Number(params.page ?? '0') || 0);
  const result = await adminFetch<Page<ImportRecord>>(
    `/import-records?status=${status}&page=${page}&size=50`,
  );

  const title = (payload: Record<string, unknown>) =>
    (typeof payload.name === 'string' && payload.name) ||
    (typeof payload.slug === 'string' && payload.slug) ||
    '(untitled)';

  return (
    <>
      <PageHeader
        title="Import queue"
        description="Review records extracted by the pipeline (S3)."
      />

      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/import-records?status=${s}`}
            className={buttonClasses({
              variant: s === status ? 'primary' : 'secondary',
              size: 'sm',
            })}
          >
            {s.toLowerCase()}
          </Link>
        ))}
      </div>

      <AdminTable
        rows={result.content}
        rowKey={(r) => r.id}
        empty={`No ${status.toLowerCase()} records.`}
        columns={[
          {
            header: 'Record',
            // Every status links — reviewed records open the read-only outcome view.
            cell: (r) => (
              <Link href={`/admin/import-records/${r.id}`} className="font-medium hover:underline">
                {title(r.payload)}
              </Link>
            ),
          },
          {
            header: 'Confidence',
            cell: (r) => <span className="text-muted">{r.confidence ?? '—'}</span>,
          },
          { header: 'Status', cell: (r) => <ReviewStatusBadge status={r.status} /> },
          {
            header: 'Submitted',
            align: 'right',
            cell: (r) => (
              <span className="text-xs text-muted">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            ),
          },
        ]}
      />

      <AdminPagination
        page={result.number}
        totalPages={result.totalPages}
        hrefFor={(p) => `/admin/import-records?status=${status}&page=${p}`}
      />
    </>
  );
}
