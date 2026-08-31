'use client';

import { useState } from 'react';
import { Alert, Button, Code, Modal, Textarea } from '@beecompete/ui';
import { CompetitionForm } from '@/components/admin/competition-form';
import {
  importSeedWarnings,
  splitImportPayload,
  type ImportSeed,
  type ImportSeedWarning,
} from '@/lib/import-seed';
import type { Category, CategoryTemplate, Organization, Region } from '@/lib/admin-types';

// "Paste JSON" on the add-competition page (2026-08-25). The create form stays the ONLY write
// path — pasting just pre-fills it, reusing the import-review machinery from #105: the payload is
// read by lib/import-seed's splitImportPayload (same shape as a queued extraction, so
// LLM-generated seeding JSON works verbatim), and the filled form is reviewed and submitted like
// any hand-entered create.
//
// Two deliberate differences from import review:
//  - The form reads its seed in useState INITIALIZERS, so applying a paste REMOUNTS it via `key`.
//    Anything already typed is lost — the confirm text says so before it happens.
//  - There is no approve-payload to carry unmapped keys, so extras are DROPPED, loudly: import
//    mode's "kept as-is" warning becomes a "won't be saved" one here.

/** importSeedWarnings speaks import-review ("approve", "raw payload tab") — reword for create. */
function createModeWarnings(
  payload: Record<string, unknown>,
  seed: ImportSeed,
  organizations: Organization[],
): ImportSeedWarning[] {
  const warnings = importSeedWarnings(payload, seed)
    .filter((w) => w.key !== 'extras')
    .map((w) => {
      if (w.key === 'organizer') {
        return { ...w, message: 'The JSON names no organizer — pick or add one below.' };
      }
      // Import review can approve without an edition (the record becomes a hidden zombie listing);
      // this form CANNOT — it posts /competitions/with-edition, whose edition is @NotNull and whose
      // cycleLabel is @NotBlank. Saying "published but invisible" here would promise a save that
      // 400s. It blocks, so it is marked blocking.
      if (w.key === 'edition') {
        return {
          ...w,
          message:
            'The JSON describes no running — fill in the first edition below. A listing cannot be created without one.',
          blocking: true,
        };
      }
      return w;
    });

  // Organizer names arrive as text, not ids. An exact match preselects (CompetitionForm's own
  // logic, fed via organizerMatches); anything else the curator resolves by hand.
  const orgKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (
    seed.organizerName &&
    !organizations.some((o) => orgKey(o.name) === orgKey(seed.organizerName!))
  ) {
    warnings.push({
      key: 'organizerUnmatched',
      // Still blocking — the server rejects a listing with no organizer, and the dialog can be
      // dismissed. It reads as a reminder rather than an errand now that the form opens with the
      // reuse-or-create choice already on screen (owner 2026-08-28).
      message: `No organization is named “${seed.organizerName}” yet — resolve it in the prompt that just opened, or pick one in the Organizer field.`,
      blocking: true,
    });
  }

  // Keys with no form control, so the curator knows what a paste is about to lose.
  //
  // `edition.status` used to be filtered out here because create discarded it anyway. Since
  // 2026-08-31 it is a MAPPED field carried on a hidden input and posted when supplied, so it is
  // no longer an extra at all and needs no exemption. A COMPETITION-level `status` is still
  // exempt: that one is the listing's own status, which the create flow owns.
  const droppedKeys = [
    // `categorySlug` is resolved to a categoryId before this runs (see `apply`), so it is never a
    // dropped field even though the payload reader has no control for it.
    ...Object.keys(seed.extras.competition).filter((k) => k !== 'status' && k !== 'categorySlug'),
    ...Object.keys(seed.extras.edition).map((k) => `edition.${k}`),
  ];
  if (droppedKeys.length > 0) {
    warnings.push({
      key: 'dropped',
      message: `Not on this form and WON'T be saved: ${droppedKeys.join(', ')}. Category-specific values belong under "attributes"; anything else, add after creating.`,
    });
  }
  return warnings;
}

export function NewCompetitionClient({
  categories,
  organizations,
  templates,
  regions,
}: {
  categories: Category[];
  organizations: Organization[];
  templates: CategoryTemplate[];
  regions: Region[];
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [seed, setSeed] = useState<ImportSeed | null>(null);
  const [warnings, setWarnings] = useState<ImportSeedWarning[]>([]);
  // Remount key: each applied paste re-initializes the form from the new seed.
  const [pasteCount, setPasteCount] = useState(0);

  const apply = () => {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      setParseError(`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      setParseError('Expected a JSON object describing one competition, not a list or a value.');
      return;
    }
    const record = payload as Record<string, unknown>;

    // categorySlug -> categoryId. The seeding pipeline resolves this itself before submitting
    // (tools/seeding categories.ts), but an AI asked for a payload by hand cannot know our UUIDs,
    // so the prompt asks for the slug and the match happens here against THIS environment's
    // categories. An unmatched slug is reported rather than silently ignored.
    const parsed = splitImportPayload(record);
    const rawSlug = typeof record.categorySlug === 'string' ? record.categorySlug.trim() : '';
    const matchedCategory = rawSlug
      ? categories.find((c) => c.slug.toLowerCase() === rawSlug.toLowerCase())
      : undefined;
    if (parsed.competition.categoryId === '' && matchedCategory) {
      parsed.competition.categoryId = matchedCategory.id;
    }

    const found = createModeWarnings(record, parsed, organizations);
    if (rawSlug && !matchedCategory) {
      found.push({
        key: 'categorySlug',
        message: `No category has the slug “${rawSlug}” — pick the right one below.`,
        blocking: true,
      });
    }

    setSeed(parsed);
    setWarnings(found);
    setPasteCount((n) => n + 1);
    setParseError(null);
    setOpen(false);
  };

  // Both slots below are rendered by CompetitionForm, which owns the create-mode page header —
  // the button on the title line, this notice directly beneath it. Rendering them here instead
  // would stack them ABOVE the back link and title, at the wrong altitude.
  const notice = (seed || warnings.length > 0) && (
    <div className="mb-5 grid grid-cols-1 gap-3">
      {seed && (
        <p className="text-sm text-muted">
          Form filled from pasted JSON — review every field before saving.
        </p>
      )}
      {warnings.length > 0 && (
        <Alert tone="warning" title="Check before saving">
          <ul className="list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w.key}>{w.message}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );

  return (
    <div>
      <CompetitionForm
        key={pasteCount}
        seed={seed ?? undefined}
        headerAction={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Code aria-hidden="true" />
            {seed ? 'Paste different JSON' : 'Paste JSON'}
          </Button>
        }
        headerNotice={notice}
        organizerMatches={organizations}
        categories={categories}
        organizations={organizations}
        templates={templates}
        regions={regions}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Fill the form from JSON"
        description={
          seed || pasteCount > 0
            ? 'Applying replaces everything currently in the form.'
            : 'Same shape as a seeding-pipeline payload. You review the filled form before anything is saved.'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={apply} disabled={raw.trim() === ''}>
              Fill form
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2">
          <Textarea
            aria-label="Competition JSON"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder={
              '{\n  "name": "…",\n  "slug": "…",\n  "edition": { … },\n  "keyDates": [ … ]\n}'
            }
            className="font-mono text-xs"
          />
          {parseError && (
            <Alert tone="danger" title="Can't read that">
              {parseError}
            </Alert>
          )}
        </div>
      </Modal>
    </div>
  );
}
