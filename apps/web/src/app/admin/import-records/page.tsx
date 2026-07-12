import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { ImportStatusBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { ImportRecord, Page } from '@/lib/admin-types';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export default async function ImportRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as string)
    : 'PENDING';
  const result = await adminFetch<Page<ImportRecord>>(`/import-records?status=${status}&size=50`);

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
            cell: (r) =>
              status === 'PENDING' ? (
                <Link
                  href={`/admin/import-records/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {title(r.payload)}
                </Link>
              ) : (
                <span className="font-medium">{title(r.payload)}</span>
              ),
          },
          {
            header: 'Confidence',
            cell: (r) => <span className="text-muted">{r.confidence ?? '—'}</span>,
          },
          { header: 'Status', cell: (r) => <ImportStatusBadge status={r.status} /> },
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
    </>
  );
}
