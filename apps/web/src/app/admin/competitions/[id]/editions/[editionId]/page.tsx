import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Card, CardContent, CardHeader, CardTitle } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { EditionForm } from '@/components/admin/edition-form';
import { KeyDateManager } from '@/components/admin/key-date-manager';
import { RegionTagger } from '@/components/admin/region-tagger';
import { adminFetch, AdminApiError } from '@/lib/admin-api';
import type { Edition, KeyDate, Region } from '@/lib/admin-types';

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string; editionId: string }>;
}) {
  const { id, editionId } = await params;

  let edition: Edition;
  try {
    edition = await adminFetch<Edition>(`/editions/${editionId}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }

  const [keyDates, allRegions, selectedRegionIds] = await Promise.all([
    adminFetch<KeyDate[]>(`/editions/${editionId}/key-dates`),
    adminFetch<Region[]>('/regions'),
    adminFetch<string[]>(`/editions/${editionId}/regions`),
  ]);

  return (
    <>
      <Link
        href={`/admin/competitions/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to competition
      </Link>
      <PageHeader title={`Edition — ${edition.cycleLabel}`} />

      <div className="grid gap-6">
        <EditionForm competitionId={id} edition={edition} />

        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <KeyDateManager competitionId={id} editionId={editionId} keyDates={keyDates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-0">
            <CardTitle>Regions</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <RegionTagger
              competitionId={id}
              editionId={editionId}
              allRegions={allRegions}
              selectedIds={selectedRegionIds}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
