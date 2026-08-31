'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import type { ChangeEvent, MouseEvent, ReactNode } from 'react';
import {
  Alert,
  ArrowLeft,
  ArrowRight,
  Button,
  Check,
  Checkbox,
  GripHandle,
  cn,
  FilePdf,
  FileUpload,
  FormField,
  ImageUpload,
  Info,
  Input,
  Modal,
  Plus,
  ProgressRing,
  Radio,
  RadioGroup,
  Select,
  Stepper,
  Textarea,
  Tooltip,
  Trash,
  useToast,
} from '@beecompete/ui';
import { AttributesFields } from '@/components/admin/attributes-fields';
import { FormSection, SubSectionHeading } from '@/components/admin/form-section';
import { RegionSelect } from '@/components/admin/region-select';
import { AwardsInput, awardRowsFromSeed } from '@/components/admin/awards-input';
import { MAX_TAGS, TagsInput } from '@/components/admin/tags-input';
import { enumLabel, enumOptions, keyDateOptions } from '@/components/admin/enum-labels';
import { OrganizationForm } from '@/components/admin/organization-form';
import { OrganizationCreatedModal } from '@/components/admin/organization-created-modal';
import { GRADE_VALUES, gradeOptionLabel } from '@/lib/catalog-display';
import { defaultKeyDateLabel } from '@/lib/detail-display';
import {
  currencyRule,
  isComplete,
  LIMITS,
  moneyRule,
  slugRule,
  textRule,
  urlRule,
} from '@/lib/form-rules';
import { uploadCoverImage } from '@/lib/cover-upload';
import { createCompetition, updateCompetition } from '@/app/admin/competitions/actions';
import { approveImportFromForm } from '@/app/admin/import-records/actions';
import { CREATE_ORGANIZER_SENTINEL, type ImportSeed } from '@/lib/import-seed';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import {
  ADMIN_TIMEZONES,
  COST_TYPES,
  ELIGIBILITY_BASES,
  DELIVERIES,
  EVALUATION_TYPES,
  KEY_DATE_TYPES,
  SPAN_KEY_DATE_TYPES,
  PARTICIPATION_MODES,
  RECURRENCES,
  RESOURCE_TYPES,
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
/**
 * Eligibility-basis choices, spelled out rather than run through `enumOptions` — twice over. The
 * shared humanizer maps BOTH → "Individual or team" and OPEN → "Open to all" (participation and
 * entry-pathway wording), which would be actively wrong here; and this is the one control whose
 * whole job is to make a curator think about WHOSE rule they are recording, so each option says it.
 *
 * '' is a real, savable value: not stated. It leads, because it is where an un-curated listing
 * honestly sits until someone checks the official page.
 */
/**
 * No "Not provided" box (owner 2026-08-28): the field is REQUIRED, and an option meaning "I didn't
 * answer" would satisfy it while answering nothing. A curator who genuinely cannot find the rule
 * leaves the row untouched — the readiness ring then names it as outstanding, which is the honest
 * place for "still unknown" to live.
 *
 * ⚠ null REMAINS a valid STORED value — legacy rows carry it, migration 0023's backfill leaves it
 * where no range existed, and the API accepts it. What changed is only that a curator can no
 * longer newly CHOOSE it. Those listings still render "Not stated" (blueprints decision 99), and
 * import review still approves them: this is a create-form rule, not a server rule.
 */
const ELIGIBILITY_BASIS_OPTIONS = [
  { value: 'GRADE', label: 'Grades' },
  { value: 'AGE', label: 'Ages' },
  { value: 'BOTH', label: 'Grades & Ages' },
  { value: 'OPEN', label: 'Open to all' },
];

/**
 * Which range inputs the chosen basis actually asks for. Everything else is DISABLED rather than
 * unmounted — the house pattern the entry-fee row already uses: the layout keeps its shape, and a
 * range typed before someone changed their mind survives the change back. Disabled controls are
 * omitted from submission, so basis GRADE posts no ages, which is exactly what the server's
 * `isEligibilityBasisBacked` guard expects.
 *
 * '' is the UNANSWERED state — no box is selected until a curator picks one, so both ranges start
 * disabled and the choice above is what unlocks them. OPEN asks for neither too, but means
 * something different: the organizer stated there IS no restriction. Disabling both is safe for
 * existing rows because migration 0023's backfill only left the basis null where BOTH ranges were
 * already empty — there is nothing for a save to clear.
 */
/**
 * Student status: a tri-state, stored as the `0022` boolean. '' removes the key — "nobody has
 * recorded this" is a real answer and must not render as "Not required" on the public tab.
 */
/**
 * NOT_PROVIDED is a form-only sentinel, never stored: picking it REMOVES the attribute key, which
 * is the same storage as before. What it buys is the distinction the field could not previously
 * make — between "a curator read the page and it says nothing about countries" and "nobody has
 * looked yet". Both were an absent key and both rendered as a blank the form let you sail past.
 *
 * ⚠ It replaces the old "Any / worldwide" option, which was an INFERENCE: a US contest that never
 * mentions countries is unstated, not open to the world, and saying so on a listing invents a rule
 * the organizer never wrote. Same reasoning as the eligibility-basis work (blueprints decision 99).
 */
const NOT_PROVIDED = 'NOT_PROVIDED';
/**
 * Unlike {@link NOT_PROVIDED}, this IS stored — it is a fact the organizer stated ("anyone may
 * enter, from anywhere"), and the listing prints it. Absent would have collapsed it back into
 * silence, which is the distinction these fields exist to keep (owner 2026-08-28).
 */
const OPEN_TO_ALL = 'Open to all';

const STUDENT_STATUS_OPTIONS = [
  { value: NOT_PROVIDED, label: 'Not provided' },
  { value: 'true', label: 'Required' },
  { value: 'false', label: 'Not required' },
];

const BASIS_ASKS_FOR: Record<string, { grades: boolean; ages: boolean }> = {
  '': { grades: false, ages: false },
  GRADE: { grades: true, ages: false },
  AGE: { grades: false, ages: true },
  BOTH: { grades: true, ages: true },
  OPEN: { grades: false, ages: false },
};

/**
 * The token alone doesn't say where the line falls, and picking wrong tells a student they cannot
 * enter without their school — so the distinction rides in the option label itself. Written short
 * because the trigger joins the CHOSEN labels: "Individual, Through a school" has to stay readable
 * in one truncating line.
 */
const ENTRY_PATHWAY_OPTIONS = [
  // `label` explains inside the list; `shortLabel` is what the trigger shows as a tag, because
  // three full labels ("Through a chapter or club" × 3) would clip long before they all fit.
  { value: 'INDIVIDUAL', label: 'Individual — signs up on their own', shortLabel: 'Individual' },
  { value: 'SCHOOL', label: 'Through a school', shortLabel: 'School' },
  { value: 'CHAPTER', label: 'Through a chapter or club', shortLabel: 'Chapter or club' },
];

const GRADE_OPTIONS = [
  { value: '', label: 'Any' },
  ...GRADE_VALUES.map((g) => ({ value: String(g), label: gradeOptionLabel(g) })),
];
/**
 * The two country gates are CLOSED vocabularies (owner 2026-08-24). Deliberately tiny: these
 * feed a filter axis at H36 (JSONB→Spine promotion, sweep §16), and free text can't be filtered
 * on — "USA" / "U.S." / "United States" were all being typed for the same rule. Anything the
 * list can't say is "Other", explained in `other_eligibility_requirements`. Stored as a
 * one-element array so the shape matches the template schema and the public renderer.
 */

const ELIGIBLE_COUNTRY_OPTIONS = [
  { value: NOT_PROVIDED, label: 'Not provided' },
  { value: OPEN_TO_ALL, label: 'Open to all' },
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
];
/**
 * The Judging step's right column, sized AGAINST the evaluation list beside it (owner 2026-08-25):
 * three boxes that together end level with the checkbox stack.
 *
 * `auto auto minmax(0,1fr)` — the two textareas size to THEMSELVES, the rubric absorbs the rest.
 *
 * It was a strict `1.5fr 1.5fr 2fr` ratio (the rules box reading as two checkbox rows, the text
 * boxes as three). Two things retired it:
 *  1. A bare `fr` track is `minmax(AUTO, …fr)`, so its floor is content — ANY field growing
 *     re-split the ratio across all three. Opening the rubric's URL row grew both textareas by
 *     25px. Blueprints #117 documents the identical trap on the At-a-glance strip.
 *  2. The textareas became drag-expandable (owner 2026-08-29), and under a proportional track
 *     dragging ONE resizes the OTHER — not what a resize handle promises.
 *
 * `auto` gives each textarea its own height and keeps a drag local. The rubric keeps a FLOORED
 * `1fr`, so it still takes whatever is left and the column still ends level with the stack beside
 * it — which was the ratio's actual purpose. The pixel-ratio half is given up deliberately.
 *
 * ⚠ That floor is `9rem`, not `0`. At `0` a curator dragging a textarea tall ate the remainder and
 * collapsed the rubric drop zone to 26px — a target too small to hit. 9rem is sized for the WORST
 * case, not the resting one: the track also carries the label and, when the URL row is open, that
 * row too, so a smaller floor still starved the zone the moment both happened at once. A FIXED
 * floor cannot be inflated by content the way a bare `fr` can, so it stops the collapse without
 * reopening (1).
 *
 * Each field still needs `grid-rows-[auto_1fr]` so it is the CONTROL that absorbs its row, not the
 * label; `min-h-0` lets the boxes shrink rather than overflow if the left column is ever short.
 */
const JUDGING_ROWS = 'grid h-full min-h-0 grid-rows-[auto_auto_minmax(9rem,1fr)] gap-4';
const JUDGING_FIELD = 'min-h-0 grid-rows-[auto_1fr]';

/** Citizenship has one real answer at R1 — the US-citizens-only rule (e.g. USAMO). */
const CITIZENSHIP_OPTIONS = [
  { value: NOT_PROVIDED, label: 'Not provided' },
  { value: OPEN_TO_ALL, label: 'Open to all' },
  { value: 'United States', label: 'United States' },
];

/**
 * One-line explainers for the evaluation tokens (owner 2026-08-23). Curator-facing: the tokens
 * alone ("Submission", "Portfolio") don't say where the line between them falls, and picking the
 * wrong one mislabels the listing's Judging tab.
 */
const EVALUATION_HINTS: Record<string, string> = {
  exam: 'A timed, scored test.',
  submission: 'Work sent in by a deadline.',
  live_performance: 'Judged live, in the room.',
  interview: 'Judged in conversation.',
  portfolio: 'A whole body of work.',
};

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
  /** ⓘ beside the step heading (create h2 + edit FormSection) — context, not a paragraph. */
  hint?: string;
  content: ReactNode;
  /** Hidden from the create flow (e.g. category attributes, which need a saved category). */
  hideOnCreate?: boolean;
  /** Hidden from the edit page (the first-edition block — later years use the Editions tab). */
  hideOnEdit?: boolean;
  /** Hidden from import review — for steps whose data the approve path cannot persist (the
   *  approve response carries no competition id to hang sub-resources off). Hiding the step is
   *  the no-silently-dropped-input rule: better no controls than controls that discard. */
  hideOnImport?: boolean;
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
/**
 * How many complete prep resources and FAQ entries a NEW listing must carry (owner 2026-08-29).
 * Both seeding prompts already ask for more than this (~8 resources, 3-5 FAQs), so a pasted or
 * extracted listing usually arrives satisfied; the floor is for hand-entered ones.
 *
 * ⚠ Not enforced on import approve — it is not in IMPORT_BLOCKING_KEYS. The server does not demand
 * these, and a queued extraction that found only two good links must stay approvable rather than
 * stalling the seeding queue. The ring still names them, so the gap is visible either way.
 */
const MIN_EXTRAS = 4;

const IMPORT_BLOCKING_KEYS = [
  'name',
  'slug',
  'category',
  'organizer',
  // Added 2026-08-28 with the enum defaults' removal. These are @NotNull server-side, so an empty
  // one is refused on approve either way — this is the rule the list already states ("only what
  // the server itself refuses"), surfaced as a labelled row instead of a 400 after the click.
  // It bites 5 queued extractions that never stated a scope level and had been quietly approving
  // as NATIONAL; they now ask a curator, which is the point.
  'costType',
  'delivery',
  'participation',
  'scopeLevel',
  'recurrence',
  'entryPathway',
];

/**
 * The key dates a CREATE-form listing must account for (owner 2026-08-24) — each needs a date
 * or an explicit TBD before the form will submit. Blank rows for all four are seeded, so the ask
 * is "fill these in", not "know which ones to add".
 *
 * ⚠ A FORM rule, not a server rule. The API still demands only a REG_CLOSE or SUBMISSION_DUE
 * (`CompetitionWithEditionRequest.isDeadlinePresent`), and that is deliberate: the seeding
 * pipeline and the import-approve path both post through the same endpoint, and real organizer
 * pages rarely publish all four — tightening the server would reject most extractions and stall
 * the content gate. The stricter rule belongs where a human is actually filling a form.
 * ROUND_START and CUSTOM stay optional: not every competition has rounds, and a custom date is by
 * definition not a fixed part of the shape.
 */
const REQUIRED_KEY_DATE_TYPES = ['REG_OPEN', 'REG_CLOSE', 'SUBMISSION_DUE', 'RESULTS'] as const;

/**
 * The types a timeline may hold only ONE of (owner 2026-08-31). Registration opens once and closes
 * once; a second of either is a different milestone wearing the wrong type.
 *
 * SUBMISSION_DUE and RESULTS are REQUIRED but not singletons — they repeat legitimately, per
 * division or per round ("junior entries due", "senior entries due"; semifinal then final results).
 * `nextDeadline` copes: it takes the earliest FUTURE row, so several submission deadlines simply
 * hand off to one another as each passes.
 */
const SINGLETON_KEY_DATE_TYPES: readonly string[] = ['REG_OPEN', 'REG_CLOSE'];

/** Case- and whitespace-insensitive org-name key — mirrors the server's normalize on resolve. */
const orgNameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Registrable host of a URL, for PREFILLING the new-organization form's Official website field.
 *
 * A convenience copy of the server's `WebDomains.registrableHost` — not a second source of truth:
 * whatever is submitted is normalized again server-side, so the worst a disagreement here can do is
 * show a curator a slightly different default before they save. Kept local for that reason; if a
 * third caller ever appears, promote it to a lib module rather than copying it again.
 */
function registrableHost(url: string | undefined): string | undefined {
  if (!url || url.trim() === '') return undefined;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    const bare = host.startsWith('www.') ? host.slice(4) : host;
    return bare === '' ? undefined : bare;
  } catch {
    return undefined;
  }
}

