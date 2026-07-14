import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { ReviewStatusBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import { formatDate } from '@/lib/dates';
import type { CorrectionProposal, Page } from '@/lib/admin-types';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as string)
    : 'PENDING';
  const page = Math.max(0, Number(params.page ?? '0') || 0);
  const result = await adminFetch<Page<CorrectionProposal>>(
    `/corrections?status=${status}&page=${page}&size=50`,
  );

  return (
    <>
      <PageHeader
        title="Corrections"
        description="User-submitted fixes (public suggest-a-correction form). Approve applies the diff."
      />

      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/corrections?status=${s}`}
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
        empty={`No ${status.toLowerCase()} corrections.`}
        columns={[
          {
            header: 'Subject',
            // Name first (server-side join); the UUID demoted to the secondary line. Every
            // status links — reviewed proposals open the read-only outcome view.
            cell: (r) => (
              <span className="grid">
                <Link href={`/admin/corrections/${r.id}`} className="font-medium hover:underline">
                  {r.subjectName ?? '(subject removed)'}
                </Link>
                <span className="text-xs text-muted">
                  {r.subjectType.toLowerCase()} · {r.subjectId.slice(0, 8)}…
                </span>
              </span>
            ),
          },
          {
            header: 'Fields',
            cell: (r) => <span className="text-muted">{Object.keys(r.payload).join(', ')}</span>,
          },
          { header: 'Status', cell: (r) => <ReviewStatusBadge status={r.status} /> },
          {
            header: 'Submitted',
            align: 'right',
            cell: (r) => <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>,
          },
        ]}
      />

      <AdminPagination
        page={result.number}
        totalPages={result.totalPages}
        hrefFor={(p) => `/admin/corrections?status=${status}&page=${p}`}
      />
    </>
  );
}
