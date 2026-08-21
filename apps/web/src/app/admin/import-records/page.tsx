import Link from 'next/link';
import { buttonClasses, Input, Search, Select } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { ImportQueueTable } from '@/components/admin/import-queue-table';
import { adminFetch } from '@/lib/admin-api';
import {
  IMPORT_STATUSES,
  SORT_CHOICES,
  parseOrigin,
  parseSort,
  parseStatus,
} from '@/lib/import-queue';
import type { Category, ImportRecord, Organization, Page } from '@/lib/admin-types';

const PAGE_SIZE = 50;

const ORIGIN_OPTIONS = [
  { value: '', label: 'Any origin' },
  { value: 'PIPELINE', label: 'Pipeline extraction' },
  { value: 'USER_REQUEST', label: 'User request' },
];

interface QueueParams {
  status?: string;
  origin?: string;
  query?: string;
  sort?: string;
  page?: string;
}

export default async function ImportRecordsPage({
  searchParams,
}: {
  searchParams: Promise<QueueParams>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const origin = parseOrigin(params.origin);
  const query = (params.query ?? '').trim();
  const sort = parseSort(params.sort);
  const page = Math.max(0, Number(params.page ?? '0') || 0);

  const search = new URLSearchParams({
    status,
    sort: sort.sort,
    desc: String(sort.desc),
    page: String(page),
    size: String(PAGE_SIZE),
  });
  if (origin) search.set('origin', origin);
  if (query) search.set('query', query);

  // The two lookups that turn ids in the payload into names in the table. Both are small,
  // fully-cached-per-request admin lists; the alternative is a column of UUIDs.
  const [result, counts, categories, organizations] = await Promise.all([
    adminFetch<Page<ImportRecord>>(`/import-records?${search}`),
    adminFetch<Record<string, number>>('/import-records/counts'),
    adminFetch<Category[]>('/categories'),
    adminFetch<Page<Organization>>('/organizations?size=200'),
  ]);

  const hrefFor = (over: Partial<QueueParams>) => {
    const next = new URLSearchParams();
    next.set('status', over.status ?? status);
    if (over.origin ?? origin) next.set('origin', (over.origin ?? origin) as string);
    if (over.query ?? query) next.set('query', (over.query ?? query) as string);
    if ((over.sort ?? sort.value) !== SORT_CHOICES[0]?.value)
      next.set('sort', over.sort ?? sort.value);
    if (over.page && over.page !== '0') next.set('page', over.page);
    return `/admin/import-records?${next}`;
  };
  const filtered = origin !== null || query !== '' || sort.value !== SORT_CHOICES[0]?.value;

  return (
    <>
      <PageHeader
        title="Import queue"
        description={`${result.totalElements} ${status.toLowerCase()} · review pipeline extractions (S3) and public competition requests (DQ15).`}
      />

      {/* Status tabs carry their queue depth: "how much is left" is the first thing a curator
          wants, and it also shows at a glance when a bulk run actually moved the needle. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {IMPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={hrefFor({ status: s, page: '0' })}
            aria-current={s === status ? 'page' : undefined}
            className={buttonClasses({
              variant: s === status ? 'primary' : 'secondary',
              size: 'sm',
            })}
          >
            {s.toLowerCase()}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* A plain GET form: filters live in the URL, so a curator's view is shareable, survives a
          reload after a decision, and needs no client state. */}
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            name="query"
            defaultValue={query}
            placeholder="Name, slug, organizer or source URL…"
            aria-label="Search the import queue"
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select
            name="origin"
            options={ORIGIN_OPTIONS}
            defaultValue={origin ?? ''}
            aria-label="Filter by origin"
          />
        </div>
        <div className="w-56">
          <Select
            name="sort"
            options={SORT_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
            defaultValue={sort.value}
            aria-label="Sort the queue"
          />
        </div>
        <button type="submit" className={buttonClasses({ size: 'sm' })}>
          Apply
        </button>
        {filtered && (
          <Link
            href={`/admin/import-records?status=${status}`}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Clear
          </Link>
        )}
      </form>

      <ImportQueueTable
        records={result.content}
        status={status}
        categories={categories}
        organizations={organizations.content}
      />

      <AdminPagination
        page={result.number}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor({ page: String(p) })}
      />
    </>
  );
}
