import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, ArrowLeft, ExternalLink, Plus } from '@beecompete/ui';
import { PageHeader } from '@/components/admin/page-header';
import { enumLabel } from '@/components/admin/enum-labels';
import { ListingStatusBadge } from '@/components/admin/status-badges';
import { CompetitionForm } from '@/components/admin/competition-form';
import { CompetitionHeaderActions } from '@/components/admin/competition-header-actions';
import { CreatedToast } from '@/components/admin/created-toast';
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
 * the saved listing plus its current season, timeline, regions, awards, prep resources and FAQ
 * (`lib/listing-seed`), every row editable in place, with one save for all of it and the review
 * decision (publish / send back) riding on that save from the form's rail.
 *
 * Other seasons keep their own edit page (advancement chain, raw attributes) and are one click
 * away in the season strip under the title.
 */
export default async function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // The season the form edits, with the two things only it has: its timeline and its regions.
  const season = currentEdition(editions);
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
  const otherSeasons = editions.filter((e) => e.id !== season?.id);

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

      <PageHeader
        title={competition.name}
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
      {/* R1-19: no competition-level verification badge — maintainer derives from the org. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <ListingStatusBadge
          listingStatus={competition.listingStatus}
          archivedAt={competition.archivedAt}
        />
        <span>
          · provenance:{' '}
          {competition.provenanceSource ? enumLabel(competition.provenanceSource) : 'none'}
        </span>
        {/* The public URL belongs HERE, not in the form: it is assigned, not edited, and only
            meaningful once the listing exists. This page is where a curator lands after create. */}
        <span>·</span>
        <a
          href={`/c/${competition.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          /c/{competition.slug}
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens the public listing in a new tab)</span>
        </a>
      </div>

      {/* Season strip: which running the form below edits, and the way to every other one. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {season ? (
          <span>
            Season <span className="font-medium text-foreground">{season.cycleLabel}</span>{' '}
            <span className="text-xs">({enumLabel(season.status).toLowerCase()})</span> is on this
            page
          </span>
        ) : (
          <span className="font-medium text-foreground">No season yet — add one below</span>
        )}
        {otherSeasons.length > 0 && (
          <>
            <span>·</span>
            <span>
              Other seasons:{' '}
              {otherSeasons.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && ', '}
                  <Link
                    href={`/admin/competitions/${id}/editions/${e.id}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {e.cycleLabel}
                  </Link>
                  {e.archivedAt && <span className="text-xs"> (archived)</span>}
                </span>
              ))}
            </span>
          </>
        )}
        <span>·</span>
        <Link
          href={`/admin/competitions/${id}/editions/new`}
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-3.5" /> New season
        </Link>
      </div>

      {competition.listingStatus === 'IN_REVIEW' && !competition.archivedAt && (
        <Alert tone="info" className="mb-6" title="Submitted for review">
          Every part of the listing is on this page — check each step, fix anything in place, then
          publish or send it back from the panel beside the form. Your edits save with the decision.
          Last changed {formatDate(competition.updatedAt)}.
        </Alert>
      )}

      <CompetitionForm
        competition={competition}
        seed={seed}
        editionId={season?.id ?? null}
        categories={categories}
        organizations={organizationOptions}
        templates={templates}
        regions={regions}
      />
    </>
  );
}
