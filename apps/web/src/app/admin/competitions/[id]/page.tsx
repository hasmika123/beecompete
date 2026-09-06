import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ArrowLeft, ExternalLink } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { enumLabel } from '@/components/admin/enum-labels';
import { ListingStatusBadge } from '@/components/admin/status-badges';
import { CompetitionForm } from '@/components/admin/competition-form';
import { CompetitionHeaderActions } from '@/components/admin/competition-header-actions';
import { CreatedToast } from '@/components/admin/created-toast';
import { SeasonSwitcher } from '@/components/admin/season-switcher';
import { adminFetch, AdminApiError } from '@/lib/admin-api';
import { formatDate } from '@/lib/dates';
import { currentEdition, seedFromListing } from '@/lib/listing-seed';
import type {
  Category,
  CategoryTemplate,
  Competition,
  Edition,
  Faq,
  KeyDate,
  Organization,
  Page,
  Region,
  Resource,
} from '@/lib/admin-types';

/**
 * The listing page — and the review surface (owner 2026-09-05).
 *
 * It used to be four tabs (Details / Editions / FAQ / Resources) with the season a further click
 * away on its own page, so reviewing a submitted listing meant hunting for fields that the create
 * form had shown in one place. It is now the SAME stepper form the create flow uses, seeded with
 * the saved listing plus ONE season — its timeline, regions, awards — and the resources + FAQ
 * (`lib/listing-seed`), every row editable in place, with one save for all of it and the review
 * decision (publish / send back) riding on that save from the form's rail.
 *
 * WHICH season: `?season=<id>` picks one, `?season=new` seeds an empty one that the first save
 * creates, and no param means the newest live season (`currentEdition`). The switcher under the
 * title is the only navigation between them — every season, old or new, opens in this one form,
 * which is what retired the per-season page and its older field layout.
 */
export default async function EditCompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, { season: seasonParam }] = await Promise.all([params, searchParams]);

  let competition: Competition;
  try {
    competition = await adminFetch<Competition>(`/competitions/${id}`);
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  }

  const [categories, templates, organizations, regions, editions, faqs, resources, canonical] =
    await Promise.all([
      adminFetch<Category[]>('/categories'),
      adminFetch<CategoryTemplate[]>('/categories/templates'),
      adminFetch<Page<Organization>>('/organizations?size=200'),
      adminFetch<Region[]>('/regions'),
      adminFetch<Edition[]>(`/competitions/${id}/editions`),
      adminFetch<Faq[]>(`/competitions/${id}/faqs`),
      adminFetch<Resource[]>(`/competitions/${id}/resources`),
      // The listing this row was retired in favour of (DQ4 PR 2) — named in the banner below.
      competition.duplicateOfCompetitionId
        ? adminFetch<Competition>(`/competitions/${competition.duplicateOfCompetitionId}`).catch(
            () => null,
          )
        : Promise.resolve(null),
    ]);

  // The season the form edits. An unknown id falls back to the current season rather than 404ing:
  // a stale link to an archived-and-purged season should still land on the listing.
  const requested = typeof seasonParam === 'string' ? seasonParam : undefined;
  const adding = requested === 'new';
  const season = adding
    ? null
    : ((requested ? editions.find((e) => e.id === requested) : undefined) ??
      currentEdition(editions));
  const [keyDates, regionIds, organizer] = await Promise.all([
    season ? adminFetch<KeyDate[]>(`/editions/${season.id}/key-dates`) : Promise.resolve([]),
    season ? adminFetch<string[]>(`/editions/${season.id}/regions`) : Promise.resolve([]),
    // The organizer may sit past the first page of organizations; without it the dropdown would
    // open blank and the ring would claim the organizer is missing when it is not.
    competition.organizerOrgId &&
    !organizations.content.some((o) => o.id === competition.organizerOrgId)
      ? adminFetch<Organization>(`/organizations/${competition.organizerOrgId}`).catch(() => null)
      : Promise.resolve(null),
  ]);
  const organizationOptions = organizer
    ? [...organizations.content, organizer]
    : organizations.content;

  const seed = seedFromListing({
    competition,
    edition: season,
    keyDates,
    regionIds,
    resources,
    faqs,
  });

  return (
    <>
      {/* Announces the assigned public URL after a create — useSearchParams needs a boundary. */}
      <Suspense fallback={null}>
        <CreatedToast />
      </Suspense>
      <Link
        href="/admin/competitions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Competitions
      </Link>

      {/* R1-19: no competition-level verification badge — maintainer derives from the org. The
          public URL belongs HERE, not in the form: it is assigned, not edited, and only meaningful
          once the listing exists. This page is where a curator lands after create. */}
      <PageHeader
        title={competition.name}
        badge={
          <ListingStatusBadge
            listingStatus={competition.listingStatus}
            archivedAt={competition.archivedAt}
          />
        }
        meta={
          <>
            <span>
              {competition.provenanceSource
                ? enumLabel(competition.provenanceSource)
                : 'No provenance'}
            </span>
            <span aria-hidden="true">·</span>
            <a
              href={`/c/${competition.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs underline underline-offset-2 hover:text-foreground"
            >
              /c/{competition.slug}
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(opens the public listing in a new tab)</span>
            </a>
            <span aria-hidden="true">·</span>
            <span>Last changed {formatDate(competition.updatedAt)}</span>
          </>
        }
        actions={
          <CompetitionHeaderActions
            id={id}
            name={competition.name}
            archived={competition.archivedAt !== null}
            listingStatus={competition.listingStatus}
          />
        }
      />
      {competition.duplicateOfCompetitionId && (
        <Alert tone="warning" className="mb-6" title="Retired as a duplicate">
          This listing is archived and <code className="font-mono">/c/{competition.slug}</code>{' '}
          redirects permanently to{' '}
          {canonical ? (
            <Link
              href={`/admin/competitions/${canonical.id}`}
              className="font-medium underline underline-offset-2"
            >
              {canonical.name}
            </Link>
          ) : (
            'its canonical listing'
          )}
          . Restore to make it a listing of its own again.
        </Alert>
      )}

      <SeasonSwitcher
        competitionId={id}
        seasons={editions}
        selectedId={season?.id ?? null}
        adding={adding}
      />

      {/* Keyed by season so switching seasons remounts the form on the new seed — the row state
          (ids, removals) is per season and must not carry across. */}
      <CompetitionForm
        key={season?.id ?? 'new'}
        competition={competition}
        seed={seed}
        editionId={season?.id ?? null}
        seasons={editions}
        categories={categories}
        organizations={organizationOptions}
        templates={templates}
        regions={regions}
      />
    </>
  );
}
