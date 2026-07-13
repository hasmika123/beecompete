import Link from 'next/link';
import { buttonClasses, Input, Plus, Search } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { enumLabel } from '@/components/admin/native-select';
import { ArchivedBadge, VerificationBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { Organization, Page } from '@/lib/admin-types';

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.query ?? '';
  const page = Math.max(0, Number(params.page ?? '0') || 0);
  const result = await adminFetch<Page<Organization>>(
    `/organizations?query=${encodeURIComponent(query)}&page=${page}&size=25`,
  );

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

      <form className="mb-4 flex max-w-md items-center gap-2" role="search">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            name="query"
            defaultValue={query}
            placeholder="Search by name…"
            aria-label="Search organizations"
            className="pl-9"
          />
        </div>
        <button type="submit" className={buttonClasses({ size: 'sm' })}>
          Search
        </button>
        {query && (
          <Link
            href="/admin/organizations"
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Clear
          </Link>
        )}
      </form>

      <AdminTable
        rows={result.content}
        rowKey={(o) => o.id}
        empty={query ? `No organizations match “${query}”.` : 'No organizations yet.'}
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

      <AdminPagination
        page={result.number}
        totalPages={result.totalPages}
        hrefFor={(p) => `/admin/organizations?query=${encodeURIComponent(query)}&page=${p}`}
      />
    </>
  );
}
