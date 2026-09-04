import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { ImportRecordMeta } from '@/components/admin/import-record-meta';
import { ImportReview } from '@/components/admin/import-review';
import { ReviewOutcome } from '@/components/admin/review-outcome';
import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { importSeedWarnings, splitImportPayload } from '@/lib/import-seed';
import type {
  Category,
  CategoryTemplate,
  ImportRecord,
  Organization,
  Page,
  Region,
} from '@/lib/admin-types';

/** Fetches by id (any status) — deep links + back-after-decision always resolve; reviewed
 * records render a read-only outcome panel instead of the review form. */
export default async function ReviewImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record: ImportRecord;
  try {
    record = await adminFetch<ImportRecord>(`/import-records/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }

  if (record.status !== 'PENDING') {
    return (
      <>
        <BackLink />
        <PageHeader title="Import record" />
        <div className="grid gap-6">
          <ReviewOutcome status={record.status} note={record.note} reviewedAt={record.reviewedAt} />
          <ImportRecordMeta record={record} />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Payload as reviewed{record.status === 'APPROVED' ? ' (created the competition)' : ''}
            </h2>
            <pre className="overflow-x-auto rounded-[var(--radius-panel)] border border-border p-4 font-mono text-xs">
              {JSON.stringify(record.payload, null, 2)}
            </pre>
          </div>
        </div>
      </>
    );
  }

  // Read the extraction into form values server-side: the mapping is pure, so doing it here keeps
  // the client component free of payload-shape logic and the seed ships with the HTML.
  const seed = splitImportPayload(record.payload);
  const warnings = importSeedWarnings(record.payload, seed);

  // Everything the competition form needs, plus the one lookup only review needs: organizations
  // matching the extracted organizer name (the raw tab's resolve-or-create panel). The duplicate
  // verdict rides on the record itself (DQ4). Fetched in parallel — the review screen is one
  // round trip.
  const [categories, templates, organizations, regions, organizerMatches] = await Promise.all([
    adminFetch<Category[]>('/categories'),
    adminFetch<CategoryTemplate[]>('/categories/templates'),
    adminFetch<Page<Organization>>('/organizations?size=200'),
    adminFetch<Region[]>('/regions'),
    findOrganizerMatches(seed.organizerName),
  ]);

  return (
    <>
      <BackLink />
      <PageHeader
        title="Review import"
        description="The listing form, pre-filled from the extraction. Approving creates the competition."
      />
      <ImportReview
        record={record}
        seed={seed}
        warnings={warnings}
        duplicates={record.duplicates}
        categories={categories}
        organizations={organizations.content}
        templates={templates}
        regions={regions}
        initialOrganizerMatches={organizerMatches}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/import-records"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" /> Import queue
    </Link>
  );
}

/** Non-fatal on failure — the raw tab falls back to "a new organization will be created". */
async function findOrganizerMatches(name: string | null): Promise<Organization[]> {
  if (!name) return [];
  try {
    const orgs = await adminFetch<Page<Organization>>(
      `/organizations?query=${encodeURIComponent(name)}&size=10`,
    );
    return orgs.content;
  } catch {
    return [];
  }
}
