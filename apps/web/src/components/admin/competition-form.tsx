'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from '@beecompete/ui';
import { AttributesFields } from '@/components/admin/attributes-fields';
import { FormSection } from '@/components/admin/form-section';
import { enumLabel, enumOptions } from '@/components/admin/enum-labels';
import { createCompetition, updateCompetition } from '@/app/admin/competitions/actions';
import {
  COST_TYPES,
  DELIVERIES,
  ENTRY_PATHWAYS,
  EVALUATION_TYPES,
  PARTICIPATION_MODES,
  RECURRENCES,
  type Category,
  type CategoryTemplate,
  type Competition,
  type FormState,
  type Organization,
} from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function CompetitionForm({
  competition,
  categories,
  organizations,
  templates = [],
}: {
  competition?: Competition;
  categories: Category[];
  organizations: Organization[];
  /** Every category template — the attributes section renders the SELECTED category's schema. */
  templates?: CategoryTemplate[];
}) {
  const editing = competition !== undefined;
  const action = editing ? updateCompetition.bind(null, competition.id) : createCompetition;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  const c = competition;
  const categoryOptions = categories.map((cat) => ({ value: cat.id, label: cat.name }));
  const orgOptions = organizations.map((o) => ({ value: o.id, label: o.name }));

  // Team size only applies to team/both participation — gate the inputs (disabled fields aren't
  // submitted, so INDIVIDUAL never posts a stray team size).
  const [participation, setParticipation] = useState(c?.participationMode ?? 'INDIVIDUAL');
  const teamDisabled = participation === 'INDIVIDUAL';

  // Attributes bag (sweep item 8 / A7): schema-driven fields for the SELECTED category's
  // template, with a raw-JSON escape hatch. The object state is the source of truth in
  // structured mode and serializes into the form's `attributes` field on submit; in raw mode
  // the textarea posts directly — either way the server action + networknt schema validation
  // path is untouched (server stays the real gate).
  const [categoryId, setCategoryId] = useState(c?.categoryId ?? '');
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    (c?.attributes as Record<string, unknown>) ?? {},
  );
  const template = templates.find((t) => t.categoryId === categoryId);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const structured = template !== undefined && !rawMode;

  const enterRawMode = () => {
    setRawText(Object.keys(attributes).length ? JSON.stringify(attributes, null, 2) : '');
    setRawMode(true);
  };
  const exitRawMode = () => {
    let parsed: unknown = {};
    if (rawText.trim()) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        toast({ title: 'Fix the JSON first — it doesn’t parse.', tone: 'error' });
        return;
      }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast({ title: 'Attributes must be a JSON object.', tone: 'error' });
      return;
    }
    setAttributes(parsed as Record<string, unknown>);
    setRawMode(false);
  };

  return (
    <form action={formAction} className="grid max-w-3xl gap-8">
      <FormSection title="Basics" cols="sm:grid-cols-2">
        <FormField label="Name" required>
          <Input name="name" defaultValue={c?.name} required maxLength={300} />
        </FormField>
        <FormField label="Slug" required hint="lowercase-kebab-case; permanent (SEO).">
          <Input
            name="slug"
            defaultValue={c?.slug}
            required
            maxLength={160}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </FormField>
        <FormField label="Category" required>
          {/* Controlled — the Category attributes section below follows the selection. */}
          <Select
            name="categoryId"
            options={categoryOptions}
            placeholder="Select category…"
            value={categoryId}
            onValueChange={setCategoryId}
            required
          />
        </FormField>
        <FormField label="Organizer" hint="the organization the verified seal attaches to.">
          {/* First universal-dropdown site (item 6) — posts via Select's hidden native
              select; searchable since the org list grows unbounded. */}
          <Select
            name="organizerOrgId"
            options={[{ value: '', label: '— none —' }, ...orgOptions]}
            placeholder="— none —"
            defaultValue={c?.organizerOrgId ?? ''}
            searchable
          />
        </FormField>
      </FormSection>

      <FormSection title="Description" description="Shown on the card and the About tab.">
        <FormField label="Summary" hint="1–2 sentences shown on the card (max 300 chars).">
          <Textarea name="summary" defaultValue={c?.summary ?? ''} maxLength={300} rows={2} />
        </FormField>
        <FormField
          label="Description"
          hint="Full write-up (About tab). Write our own — never paste theirs."
        >
          <Textarea name="description" defaultValue={c?.description ?? ''} rows={5} />
        </FormField>
      </FormSection>

      <FormSection title="Format" cols="sm:grid-cols-3">
        <FormField label="Participation">
          <Select
            name="participationMode"
            options={enumOptions(PARTICIPATION_MODES)}
            value={participation}
            onValueChange={setParticipation}
          />
        </FormField>
        <FormField label="Delivery">
          <Select
            name="delivery"
            options={enumOptions(DELIVERIES)}
            defaultValue={c?.delivery ?? 'IN_PERSON'}
          />
        </FormField>
        <FormField label="Entry pathway">
          <Select
            name="entryPathway"
            options={enumOptions(ENTRY_PATHWAYS)}
            defaultValue={c?.entryPathway ?? 'INDIVIDUAL'}
          />
        </FormField>
        <FormField label="Cost">
          <Select
            name="costType"
            options={enumOptions(COST_TYPES)}
            defaultValue={c?.costType ?? 'FREE'}
          />
        </FormField>
        <FormField label="Recurrence">
          <Select
            name="recurrence"
            options={enumOptions(RECURRENCES)}
            defaultValue={c?.recurrence ?? 'ANNUAL'}
          />
        </FormField>
        <FormField label="Team size" hint="team competitions only">
          {/* Min + max as one paired field — kills the orphan 7th cell in the 3-col grid. */}
          <div className="flex items-center gap-2">
            <Input
              name="teamSizeMin"
              type="number"
              aria-label="Team size (min)"
              placeholder="min"
              defaultValue={c?.teamSizeMin ?? ''}
              min={1}
              disabled={teamDisabled}
            />
            <span aria-hidden="true" className="text-muted">
              –
            </span>
            <Input
              name="teamSizeMax"
              type="number"
              aria-label="Team size (max)"
              placeholder="max"
              defaultValue={c?.teamSizeMax ?? ''}
              min={1}
              disabled={teamDisabled}
            />
          </div>
        </FormField>
      </FormSection>

      <FormSection title="Eligibility" cols="sm:grid-cols-4">
        <FormField label="Min grade" hint="Pre-K −1, K 0">
          <Input name="minGrade" type="number" defaultValue={c?.minGrade ?? ''} min={-1} max={12} />
        </FormField>
        <FormField label="Max grade">
          <Input name="maxGrade" type="number" defaultValue={c?.maxGrade ?? ''} min={-1} max={12} />
        </FormField>
        <FormField label="Min age">
          <Input name="minAge" type="number" defaultValue={c?.minAge ?? ''} min={0} max={25} />
        </FormField>
        <FormField label="Max age">
          <Input name="maxAge" type="number" defaultValue={c?.maxAge ?? ''} min={0} max={25} />
        </FormField>
      </FormSection>

      <FormSection title="Classification & links" cols="sm:grid-cols-2">
        {/* The 5-checkbox group wraps raggedly beside a 40px input — give it its own row. */}
        <FormField
          label="Evaluation types"
          hint="how entries are judged — pick any that apply."
          className="sm:col-span-2"
        >
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {EVALUATION_TYPES.map((token) => (
              <Checkbox
                key={token}
                name="evaluationType"
                value={token}
                defaultChecked={c?.evaluationType?.includes(token) ?? false}
                label={enumLabel(token)}
              />
            ))}
          </div>
        </FormField>
        <FormField label="Tags" hint="comma-separated" className="sm:col-span-2">
          <Input name="tags" defaultValue={c?.tags?.join(', ') ?? ''} />
        </FormField>
        <FormField label="Official URL">
          <Input
            name="officialUrl"
            type="url"
            defaultValue={c?.officialUrl ?? ''}
            maxLength={1000}
          />
        </FormField>
        <FormField label="Logo (S3 key or URL)">
          <Input name="logo" defaultValue={c?.logo ?? ''} maxLength={1000} />
        </FormField>
      </FormSection>

      <FormSection
        title="Category attributes"
        description="Category-specific fields — validated against the category template on save."
      >
        {structured ? (
          <>
            {/* The object serializes into the same `attributes` field the raw textarea posts. */}
            <input
              type="hidden"
              name="attributes"
              value={Object.keys(attributes).length ? JSON.stringify(attributes) : ''}
            />
            {/* Remount on category switch so per-field local state (CSV/raw text) re-seeds. */}
            <AttributesFields
              key={categoryId}
              schema={template.jsonSchema}
              uiHints={template.uiHints}
              value={attributes}
              onChange={setAttributes}
            />
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={enterRawMode}>
                Edit raw JSON
              </Button>
            </div>
          </>
        ) : rawMode ? (
          <>
            <FormField label="Attributes (JSON)">
              <Textarea
                name="attributes"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                className="font-mono text-xs"
                placeholder='{ "topics": ["algebra"] }'
              />
            </FormField>
            {template && (
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={exitRawMode}>
                  Back to fields
                </Button>
              </div>
            )}
          </>
        ) : (
          // No template for the selected category (or none selected yet) — raw JSON is the
          // only editor (uncontrolled; posts directly, exactly the pre-item-8 behavior).
          <FormField
            label="Attributes (JSON)"
            hint="No template for this category yet — raw JSON only (pick a category first)."
          >
            <Textarea
              name="attributes"
              defaultValue={
                Object.keys(attributes).length ? JSON.stringify(attributes, null, 2) : ''
              }
              rows={6}
              className="font-mono text-xs"
              placeholder='{ "topics": ["algebra"] }'
            />
          </FormField>
        )}
      </FormSection>

      {/* Dates aren't part of the competition record — they live on its Editions (D3, timeline
          as data). On the edit page the pointer lives at the top of the Editions tab; the create
          page has no tabs yet, so surface it here. */}
      {!editing && (
        <Alert tone="info">
          Dates &amp; deadlines aren&apos;t set here — they live on the competition&apos;s{' '}
          <strong>Editions</strong>. After saving, open the competition, add an Edition, then add
          its key dates (registration close, submission due, results).
        </Alert>
      )}

      {/* Sticky save bar: the action (and any server error) stays visible on a form this tall
          instead of sitting thousands of pixels below the fold. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Create competition'}
        </Button>
        {state.error && (
          <Alert tone="danger" className="min-w-0 flex-1">
            {state.error}
          </Alert>
        )}
      </div>
    </form>
  );
}
