'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Alert,
  ArrowLeft,
  ArrowRight,
  Button,
  Check,
  Checkbox,
  cn,
  FormField,
  ImageUpload,
  Input,
  Plus,
  ProgressRing,
  Select,
  Stepper,
  Textarea,
  Trash,
  useToast,
} from '@beecompete/ui';
import { AttributesFields } from '@/components/admin/attributes-fields';
import { FormSection } from '@/components/admin/form-section';
import { RegionPicker } from '@/components/admin/region-picker';
import { enumLabel, enumOptions } from '@/components/admin/enum-labels';
import { GRADE_VALUES, gradeName } from '@/lib/catalog-display';
import { uploadCoverImage } from '@/lib/cover-upload';
import { createCompetition, updateCompetition } from '@/app/admin/competitions/actions';
import { approveImportFromForm } from '@/app/admin/import-records/actions';
import { CREATE_ORGANIZER_SENTINEL, type ImportSeed } from '@/lib/import-seed';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import {
  ADMIN_TIMEZONES,
  COST_TYPES,
  DELIVERIES,
  EDITION_STATUSES,
  ENTRY_PATHWAYS,
  EVALUATION_TYPES,
  KEY_DATE_TYPES,
  PARTICIPATION_MODES,
  RECURRENCES,
  SCOPE_LEVELS,
  type Category,
  type CategoryTemplate,
  type Competition,
  type FormState,
  type Organization,
  type Region,
} from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/** Sentinel option in the Organizer dropdown that opens the add-organization form (item 7). */
const ADD_ORG = '__add_org__';

/** name → permanent-safe kebab slug — matches the server pattern `[a-z0-9]+(-[a-z0-9]+)*`. */
function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

// Eligibility dropdown options. "" = "Any" (open on that side, posts null). Grade uses the SAME
// ladder as the marketplace grade filter (GRADE_VALUES); age runs 0…99 with 99 shown as "99+".
const GRADE_OPTIONS = [
  { value: '', label: 'Any' },
  ...GRADE_VALUES.map((g) => ({ value: String(g), label: `Grade ${gradeName(g)}` })),
];
const AGE_MAX = 99;
const AGE_OPTIONS = [
  { value: '', label: 'Any' },
  ...Array.from({ length: AGE_MAX + 1 }, (_, i) => ({
    value: String(i),
    label: i >= AGE_MAX ? `${AGE_MAX}+` : String(i),
  })),
];

interface StepDef {
  id: string;
  label: string;
  meta: string;
  content: ReactNode;
  /** Hidden from the create flow (e.g. category attributes, which need a saved category). */
  hideOnCreate?: boolean;
  /** Hidden from the edit page (the first-edition block — later years use the Editions tab). */
  hideOnEdit?: boolean;
}

/**
 * Which write path this form is driving.
 *
 * `import` is the review surface for a queued extraction (R1-3): the same fields as `create`,
 * pre-filled from the payload, submitting an approve override instead of a create. It is
 * deliberately NOT a stricter create — the server keeps the import path lenient on purpose (a
 * competition's own page routinely states no prize or fee), so the completeness ring here advises
 * and only the fields the server actually demands can block approval.
 */
export type CompetitionFormMode = 'create' | 'edit' | 'import';

/** The server-required minimum on the import path — everything else is advice, not a gate. */
const IMPORT_BLOCKING_KEYS = ['name', 'slug', 'category', 'organizer'];

