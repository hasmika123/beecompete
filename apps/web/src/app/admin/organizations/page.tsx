import Link from 'next/link';
import { buttonClasses, Plus } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { enumLabel } from '@/components/admin/native-select';
import { ArchivedBadge, VerificationBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { Organization, Page } from '@/lib/admin-types';

export default async function OrganizationsPage() {
  const result = await adminFetch<Page<Organization>>('/organizations?size=100');
  return (
    <>
      <PageHeader
        title="Organizations"
        description={`${result.totalElements} total`}
        actions={
          <Link href="/admin/organizations/new" className={buttonClasses({ size: 'sm' })}>
            <Plus aria-hidden="true" className="size-4" /> New
          </Link>
        }
      />
      <AdminTable
        rows={result.content}
        rowKey={(o) => o.id}
        empty="No organizations yet."
        columns={[
          {
            header: 'Name',
            cell: (o) => (
              <Link href={`/admin/organizations/${o.id}`} className="font-medium hover:underline">
                {o.name}
              </Link>
            ),
          },
          {
            header: 'Type',
            cell: (o) => <span className="text-muted">{enumLabel(o.type)}</span>,
          },
          { header: 'Domain', cell: (o) => <span className="text-muted">{o.domain ?? '—'}</span> },
          {
            header: 'Verification',
            cell: (o) => <VerificationBadge state={o.verificationState} />,
          },
          { header: 'State', cell: (o) => <ArchivedBadge archivedAt={o.archivedAt} /> },
        ]}
      />
    </>
  );
}
