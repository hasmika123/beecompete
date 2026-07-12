import Link from 'next/link';
import { buttonClasses } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { ReviewStatusBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { CorrectionProposal, Page } from '@/lib/admin-types';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as string)
    : 'PENDING';
  const result = await adminFetch<Page<CorrectionProposal>>(
    `/corrections?status=${status}&size=50`,
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
            cell: (r) =>
              status === 'PENDING' ? (
                <Link href={`/admin/corrections/${r.id}`} className="font-medium hover:underline">
                  {r.subjectType.toLowerCase()} · {r.subjectId.slice(0, 8)}…
                </Link>
              ) : (
                <span className="font-medium">
                  {r.subjectType.toLowerCase()} · {r.subjectId.slice(0, 8)}…
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