/** Case- and whitespace-insensitive org-name key — mirrors the server's normalize on resolve. */
const orgNameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function CompetitionForm({
  competition,
  mode = competition ? 'edit' : 'create',
  importRecordId,
  seed,
  organizerMatches = [],
  categories,
  organizations,
  templates = [],
  regions = [],
}: {
  competition?: Competition;
  /** Defaults to edit/create from `competition`; import review passes it explicitly. */
  mode?: CompetitionFormMode;
  /** Import mode only — the record whose approve this form submits. */
  importRecordId?: string;
  /** Import mode only — the extracted payload read into form values (lib/import-seed). */
  seed?: ImportSeed;
  /** Import mode only — organizations matching the extracted organizer name (fetched server-side). */
  organizerMatches?: Organization[];
  categories: Category[];
  organizations: Organization[];
  /** Every category template — the attributes section renders the SELECTED category's schema. */
  templates?: CategoryTemplate[];
  /** Region options for the first-edition region picker (create + import flows). */
  regions?: Region[];
}) {
  const editing = mode === 'edit';
  const importing = mode === 'import';
  const action =
    editing && competition
      ? updateCompetition.bind(null, competition.id)
      : importing && importRecordId
        ? approveImportFromForm.bind(null, importRecordId)
        : createCompetition;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  // Initial values come from the saved competition (edit) or the extracted payload (import). The
  // seed is a Partial by construction — an extraction states what the page stated, nothing more.
  const c: Partial<Competition> | undefined = competition ?? seed?.competition;
  const editionSeed = seed?.edition ?? null;

  // Resolve-or-create, decided here rather than left to the server: when an org already carries the
  // extracted name the server REUSES it, so offering "create it" would be a lie about what approve
  // does. An exact match is preselected instead, and the create option only appears when there is
  // genuinely nothing to reuse. An archived same-name org is a hard 422 on approve — warn, don't hide.
  const extractedOrganizer = seed?.organizerName ?? null;
  const organizerNameMatches = extractedOrganizer
    ? organizerMatches.filter((o) => orgNameKey(o.name) === orgNameKey(extractedOrganizer))
    : [];
  const exactOrganizer = organizerNameMatches.find((o) => !o.archivedAt);
  const archivedOrganizer = exactOrganizer ? undefined : organizerNameMatches[0];
  const categoryOptions = categories.map((cat) => ({ value: cat.id, label: cat.name }));
  const orgOptions = organizations.map((o) => ({ value: o.id, label: o.name }));
  // Organizer is mandatory now (create, edit and import alike) — no "— none —" escape hatch. The
  // server rejects an empty organizer, and every listing carries one after migration 0012.
  //
  // Import adds ONE option rather than a second control: "create the organization the page named".
  // That is the resolve-or-create decision the queue has always required, folded into the same
  // Organizer dropdown a curator already knows — see CREATE_ORGANIZER_SENTINEL.
  const orgSelectOptions = [
    ...orgOptions,
    // The matched org may sit outside the first page of organizations the picker was given.
    ...(exactOrganizer && !orgOptions.some((o) => o.value === exactOrganizer.id)
      ? [{ value: exactOrganizer.id, label: exactOrganizer.name }]
      : []),
    ...(importing && extractedOrganizer && !exactOrganizer
      ? [
          {
            value: CREATE_ORGANIZER_SENTINEL,
            label: `+ Create “${extractedOrganizer}” (as extracted)`,
          },
        ]
      : []),
    { value: ADD_ORG, label: '+ Add organization…' },
  ];

  // Team size only applies to team/both participation — gate the inputs (disabled fields aren't
  // submitted, so INDIVIDUAL never posts a stray team size).
  const [participation, setParticipation] = useState(c?.participationMode ?? 'INDIVIDUAL');
  const teamDisabled = participation === 'INDIVIDUAL';

  // Cost drives the fee fields (item 17): a FREE competition has no entry fee, so the fee +
  // currency inputs are hidden and dropped from the required-ring. Controlled so the toggle is live.
  const [costType, setCostType] = useState(c?.costType ?? 'FREE');
  const isFree = costType === 'FREE';

  // Delivery + scope feed the region picker's soft assist (item 22) — controlled for that only.
  const [delivery, setDelivery] = useState(c?.delivery ?? 'IN_PERSON');
  const [scopeLevel, setScopeLevel] = useState(editionSeed?.scopeLevel ?? 'NATIONAL');

  // First-edition typed key dates (item 21, create only): repeatable rows posted as indexed
  // fields (keydate_0_type…). Per row, "Date TBD" records the milestone without a date (R1-18) —
  // the date/time inputs are then disabled (and not posted). First row defaults to REG_CLOSE.
  interface KeyDateRow {
    key: number;
    type: string;
    date: string;
    time: string;
    timezone: string;
    tbd: boolean;
    label: string;
  }
  const emptyKeyDateRow = (key: number, type: string): KeyDateRow => ({
    key,
    type,
    date: '',
    time: '',
    timezone: DEFAULT_TIMEZONE,
    tbd: false,
    label: '',
  });
  // Import starts from the extracted timeline (already read into wall-clock rows in their own
  // zones); create/edit start with one empty deadline row.
  const [keyDateRows, setKeyDateRows] = useState<KeyDateRow[]>(() =>
    seed && seed.keyDates.length > 0
      ? seed.keyDates.map((row, i) => ({ key: i, ...row }))
      : [emptyKeyDateRow(0, 'REG_CLOSE')],
  );
  const patchKeyDateRow = (key: number, patch: Partial<KeyDateRow>) =>
    setKeyDateRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addKeyDateRow = () =>
    setKeyDateRows((rows) => [
      ...rows,
      emptyKeyDateRow(Math.max(...rows.map((r) => r.key), -1) + 1, 'RESULTS'),
    ]);
  const removeKeyDateRow = (key: number) =>
    setKeyDateRows((rows) => rows.filter((r) => r.key !== key));

  // Controlled selections — feed both the form post and the required-field ring.
  const [categoryId, setCategoryId] = useState(c?.categoryId ?? '');
  // Import preselects the extracted organizer's intent: a resolved id if the payload carried one,
  // otherwise "create the named org". Either way the curator can override it in the dropdown.
  const [organizerOrgId, setOrganizerOrgId] = useState(
    c?.organizerOrgId ??
      exactOrganizer?.id ??
      (importing && extractedOrganizer ? CREATE_ORGANIZER_SENTINEL : ''),
  );
  const [regionIds, setRegionIds] = useState<string[]>(seed?.regionIds ?? []);
  const toggleRegion = (id: string) =>
    setRegionIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  // Attributes bag (A7): schema-driven fields for the SELECTED category's template, with a
  // raw-JSON escape hatch. The object serializes into the form's `attributes` field on submit.
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    (c?.attributes as Record<string, unknown>) ?? {},
  );
  const template = templates.find((t) => t.categoryId === categoryId);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const structured = template !== undefined && !rawMode;

  // Active stepper step (create mode). Declared unconditionally (Rules of Hooks) — the first
  // step is always "basics"; ignored in edit mode, which renders every section at once.
  const [activeStepId, setActiveStepId] = useState('basics');

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
        toast({ title: 'Fix the JSON first. It doesn’t parse.', tone: 'error' });
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

  // Name + slug (item 18): the slug auto-mirrors the name until the admin edits the slug field.
  // Edit mode: the slug is permanent (SEO) — never auto-change it, so treat it as already "dirty".
  const [name, setName] = useState(c?.name ?? '');
  const [slug, setSlug] = useState(c?.slug ?? '');
  // Auto-mirror only while creating: an edit keeps its permanent slug, and an import already has
  // the slug the extractor derived — retyping the name must not silently change either.
  const [slugDirty, setSlugDirty] = useState(mode !== 'create');

  // --- required-field tracking (drives the completion ring; server stays the real gate) ---
  // Text fields stay uncontrolled (defaultValue) with a change listener recording only whether
  // they're non-empty — enough for the ring without controlling every keystroke.
  const [filled, setFilled] = useState({
    summary: Boolean(c?.summary),
    description: Boolean(c?.description),
    officialUrl: Boolean(c?.officialUrl),
    cycleLabel: Boolean(editionSeed?.cycleLabel),
    registrationUrl: Boolean(editionSeed?.registrationUrl),
    entryFee: Boolean(editionSeed?.entryFee),
    currency: Boolean(editionSeed?.currency),
    prizeSummary: Boolean(editionSeed?.prizeSummary),
  });
  type FilledKey = keyof typeof filled;
  const mark = (key: FilledKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFilled((f) => ({ ...f, [key]: e.target.value.trim() !== '' }));

  // --- eligibility (grade + age dropdowns; min ≤ max) ---
  // The dropdowns only offer valid grades/ages, so the one thing left to guard is that a chosen
  // min isn't above its max. '' = "Any" (open on that side). The server re-validates regardless.
  const [elig, setElig] = useState({
    minGrade: c?.minGrade?.toString() ?? '',
    maxGrade: c?.maxGrade?.toString() ?? '',
    minAge: c?.minAge?.toString() ?? '',
    maxAge: c?.maxAge?.toString() ?? '',
  });
  type EligKey = keyof typeof elig;
  const setEligValue = (key: EligKey) => (v: string) => setElig((s) => ({ ...s, [key]: v }));
  const toInt = (v: string): number | null => (v === '' ? null : Number(v));
  const orderErr = (minK: EligKey, maxK: EligKey, msg: string): string | undefined => {
    const lo = toInt(elig[minK]);
    const hi = toInt(elig[maxK]);
    return lo !== null && hi !== null && lo > hi ? msg : undefined;
  };
  const eligErrors = {
    minGrade: orderErr('minGrade', 'maxGrade', 'Min grade can’t be above max grade.'),
    minAge: orderErr('minAge', 'maxAge', 'Min age can’t be above max age.'),
  };
  const eligibilityValid = !eligErrors.minGrade && !eligErrors.minAge;

  const orgChosen = organizerOrgId !== '' && organizerOrgId !== ADD_ORG;
  // "Deadline" (item 21) = at least one REG_CLOSE or SUBMISSION_DUE row, dated or TBD — matching
  // the search deadline rule (blueprint #31) and the server's completeness gate.
  const deadlineOk = keyDateRows.some(
    (r) => (r.type === 'REG_CLOSE' || r.type === 'SUBMISSION_DUE') && (r.tbd || r.date !== ''),
  );
  // Create front-loads everything the public card/detail shows (item 5/9): the listing is
  // complete-by-default. Edit keeps only the base spine required, so legacy listings still save.
  // Import uses the SAME full checklist as create, but only to SHOW what a curator would have to
  // chase — see `blockingFields` below for what actually gates the button.
  const requiredFields = editing
    ? [
        { key: 'name', label: 'Name', stepId: 'basics', ok: name.trim() !== '' },
        { key: 'slug', label: 'Slug', stepId: 'basics', ok: slug.trim() !== '' },
        { key: 'category', label: 'Category', stepId: 'basics', ok: categoryId !== '' },
        { key: 'organizer', label: 'Organizer', stepId: 'basics', ok: orgChosen },
      ]
    : [
        { key: 'name', label: 'Name', stepId: 'basics', ok: name.trim() !== '' },
        { key: 'slug', label: 'Slug', stepId: 'basics', ok: slug.trim() !== '' },
        { key: 'category', label: 'Category', stepId: 'basics', ok: categoryId !== '' },
        { key: 'organizer', label: 'Organizer', stepId: 'basics', ok: orgChosen },
        { key: 'summary', label: 'Summary', stepId: 'about', ok: filled.summary },
        { key: 'description', label: 'Description', stepId: 'about', ok: filled.description },
        { key: 'officialUrl', label: 'Official URL', stepId: 'media', ok: filled.officialUrl },
        { key: 'cycleLabel', label: 'Cycle label', stepId: 'edition', ok: filled.cycleLabel },
        {
          key: 'registrationUrl',
          label: 'Registration URL',
          stepId: 'edition',
          ok: filled.registrationUrl,
        },
        ...(isFree
          ? []
          : [
              { key: 'entryFee', label: 'Entry fee', stepId: 'edition', ok: filled.entryFee },
              { key: 'currency', label: 'Currency', stepId: 'edition', ok: filled.currency },
            ]),
        { key: 'prize', label: 'Prize', stepId: 'edition', ok: filled.prizeSummary },
        { key: 'region', label: 'Region', stepId: 'edition', ok: regionIds.length > 0 },
        { key: 'deadline', label: 'Deadline', stepId: 'edition', ok: deadlineOk },
      ];
  const filledCount = requiredFields.filter((r) => r.ok).length;
  const totalRequired = requiredFields.length;
  const allComplete = filledCount === totalRequired;
  const remaining = requiredFields.filter((r) => !r.ok);
  // What may actually block submit. On import that is only what the server itself refuses —
  // demanding the create form's full completeness here would make most real extractions
  // unapprovable (the API keeps the import path lenient for exactly this reason), which is how an
  // "improved" review screen would quietly halt seeding.
  const blockingFields = importing
    ? requiredFields.filter((r) => IMPORT_BLOCKING_KEYS.includes(r.key))
    : requiredFields;
  const blockingRemaining = blockingFields.filter((r) => !r.ok);
  const submittable = blockingRemaining.length === 0 && eligibilityValid;
  // On create every listed field carries a visible asterisk; on edit only the spine fields
  // (name/slug/category/organizer) do — organizer is now mandatory in edit mode too. Import shows
  // the same asterisks as create (they mark a complete listing), while still allowing approve.
  const req = !editing;

  // --- step content (written once; laid out as a stepper on create, stacked sections on edit) ---
  const stepDefs: StepDef[] = [
    {
      id: 'basics',
      label: 'Basics',
      meta: 'Name · slug · category',
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required>
            <Input
              name="name"
              value={name}
              minLength={2}
              maxLength={300}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (!slugDirty) setSlug(slugify(v));
              }}
            />
          </FormField>
          <FormField
            label="Slug"
            required
            hint="auto-filled from the name; lowercase-kebab-case, permanent (SEO)."
          >
            <Input
              name="slug"
              value={slug}
              minLength={2}
              maxLength={160}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
            />
          </FormField>
          {/* An archived org holding the extracted name makes approve a 422 — the curator has to
              restore it or choose another, and finding that out only on submit wastes the review. */}
          {importing && archivedOrganizer && (
            <Alert tone="warning" className="sm:col-span-2">
              An <b>archived</b> organization is already called “{archivedOrganizer.name}”. Restore
              it or pick a different organizer — approving with the extracted name will fail while
              it stays archived.
            </Alert>
          )}
          <FormField label="Category" required>
            <Select
              name="categoryId"
              options={categoryOptions}
              placeholder="Select category…"
              value={categoryId}
              onValueChange={setCategoryId}
            />
          </FormField>
          <FormField
            label="Organizer"
            required
            hint={
              importing && extractedOrganizer
                ? exactOrganizer
                  ? `The page named “${extractedOrganizer}”, which matches this existing organization — it will be reused, not duplicated.`
                  : `The page named “${extractedOrganizer}”. No existing organization matches, so approving creates one (CURATED / host).`
                : 'the organization the verified seal attaches to.'
            }
          >
            <Select
              name="organizerOrgId"
              options={orgSelectOptions}
              placeholder="Select organizer…"
              value={organizerOrgId}
              onValueChange={(v) => {
                if (v === ADD_ORG) {
                  // Open the add-organization form in a new tab so the in-progress listing isn't
                  // lost; refresh this page afterward to pick the new org from the list.
                  window.open('/admin/organizations/new', '_blank', 'noopener,noreferrer');
                  return;
                }
                setOrganizerOrgId(v);
              }}
              searchable
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'about',
      label: 'About',
      meta: 'Summary · description · tags',
      content: (
        <div className="grid gap-4">
          <FormField
            label="Summary"
            required={req}
            hint="1–2 sentences shown on the card (max 300 chars)."
          >
            <Textarea
              name="summary"
              defaultValue={c?.summary ?? ''}
              minLength={10}
              maxLength={300}
              rows={2}
              onChange={mark('summary')}
            />
          </FormField>
          <FormField
            label="Description"
            required={req}
            hint="Full write-up (About tab). Write our own; never paste theirs."
          >
            <Textarea
              name="description"
              defaultValue={c?.description ?? ''}
              minLength={20}
              maxLength={10000}
              rows={5}
              onChange={mark('description')}
            />
          </FormField>
          <FormField label="Tags" hint="comma-separated">
            <Input name="tags" defaultValue={c?.tags?.join(', ') ?? ''} maxLength={300} />
          </FormField>
        </div>
      ),
    },
    {
      id: 'format',
      label: 'Format & eligibility',
      meta: 'Participation · cost · grades',
      content: (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
                value={delivery}
                onValueChange={setDelivery}
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
                value={costType}
                onValueChange={(v) => {
                  setCostType(v);
                  // The fee/currency inputs unmount on FREE and remount empty on the way back, so
                  // clear their ring-tracking flags on any cost change to stay in sync.
                  setFilled((f) => ({ ...f, entryFee: false, currency: false }));
                }}
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
          </div>
          <FormField
            label="Evaluation types"
            hint="how entries are judged; pick any that apply."
            labelAsText
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Min grade" error={eligErrors.minGrade}>
              <Select
                name="minGrade"
                options={GRADE_OPTIONS}
                value={elig.minGrade}
                onValueChange={setEligValue('minGrade')}
              />
            </FormField>
            <FormField label="Max grade">
              <Select
                name="maxGrade"
                options={GRADE_OPTIONS}
                value={elig.maxGrade}
                onValueChange={setEligValue('maxGrade')}
              />
            </FormField>
            <FormField label="Min age" error={eligErrors.minAge}>
              <Select
                name="minAge"
                options={AGE_OPTIONS}
                value={elig.minAge}
                onValueChange={setEligValue('minAge')}
              />
            </FormField>
            <FormField label="Max age">
              <Select
                name="maxAge"
                options={AGE_OPTIONS}
                value={elig.maxAge}
                onValueChange={setEligValue('maxAge')}
              />
            </FormField>
          </div>
        </div>
      ),
    },
    {
      id: 'media',
      label: 'Media & links',
      meta: 'Cover image · official URL',
      content: (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Cover image</span>
            <ImageUpload
              name="logo"
              defaultValue={c?.logo}
              uploadEnabled
              onSelectFile={uploadCoverImage}
            />
            <p className="text-xs text-muted">
              Shown on the listing card and the detail header. Falls back to generated category art
              when empty.
            </p>
          </div>
          <FormField label="Official URL" required={req} hint="the competition’s home page.">
            <Input
              name="officialUrl"
              type="url"
              inputMode="url"
              defaultValue={c?.officialUrl ?? ''}
              maxLength={1000}
              placeholder="https://…"
              onChange={mark('officialUrl')}
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'attributes',
      label: 'Category details',
      meta: 'Template fields',
      hideOnCreate: true,
      content: (
        <div className="grid gap-4">
          <p className="text-xs text-muted">
            Category-specific fields, validated against the category template on save.
          </p>
          {structured ? (
            <>
              <input
                type="hidden"
                name="attributes"
                value={Object.keys(attributes).length ? JSON.stringify(attributes) : ''}
              />
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
            <FormField
              label="Attributes (JSON)"
              hint="No template for this category yet; raw JSON only (pick a category first)."
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
        </div>
      ),
    },
    // First edition (create + import): a competition needs a running to be publicly visible (the
    // readiness gate). The card-facing facts (prize, region, deadline) are captured here so a new
    // listing is complete-by-default — one atomic create, and one atomic approve.
    {
      id: 'edition',
      label: 'First edition',
      meta: 'The year’s running',
      hideOnEdit: true,
      content: (
        <div className="grid gap-4">
          <p className="text-xs text-muted">
            The current year’s running, needed for the listing to go live. Later years are added on
            the Editions tab.
          </p>
          {/* Import only: the cycle label is what decides whether an edition exists at all, so an
              empty one has to say what that costs. Extractions of pages that describe no running
              are legitimate — they just leave a listing the readiness gate hides. */}
          {importing && !filled.cycleLabel && (
            <Alert tone="warning">
              With no <b>cycle label</b> this approves the competition <b>without an edition</b>.
              The listing is then published but invisible (the readiness gate hides a competition
              with no running), and the dates and regions below are not saved. Add the year here, or
              approve now and create the edition on the listing afterwards.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Cycle label" required hint="e.g. 2026">
              <Input
                name="edition_cycleLabel"
                defaultValue={editionSeed?.cycleLabel ?? ''}
                maxLength={60}
                onChange={mark('cycleLabel')}
              />
            </FormField>
            <FormField label="Status">
              <Select
                name="edition_status"
                options={enumOptions(EDITION_STATUSES)}
                defaultValue={editionSeed?.status ?? 'UPCOMING'}
              />
            </FormField>
            <FormField label="Scope level">
              <Select
                name="edition_scopeLevel"
                options={enumOptions(SCOPE_LEVELS)}
                value={scopeLevel}
                onValueChange={setScopeLevel}
              />
            </FormField>
          </div>
          <div
            className={cn('grid gap-4', isFree ? 'sm:grid-cols-1' : 'sm:grid-cols-[2fr_1fr_1fr]')}
          >
            <FormField label="Registration URL" required hint="where entrants sign up.">
              <Input
                name="edition_registrationUrl"
                type="url"
                inputMode="url"
                defaultValue={editionSeed?.registrationUrl ?? ''}
                maxLength={1000}
                placeholder="https://…"
                onChange={mark('registrationUrl')}
              />
            </FormField>
            {/* Fee + currency only when the competition isn't free (item 17) — FREE posts no fee. */}
            {!isFree && (
              <>
                <FormField label="Entry fee" required hint="what entrants pay.">
                  <Input
                    name="edition_entryFee"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100000}
                    defaultValue={editionSeed?.entryFee ?? ''}
                    placeholder="0.00"
                    onChange={mark('entryFee')}
                  />
                </FormField>
                <FormField label="Currency" required hint="ISO, e.g. USD">
                  <Input
                    name="edition_currency"
                    defaultValue={editionSeed?.currency ?? ''}
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                    placeholder="USD"
                    className="uppercase"
                    onChange={mark('currency')}
                  />
                </FormField>
              </>
            )}
          </div>
          <FormField
            label="Prize"
            required
            hint="the headline prize shown on the card, e.g. “$10,000 + trip to nationals”."
          >
            <Input
              name="edition_prizeSummary"
              defaultValue={editionSeed?.prizeSummary ?? ''}
              maxLength={500}
              onChange={mark('prizeSummary')}
            />
          </FormField>
          <FormField
            label="Regions"
            required
            labelAsText
            hint="where this runs; shown on the card. Pick at least one."
          >
            {/* Single element child (a div, not a Fragment): FormField clones its child to wire
                id/aria, and a Fragment can't take those props. */}
            <div className="grid gap-1">
              {regionIds.map((id) => (
                <input key={id} type="hidden" name="edition_regionIds" value={id} />
              ))}
              <RegionPicker
                regions={regions}
                selectedIds={regionIds}
                onToggle={toggleRegion}
                scopeLevel={scopeLevel}
                delivery={delivery}
              />
            </div>
          </FormField>
          <div className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Key dates{' '}
              <span className="font-normal text-muted">
                · needs a Reg close or Submission due (dated or TBD); add the rest as you have them
              </span>
            </span>
            {keyDateRows.map((row, i) => (
              <div
                key={row.key}
                className="grid gap-3 rounded-[var(--radius-panel)] border border-border p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
                  <FormField label="Type" className="min-w-0">
                    <Select
                      name={`keydate_${i}_type`}
                      options={enumOptions(KEY_DATE_TYPES)}
                      value={row.type}
                      onValueChange={(v) => patchKeyDateRow(row.key, { type: v })}
                    />
                  </FormField>
                  <FormField label="Date" className="min-w-0">
                    <Input
                      name={`keydate_${i}_date`}
                      type="date"
                      disabled={row.tbd}
                      value={row.date}
                      onChange={(e) => patchKeyDateRow(row.key, { date: e.target.value })}
                      className="w-full min-w-0"
                    />
                  </FormField>
                  <FormField label="Time" className="min-w-0">
                    <Input
                      name={`keydate_${i}_time`}
                      type="time"
                      disabled={row.tbd}
                      value={row.time}
                      onChange={(e) => patchKeyDateRow(row.key, { time: e.target.value })}
                      className="w-full min-w-0"
                    />
                  </FormField>
                  <FormField label="Timezone" className="min-w-0">
                    <Select
                      name={`keydate_${i}_timezone`}
                      options={ADMIN_TIMEZONES}
                      value={row.timezone}
                      onValueChange={(v) => patchKeyDateRow(row.key, { timezone: v })}
                    />
                  </FormField>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <FormField
                    label="Label"
                    hint="optional, shown for Custom dates"
                    className="min-w-40 flex-1"
                  >
                    <Input
                      name={`keydate_${i}_label`}
                      maxLength={200}
                      value={row.label}
                      onChange={(e) => patchKeyDateRow(row.key, { label: e.target.value })}
                    />
                  </FormField>
                  {/* mt aligns the checkbox to the neighbor's control band (same trick as the
                      edition-page KeyDateManager). */}
                  <div className="flex h-10 items-center">
                    <Checkbox
                      name={`keydate_${i}_tbd`}
                      label="Date TBD"
                      checked={row.tbd}
                      onChange={(e) => patchKeyDateRow(row.key, { tbd: e.target.checked })}
                    />
                  </div>
                  {keyDateRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove this key date"
                      onClick={() => removeKeyDateRow(row.key)}
                    >
                      <Trash aria-hidden="true" className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={addKeyDateRow}>
                <Plus aria-hidden="true" className="size-4" /> Add date
              </Button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  // --- edit mode: the familiar stacked sections (health widget + tabs live on the edit page) ---
  if (editing) {
    return (
      <form action={formAction} className="grid max-w-3xl gap-8">
        {stepDefs
          .filter((s) => !s.hideOnEdit)
          .map((s) => (
            <FormSection key={s.id} title={s.label}>
              {s.content}
            </FormSection>
          ))}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
          <Button type="submit" disabled={pending || !eligibilityValid}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
          {!eligibilityValid && (
            <span className="text-xs text-danger">Fix the eligibility errors above to save.</span>
          )}
          {state.error && (
            <Alert tone="danger" className="min-w-0 flex-1">
              {state.error}
            </Alert>
          )}
        </div>
      </form>
    );
  }

  // --- create + import: vertical stepper + a form-wide completion ring ---
  const steps = stepDefs.filter((s) => !(s.hideOnCreate && mode === 'create'));
  const activeStepDef = steps.find((s) => s.id === activeStepId) ?? steps[0];
  if (!activeStepDef) return null; // steps always has ≥1 entry — this just narrows the type
  const activeIndex = steps.indexOf(activeStepDef);
  const prevStep = steps[activeIndex - 1];
  const nextStep = steps[activeIndex + 1];
  const nextRemaining = remaining[0];
  const stepperSteps = steps.map((s) => {
    const stepReq = requiredFields.filter((r) => r.stepId === s.id);
    return {
      id: s.id,
      label: s.label,
      description: s.meta,
      complete: stepReq.length > 0 && stepReq.every((r) => r.ok),
      incompleteRequired: stepReq.some((r) => !r.ok),
    };
  });
  const labelOf = (stepId: string) => steps.find((s) => s.id === stepId)?.label ?? '';

  return (
    <div>
      {/* Header — back link + title on the left; the completion ring aligns to the back-link line
          on the right (items-start), so the stepper + form grid below start just beneath the ring
          card. Import review supplies its own page header (source, confidence, tabs), so only the
          ring is rendered there. */}
      <div
        className={cn('mb-5 flex items-start gap-4', importing ? 'justify-end' : 'justify-between')}
      >
        {!importing && (
          <div>
            <Link
              href="/admin/competitions"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-4" /> Competitions
            </Link>
            <h1 className="mt-2 font-display text-2xl text-foreground">New competition</h1>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3.5 self-start rounded-[var(--radius-panel)] border border-border bg-surface-raised px-4 py-3.5 shadow-[var(--shadow-lift)]">
          <ProgressRing
            size={72}
            thickness={7}
            value={filledCount}
            max={totalRequired}
            label={
              importing
                ? `${filledCount} of ${totalRequired} listing-completeness fields filled`
                : `${filledCount} of ${totalRequired} required fields complete`
            }
          >
            {allComplete ? (
              <Check weight="bold" className="size-7 text-success" />
            ) : (
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {filledCount}
                <span className="text-sm text-muted">/{totalRequired}</span>
              </span>
            )}
          </ProgressRing>
          <div className="text-sm">
            <div className="font-semibold text-foreground">
              {allComplete
                ? importing
                  ? 'Complete listing'
                  : 'Ready to create'
                : importing
                  ? 'Gaps to fill in'
                  : 'Almost ready'}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {allComplete
                ? 'All required fields filled'
                : importing
                  ? `${remaining.length} field${remaining.length === 1 ? '' : 's'} the page didn’t give us`
                  : `${remaining.length} required field${remaining.length === 1 ? '' : 's'} left`}
            </div>
            {!allComplete && nextRemaining && (
              <button
                type="button"
                onClick={() => setActiveStepId(nextRemaining.stepId)}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
                {nextRemaining.label} · {labelOf(nextRemaining.stepId)}
              </button>
            )}
          </div>
        </div>
      </div>

      <form action={formAction}>
        {/* Import review round-trip: the payload keys this form has no control for, and the
            organizer name behind the "create as extracted" option. Both are read back by
            buildImportApprovalPayload so approving can never quietly drop what was extracted. */}
        {importing && seed && (
          <>
            <input type="hidden" name="import_extras" value={JSON.stringify(seed.extras)} />
            <input type="hidden" name="import_organizerName" value={seed.organizerName ?? ''} />
          </>
        )}
        <div className="grid gap-6 md:grid-cols-[236px_1fr] md:items-start">
          <Stepper
            steps={stepperSteps}
            activeId={activeStepId}
            onSelect={setActiveStepId}
            className="md:sticky md:top-4"
          />
          <div className="min-w-0 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 sm:p-6">
            <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <h2 className="font-display text-xl text-foreground">{activeStepDef.label}</h2>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                Step {activeIndex + 1} of {steps.length}
              </span>
            </div>
            {/* Every step stays in the DOM (hidden when inactive) so one submit posts all fields. */}
            {steps.map((s) => (
              <div key={s.id} className={cn(s.id === activeStepId ? 'block' : 'hidden')}>
                {s.content}
              </div>
            ))}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!prevStep}
                onClick={() => prevStep && setActiveStepId(prevStep.id)}
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Back
              </Button>
              {nextStep && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveStepId(nextStep.id)}
                >
                  Continue <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky save bar — Create gates on the completion ring; the server re-validates regardless. */}
        {/* Sticky save bar. Create gates on the whole completion ring; import gates only on what
            the server refuses, and says out loud what an incomplete approve produces. The server
            re-validates either way. */}
        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
          <Button type="submit" variant="brand" disabled={pending || !submittable}>
            {importing
              ? pending
                ? 'Approving…'
                : 'Approve & create'
              : pending
                ? 'Creating…'
                : 'Create competition'}
          </Button>
          {blockingRemaining.length > 0 ? (
            importing ? (
              <button
                type="button"
                onClick={() => {
                  const first = blockingRemaining[0];
                  if (first) setActiveStepId(first.stepId);
                }}
                className="text-xs font-medium text-danger hover:underline"
              >
                Needs {blockingRemaining.map((r) => r.label.toLowerCase()).join(', ')} before it can
                be approved
              </button>
            ) : (
              <span className="text-xs text-muted">
                {blockingRemaining.length} required field
                {blockingRemaining.length === 1 ? '' : 's'} left
              </span>
            )
          ) : !eligibilityValid ? (
            <button
              type="button"
              onClick={() => setActiveStepId('format')}
              className="text-xs font-medium text-danger hover:underline"
            >
              Fix the errors in Format &amp; eligibility to continue
            </button>
          ) : importing && !allComplete ? (
            <span className="text-xs text-muted">
              {remaining.length} field{remaining.length === 1 ? '' : 's'} still empty — you can
              approve anyway and fill them in on the listing.
            </span>
          ) : null}
          {state.error && (
            <Alert tone="danger" className="min-w-0 flex-1">
              {state.error}
            </Alert>
          )}
        </div>
      </form>
    </div>
  );
}
