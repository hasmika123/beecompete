'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, cn, Tab, TabList, TabPanel, Tabs, Warning } from '@beecompete/ui';
import { CompetitionForm } from '@/components/admin/competition-form';
import { ImportRawPayloadForm } from '@/components/admin/import-raw-payload-form';
import { ImportRecordMeta } from '@/components/admin/import-record-meta';
import { ImportRejectPanel } from '@/components/admin/import-reject-panel';
import { describeReasons, hardCompetitionMatch } from '@/lib/duplicates';
import type { ImportSeed, ImportSeedWarning } from '@/lib/import-seed';
import type {
  Category,
  CategoryTemplate,
  CompetitionDuplicates,
  ImportRecord,
  Organization,
  Region,
} from '@/lib/admin-types';

/**
 * The record-level duplicate verdict (DQ4): one sentence naming the strongest match and any
 * pending twins, with links, and what to do about it. Hard (a live same-name listing) reads as
 * danger; everything else as a warning the form can confirm through.
 */
function DuplicateVerdict({ duplicates }: { duplicates: CompetitionDuplicates | null }) {
  if (!duplicates || (duplicates.catalog.length === 0 && duplicates.pending.length === 0)) {
    return null;
  }
  const hard = hardCompetitionMatch(duplicates);
  const best = hard ?? duplicates.catalog[0] ?? null;
  const twins = duplicates.pending;
  return (
    <Alert tone={hard ? 'danger' : 'warning'}>
      <span className="flex flex-wrap items-center gap-1">
        <Warning aria-hidden="true" className="size-4 shrink-0" />
        {best ? (
          <>
            {hard ? 'Already listed as' : 'Looks like a possible duplicate of'}{' '}
            <Link
              href={`/admin/competitions/${best.id}`}
              className="font-medium underline underline-offset-2"
            >
              {best.name}
            </Link>
            <span className="text-muted">({describeReasons(best.reasons)})</span>
            {duplicates.catalog.length > 1 && (
              <span className="text-muted">and {duplicates.catalog.length - 1} more below</span>
            )}
            .
          </>
        ) : (
          <>Not listed yet, but</>
        )}
        {twins.length > 0 && (
          <>
            {' '}
            {twins.length === 1
              ? 'Another pending record'
              : `${twins.length} other pending records`}{' '}
            look{twins.length === 1 ? 's' : ''} like the same competition:{' '}
            {twins.map((t, i) => (
              <span key={t.importRecordId}>
                {i > 0 && ', '}
                <Link
                  href={`/admin/import-records/${t.importRecordId}`}
                  className="font-medium underline underline-offset-2"
                >
                  {t.name ?? 'untitled record'}
                </Link>
              </span>
            ))}
            .
          </>
        )}{' '}
        {hard
          ? 'Approving as-is will fail — rename it in the form, or reject this record as a duplicate.'
          : 'Confirm it’s not a duplicate in the form below, or reject this record.'}
      </span>
    </Alert>
  );
}

/**
 * Review one queued import.
 *
 * The default surface is the SAME form used to add a competition by hand, pre-filled from the
 * extraction — reviewing a listing means looking at the listing, not at its JSON. The raw payload
 * stays one tab away as an escape hatch (see {@link ImportRawPayloadForm} for why the two are
 * deliberately independent edits).
 *
 * Rejecting sits below both tabs: it's a decision about the record, not about the editor.
 */
export function ImportReview({
  record,
  seed,
  warnings,
  duplicates,
  categories,
  organizations,
  templates,
  regions,
  initialOrganizerMatches = [],
}: {
  record: ImportRecord;
  seed: ImportSeed;
  warnings: ImportSeedWarning[];
  /** The API's full duplicate detection for this record (DQ4), as it stood when the page loaded. */
  duplicates: CompetitionDuplicates | null;
  categories: Category[];
  organizations: Organization[];
  templates: CategoryTemplate[];
  regions: Region[];
  /** Orgs matching the extracted organizerName — drives resolve-or-create in BOTH tabs. */
  initialOrganizerMatches?: Organization[];
}) {
  const [tab, setTab] = useState('form');

  return (
    <div className="grid gap-6">
      <ImportRecordMeta record={record} />

      {/* The record-level verdict (DQ4): what the queue flagged, spelled out with links, before the
          curator fills in a form they may not be able to save. The FORM below runs the same check
          live as they edit and carries the "not a duplicate" checkbox — this is the headline. */}
      <DuplicateVerdict duplicates={duplicates} />

      {warnings.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Worth checking before you approve
          </h2>
          <ul className="grid gap-1.5 text-sm text-muted">
            {warnings.map((w) => (
              <li key={w.key} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    w.blocking ? 'bg-danger' : 'bg-amber-500',
                  )}
                />
                <span className={w.blocking ? 'text-foreground' : undefined}>{w.message}</span>
              </li>
            ))}
          </ul>
          {warnings.some((w) => !w.blocking) && (
            <p className="mt-2.5 text-xs text-muted">
              {warnings.some((w) => w.blocking)
                ? 'Only the red items block approval — for the rest, an extraction can only state what the page stated.'
                : 'None of these block approval — an extraction can only state what the page stated.'}
            </p>
          )}
        </div>
      )}

      {/* Underline, not the pill variant: the pill panel draws its own card, and the review form
          already renders one for the step content — nesting them reads as a box in a box. */}
      <Tabs value={tab} onValueChange={setTab} defaultValue="form">
        <TabList aria-label="Review surface">
          <Tab value="form">Review form</Tab>
          <Tab value="raw">Raw payload</Tab>
        </TabList>
        <TabPanel value="form">
          {/* Both panels stay mounted (TabPanel hides rather than unmounts), so a half-finished
              edit survives a look at the raw payload and back. */}
          <CompetitionForm
            mode="import"
            importRecordId={record.id}
            seed={seed}
            categories={categories}
            organizations={organizations}
            templates={templates}
            regions={regions}
            organizerMatches={initialOrganizerMatches}
          />
        </TabPanel>
        <TabPanel value="raw">
          <ImportRawPayloadForm record={record} initialOrganizerMatches={initialOrganizerMatches} />
        </TabPanel>
      </Tabs>

      <ImportRejectPanel recordId={record.id} />
    </div>
  );
}
