import Link from 'next/link';
import { ArrowLeft, ArrowRight, buttonClasses, Input, Plus, Search } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { ArchivedBadge, VerificationBadge } from '@/components/admin/status-badges';
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

      <form className="mb-4 flex max-w-sm items-center gap-2" role="search">
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
          {
            header: 'Verification',
            cell: (c) => <VerificationBadge state={c.verificationState} />,
          },
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

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {result.number + 1} of {result.totalPages}
          </span>
          <div className="flex gap-2">
            {result.number > 0 && (
              <Link
                href={buildHref(result.number - 1)}
                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Prev
              </Link>
            )}
            {result.number < result.totalPages - 1 && (
              <Link
                href={buildHref(result.number + 1)}
                className={buttonClasses({ variant: 'secondary', size: 'sm' })}
              >
                Next <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
