import Link from 'next/link';
import { buttonClasses, Input, Plus, Search } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminTable } from '@/components/admin/admin-table';
import { ListingStatusBadge, MissingEditionBadge } from '@/components/admin/status-badges';
import { adminFetch } from '@/lib/admin-api';
import { formatDate } from '@/lib/dates';
import type { Competition, Page } from '@/lib/admin-types';

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string; missingEdition?: string }>;
}) {
  const params = await searchParams;
  const query = params.query ?? '';
  const page = Math.max(0, Number(params.page ?? '0') || 0);
  // Zombie filter: listings with no live edition, which the readiness gate hides publicly. Only
  // import approve can create one (the create form posts /competitions/with-edition), so this is
  // where that debt surfaces.
  const missingEdition = params.missingEdition === '1';
  const result = await adminFetch<Page<Competition>>(
    `/competitions?query=${encodeURIComponent(query)}&page=${page}&size=25` +
      (missingEdition ? '&missingEdition=true' : ''),
  );

  const buildHref = (p: number) =>
    `/admin/competitions?query=${encodeURIComponent(query)}&page=${p}` +
    (missingEdition ? '&missingEdition=1' : '');

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
        {missingEdition && <input type="hidden" name="missingEdition" value="1" />}
        <button type="submit" className={buttonClasses({ size: 'sm' })}>
          Search
        </button>
        {(query || missingEdition) && (
          <Link
            href="/admin/competitions"
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mb-4">
        <Link
          href={
            missingEdition
              ? `/admin/competitions?query=${encodeURIComponent(query)}`
              : `/admin/competitions?query=${encodeURIComponent(query)}&missingEdition=1`
          }
          className={buttonClasses({
            variant: missingEdition ? 'primary' : 'secondary',
            size: 'sm',
          })}
          aria-pressed={missingEdition}
        >
          Missing an edition
        </Link>
      </div>

      <AdminTable
        rows={result.content}
        rowKey={(c) => c.id}
        empty={
          missingEdition
            ? 'Every listing here has a live edition — nothing hidden by the readiness gate.'
            : query
              ? `No competitions match “${query}”.`
              : 'No competitions yet.'
        }
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
            header: 'State',
            cell: (c) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <ListingStatusBadge listingStatus={c.listingStatus} archivedAt={c.archivedAt} />
                <MissingEditionBadge hasLiveEdition={c.hasLiveEdition} />
              </span>
            ),
          },
          {
            header: 'Updated',
            align: 'right',
            cell: (c) => <span className="text-xs text-muted">{formatDate(c.updatedAt)}</span>,
          },
        ]}
      />

      <AdminPagination page={result.number} totalPages={result.totalPages} hrefFor={buildHref} />
    </>
  );
}