export function CompetitionForm({
  competition,
  mode = competition ? 'edit' : 'create',
  importRecordId,
  seed,
  headerAction,
  headerNotice,
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
  /**
   * Create mode only — rendered on the title line, right-aligned (e.g. “Paste JSON”). Lives here
   * rather than above the form because create draws its own page header; a caller-owned row would
   * sit at a different altitude than the h1 it belongs with.
   */
  headerAction?: ReactNode;
  /**
   * Create mode only — a full-width block under the header, above the stepper (e.g. what a pasted
   * payload resolved to). Same reason as {@link headerAction}: create draws its own header, so the
   * caller cannot place anything between that header and the form without a slot.
   */
  headerNotice?: ReactNode;
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
  // Organizations created WITHOUT leaving this form (owner 2026-08-28). `organizations` is a
  // server prop, so a new row could not appear in the dropdown until the page re-rendered — which
  // is why creating one used to mean a new tab and a refresh, and why curators saw the new
  // organization missing until they reloaded. Merging locally is what makes it appear instantly,
  // and it is also what PROTECTS the half-filled listing: a router.refresh() would re-render this
  // form from the server and take every unsaved field with it.
  const [createdOrgs, setCreatedOrgs] = useState<Organization[]>([]);
  // Two phases, deliberately separate: the form, then its confirmation. `justCreatedOrg` outlives
  // `addingOrg` so the success message sits over the LISTING form, not over the org form.
  const [addingOrg, setAddingOrg] = useState(false);
  const [justCreatedOrg, setJustCreatedOrg] = useState<Organization | null>(null);

  // ORGANIZER RESOLUTION FOR A PASTED LISTING (owner 2026-08-28). A payload names its organizer as
  // TEXT, and the form needs an id — so an unmatched name used to surface only as a blocking
  // warning telling the curator to go sort it out themselves. It now opens as the first thing they
  // see, with the decision already laid out: reuse one of these, or create it.
  //
  // SIMILAR = containment either way, case-insensitive. That mirrors the server's resolve-or-create
  // guard (CompetitionCurationService: `findByNameContainingIgnoreCase`, "no fuzzy/acronym matching,
  // no auto-merge — a wrong merge is worse than a duplicate") and widens it by ONE step, matching
  // the reverse direction too so "Mathematical Association of America (MAA)" surfaces the plain
  // "Mathematical Association of America". Deliberately not fuzzier: these are candidates a human
  // picks from, and a tempting-but-wrong suggestion is how two organizations become one by accident.
  const similarOrganizers = extractedOrganizer
    ? [...organizations, ...createdOrgs].filter((o) => {
        if (o.archivedAt) return false;
        const a = orgNameKey(o.name);
        const b = orgNameKey(extractedOrganizer);
        return a !== b && (a.includes(b) || b.includes(a));
      })
    : [];
  // Opens on MOUNT, via a state initializer rather than an effect: the form is remounted per paste
  // (`key={pasteCount}`), so "is this a fresh paste with an unresolved organizer" is knowable at
  // first render and needs no post-render correction.
  const [resolvingOrg, setResolvingOrg] = useState(
    () => importing === false && extractedOrganizer !== null && exactOrganizer === undefined,
  );

  const categoryOptions = categories.map((cat) => ({ value: cat.id, label: cat.name }));
  const orgOptions = [...organizations, ...createdOrgs].map((o) => ({
    value: o.id,
    label: o.name,
  }));
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
  // Cover image is REQUIRED on create (owner 2026-08-28): every card and detail header shows one,
  // and the generated category art was meant as a graceful fallback for legacy rows, not as the
  // normal outcome of adding a listing. Tracked in state because the required-ring reads it.
  const [coverUrl, setCoverUrl] = useState(c?.logo ?? '');
  const [participation, setParticipation] = useState(c?.participationMode ?? '');
  const teamDisabled = participation === 'INDIVIDUAL';

  // Cost drives the fee fields (item 17): a FREE competition has no entry fee, so the fee +
  // currency inputs are hidden and dropped from the required-ring. Controlled so the toggle is live.
  // NO PRE-CHOSEN VALUE on any of these (owner 2026-08-28). A dropdown that opens on "Free" or
  // "Annual" looks like an answer, and after a paste it looks like the payload's answer — so a
  // curator scrolls past a guess we made and publishes it as fact. Empty + a placeholder makes the
  // unanswered state visible, and the required-ring below makes it unmissable.
  const [costType, setCostType] = useState(c?.costType ?? '');
  // Which axis the ORGANIZER states (0023). '' = not stated, and it is a legitimate saved value:
  // a curator who cannot find the rule must be able to leave it unanswered rather than pick one.
  const [eligibilityBasis, setEligibilityBasis] = useState<string>(c?.eligibilityBasis ?? '');
  const isFree = costType === 'FREE';

  // Delivery + scope feed the region picker's soft assist (item 22) — controlled for that only.
  const [delivery, setDelivery] = useState(c?.delivery ?? '');
  const [recurrence, setRecurrence] = useState(c?.recurrence ?? '');
  // A SET since `0024` (domain-model §7a.1) — a competition may accept more than one route, and
  // the composites that used to fake that (SCHOOL_OR_CHAPTER, OPEN) are gone. Empty = unanswered,
  // which the required-ring asks for: a pre-chosen "Individual" after a paste looks like the
  // payload's answer, and this field decides whether a student can enter without their school.
  const [entryPathways, setEntryPathways] = useState<string[]>(c?.entryPathways ?? []);

  const [scopeLevel, setScopeLevel] = useState(editionSeed?.scopeLevel ?? '');

  // First-edition typed key dates (item 21, create only): repeatable rows posted as indexed
  // fields (keydate_0_type…). Per row, "Date TBD" records the key date without a date (R1-18) —
  // the date/time inputs are then disabled (and not posted). First row defaults to REG_CLOSE.
  interface KeyDateRow {
    key: number;
    type: string;
    date: string;
    /** Optional — set only for a key date that spans days; posts as end-of-day in `timezone`. */
    endDate: string;
    time: string;
    timezone: string;
    tbd: boolean;
    label: string;
  }
  const emptyKeyDateRow = (key: number, type: string): KeyDateRow => ({
    key,
    type,
    date: '',
    endDate: '',
    time: '',
    timezone: DEFAULT_TIMEZONE,
    tbd: false,
    label: '',
  });
  // Import starts from the extracted timeline (already read into wall-clock rows in their own
  // zones); create starts empty. EITHER WAY the four required key dates are topped up with blank
  // rows, so a curator is never asked for a date whose row they'd have to add first.
  const [keyDateRows, setKeyDateRows] = useState<KeyDateRow[]>(() => {
    const seeded = seed?.keyDates.map((row, i) => ({ key: i, ...row })) ?? [];
    const missing = REQUIRED_KEY_DATE_TYPES.filter((t) => !seeded.some((r) => r.type === t));
    return [...seeded, ...missing.map((t, i) => emptyKeyDateRow(seeded.length + i, t))];
  });
  const patchKeyDateRow = (key: number, patch: Partial<KeyDateRow>) =>
    setKeyDateRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addKeyDateRow = () =>
    setKeyDateRows((rows) => [
      ...rows,
      emptyKeyDateRow(Math.max(...rows.map((r) => r.key), -1) + 1, 'ROUND_START'),
    ]);
  const removeKeyDateRow = (key: number) =>
    setKeyDateRows((rows) => rows.filter((r) => r.key !== key));

  // --- Resources + FAQ rows (create-only extras step, 2026-08-25). Same repeatable-row grammar
  // as key dates: controls carry indexed names (`resource_0_title`, …) derived from RENDER
  // position, so removal renumbers automatically; keys are only list identity. One blank row
  // each from the start — blanks post nothing (buildResources/buildFaqs skip the incomplete).
  interface ResourceRow {
    key: number;
    title: string;
    url: string;
    type: string;
    affiliate: boolean;
    image: string;
  }
  interface FaqRow {
    key: number;
    question: string;
    answer: string;
  }
  // Seeded from the payload when one suggested resources (the paste prompt asks for ~5 prep links
  // plus 2-3 Amazon ones), otherwise the single blank row the editor has always opened with.
  //
  // ⚠ The blank is ONLY for the empty case (owner 2026-08-31). It used to be appended
  // unconditionally "so the editor stays ready to type", which meant a payload that supplied five
  // resources rendered six rows with the last one empty — it read as a row the extraction had
  // failed to fill, and it counted against the partial-row check below. "Add resource" already
  // covers wanting another.
  const [resourceRows, setResourceRows] = useState<ResourceRow[]>(() => {
    const seeded = (seed?.resources ?? []).map((r, i) => ({
      key: i,
      title: r.title,
      url: r.url,
      type: r.type,
      affiliate: r.isAffiliate,
      image: r.imageUrl,
    }));
    if (seeded.length > 0) return seeded;
    return [{ key: 0, title: '', url: '', type: 'GUIDE', affiliate: false, image: '' }];
  });
  // Seeded like the resource rows, and blank ONLY when nothing was seeded — same reason.
  const [faqRows, setFaqRows] = useState<FaqRow[]>(() => {
    const seeded = (seed?.faqs ?? []).map((f, i) => ({
      key: i,
      question: f.question,
      answer: f.answer,
    }));
    if (seeded.length > 0) return seeded;
    return [{ key: 0, question: '', answer: '' }];
  });
  const patchResourceRow = (key: number, patch: Partial<ResourceRow>) =>
    setResourceRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const patchFaqRow = (key: number, patch: Partial<FaqRow>) =>
    setFaqRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addResourceRow = () =>
    setResourceRows((rows) => [
      ...rows,
      {
        key: Math.max(...rows.map((r) => r.key), -1) + 1,
        title: '',
        url: '',
        type: 'GUIDE',
        affiliate: false,
        image: '',
      },
    ]);
  const addFaqRow = () =>
    setFaqRows((rows) => [
      ...rows,
      { key: Math.max(...rows.map((r) => r.key), -1) + 1, question: '', answer: '' },
    ]);
  // The last row clears instead of disappearing — the editor stays ready to type (awards rule).
  const removeResourceRow = (key: number) =>
    setResourceRows((rows) =>
      rows.length === 1
        ? [{ key: rows[0]!.key, title: '', url: '', type: 'GUIDE', affiliate: false, image: '' }]
        : rows.filter((r) => r.key !== key),
    );
  const removeFaqRow = (key: number) =>
    setFaqRows((rows) =>
      rows.length === 1
        ? [{ key: rows[0]!.key, question: '', answer: '' }]
        : rows.filter((r) => r.key !== key),
    );
  // Drag reordering, the AwardsInput grammar verbatim (owner 2026-08-25): rows are draggable
  // only while the grip is held (armed), and the held row follows the row the pointer enters.
  // Order is meaning — buildResources/buildFaqs number displayOrder from row position. One
  // state pair per list; a shared pair would let a drag started in one list reorder the other.
  const [resourceDrag, setResourceDrag] = useState<{ drag: number | null; armed: number | null }>({
    drag: null,
    armed: null,
  });
  const [faqDrag, setFaqDrag] = useState<{ drag: number | null; armed: number | null }>({
    drag: null,
    armed: null,
  });
  const reorder = <T extends { key: number }>(rows: T[], dragKey: number, overKey: number): T[] => {
    const from = rows.findIndex((r) => r.key === dragKey);
    const to = rows.findIndex((r) => r.key === overKey);
    if (from < 0 || to < 0 || from === to) return rows;
    const next = [...rows];
    const [held] = next.splice(from, 1);
    next.splice(to, 0, held!);
    return next;
  };

  /**
   * A row the CURATOR orders by hand: no date to sort it by, either because it's TBD or because
   * nothing has been typed yet. Dated rows are placed by their dates and are not draggable — a
   * drop that fought the calendar would just snap back.
   */
  const isUndatedRow = (r: KeyDateRow) => r.tbd || r.date === '';

  /** True when this row is the sole carrier of a required key date type — removing it would
   *  strand the form on an unsatisfiable requirement. */
  const isOnlyRequiredRow = (r: KeyDateRow) =>
    (REQUIRED_KEY_DATE_TYPES as readonly string[]).includes(r.type) &&
    keyDateRows.filter((o) => o.type === r.type).length === 1;

  // Drag reordering for those rows (owner 2026-08-24) — the Awards editor's gesture: the row is
  // only draggable while the pointer is holding its grip, so selecting text in an input never
  // starts a drag. `armedKey` = grip held, `dragKey` = row in hand.
  const [keyDateDragKey, setKeyDateDragKey] = useState<number | null>(null);
  const [keyDateArmedKey, setKeyDateArmedKey] = useState<number | null>(null);

  /**
   * Live reorder while dragging. It moves the row inside `keyDateRows` STATE, which is what the
   * chronological view below tie-breaks undated rows on — so a drag among undated rows lands
   * exactly where it was dropped. Refuses when either end is dated, because their order is a fact
   * about the calendar rather than a preference.
   */
  const dragOverKeyDate = (overKey: number) => {
    if (keyDateDragKey === null || keyDateDragKey === overKey) return;
    setKeyDateRows((rows) => {
      const from = rows.findIndex((r) => r.key === keyDateDragKey);
      const to = rows.findIndex((r) => r.key === overKey);
      if (from < 0 || to < 0) return rows;
      if (!isUndatedRow(rows[from]!) || !isUndatedRow(rows[to]!)) return rows;
      const next = [...rows];
      const [held] = next.splice(from, 1);
      next.splice(to, 0, held!);
      return next;
    });
  };

  /**
   * The rows in CHRONOLOGICAL order (owner 2026-08-24) — a derived view, never a re-sort of
   * state, so a row's identity (`key`, and therefore focus and the patch/remove handlers) is
   * untouched by where it happens to sit. Dated rows ascend; TBD and not-yet-dated rows sink to
   * the bottom, because "we don't know when" can't be placed on a timeline. Ties and undated rows
   * hold their STATE order (the `seq` tiebreak) — which is exactly what makes them drag-orderable:
   * `dragOverKeyDate` rewrites that order and the sort preserves it.
   *
   * This is what the row counter numbers, and it is deliberately NOT the order the curator typed
   * them in: the public timeline sorts by date too, so the editor showing anything else would be
   * a preview of a page that doesn't exist. Rendering order also drives the posted field indices
   * (`keydate_0_*`, `keydate_1_*`, …), which is harmless — `buildKeyDates` only needs them
   * contiguous, and the server re-sorts anyway.
   */
  const orderedKeyDateRows = keyDateRows
    .map((row, seq) => ({ row, seq }))
    .sort((a, b) => {
      const at = a.row.tbd || !a.row.date ? null : `${a.row.date}T${a.row.time || '23:59'}`;
      const bt = b.row.tbd || !b.row.date ? null : `${b.row.date}T${b.row.time || '23:59'}`;
      if (at === bt) return a.seq - b.seq;
      if (at === null) return 1;
      if (bt === null) return -1;
      return at < bt ? -1 : 1;
    })
    .map(({ row }) => row);

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

  // Awards editor seed — an extracted prize becomes the first row; create starts empty.
  const [initialAwardRows] = useState(() =>
    awardRowsFromSeed(
      editionSeed?.prizeSummary || editionSeed?.prizeValue
        ? [
            {
              title: editionSeed?.prizeSummary ?? '',
              value: editionSeed?.prizeValue || undefined,
              currency: editionSeed?.prizeCurrency || undefined,
            },
          ]
        : [],
    ),
  );
  const toggleRegion = (id: string) =>
    setRegionIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  // Attributes bag (A7): schema-driven fields for the SELECTED category's template, with a
  // raw-JSON escape hatch. The object serializes into the form's `attributes` field on submit.
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    (c?.attributes as Record<string, unknown>) ?? {},
  );

  // Judging + eligibility catalog-info controls (their steps) write into the SAME attributes
  // bag the Category-details step posts — one hidden input, one source of truth. Empty clears
  // the key. CSV fields keep local text so typing ", " isn't re-normalized mid-keystroke.
  const attrCsvText = (key: string) => {
    const v = ((c?.attributes as Record<string, unknown>) ?? {})[key];
    return Array.isArray(v) ? v.join(', ') : '';
  };
  const csvToList = (text: string) =>
    text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  const [judgingCriteriaText, setJudgingCriteriaText] = useState(() =>
    attrCsvText('judging_criteria'),
  );
  // Evaluation types are a real column (not the bag) and post through the checkboxes' own
  // `name`; the state exists so the chosen rows can SHOW as chosen (owner 2026-08-23).
  const [evaluationTypes, setEvaluationTypes] = useState<string[]>(c?.evaluationType ?? []);
  const toggleEvaluationType = (token: string) =>
    setEvaluationTypes((prev) =>
      prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token],
    );
  // The country gates are single-choice now, but the BAG still holds arrays (unchanged schema).
  // Read the first entry back; anything a previous curator free-typed that isn't in the closed
  // list resolves to "Other" rather than silently blanking the field.
  const attrFirst = (key: string, allowed: readonly string[]) => {
    const v = ((c?.attributes as Record<string, unknown>) ?? {})[key];
    const first = Array.isArray(v) ? v[0] : undefined;
    if (typeof first !== 'string' || first === '') return '';
    // "Other" was retired as an option (owner 2026-08-28) and no row stored it. An unrecognized
    // value is therefore surfaced as UNANSWERED rather than silently bucketed — better the ring
    // asks a curator than the field quietly claims something the data does not say.
    return allowed.includes(first) ? first : '';
  };
  // '' = UNANSWERED (no option selected, placeholder showing) — distinct from NOT_PROVIDED, which
  // is a curator saying the page is silent. A stored value selects itself; an absent key leaves the
  // field unanswered so the required-ring asks for it rather than letting a blank pass as a fact.
  const [eligibleCountry, setEligibleCountry] = useState(() =>
    attrFirst('eligible_countries', [OPEN_TO_ALL, 'United States', 'Canada']),
  );
  const [citizenship, setCitizenship] = useState(() =>
    attrFirst('citizenship_countries', [OPEN_TO_ALL, 'United States']),
  );
  const [studentStatus, setStudentStatus] = useState(() => {
    const v = ((c?.attributes as Record<string, unknown>) ?? {}).student_status_required;
    return typeof v === 'boolean' ? String(v) : '';
  });
  /** NOT_PROVIDED and '' both store nothing; only a real choice writes the key. */
  const answeredAttr = (v: string) => v !== '' && v !== NOT_PROVIDED;
  const setAttrKey = (key: string, value: unknown) =>
    setAttributes((prev) => {
      const next = { ...prev };
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  const template = templates.find((t) => t.categoryId === categoryId);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  // Structured is the default even with NO template (owner 2026-08-23): custom fields and
  // the JSON dropdown work regardless; a template only adds its typed controls on top.
  const structured = !rawMode;

  // Active stepper step (create mode). Declared unconditionally (Rules of Hooks) — the first
  // step is always "basics"; ignored in edit mode, which renders every section at once.
  const [activeStepId, setActiveStepId] = useState('overview');
  /**
   * Set by a blocked submit click (owner 2026-08-30). Red only ever appears AFTER someone has
   * asked to publish — painting a form red while it is still being filled in would flag every step
   * the moment the page loads, which reads as broken rather than incomplete.
   */
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
  // Seeded tag lists can exceed MAX_TAGS (a JSON fill bypasses the input's own cap), so the count
  // is tracked here to gate submit — see TagsInput.onCountChange.
  const [tagCount, setTagCount] = useState((c?.tags ?? []).length);
  const [name, setName] = useState(c?.name ?? '');
  const [slug, setSlug] = useState(c?.slug ?? '');
  // Auto-mirror only while creating: an edit keeps its permanent slug, and an import already has
  // the slug the extractor derived — retyping the name must not silently change either. Nothing
  // can unlock this any more (the slug is assigned, with no field to override it), so it's a
  // plain constant rather than state.
  const slugLocked = mode !== 'create';

  // --- required-field tracking (drives the completion ring; server stays the real gate) ---
  // Text fields stay uncontrolled (defaultValue) with a change listener recording only whether
  // they're non-empty — enough for the ring without controlling every keystroke.
  // These stay UNCONTROLLED inputs (defaultValue) with a change listener. What changed
  // 2026-08-30 is that the listener records the VALUE, not a non-empty boolean, so the ring's
  // `ok` can mean VALID rather than merely "not blank" — a 12,000-character description and a URL
  // of `asdf` are both non-empty, and neither one should complete its step.
  const [text, setText] = useState({
    description: c?.description ?? '',
    officialUrl: c?.officialUrl ?? '',
    registrationUrl: editionSeed?.registrationUrl ?? '',
    entryFee: editionSeed?.entryFee ?? '',
    currency: editionSeed?.currency ?? '',
  });
  type TextKey = keyof typeof text;
  const mark = (key: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setText((t) => ({ ...t, [key]: e.target.value }));
  // Derived from the awards editor rather than typed into, so it stays a flag.
  const [hasPrizeLine, setHasPrizeLine] = useState(Boolean(editionSeed?.prizeSummary));

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
  // Which ranges the chosen basis asks for; the rest go disabled (see BASIS_ASKS_FOR).
  const asksFor = BASIS_ASKS_FOR[eligibilityBasis] ?? { grades: true, ages: true };
  // Mirrors the server's `isEligibilityBasisBacked`: claiming an axis with no range on it would be
  // a 400 on submit, and — worse — a listing asserting an eligibility it cannot show. Caught here
  // so it reads as a field error rather than a failed save.
  const basisUnbacked =
    (asksFor.grades && elig.minGrade === '' && elig.maxGrade === '') ||
    (asksFor.ages && elig.minAge === '' && elig.maxAge === '');
  const eligibilityValid = !eligErrors.minGrade && !eligErrors.minAge && !basisUnbacked;

  /**
   * Per-field messages, server-mirrored (`lib/form-rules`). Undefined = nothing to say.
   *
   * Required-ness is NOT expressed here for most fields: an empty required field is reported by the
   * ring and, after a failed submit, by the step turning red — putting "X is required" under every
   * blank control on first paint would shout at a form nobody has filled in yet. These messages are
   * for a value that IS there and is wrong.
   */
  const fieldErrors = {
    name: textRule(name, { max: LIMITS.name, label: 'Name' }),
    slug: slugRule(slug),
    description: textRule(text.description, { max: LIMITS.description, label: 'Description' }),
    officialUrl: urlRule(text.officialUrl, { max: LIMITS.officialUrl, label: 'Official URL' }),
    coverUrl: urlRule(coverUrl, { max: LIMITS.logo, label: 'Cover image' }),
    registrationUrl: urlRule(text.registrationUrl, {
      max: LIMITS.registrationUrl,
      label: 'Registration URL',
    }),
    entryFee: moneyRule(text.entryFee, { label: 'Entry fee' }),
    currency: currencyRule(text.currency),
  };

  /**
   * HALF-FILLED rows (owner 2026-08-31). A row with SOME of its required fields but not all is
   * silently DROPPED on save — `buildResources`/`buildFaqs` skip any row missing either half — so a
   * curator who typed a title and no URL lost the row without being told. These block submit now.
   *
   * An ENTIRELY empty row is not half-filled: it is the editor's "ready to type" affordance, drops
   * out harmlessly, and must never block. The test is therefore "touched but incomplete", not
   * "incomplete".
   */
  const has = (v: string) => v.trim() !== '';
  const partialResourceRows = resourceRows.filter(
    (r) => (has(r.title) || has(r.url) || has(r.image)) && !(has(r.title) && has(r.url)),
  );
  const partialFaqRows = faqRows.filter(
    (f) => (has(f.question) || has(f.answer)) && !(has(f.question) && has(f.answer)),
  );
  /**
   * A key date row always has a type, so "touched" means it carries a date, an end date or a
   * label. Such a row must resolve to a real date or an explicit TBD — the R1-18 encoding — or it
   * posts nothing and the milestone vanishes.
   */
  const partialKeyDateRows = keyDateRows.filter(
    (r) => (has(r.date) || has(r.endDate) || has(r.label)) && !r.tbd && !has(r.date),
  );

  const orgChosen = organizerOrgId !== '' && organizerOrgId !== ADD_ORG;
  // A required key date is satisfied by a row of that type carrying either a real date or an
  // explicit TBD — "we checked and it isn't published yet" is a complete answer, an untouched
  // blank row is not. This supersedes the old single "Deadline" check: REG_CLOSE and
  // SUBMISSION_DUE are now each required outright, so the server's either/or gate is met by
  // construction.
  const keyDateOk = (type: string) =>
    keyDateRows.some((r) => r.type === type && (r.tbd || r.date !== ''));
  /**
   * A SECOND registration open/close (owner 2026-08-30, narrowed 2026-08-31). Flagged, not blocked.
   *
   * ⚠ Narrowed from "any required type": SUBMISSION_DUE and RESULTS repeat legitimately — per
   * division, or per round — and flagging those was wrong. Only the registration pair is a
   * singleton (see SINGLETON_KEY_DATE_TYPES).
   *
   * Two reasons, one live and one ahead of us. Live: `nextDeadline` is `min(starts_at)` over the
   * REG_CLOSE rows, so a duplicate silently makes the EARLIER date the listing's deadline — an
   * early-bird cutoff would masquerade as the real one. (Early-bird belongs on a CUSTOM row, which
   * is how the seeded data already does it.) Ahead: `docs/timeline-model-plan.md` merges REG_OPEN +
   * REG_CLOSE into one REGISTRATION row by pairing them per edition, which is only unambiguous
   * while there is at most one of each — true of all 52 rows today, and worth keeping true through
   * the seeding run.
   *
   * Not a hard block: the curator is better placed to judge an unusual timeline than this rule is.
   */
  const duplicateRequiredType = (row: KeyDateRow) =>
    SINGLETON_KEY_DATE_TYPES.includes(row.type) &&
    keyDateRows.filter((o) => o.type === row.type).length > 1;
  /**
   * Half-filled rows gate SUBMIT but are deliberately NOT ring entries. The ring counts FIELDS a
   * curator has to fill; these are conditions satisfied by doing nothing, so counting them inflated
   * the denominator ("27 required" became "30") with rows that are already fine on a blank form.
   * They behave like `eligibilityValid`: they can block, and they redden their step, without
   * pretending to be work items.
   *
   * Phrased "finish or clear" because both are valid fixes — the point is that the curator chooses,
   * rather than the save choosing for them by silently dropping the row.
   */
  const rowIssues = [
    {
      key: 'partialResources',
      label: 'Finish or clear the part-filled prep resource',
      stepId: 'extras',
      ok: partialResourceRows.length === 0,
    },
    {
      key: 'partialFaqs',
      label: 'Finish or clear the part-filled FAQ',
      stepId: 'extras',
      ok: partialFaqRows.length === 0,
    },
    {
      key: 'tagLimit',
      label: `Keep tags to ${MAX_TAGS} — a filled payload can arrive with more`,
      stepId: 'overview',
      ok: tagCount <= MAX_TAGS,
    },
    {
      key: 'partialKeyDates',
      label: 'Give every dated milestone a date or mark it TBD',
      stepId: 'timeline',
      ok: partialKeyDateRows.length === 0,
    },
  ];
  // Create front-loads everything the public card/detail shows (item 5/9): the listing is
  // complete-by-default. Edit keeps only the base spine required, so legacy listings still save.
  // Import uses the SAME full checklist as create, but only to SHOW what a curator would have to
  // chase — see `blockingFields` below for what actually gates the button.
  const requiredFields = editing
    ? [
        { key: 'name', label: 'Name', stepId: 'overview', ok: isComplete(name, fieldErrors.name) },
        { key: 'category', label: 'Category', stepId: 'overview', ok: categoryId !== '' },
        { key: 'organizer', label: 'Organizer', stepId: 'overview', ok: orgChosen },
      ]
    : [
        { key: 'name', label: 'Name', stepId: 'overview', ok: isComplete(name, fieldErrors.name) },
        { key: 'category', label: 'Category', stepId: 'overview', ok: categoryId !== '' },
        { key: 'organizer', label: 'Organizer', stepId: 'overview', ok: orgChosen },
        {
          key: 'description',
          label: 'Description',
          stepId: 'overview',
          ok: isComplete(text.description, fieldErrors.description),
        },
        {
          key: 'officialUrl',
          label: 'Official URL',
          stepId: 'overview',
          ok: isComplete(text.officialUrl, fieldErrors.officialUrl),
        },
        {
          key: 'cover',
          label: 'Cover image',
          stepId: 'overview',
          ok: isComplete(coverUrl, fieldErrors.coverUrl),
        },
        {
          key: 'registrationUrl',
          label: 'Registration URL',
          stepId: 'administration',
          ok: isComplete(text.registrationUrl, fieldErrors.registrationUrl),
        },
        // ADMINISTRATION IS REQUIRED THROUGHOUT (owner 2026-08-28), except the two contact fields
        // and team size. These five are all @NotNull server-side, so an empty one is a 400 on
        // submit either way — listing them turns that into a labelled row in the ring instead of a
        // failure after the fact, which is the whole reason the enum defaults could be dropped.
        { key: 'costType', label: 'Entry fee', stepId: 'administration', ok: costType !== '' },
        // The AMOUNT is only a field when there is one to state. FREE has no fee, and an unanswered
        // Free/Paid has no amount to ask for yet.
        ...(costType === 'PAID'
          ? [
              {
                key: 'entryFee',
                label: 'Entry fee amount',
                stepId: 'administration',
                ok: isComplete(text.entryFee, fieldErrors.entryFee),
              },
              {
                key: 'currency',
                label: 'Currency',
                stepId: 'administration',
                ok: isComplete(text.currency, fieldErrors.currency),
              },
            ]
          : []),
        { key: 'delivery', label: 'Delivery', stepId: 'administration', ok: delivery !== '' },
        {
          key: 'participation',
          label: 'Participation',
          stepId: 'administration',
          ok: participation !== '',
        },
        {
          key: 'scopeLevel',
          label: 'Scope level',
          stepId: 'administration',
          ok: scopeLevel !== '',
        },
        { key: 'recurrence', label: 'Recurrence', stepId: 'administration', ok: recurrence !== '' },
        {
          key: 'eligibilityBasis',
          label: 'What the organizer provides',
          stepId: 'eligibility',
          ok: eligibilityBasis !== '',
        },
        // The three bag-backed eligibility gates. "Not provided" SATISFIES them — it is an answer
        // ("I read the page and it is silent"), and the listing shows it as one. What does not
        // satisfy them is '': nobody has looked. That distinction is the entire point of the
        // option, and it is why these read off form state rather than the stored bag, which
        // cannot tell the two apart.
        {
          key: 'studentStatus',
          label: 'Student status',
          stepId: 'eligibility',
          ok: studentStatus !== '',
        },
        {
          key: 'eligibleCountries',
          label: 'Eligible countries',
          stepId: 'eligibility',
          ok: eligibleCountry !== '',
        },
        {
          key: 'citizenship',
          label: 'Citizenship',
          stepId: 'eligibility',
          ok: citizenship !== '',
        },
        {
          key: 'entryPathway',
          label: 'Entry pathway',
          stepId: 'eligibility',
          ok: entryPathways.length > 0,
        },
        // Only the axis the curator said the organizer provides. The ring is where "still missing"
        // lives on this form, so the range requirement reads there instead of reddening a field
        // nobody has reached yet.
        ...(asksFor.grades
          ? [
              {
                key: 'gradeRange',
                label: 'Grade range',
                stepId: 'eligibility',
                ok: elig.minGrade !== '' || elig.maxGrade !== '',
              },
            ]
          : []),
        ...(asksFor.ages
          ? [
              {
                key: 'ageRange',
                label: 'Age range',
                stepId: 'eligibility',
                ok: elig.minAge !== '' || elig.maxAge !== '',
              },
            ]
          : []),
        {
          key: 'evaluationType',
          label: 'Evaluation types',
          stepId: 'judging',
          ok: evaluationTypes.length > 0,
        },
        {
          key: 'judgingCriteria',
          label: 'What judges look for',
          stepId: 'judging',
          // Bag-backed, so it is read from the stored value rather than the control — equally
          // satisfiable in raw-JSON mode, where the textarea is not rendered.
          ok: Array.isArray(attributes.judging_criteria)
            ? attributes.judging_criteria.length > 0
            : typeof attributes.judging_criteria === 'string' &&
              attributes.judging_criteria.trim() !== '',
        },
        { key: 'prize', label: 'Awards', stepId: 'awards', ok: hasPrizeLine },
        // COMPLETE rows only, counted the same way the submit path counts them (buildResources /
        // buildFaqs skip a row missing either half), so the ring can never say "done" on rows that
        // will be dropped on save. ⚠ A resource's preview image is NOT part of complete — most
        // resources never get one, and the card falls back to per-type art by design.
        {
          key: 'resources',
          label: `Prep resources (${MIN_EXTRAS})`,
          stepId: 'extras',
          ok:
            resourceRows.filter((r) => r.title.trim() !== '' && r.url.trim() !== '').length >=
            MIN_EXTRAS,
        },
        {
          key: 'faqs',
          label: `FAQ entries (${MIN_EXTRAS})`,
          stepId: 'extras',
          ok:
            faqRows.filter((f) => f.question.trim() !== '' && f.answer.trim() !== '').length >=
            MIN_EXTRAS,
        },
        { key: 'region', label: 'Region', stepId: 'administration', ok: regionIds.length > 0 },
        ...REQUIRED_KEY_DATE_TYPES.map((type) => ({
          key: `keydate_${type}`,
          label: defaultKeyDateLabel(type),
          stepId: 'timeline',
          ok: keyDateOk(type),
        })),
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
  const rowIssuesRemaining = rowIssues.filter((r) => !r.ok);
  const blockingRemaining = [...blockingFields.filter((r) => !r.ok), ...rowIssuesRemaining];
  const submittable = blockingRemaining.length === 0 && eligibilityValid;
  // On create every listed field carries a visible asterisk; on edit only the spine fields
  // (name/slug/category/organizer) do — organizer is now mandatory in edit mode too. Import shows
  // the same asterisks as create (they mark a complete listing), while still allowing approve.
  const req = !editing;

  // --- step content (written once; laid out as a stepper on create, stacked sections on edit) ---
  const stepDefs: StepDef[] = [
    {
      id: 'overview',
      label: 'Overview',
      meta: 'Name · category · cover',
      content: (
        <div className="grid gap-4">
          <input type="hidden" name="slug" value={slug} />
          {/* Two explicit column stacks rather than row-wise auto-placement: the fields have very
            different heights (a textarea, a card-shaped upload), so flowing them across rows left
            one column short. Grouped so the columns finish level, and so Tags sits under
            Description. Focus order runs down the left column, then the right. */}
          {/* An archived org holding the extracted name makes approve a 422 — the curator has to
              restore it or choose another, and finding that out only on submit wastes the review. */}
          {importing && archivedOrganizer && (
            <Alert tone="warning">
              An <b>archived</b> organization is already called “{archivedOrganizer.name}”. Restore
              it or pick a different organizer — approving with the extracted name will fail while
              it stays archived.
            </Alert>
          )}
          {/* COLUMN ALIGNMENT (owner 2026-08-25). The grid already stretches both columns to the
              same height; what didn't line up was their CONTENT, because each stack packed to the
              top and left its slack dangling below the last field. Two changes fix it at every
              width: every control here has a deterministic height (nothing scales with the column
              width or can be dragged bigger — see the cover image below), and each stack is a
              full-height flex column whose LAST field carries `mt-auto`. Whichever column is
              shorter pushes its final field to the bottom; the taller one has no slack, so
              `mt-auto` is inert there. Symmetric, so it self-corrects whichever side wins at a
              given breakpoint — no hard-coded "left is taller" assumption to go stale. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex h-full flex-col gap-4">
              <FormField label="Name" required error={fieldErrors.name}>
                <Input
                  name="name"
                  value={name}
                  minLength={2}
                  maxLength={300}
                  onChange={(e) => {
                    const v = e.target.value;
                    setName(v);
                    if (!slugLocked) setSlug(slugify(v));
                  }}
                />
              </FormField>
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
                label="Description"
                required={req}
                hintAs="icon"
                hint="Full write-up (About tab) — its first ~300 chars also become the card blurb. Write our own; never paste theirs."
                error={fieldErrors.description}
              >
                <Textarea
                  name="description"
                  defaultValue={c?.description ?? ''}
                  minLength={20}
                  maxLength={10000}
                  // 3 → 2 (owner 2026-08-28, "decrease the height a bit"). Still multi-line and
                  // still drag-resizable for the long write-up this field takes.
                  rows={2}
                  // Textarea's shared min-h-24 floor was overriding `rows`, so the box couldn't get
                  // shorter. Released here — it now sizes to its rows, and still scrolls/resizes for
                  // the long prose this field takes.
                  className="min-h-0"
                  onChange={mark('description')}
                />
              </FormField>
              <FormField
                className="mt-auto"
                label="Tags"
                hintAs="icon"
                hint="type a tag and press Enter or +. Paste a comma-separated list to add several."
              >
                <TagsInput name="tags" defaultValue={c?.tags ?? []} onCountChange={setTagCount} />
              </FormField>
            </div>
            <div className="flex h-full flex-col gap-4">
              <FormField
                label="Organizer"
                required
                hintAs="icon"
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
                      // Opens OVER this form rather than in a new tab (owner 2026-08-28). The tab
                      // kept the listing safe only by leaving it behind: the curator then had to
                      // come back and reload, which lost the listing anyway. A modal never unmounts
                      // this form, so every field typed so far is still here afterward.
                      setAddingOrg(true);
                      return;
                    }
                    setOrganizerOrgId(v);
                  }}
                  searchable
                />
              </FormField>
              <FormField
                label="Official URL"
                required={req}
                hintAs="icon"
                hint="the competition’s home page."
                error={fieldErrors.officialUrl}
              >
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
              {/* ALIGNED TO THE LEFT COLUMN'S THIRD FIELD (owner 2026-08-28). `mt-auto` pinned only
                  the BOTTOM: the right column is naturally shorter, so the slack collected above
                  the box and its top sat ~19px below the Description it sits beside. Absorbing the
                  leftover row instead (`flex-1` + the JUDGING_FIELD trick, so the CONTROL takes the
                  space rather than the label) pins BOTH ends — the box now starts level with the
                  Description textarea and still finishes level with the Tags input, at any height
                  either column happens to take. */}
              <FormField
                className={cn('flex-1', JUDGING_FIELD)}
                label="Cover image"
                labelAsText
                required={req}
                hintAs="icon"
                hint="Shown on the listing card and the detail header."
              >
                {/* w-full min-w-0: a grid item defaults to min-width:auto, which let the drop
                  zone size itself from its content height and overflow the column. */}
                <div className="h-full min-h-0 w-full min-w-0">
                  <ImageUpload
                    compact
                    // A FIXED height (h-36 = 144px, the listing card cover's real pixel height),
                    // not the `aspect-[263/144]` it used to carry. An aspect ratio makes the box
                    // grow and shrink with the column, so this column's total height changed at
                    // every breakpoint and the two columns only happened to line up at some of
                    // them. Width still fills like every other control; only the exact card
                    // PROPORTION is given up, and the height kept is the one the card uses.
                    // The field takes whatever height the row gives it and the drop zone absorbs
                    // the slack (`flex-1`), which is what keeps the URL row and upload notes from
                    // changing the column's height: they appear INSIDE the field's box and the
                    // zone shrinks to make room, so Tags opposite never moves (owner 2026-08-28).
                    className="flex h-full min-h-0 flex-col"
                    dropZoneClassName="min-h-0 w-full flex-1"
                    name="logo"
                    defaultValue={c?.logo}
                    uploadEnabled
                    onSelectFile={uploadCoverImage}
                    onChange={setCoverUrl}
                  />
                </div>
              </FormField>
            </div>
          </div>
        </div>
      ),
    },
    // First edition (create + import): a competition needs a running to be publicly visible (the
    // readiness gate). The card-facing facts (prize, region, deadline) are captured here so a new
    // listing is complete-by-default — one atomic create, and one atomic approve.
    {
      id: 'administration',
      label: 'Administration',
      meta: 'Sign-up · entry fee · delivery',
      // NOT hideOnEdit: delivery/cost/recurrence are competition-level and must stay editable.
      // The seasonal fields inside (location, fee, sign-up link, scope) carry their own !editing
      // guards — those are edited per-edition on the Editions tab.
      content: (
        // One 2-column grid, owner-set order (2026-08-23): sign-up + cost, then delivery +
        // location, then scope + recurrence — the sign-up link and price lead because they're
        // what a curator copies off the organizer's page first. On EDIT the three edition-level
        // fields (registration URL, location, scope) drop out and the remaining three simply
        // repack; only the create/import form shows the full 3×2.
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && (
            <FormField
              label="Registration URL"
              required
              hintAs="icon"
              hint="where entrants sign up."
              error={fieldErrors.registrationUrl}
            >
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
          )}
          <FormField
            label="Entry fee"
            labelAsText
            required={req}
            error={isFree ? undefined : (fieldErrors.entryFee ?? fieldErrors.currency)}
          >
            <div className="flex items-start gap-2">
              <Select
                name="costType"
                options={enumOptions(COST_TYPES)}
                placeholder="Free or paid…"
                value={costType}
                onValueChange={setCostType}
                className="w-32 shrink-0"
              />
              {!editing && (
                // Fee + currency stay MOUNTED on FREE and go disabled instead of vanishing
                // (owner 2026-08-23): the row keeps its shape, and a price typed before someone
                // flips to Free survives the flip back. Disabled controls are omitted from the
                // submission, so FREE still posts no fee — same payload the unmounted version
                // sent. `text` needs no resetting for the same reason: the values persist, so the
                // rules stay true to them (and entryFee/currency drop out of `requiredFields`
                // entirely while FREE, so a stale amount can never block a free listing).
                <>
                  <Input
                    name="edition_entryFee"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100000}
                    defaultValue={editionSeed?.entryFee ?? ''}
                    placeholder="0.00"
                    aria-label="Entry fee"
                    disabled={isFree}
                    onChange={mark('entryFee')}
                    className="min-w-0 flex-1"
                  />
                  <Input
                    name="edition_currency"
                    defaultValue={editionSeed?.currency ?? ''}
                    maxLength={3}
                    pattern="[A-Za-z]{3}"
                    placeholder="USD"
                    aria-label="Currency"
                    disabled={isFree}
                    onChange={mark('currency')}
                    className="w-20 shrink-0 uppercase"
                  />
                </>
              )}
            </div>
          </FormField>
          <FormField label="Delivery" required={req}>
            <Select
              name="delivery"
              options={enumOptions(DELIVERIES)}
              placeholder="Select…"
              value={delivery}
              onValueChange={(v) => {
                setDelivery(v);
                // Virtual delivery auto-tags the Virtual/Online region — the location IS the
                // internet; any extra regions then mean “who may enter”, not venues.
                if (v === 'VIRTUAL') {
                  const virtual = regions.find((r) => r.level === 'VIRTUAL');
                  if (virtual && !regionIds.includes(virtual.id)) toggleRegion(virtual.id);
                }
              }}
            />
          </FormField>
          {!editing && (
            <FormField
              label={delivery === 'VIRTUAL' ? 'Who can enter' : 'Location'}
              required
              labelAsText
              hintAs="icon"
              hint="the regions this running covers — shown on the card and drives the marketplace region filter. Virtual competitions keep the Online tag; add regions to say who may enter."
            >
              <div className="grid gap-1">
                {regionIds.map((id) => (
                  <input key={id} type="hidden" name="edition_regionIds" value={id} />
                ))}
                <RegionSelect
                  regions={regions}
                  selectedIds={regionIds}
                  onToggle={toggleRegion}
                  ariaLabel={delivery === 'VIRTUAL' ? 'Who can enter' : 'Location'}
                />
              </div>
            </FormField>
          )}
          {/* Row 3 — WHO ENTERS, moved off the Eligibility step (owner 2026-08-24): participation
              and its dependent team size are administrative shape ("how is this run"), not who
              qualifies, and they belong beside delivery. Team size only applies to team/both, so
              the inputs stay disabled otherwise — disabled fields aren't submitted, so
              INDIVIDUAL never posts a stray size. */}
          <FormField label="Participation" required={req}>
            <Select
              name="participationMode"
              options={enumOptions(PARTICIPATION_MODES)}
              placeholder="Select…"
              value={participation}
              onValueChange={setParticipation}
            />
          </FormField>
          <FormField label="Team size" hintAs="icon" hint="team competitions only">
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
          {/* Row 4 */}
          {!editing && (
            <FormField
              label="Scope level"
              required={req}
              hintAs="icon"
              hint="the season's overall reach — a regionals→nationals program is National."
            >
              <Select
                name="edition_scopeLevel"
                options={enumOptions(SCOPE_LEVELS)}
                placeholder="Select…"
                value={scopeLevel}
                onValueChange={setScopeLevel}
              />
            </FormField>
          )}
          <FormField label="Recurrence" required={req}>
            <Select
              name="recurrence"
              options={enumOptions(RECURRENCES)}
              placeholder="Select…"
              value={recurrence}
              onValueChange={setRecurrence}
            />
          </FormField>
          {/* Row 5 — the organizer's published contact points (owner 2026-08-25). Bag keys
              (`contact_email` / `contact_phone`, declared on every template by `0019`), so they
              carry the structured-mode gate the other bag fields do and surface publicly through
              the Overview overflow. The organizer's OWN published details, never a person's. */}
          {structured && (
            <>
              <FormField
                label="Contact email"
                hintAs="icon"
                hint="the organizer’s published contact address, from their site — shown on the listing. Never a personal address."
              >
                <Input
                  type="email"
                  inputMode="email"
                  value={
                    typeof attributes.contact_email === 'string' ? attributes.contact_email : ''
                  }
                  onChange={(e) => setAttrKey('contact_email', e.target.value)}
                  placeholder="info@organizer.org"
                  maxLength={320}
                />
              </FormField>
              <FormField
                label="Contact phone"
                hintAs="icon"
                hint="the organizer’s published phone number, if they list one."
              >
                <Input
                  type="tel"
                  inputMode="tel"
                  value={
                    typeof attributes.contact_phone === 'string' ? attributes.contact_phone : ''
                  }
                  onChange={(e) => setAttrKey('contact_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  maxLength={40}
                />
              </FormField>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'eligibility',
      label: 'Eligibility',
      meta: 'Grades · ages · countries',
      content: (
        // One 2-column grid, owner-set order (2026-08-24):
        //   R1  Grades          | Ages                          — the two ranges, each cell its own min/max
        //   R2  Student status  | Age cutoff date               — who qualifies, and as of when
        //   R3  Entry pathway   | Citizenship requirement
        //   R4  Other requirements | Eligible countries         — the catch-all beside the gate it explains
        // Participation + team size LEFT this step for Administration — they describe how the
        // competition is run, not who may enter. Bag-backed fields (student status, countries,
        // other requirements) carry the structured-mode gate; in raw-JSON mode they drop out and
        // the rest repacks, so the table above holds for the create/import form specifically.
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Row 0 — WHICH AXIS IS THE RULE (0023, blueprints decision 99). Full width and first,
              because it governs the two ranges under it: whichever axis is not stated becomes a
              derived search range and is never published as a rule. Leaving it unanswered is
              allowed and honest — the listing then reads "Not stated" rather than "All grades". */}
          <FormField
            label="What does the organizer provide?"
            labelAsText
            required={req}
            className="sm:col-span-2"
            hintAs="icon"
            hint="the axis the official page actually gives, and it decides which range you fill in below. Pick Ages when the page says “ages 13–18” even if you could work out the grades — a range we derived is used for filtering and is never shown as the rule. Leave it unanswered if the page states no eligibility at all; the ring will keep naming it."
          >
            {/* Five equal BOXES on one line (owner 2026-08-28) — a dropdown hid the choice behind a
                click on the field that governs the two below it, and loose radios did not read as
                part of the form. Each option wears the field wardrobe (h-10, --radius-field,
                border-border, bg-background) so the row sits in the grid like an Input or a Select
                would; the selected one inverts to the primary fill.
                `grid-cols-4` not flex: "all boxes same size" is the ask, and equal TRACKS give
                that regardless of label length, where flex would size each box to its own text.
                Still a real radiogroup underneath — arrow keys, one tab stop, and it posts under
                `eligibilityBasis` exactly as before. */}
            <RadioGroup
              name="eligibilityBasis"
              value={eligibilityBasis}
              onValueChange={setEligibilityBasis}
              aria-label="What does the organizer provide?"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {ELIGIBILITY_BASIS_OPTIONS.map((o) => (
                <Radio
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  hideControl
                  className={cn(
                    'h-10 items-center justify-center rounded-[var(--radius-field)] border px-2 text-center text-sm transition-colors',
                    eligibilityBasis === o.value
                      ? 'border-primary bg-primary font-medium text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-muted/50',
                  )}
                />
              ))}
            </RadioGroup>
          </FormField>
          {/* Row 1 — the two ranges. Min+max share a cell so the row reads as two bands, not
              four loose selects; the range error hangs off the cell that owns both ends. */}
          {/* Error = a RANGE ORDER mistake only (min above max). "Not filled in yet" is NOT an
              error and no longer renders as one (owner 2026-08-28): the field would open red on a
              form the curator has not started. What is missing belongs in the readiness ring,
              which already lists it by name, and what is always true belongs in the ⓘ. */}
          <FormField
            label="Grades"
            labelAsText
            error={eligErrors.minGrade}
            hintAs="icon"
            hint="required when the organizer provides grades — leave the row alone otherwise; it is disabled unless the choice above asks for it."
          >
            <div className="flex items-center gap-2">
              <Select
                name="minGrade"
                options={GRADE_OPTIONS}
                value={elig.minGrade}
                onValueChange={setEligValue('minGrade')}
                aria-label="Min grade"
                disabled={!asksFor.grades}
                className="min-w-0 flex-1"
              />
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <Select
                name="maxGrade"
                options={GRADE_OPTIONS}
                value={elig.maxGrade}
                onValueChange={setEligValue('maxGrade')}
                aria-label="Max grade"
                disabled={!asksFor.grades}
                className="min-w-0 flex-1"
              />
            </div>
          </FormField>
          <FormField
            label="Ages"
            labelAsText
            error={eligErrors.minAge}
            hintAs="icon"
            hint="required when the organizer provides ages — leave the row alone otherwise; it is disabled unless the choice above asks for it."
          >
            <div className="flex items-center gap-2">
              <Select
                name="minAge"
                options={AGE_OPTIONS}
                value={elig.minAge}
                onValueChange={setEligValue('minAge')}
                aria-label="Min age"
                disabled={!asksFor.ages}
                className="min-w-0 flex-1"
              />
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <Select
                name="maxAge"
                options={AGE_OPTIONS}
                value={elig.maxAge}
                onValueChange={setEligValue('maxAge')}
                aria-label="Max age"
                disabled={!asksFor.ages}
                className="min-w-0 flex-1"
              />
            </div>
          </FormField>
          {/* Row 2 — the enrollment gate and the date its age rule is measured from.
              Student status is a BOOLEAN since `0022` (owner 2026-08-26); it was a 300-char
              free-text box, which is why curators wrote whole clauses into a key named for a
              yes/no question. Sentences belong in Other eligibility requirements (0017). */}
          {structured && (
            <FormField
              label="Student status"
              required={req}
              hintAs="icon"
              hint="whether entrants must be enrolled students. The exact wording of the rule goes in Other eligibility requirements below."
            >
              {/* A dropdown, not a checkbox (owner 2026-08-28). A checkbox has two states and the
                  field has three: required, NOT required, and nobody has checked — and an unticked
                  box silently claimed the middle one. The stored value is still the `0022` BOOLEAN;
                  the empty option removes the key entirely, which is how the Eligibility tab knows
                  to omit the row rather than print "Not required" on a listing nobody read. */}
              {/* No `name`: the value's home is the attributes bag (setAttrKey), which is
                  serialized on submit. A named control would post a second, ignored copy — the
                  other bag-backed fields in attributes-fields.tsx are nameless for the same
                  reason. */}
              <Select
                options={STUDENT_STATUS_OPTIONS}
                placeholder="Select…"
                value={studentStatus}
                onValueChange={(v) => {
                  setStudentStatus(v);
                  setAttrKey('student_status_required', answeredAttr(v) ? v === 'true' : undefined);
                }}
                aria-label="Student status"
              />
            </FormField>
          )}
          {!editing && (
            <FormField
              label="Age cutoff date"
              hintAs="icon"
              hint="age eligibility is computed “as of” this date, the way competitions state age rules. Re-dated each season."
            >
              <Input
                name="edition_ageCutoffDate"
                type="date"
                defaultValue={editionSeed?.ageCutoffDate ?? ''}
              />
            </FormField>
          )}
          {/* Row 3 — how they enter, then the citizenship gate. */}
          <FormField
            label="Entry pathway"
            required={req}
            hintAs="icon"
            hint="how an entrant signs up. Tick every route the competition accepts — a listing open to both school and chapter entry is both boxes, and all three is open to all."
          >
            {/* A DROPDOWN that still selects many (owner 2026-08-28) — `Select multiple`, not a
                second component: options toggle, the popover stays open, and the trigger reads the
                chosen routes joined. It posts through a native `<select multiple>` under one name,
                so `multi(form, 'entryPathways')` reads it unchanged. The checkbox-card group this
                replaced cost three rows of height on a step that already has eight fields. */}
            <Select
              name="entryPathways"
              multiple
              options={ENTRY_PATHWAY_OPTIONS}
              values={entryPathways}
              onValuesChange={setEntryPathways}
              placeholder="Select…"
              aria-label="Entry pathway"
            />
          </FormField>
          {/* The two country gates are CLOSED dropdowns rather than the old comma-separated text
              (owner 2026-08-24): curators were free-typing spellings that no filter could ever
              match. The vocabulary is deliberately tiny — anything outside it is "Other", and the
              free-text field says what "Other" actually means. Both still POST as a one-element
              array, so the stored shape and the public Eligibility tab are unchanged.
              ⚠ DOM ORDER IS THE LAYOUT (owner 2026-08-24): the grid is auto-flow, so these three
              are emitted citizenship → other requirements → eligible countries to land as
              R3C2 / R4C1 / R4C2. Reordering the JSX moves the cells. */}
          {structured && (
            <>
              <FormField
                label="Citizenship"
                required={req}
                hintAs="icon"
                hint="citizenship / permanent-residency requirement, independent of where they live (e.g. USAMO). Pick Not provided when the page never raises it — that is an answer, and the listing shows it as one."
              >
                <Select
                  options={CITIZENSHIP_OPTIONS}
                  value={citizenship}
                  onValueChange={(v) => {
                    setCitizenship(v);
                    setAttrKey('citizenship_countries', answeredAttr(v) ? [v] : []);
                  }}
                />
              </FormField>
              {/* Row 4 — the catch-all, beside the country gate whose "Other" it most often
                  explains. Everything the closed vocabularies can't express (a country rule
                  outside the list, school-affiliation clauses, prior-round qualification) lands
                  here as prose rather than being wedged into a field that means something else.
                  Half-width now, not the full row it used to span. */}
              <FormField
                label="Other eligibility requirements"
                hintAs="icon"
                hint="anything the fields above can’t say — e.g. “must have qualified at a regional”, “open only to member schools”. Shown verbatim on the public Eligibility tab."
              >
                {/* One LINE tall by default, draggable taller (owner 2026-08-25): most listings
                    have no extra rule at all, so the field should cost a row's worth of space
                    until it's used — and the ones that do need a paragraph get the resize handle.
                    `min-h-10` overrides the Textarea's own `min-h-24` floor and stops a drag from
                    shrinking it below one line. Alignment survives: this is a flat auto-flow grid,
                    so growing this cell grows its whole ROW, and the two columns stay level. */}
                <Textarea
                  value={
                    typeof attributes.other_eligibility_requirements === 'string'
                      ? attributes.other_eligibility_requirements
                      : ''
                  }
                  onChange={(e) => setAttrKey('other_eligibility_requirements', e.target.value)}
                  maxLength={1000}
                  className="h-10 min-h-10 resize-y"
                />
              </FormField>
              <FormField
                label="Eligible countries"
                required={req}
                hintAs="icon"
                hint="where entrants must live or study. Pick Not provided when the page never says; pick Other and spell the rule out under Other requirements."
              >
                <Select
                  options={ELIGIBLE_COUNTRY_OPTIONS}
                  value={eligibleCountry}
                  onValueChange={(v) => {
                    setEligibleCountry(v);
                    setAttrKey('eligible_countries', answeredAttr(v) ? [v] : []);
                  }}
                />
              </FormField>
            </>
          )}
          {!structured && (
            <p className="text-xs text-muted sm:col-span-2">
              Attributes are in raw-JSON mode — edit the eligibility keys there directly:
              eligible_countries, citizenship_countries, student_status_required,
              other_eligibility_requirements.
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'judging',
      label: 'Judging',
      meta: 'Evaluation · rules',
      content: (
        // Two columns (owner 2026-08-23): HOW entries are assessed on the left, WHAT the
        // organizer publishes about it on the right. The left column is a real spine column and
        // always renders; the right one lives in the attributes bag, so it carries the same
        // structured-mode gate the Category-details step does.
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField
            label="Evaluation types"
            required={req}
            hintAs="icon"
            hint="how entries are judged; pick any that apply."
            labelAsText
          >
            {/* One row per type instead of a wrapped checkbox line: each option gets its
                explainer, a full-width hit area, and a visible selected state (border-primary,
                the same selected token Chip/Tabs use). */}
            <div className="grid gap-2">
              {EVALUATION_TYPES.map((token) => {
                const selected = evaluationTypes.includes(token);
                return (
                  <Checkbox
                    key={token}
                    name="evaluationType"
                    value={token}
                    checked={selected}
                    onChange={() => toggleEvaluationType(token)}
                    className={cn(
                      'items-start gap-2.5 rounded-[var(--radius-field)] border p-3 transition-colors',
                      selected
                        ? 'border-primary bg-surface-raised'
                        : 'border-border hover:bg-background',
                    )}
                    label={
                      <span className="grid gap-0.5">
                        <span className="font-medium text-foreground">{enumLabel(token)}</span>
                        <span className="text-xs text-muted">{EVALUATION_HINTS[token]}</span>
                      </span>
                    }
                  />
                );
              })}
            </div>
          </FormField>
          {/* Catalog INFO about how the ORGANIZER judges (2026-08-22 template keys) — written
              into the same attributes bag the Category-details step posts; the controls there
              omit these keys so nothing renders twice. NOT the gated judging system. The bag
              only POSTS in structured mode (a category picked, not raw-JSON editing), so the
              controls are gated on the same condition rather than silently dropping input. */}
          {structured ? (
            // Proportional rows against the checkbox stack — see JUDGING_ROWS for the ratio and
            // why it is fractions rather than pixels. The two text boxes stay equal to each other
            // (1.5fr each), which is what made this column read as one list of three answers
            // instead of three unrelated widgets.
            <div className={JUDGING_ROWS}>
              <FormField
                className={JUDGING_FIELD}
                label="What judges look for"
                required={req}
                hintAs="icon"
                hint="short criteria, comma-separated — e.g. Originality 40%, Method 30%, Presentation 30%."
              >
                {/* Textarea, not the one-line Input it was: real criteria run past a single line,
                    and it is what makes this box match its two neighbours. Still CSV — the value
                    is a string[] in the bag, so the parsing is unchanged. */}
                {/* Drag-expandable, like Description (owner 2026-08-29): `rows` sets the opening
                    height and the handle takes it from there. No `h-full` — a stretched box cannot
                    be dragged, since the track would keep overriding the height — and no
                    `resize-none`, which is what pinned it before.
                    ⚠ `rows={2}`, not 3: at 3 the two boxes plus the rubric's floor made this column
                    TALLER than the checkbox stack beside it, so the right column drove the row and
                    the rubric ran 14px past where the left column ended. At 2 the left column is
                    the taller one again, and the rubric's `1fr` absorbs the slack — which is what
                    makes both columns start AND end level. Re-measure both if you change it. */}
                <Textarea
                  value={judgingCriteriaText}
                  onChange={(e) => {
                    setJudgingCriteriaText(e.target.value);
                    setAttrKey('judging_criteria', csvToList(e.target.value));
                  }}
                  maxLength={500}
                  rows={2}
                  className="min-h-0"
                />
              </FormField>
              <FormField
                className={JUDGING_FIELD}
                label="Tie-breaker rules"
                hintAs="icon"
                hint="how the organizer breaks ties — shown to participants on the Judging tab."
              >
                <Textarea
                  value={typeof attributes.tie_breakers === 'string' ? attributes.tie_breakers : ''}
                  onChange={(e) => setAttrKey('tie_breakers', e.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="min-h-0"
                />
              </FormField>
              <FormField
                className={JUDGING_FIELD}
                label="Official Rubric"
                hintAs="icon"
                hint="the organizer’s current rules or rubric. A LINK is preferred — participants then always read the season’s live version; attach a PDF when the organizer publishes no stable page."
              >
                {/* Same drop-or-link field as the cover image (packages/ui FileUpload). Uploads
                    stay OFF until PDF storage is wired — browsing then explains itself and falls
                    through to link entry, which is the preferred answer anyway. Value lives in
                    the attributes bag, so no posted field: onChange is the only write path. */}
                {/* h-full on the WRAPPER too: the drop zone's own `h-full` resolves against this
                    div, so without it the zone fell back to its content height (~102px) and left
                    a gap at the bottom of its row. */}
                {/* RELATIVE + the field absolutely filling it: the field's CONTENT then contributes
                    nothing to layout height, so opening the URL row cannot grow this column — which
                    is what re-split the proportional tracks and resized the two textareas beside
                    it. Flooring the tracks alone was not enough: the OUTER two-column row is sized
                    by its tallest item's CONTENT, so the growth arrived from above the ratio. */}
                <div className="relative h-full min-h-0 w-full min-w-0">
                  <FileUpload
                    compact
                    // FIXED FIELD, FLEXING ZONE (owner 2026-08-28) — the same shape the cover image
                    // uses. These three boxes are PROPORTIONAL to each other (JUDGING_ROWS), so
                    // anything that made this field taller re-split the ratio and grew the two
                    // textareas beside it: opening the URL row added 25px to each. Pinning the
                    // field to its track and letting the zone absorb the slack means the row's
                    // height never changes, so its neighbours never move or resize — the URL entry
                    // appears at the end of THIS box instead.
                    className="absolute inset-0 flex min-h-0 flex-col"
                    dropZoneClassName="w-full min-h-0 flex-1"
                    noun="rubric"
                    article="a"
                    accept="application/pdf"
                    setLabel="Rules / rubric linked"
                    placeholder="https://…/rules.pdf"
                    urlIcon={<FilePdf className="size-4" />}
                    defaultValue={
                      typeof attributes.rules_url === 'string' ? attributes.rules_url : ''
                    }
                    onChange={(url) => setAttrKey('rules_url', url)}
                  />
                </div>
              </FormField>
            </div>
          ) : (
            <p className="text-xs text-muted">
              Pick a category first — judging info is stored with the category-specific fields. (In
              raw-JSON mode, edit the keys directly: judging_criteria, tie_breakers, rules_url.)
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'awards',
      label: 'Awards',
      meta: 'Prizes · order · value',
      // Awards are seasonal — managed per-edition on the Editions tab after create.
      hideOnEdit: true,
      content: (
        <FormField
          label="Awards"
          labelAsText
          required={req}
          hintAs="icon"
          hint="one complete award at least — a title plus its value (or its detail, for a non-money award). Listed in display order; the first money award leads the card (“$10,000 · …”). If the competition awards nothing but the placing, say so with “No award provided?” — that answers this too."
        >
          <AwardsInput
            name="edition_awards"
            initial={initialAwardRows}
            onPrizeLineChange={setHasPrizeLine}
          />
        </FormField>
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      meta: 'The running · dates · regions',
      hideOnEdit: true,
      content: (
        <div className="grid gap-4">
          {/* Import only: the cycle label is what decides whether an edition exists at all, so an
              empty one has to say what that costs. Extractions of pages that describe no running
              are legitimate — they just leave a listing the readiness gate hides. */}
          {importing && !editionSeed?.cycleLabel && (
            <Alert tone="warning">
              With no <b>cycle label</b> this approves the competition <b>without an edition</b>.
              The listing is then published but invisible (the readiness gate hides a competition
              with no running), and the dates and regions below are not saved. Add the year here, or
              approve now and create the edition on the listing afterwards.
            </Alert>
          )}
          {/* Cycle label is ASSIGNED, not asked (owner 2026-08-23): the year for a manual
              create; the extracted label on import — left empty there so an extraction with no
              running still approves edition-less (the warning above). */}
          <input
            type="hidden"
            name="edition_cycleLabel"
            value={editionSeed?.cycleLabel ?? (importing ? '' : String(new Date().getFullYear()))}
          />
          <FormField
            label="Key dates"
            labelAsText
            hintAs="icon"
            hint="needs a Registration closes or Submission due row (dated or TBD); add the rest as you have them."
          >
            {/* ONE panel of hairline-divided rows with "Add date" as its last row — the same
                shape the Awards editor settled on (owner 2026-08-24).
                TWO LINES per row, not one strip of six controls: line 1 is what the key date IS
                (type + label), line 2 is WHEN it happens (date + TBD + time + zone). The main
                column is ~650px, so a single line gave every control ~90px and the date input was
                clipping its own placeholder; splitting by meaning gives each field room without
                turning each date into a full card. */}
            <div className="rounded-[var(--radius-field)] border border-border">
              <div className="divide-y divide-border">
                {orderedKeyDateRows.map((row, i) => (
                  <div
                    key={row.key}
                    draggable={keyDateArmedKey === row.key}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setKeyDateDragKey(row.key);
                    }}
                    onDragEnd={() => {
                      setKeyDateDragKey(null);
                      setKeyDateArmedKey(null);
                    }}
                    onDragOver={(e) => e.preventDefault()} // required for the drop cursor
                    onDragEnter={() => dragOverKeyDate(row.key)}
                    className={cn(
                      'group flex gap-3 px-3.5 py-3.5',
                      keyDateDragKey === row.key && 'bg-brand-gold-soft/50 opacity-80',
                    )}
                  >
                    {/* Top-left of the row, not centred on the first control band (owner
                        2026-08-30). The grip and the position number are row-level chrome — they
                        belong to the whole key date, not to the Key date field they used to sit
                        beside — and anchoring them to the top keeps them in one place as the row
                        grows or shrinks (an "Ends" field appearing, an error wrapping). */}
                    <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
                      {/* The grip appears ONLY on rows with no date to sort them by (owner
                          2026-08-24): once a key date has a date the calendar owns its position,
                          so offering a handle there would promise a reorder that snaps back. TBD
                          rows are exactly the case where order is still the curator's call. */}
                      {isUndatedRow(row) ? (
                        <button
                          type="button"
                          aria-hidden="true"
                          tabIndex={-1}
                          onMouseDown={() => setKeyDateArmedKey(row.key)}
                          onMouseUp={() => setKeyDateArmedKey(null)}
                          className="hidden cursor-grab touch-none text-muted/40 group-focus-within:text-muted group-hover:text-muted active:cursor-grabbing sm:block"
                        >
                          <GripHandle className="size-4" />
                        </button>
                      ) : (
                        <span aria-hidden="true" className="hidden size-4 sm:block" />
                      )}
                      {/* Position, not identity: the number tracks where this key date falls in
                          the CHRONOLOGY the rows are sorted into, so it renumbers as dates change
                          and as undated rows are dragged. */}
                      <span
                        aria-hidden="true"
                        className="grid size-6 place-items-center rounded-full border border-border text-xs font-semibold text-muted tabular-nums"
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3">
                      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                        <FormField
                          label="Type"
                          className="min-w-0"
                          error={
                            duplicateRequiredType(row)
                              ? 'Already on the timeline — a second one would become the listing’s deadline. Use Custom for an extra cutoff.'
                              : undefined
                          }
                        >
                          <Select
                            name={`keydate_${i}_type`}
                            options={keyDateOptions(KEY_DATE_TYPES)}
                            value={row.type}
                            onValueChange={(v) =>
                              // Drop any end date when moving to a type that cannot span, so a
                              // value typed under the old type can't post from a hidden field.
                              patchKeyDateRow(row.key, {
                                type: v,
                                ...(SPAN_KEY_DATE_TYPES.includes(v) ? {} : { endDate: '' }),
                              })
                            }
                          />
                        </FormField>
                        <FormField
                          label="Label"
                          hintAs="icon"
                          hint="optional — leave empty and the public timeline uses the key date's own wording (shown greyed here). Type only to override it, or to name a Custom date."
                          className="min-w-0"
                        >
                          {/* Placeholder, never a pre-filled VALUE: it shows the exact wording
                              visitors will read for the chosen key date, so an empty field is
                              visibly a deliberate "use the standard name", not an unfinished one. */}
                          <Input
                            name={`keydate_${i}_label`}
                            maxLength={200}
                            placeholder={
                              row.type === 'CUSTOM'
                                ? 'Name this date'
                                : defaultKeyDateLabel(row.type)
                            }
                            value={row.label}
                            onChange={(e) => patchKeyDateRow(row.key, { label: e.target.value })}
                          />
                        </FormField>
                      </div>
                      {/* Line 2 — WHEN. TBD keeps every field on screen and DISABLES the three it
                          makes irrelevant (owner 2026-08-24), rather than swapping them out: the
                          row holds its shape, and the disabled controls still show what was typed
                          before the switch, so flipping back loses nothing. Disabled fields aren't
                          submitted, so a TBD row posts no date — the same payload the hidden flag
                          below already implied. */}
                      <div className="flex flex-wrap items-end gap-2">
                        <FormField label="Date" className="min-w-36 flex-1">
                          <Input
                            name={`keydate_${i}_date`}
                            type="date"
                            disabled={row.tbd}
                            value={row.date}
                            onChange={(e) => patchKeyDateRow(row.key, { date: e.target.value })}
                            className="w-full min-w-0"
                          />
                        </FormField>
                        {/* Only for the types that can actually span days — see
                            SPAN_KEY_DATE_TYPES. "Registration closes" is an instant, and offering
                            it an end date invited a value that means nothing. */}
                        {SPAN_KEY_DATE_TYPES.includes(row.type) && (
                          <FormField
                            label="Ends"
                            hintAs="icon"
                            hint="optional — only for a key date that runs over more than one day (a two-day finals). Leave empty for a single day; it ends at end-of-day in the zone below."
                            className="min-w-36 flex-1"
                            error={
                              row.endDate !== '' && row.date !== '' && row.endDate <= row.date
                                ? 'Must be after the start date.'
                                : undefined
                            }
                          >
                            <Input
                              name={`keydate_${i}_enddate`}
                              type="date"
                              disabled={row.tbd}
                              min={row.date || undefined}
                              value={row.endDate}
                              onChange={(e) =>
                                patchKeyDateRow(row.key, { endDate: e.target.value })
                              }
                              className="w-full min-w-0"
                            />
                          </FormField>
                        )}
                        <FormField label="Time" className="w-28 shrink-0">
                          <Input
                            name={`keydate_${i}_time`}
                            type="time"
                            disabled={row.tbd}
                            value={row.time}
                            onChange={(e) => patchKeyDateRow(row.key, { time: e.target.value })}
                            className="w-full min-w-0"
                          />
                        </FormField>
                        <FormField label="Time zone" className="w-24 shrink-0">
                          <Select
                            name={`keydate_${i}_timezone`}
                            options={ADMIN_TIMEZONES}
                            disabled={row.tbd}
                            value={row.timezone}
                            onValueChange={(v) => patchKeyDateRow(row.key, { timezone: v })}
                          />
                        </FormField>
                        {/* Last on the line (owner 2026-08-30): TBD is a verdict on the three
                            fields to its left — "we checked, none of this is published yet" — so it
                            reads after them rather than interrupting date → time → zone. */}
                        {row.tbd && <input type="hidden" name={`keydate_${i}_tbd`} value="on" />}
                        <button
                          type="button"
                          aria-pressed={row.tbd}
                          aria-label={`Key date ${i + 1} date is TBD`}
                          onClick={() => patchKeyDateRow(row.key, { tbd: !row.tbd })}
                          className={cn(
                            'h-10 shrink-0 rounded-[var(--radius-field)] border px-2.5 text-xs font-semibold transition-colors',
                            row.tbd
                              ? 'border-primary bg-surface-raised text-foreground'
                              : 'border-border text-muted hover:bg-background hover:text-foreground',
                          )}
                        >
                          TBD
                        </button>
                      </div>
                    </div>
                    {/* Dimmed until hover/focus — present for touch and keyboard, quiet otherwise
                        (the Awards editor's row-control grammar). */}
                    {/* A required key date's LAST remaining row can't be removed — deleting it
                        would make the form unsubmittable with no hint as to what vanished.
                        Duplicates of a required type, and any optional row, still go. */}
                    {keyDateRows.length > 1 && !isOnlyRequiredRow(row) ? (
                      <button
                        type="button"
                        aria-label={`Remove key date ${i + 1}`}
                        onClick={() => removeKeyDateRow(row.key)}
                        className="mt-0.5 grid size-7 shrink-0 place-items-center self-start rounded text-muted opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-danger"
                      >
                        <Trash aria-hidden="true" className="size-3.5" />
                      </button>
                    ) : (
                      <span aria-hidden="true" className="size-7 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addKeyDateRow}
                className="flex w-full items-center gap-1.5 rounded-b-[calc(var(--radius-field)-1px)] border-t border-border px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-4" /> Add date
              </button>
            </div>
          </FormField>
        </div>
      ),
    },
    // Resources + FAQ (owner 2026-08-25): the two curated extras the create flow never collected
    // — both previously reachable only via the edit page's managers AFTER a save, which meant a
    // second trip for data the curator had on screen during the first. The edit page keeps its
    // managers (they edit rows in place), so this step stays create/import-only.
    //
    // IMPORT REVIEW SHOWS THIS STEP (2026-08-28). It used to be hidden outright because approve
    // could not persist a sub-resource; ImportReviewService now creates the payload's `resources`
    // AND `faqs` rows after the competition exists, and the S3 extractor suggests both — so hiding
    // them would mean approving links and published answers a curator never saw. The rule the step
    // was built on is unchanged, it just points the other way now: controls that persist, or none.
    {
      id: 'extras',
      label: 'Resources & FAQ',
      meta: 'Prep links · questions',
      hideOnEdit: true,
      content: (
        <div className="grid gap-6">
          <FormField
            label="Prep resources"
            labelAsText
            required={req}
            hintAs="icon"
            hint={`at least ${MIN_EXTRAS} — curated links that help someone prepare: books, past papers, guides, videos. A row counts once it has a title and a URL; the preview image is optional. Shown in the Prep resources row on the listing; mark paid placements as affiliate so the disclosure renders.`}
          >
            <div className="rounded-[var(--radius-field)] border border-border">
              <div className="divide-y divide-border">
                {resourceRows.map((row, i) => (
                  <div
                    key={row.key}
                    draggable={resourceDrag.armed === row.key}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setResourceDrag((d) => ({ ...d, drag: row.key }));
                    }}
                    onDragEnd={() => setResourceDrag({ drag: null, armed: null })}
                    onDragOver={(e) => {
                      e.preventDefault(); // required for the drop cursor; reorder happens on enter
                    }}
                    onDragEnter={() => {
                      if (resourceDrag.drag !== null && resourceDrag.drag !== row.key)
                        setResourceRows((rows) => reorder(rows, resourceDrag.drag!, row.key));
                    }}
                    className={cn(
                      'group grid gap-2 px-3.5 py-3',
                      resourceDrag.drag === row.key && 'bg-brand-gold-soft/50 opacity-80',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Grip + rank as one quiet ordinal block (AwardsInput grammar): the number
                          is POSITION — it renumbers as rows are dragged, and it is exactly the
                          displayOrder the row will save with. */}
                      <button
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        onMouseDown={() => setResourceDrag((d) => ({ ...d, armed: row.key }))}
                        onMouseUp={() => setResourceDrag((d) => ({ ...d, armed: null }))}
                        className="hidden cursor-grab touch-none text-muted/50 group-focus-within:text-muted group-hover:text-muted active:cursor-grabbing sm:block"
                      >
                        <GripHandle className="size-4" />
                      </button>
                      <span
                        aria-hidden="true"
                        className="w-4 text-center text-xs text-muted tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <Input
                        aria-label={`Resource ${i + 1} title`}
                        name={`resource_${i}_title`}
                        placeholder="e.g. AMC 10 past papers"
                        maxLength={300}
                        value={row.title}
                        onChange={(e) => patchResourceRow(row.key, { title: e.target.value })}
                        className="min-w-0 flex-1"
                      />
                      <Select
                        aria-label={`Resource ${i + 1} type`}
                        name={`resource_${i}_type`}
                        options={enumOptions(RESOURCE_TYPES)}
                        value={row.type}
                        onValueChange={(v) => patchResourceRow(row.key, { type: v })}
                        className="w-32 shrink-0"
                      />
                      {/* Dimmed until hover/focus — the Awards editor's row-control grammar. */}
                      <button
                        type="button"
                        aria-label={`Remove resource ${i + 1}`}
                        onClick={() => removeResourceRow(row.key)}
                        className="grid size-7 shrink-0 place-items-center rounded text-muted opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-danger"
                      >
                        <Trash aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                    {/* Named on the row, not just in the ring: an incomplete row is DROPPED on
                        save, so the curator has to see which one. */}
                    {partialResourceRows.some((r) => r.key === row.key) && (
                      <p className="mt-1.5 pl-8 text-xs font-medium text-danger">
                        Needs both a title and a URL — finish it, or clear the row.
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Input
                        aria-label={`Resource ${i + 1} URL`}
                        name={`resource_${i}_url`}
                        type="url"
                        inputMode="url"
                        placeholder="https://…"
                        maxLength={1000}
                        value={row.url}
                        onChange={(e) => patchResourceRow(row.key, { url: e.target.value })}
                        className="min-w-0 flex-1"
                      />
                      {/* 🔒 The affiliate flag drives the public disclosure — checkbox presence
                          is the posted signal (same contract as the key-date TBD flag). */}
                      <Checkbox
                        name={`resource_${i}_affiliate`}
                        label="Affiliate link"
                        checked={row.affiliate}
                        onChange={(e) => patchResourceRow(row.key, { affiliate: e.target.checked })}
                        className="shrink-0"
                      />
                    </div>
                    {/* Optional card art (0020) — the resource's own cover/thumbnail; the public
                        card falls back to its type tint without one. */}
                    <Input
                      aria-label={`Resource ${i + 1} preview image URL`}
                      name={`resource_${i}_image`}
                      type="url"
                      inputMode="url"
                      placeholder="Preview image URL (optional) — https://…"
                      maxLength={1000}
                      value={row.image}
                      onChange={(e) => patchResourceRow(row.key, { image: e.target.value })}
                      className="min-w-0"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addResourceRow}
                className="flex w-full items-center gap-1.5 rounded-b-[calc(var(--radius-field)-1px)] border-t border-border px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-4" /> Add resource
              </button>
            </div>
          </FormField>
          <FormField
            label="FAQ"
            labelAsText
            required={req}
            hintAs="icon"
            hint={`at least ${MIN_EXTRAS} — questions parents and students actually ask, shown as the listing's FAQ tab. A row counts once it has both a question and an answer. Write our own answers; never paste the organizer's.`}
          >
            <div className="rounded-[var(--radius-field)] border border-border">
              <div className="divide-y divide-border">
                {faqRows.map((row, i) => (
                  <div
                    key={row.key}
                    draggable={faqDrag.armed === row.key}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setFaqDrag((d) => ({ ...d, drag: row.key }));
                    }}
                    onDragEnd={() => setFaqDrag({ drag: null, armed: null })}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDragEnter={() => {
                      if (faqDrag.drag !== null && faqDrag.drag !== row.key)
                        setFaqRows((rows) => reorder(rows, faqDrag.drag!, row.key));
                    }}
                    className={cn(
                      'group grid gap-2 px-3.5 py-3',
                      faqDrag.drag === row.key && 'bg-brand-gold-soft/50 opacity-80',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        onMouseDown={() => setFaqDrag((d) => ({ ...d, armed: row.key }))}
                        onMouseUp={() => setFaqDrag((d) => ({ ...d, armed: null }))}
                        className="hidden cursor-grab touch-none text-muted/50 group-focus-within:text-muted group-hover:text-muted active:cursor-grabbing sm:block"
                      >
                        <GripHandle className="size-4" />
                      </button>
                      <span
                        aria-hidden="true"
                        className="w-4 text-center text-xs text-muted tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <Input
                        aria-label={`FAQ ${i + 1} question`}
                        name={`faq_${i}_question`}
                        placeholder="e.g. Can homeschooled students enter?"
                        maxLength={500}
                        value={row.question}
                        onChange={(e) => patchFaqRow(row.key, { question: e.target.value })}
                        className="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        aria-label={`Remove FAQ ${i + 1}`}
                        onClick={() => removeFaqRow(row.key)}
                        className="grid size-7 shrink-0 place-items-center rounded text-muted opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-danger"
                      >
                        <Trash aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                    {/* One line tall until it's used, draggable taller — the Other-requirements
                        pattern: an answer is often a sentence, sometimes a paragraph. */}
                    <Textarea
                      aria-label={`FAQ ${i + 1} answer`}
                      name={`faq_${i}_answer`}
                      placeholder="The answer, in our words."
                      // Mirrors FaqRequest.MAX_ANSWER, added server-side 2026-08-30 — the column
                      // is TEXT, so without that constraint this cap would only bind the browser.
                      maxLength={LIMITS.faqAnswer}
                      value={row.answer}
                      onChange={(e) => patchFaqRow(row.key, { answer: e.target.value })}
                      className="h-10 min-h-10 resize-y"
                    />
                    {/* Same reason as the resource rows: a half-filled FAQ is dropped on save. */}
                    {partialFaqRows.some((f) => f.key === row.key) && (
                      <p className="mt-1.5 text-xs font-medium text-danger">
                        Needs both a question and an answer — finish it, or clear the row.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addFaqRow}
                className="flex w-full items-center gap-1.5 rounded-b-[calc(var(--radius-field)-1px)] border-t border-border px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-4" /> Add question
              </button>
            </div>
          </FormField>
        </div>
      ),
    },
    {
      id: 'attributes',
      label: 'Custom fields',
      meta: 'Category-specific · extras',
      content: (
        <div className="grid gap-4">
          {structured ? (
            <>
              <input
                type="hidden"
                name="attributes"
                value={Object.keys(attributes).length ? JSON.stringify(attributes) : ''}
              />
              <AttributesFields
                key={categoryId}
                schema={template?.jsonSchema ?? {}}
                uiHints={template?.uiHints ?? null}
                value={attributes}
                onChange={setAttributes}
                // The Judging + Eligibility steps own these keys with dedicated controls — never twice.
                omitKeys={[
                  'judging_criteria',
                  'tie_breakers',
                  'rules_url',
                  'eligible_countries',
                  'citizenship_countries',
                  'student_status_required',
                  'other_eligibility_requirements',
                  'contact_email',
                  'contact_phone',
                ]}
              />
              {/* The payload itself, tucked away (owner 2026-08-23): read it at a glance, or
                  switch to the existing raw-edit mode — never two live editors of one bag. Titled
                  like the two field sections above it (owner 2026-08-24) so the tab reads as three
                  named parts rather than two plus an unlabelled stray control. */}
              <section className="grid gap-3">
                <SubSectionHeading
                  title="Raw JSON payload"
                  hint="Exactly what the two sections above will save. Open it to check a value, or edit the bag directly when a field needs a shape the controls can’t express."
                />
                <details className="rounded-[var(--radius-field)] border border-border">
                  <summary className="cursor-pointer px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground">
                    Show payload
                  </summary>
                  <div className="grid gap-2 border-t border-border p-3">
                    <pre className="max-h-56 overflow-auto rounded-md bg-surface p-2 font-mono text-xs text-foreground">
                      {Object.keys(attributes).length ? JSON.stringify(attributes, null, 2) : '{ }'}
                    </pre>
                    <div>
                      <Button type="button" variant="ghost" size="sm" onClick={enterRawMode}>
                        Edit as JSON
                      </Button>
                    </div>
                  </div>
                </details>
              </section>
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
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={exitRawMode}>
                  Back to fields
                </Button>
              </div>
            </>
          ) : null}
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
            <FormSection key={s.id} title={s.label} hint={s.hint}>
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
  const steps = stepDefs.filter(
    (s) => !(s.hideOnCreate && mode === 'create') && !(s.hideOnImport && mode === 'import'),
  );
  const activeStepDef = steps.find((s) => s.id === activeStepId) ?? steps[0];
  if (!activeStepDef) return null; // steps always has ≥1 entry — this just narrows the type
  const activeIndex = steps.indexOf(activeStepDef);
  const prevStep = steps[activeIndex - 1];
  const nextStep = steps[activeIndex + 1];
  /**
   * Which steps carry a VISIBLE field error right now (as opposed to an unfilled required field).
   * A step showing an error must not read as done, even when every required field on it is filled:
   * the owner's rule is that green means "this step is finished", and a step with a red message
   * under a control plainly is not.
   */
  const stepHasError: Record<string, boolean> = {
    overview: Boolean(
      fieldErrors.name ||
      fieldErrors.slug ||
      fieldErrors.description ||
      fieldErrors.officialUrl ||
      fieldErrors.coverUrl,
    ),
    administration: Boolean(
      fieldErrors.registrationUrl || fieldErrors.entryFee || fieldErrors.currency,
    ),
    eligibility: !eligibilityValid,
    // Row issues are errors on their step too, so it cannot read as done while one stands.
    extras: rowIssues.some((r) => r.stepId === 'extras' && !r.ok),
    timeline: rowIssues.some((r) => r.stepId === 'timeline' && !r.ok),
  };
  // Overview is built above from its field errors; fold in its row issues (the tag limit) rather
  // than redeclaring the key.
  stepHasError.overview =
    stepHasError.overview === true || rowIssues.some((r) => r.stepId === 'overview' && !r.ok);

  const stepperSteps = steps.map((s) => {
    const stepReq = requiredFields.filter((r) => r.stepId === s.id);
    const missingHere = stepReq.some((r) => !r.ok);
    const erroredHere = stepHasError[s.id] === true;
    return {
      id: s.id,
      label: s.label,
      description: s.meta,
      // Optional fields are deliberately NOT part of this: a step is done when its REQUIRED work
      // is done and nothing on it is wrong (owner 2026-08-30).
      complete: stepReq.length > 0 && !missingHere && !erroredHere,
      incompleteRequired: missingHere,
      // Red is the state after a blocked submit, plus any live error — an error the curator can
      // see does not need a submit to justify flagging.
      invalid:
        erroredHere || (submitAttempted && blockingFields.some((r) => r.stepId === s.id && !r.ok)),
    };
  });

  // Completion summary — crowns the step rail rather than floating in its own card beside it, so
  // the overall state and the steps that add up to it read as one timeline. Which step holds the
  // next gap is left to the rail's own amber flags; repeating it here just crowded the header.
  const completionSummary = (
    <div className="flex items-center gap-3">
      <ProgressRing
        size={56}
        thickness={6}
        value={filledCount}
        max={totalRequired}
        label={
          importing
            ? `${filledCount} of ${totalRequired} listing-completeness fields filled`
            : `${filledCount} of ${totalRequired} required fields complete`
        }
      >
        {allComplete ? (
          <Check weight="bold" className="size-6 text-success" />
        ) : (
          <span className="text-base font-semibold tabular-nums text-foreground">
            {filledCount}
            <span className="text-xs text-muted">/{totalRequired}</span>
          </span>
        )}
      </ProgressRing>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">
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
      </div>
    </div>
  );

  // The submit closes the step rail, directly under the last step — the rail now reads top to
  // bottom as state → steps → the action they lead to, so the action sits where the work ends
  // instead of in a bar pinned across the viewport. Create stays gated on the whole ring; import
  // gates only on what the server actually refuses, and says so.
  /**
   * The submit guard (owner 2026-08-30). The three buttons used to be `disabled` while the form was
   * incomplete, which is a dead end: nothing explains WHY, and the rail's amber dots are easy to
   * miss. They are now live, and a blocked click paints the failing steps red and jumps to the
   * first one — the click becomes the thing that tells you what is wrong.
   *
   * This is UX, not enforcement. The server's @AssertTrue set runs on every submit regardless, and
   * remains the only real gate.
   */
  const guardSubmit = (e: MouseEvent<HTMLButtonElement>) => {
    if (submittable) return;
    e.preventDefault();
    setSubmitAttempted(true);
    const first = blockingRemaining[0];
    if (first) setActiveStepId(first.stepId);
    else if (!eligibilityValid) setActiveStepId('eligibility');
  };

  const submitAction = (
    <div className="grid gap-2">
      <Button
        type="submit"
        variant="brand"
        disabled={pending}
        onClick={guardSubmit}
        className="w-full"
      >
        {importing
          ? pending
            ? 'Approving…'
            : 'Approve & create'
          : pending
            ? 'Saving…'
            : 'Publish now'}
      </Button>
      {/* §8a lifecycle split (item 14): the same submit, parameterized by where the listing
          starts. Buttons post `listing_intent`; the server action maps it to listingStatus.
          "Submit for review" parks it on the review queue (/admin/review) for a second pair of
          eyes — process, not permission: with no roles yet, nothing STOPS direct publishing.
          Draft skips the completeness gate? No — same gate: the server's @AssertTrue checks run
          regardless of status, so a draft must already be a complete listing. */}
      {!importing && (
        <>
          <Button
            type="submit"
            name="listing_intent"
            value="review"
            variant="secondary"
            disabled={pending}
            onClick={guardSubmit}
            className="w-full"
          >
            Submit for review
          </Button>
          <Button
            type="submit"
            name="listing_intent"
            value="draft"
            variant="ghost"
            disabled={pending}
            onClick={guardSubmit}
            className="w-full"
          >
            Save as draft
          </Button>
        </>
      )}
      {blockingRemaining.length > 0 ? (
        // Create mode says nothing here: the ring at the head of the rail already carries the
        // count, and the disabled submit carries the consequence. Import still names what the
        // server will refuse, because there the button is NOT disabled by the same rule.
        importing || submitAttempted ? (
          <button
            type="button"
            onClick={() => {
              const first = blockingRemaining[0];
              if (first) setActiveStepId(first.stepId);
            }}
            className="text-left text-xs font-medium text-danger hover:underline"
          >
            Needs {blockingRemaining.map((r) => r.label.toLowerCase()).join(', ')} before it can be{' '}
            {importing ? 'approved' : 'published'}
          </button>
        ) : null
      ) : !eligibilityValid ? (
        <button
          type="button"
          onClick={() => setActiveStepId('eligibility')}
          className="text-left text-xs font-medium text-danger hover:underline"
        >
          Fix the errors in Format &amp; eligibility to continue
        </button>
      ) : importing && !allComplete ? (
        <span className="text-xs text-muted">
          {remaining.length} field{remaining.length === 1 ? '' : 's'} still empty — you can approve
          anyway and fill them in on the listing.
        </span>
      ) : null}
    </div>
  );

  return (
    <div>
      {/* Import review supplies its own page header (source, confidence, tabs), so create mode is
          the only one that draws a header here — and the completion ring now lives at the head of
          the step rail below, not beside the title. */}
      {!importing && (
        <div className="mb-5">
          <Link
            href="/admin/competitions"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Competitions
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h1 className="font-display text-2xl text-foreground">New competition</h1>
            {headerAction}
          </div>
        </div>
      )}

      {!importing && headerNotice}

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
            header={completionSummary}
            footer={submitAction}
            // order-last on mobile: the single-column stack would otherwise put the rail — and now
            // the submit that closes it — ABOVE the fields, so you'd meet "Create competition"
            // before anything to fill in. Desktop keeps source order (rail left, sticky).
            className="order-last md:order-none md:sticky md:top-4"
          />
          <div className="min-w-0 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 sm:p-6">
            <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <span className="flex items-center gap-1.5">
                <h2 className="font-display text-xl text-foreground">{activeStepDef.label}</h2>
                {activeStepDef.hint && (
                  <Tooltip content={activeStepDef.hint}>
                    <button
                      type="button"
                      aria-label={`More about ${activeStepDef.label}`}
                      className="inline-flex rounded-full text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none"
                    >
                      <Info aria-hidden="true" className="size-4" />
                    </button>
                  </Tooltip>
                )}
              </span>
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

        {/* The submit itself now closes the step rail (see submitAction) — what's left here is the
            error surface, which must stay in the wide column: an Alert has no room in a 236px rail. */}
        {state.error && (
          <Alert tone="danger" className="mt-4">
            {state.error}
          </Alert>
        )}
      </form>

      {/* ADD AN ORGANIZATION WITHOUT LEAVING THIS LISTING (owner 2026-08-28).
          Both modals render OUTSIDE the <form> above — Modal portals to document.body anyway, but
          keeping them out of the element tree also keeps the nested form's fields out of this
          form's submission. Nothing here unmounts the listing form, which is the whole point: a
          curator four steps into a listing can create the organizer and carry on where they were. */}
      {/* STEP 1 — the pasted payload named an organizer we have no id for. Reuse or create, decided
          before anything else, because every other field is reviewable without it and this one is
          not. Dismissing (✕/Escape) is allowed and lands on the form with the Organizer field
          empty: the required-ring already says it is missing, and forcing a choice here would trap
          a curator who wants to look at the rest of the listing first. */}
      <Modal
        open={resolvingOrg}
        onClose={() => setResolvingOrg(false)}
        title="Which organization runs this?"
        description={
          similarOrganizers.length > 0
            ? `The JSON names “${extractedOrganizer}”. Nothing matches it exactly, but these are close — reuse one, or create it as new.`
            : `The JSON names “${extractedOrganizer}”, and no organization matches. Create it, or pick a different one on the form.`
        }
        className="max-w-lg"
      >
        <div className="grid gap-2">
          {similarOrganizers.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                setOrganizerOrgId(org.id);
                setResolvingOrg(false);
              }}
              className="flex flex-col items-start gap-0.5 rounded-[var(--radius-field)] border border-border p-3 text-left transition-colors hover:border-muted/50 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="text-sm font-medium text-foreground">{org.name}</span>
              <span className="text-xs text-muted">
                {enumLabel(org.type)}
                {org.domain ? ` · ${org.domain}` : ''}
              </span>
            </button>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant={similarOrganizers.length > 0 ? 'secondary' : 'primary'}
              onClick={() => {
                setResolvingOrg(false);
                setAddingOrg(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add “{extractedOrganizer}” as new
            </Button>
            <Button variant="ghost" onClick={() => setResolvingOrg(false)}>
              I’ll choose on the form
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={addingOrg}
        onClose={() => setAddingOrg(false)}
        title="New organization"
        description="It’s selected as this listing’s organizer as soon as it’s created."
        className="max-w-lg"
      >
        <OrganizationForm
          prefill={{
            // Prefilled from the payload so a curator confirms rather than retypes. The domain
            // mirrors what the SERVER would infer for an auto-created org (registrable host of the
            // official URL), so both routes to a new organization land on the same value.
            name: extractedOrganizer ?? undefined,
            domain: registrableHost(c?.officialUrl ?? undefined),
          }}
          onCreated={(org) => {
            // Order matters: merge into the options BEFORE selecting, or the Select is handed a
            // value that isn't in its list yet and renders blank.
            setCreatedOrgs((prev) => [...prev, org]);
            // No `mark()` here: organizer readiness is DERIVED (`orgChosen`), not a `filled` flag,
            // so selecting the row is all the required-ring needs.
            setOrganizerOrgId(org.id);
            setAddingOrg(false);
            setJustCreatedOrg(org);
          }}
        />
      </Modal>
      <OrganizationCreatedModal
        organization={justCreatedOrg}
        onClose={() => setJustCreatedOrg(null)}
        returnLabel="Back to the listing"
      />
    </div>
  );
}
