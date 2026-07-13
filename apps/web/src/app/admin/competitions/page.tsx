import Link from 'next/link';
import { buttonClasses, Input, Plus, Search } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { ArchivedBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import type { Competition, Page } from '@/lib/admin-types';

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.query ?? '';
  const page = Math.max(0, Number(params.page ?? '0') || 0);
  const result = await adminFetch<Page<Competition>>(
    `/competitions?query=${encodeURIComponent(query)}&page=${page}&size=25`,
  );

  const buildHref = (p: number) =>
    `/admin/competitions?query=${encodeURIComponent(query)}&page=${p}`;

  return (
    <>
      <PageHeader
        title="Competitions"
        description={`${result.totalElements} total`}
        actions={
          <Link href="/admin/competitions/new" className={buttonClasses({ size: 'sm' })}>
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
            aria-label="Search competitions"
            className="pl-9"
          />
        </div>
        <button type="submit" className={buttonClasses({ size: 'sm' })}>
          Search
        </button>
        {query && (
          <Link
            href="/admin/competitions"
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Clear
          </Link>
        )}
      </form>

      <AdminTable
        rows={result.content}
        rowKey={(c) => c.id}
        empty={query ? `No competitions match “${query}”.` : 'No competitions yet.'}
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
          { header: 'State', cell: (c) => <ArchivedBadge archivedAt={c.archivedAt} /> },
          {
            header: 'Updated',
            align: 'right',
            cell: (c) => (
              <span className="text-xs text-muted">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            ),
          },
        ]}
      />

      <AdminPagination page={result.number} totalPages={result.totalPages} hrefFor={buildHref} />
    </>
  );
}
