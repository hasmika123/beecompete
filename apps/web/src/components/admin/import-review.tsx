'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, cn, Tab, TabList, TabPanel, Tabs, Warning } from '@beecompete/ui';
import { CompetitionForm } from '@/components/admin/competition-form';
import { ImportRawPayloadForm } from '@/components/admin/import-raw-payload-form';
import { ImportRecordMeta } from '@/components/admin/import-record-meta';
import { ImportRejectPanel } from '@/components/admin/import-reject-panel';
import type { ImportSeed, ImportSeedWarning } from '@/lib/import-seed';
import type {
  Category,
  CategoryTemplate,
  ImportRecord,
  Organization,
  Region,
} from '@/lib/admin-types';

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
  duplicate,
  categories,
  organizations,
  templates,
  regions,
  initialOrganizerMatches = [],
}: {
  record: ImportRecord;
  seed: ImportSeed;
  warnings: ImportSeedWarning[];
  /** The live listing already holding this slug, when the API flagged a collision. */
  duplicate: { id: string; name: string } | null;
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

      {/* Approving over a taken slug is a 409 from the write path. Curators should meet that as a
          warning with a link to the existing listing, not as a raw error after filling the form. */}
      {duplicate && (
        <Alert tone="warning">
          <span className="flex flex-wrap items-center gap-1">
            <Warning aria-hidden="true" className="size-4 shrink-0" />
            The slug <code className="font-mono">{seed.competition.slug}</code> is already taken by{' '}
            <Link
              href={`/admin/competitions/${duplicate.id}`}
              className="font-medium underline underline-offset-2"
            >
              {duplicate.name}
            </Link>
            . Approving as-is will fail — change the slug below, or reject this as a duplicate.
          </span>
        </Alert>
      )}

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
