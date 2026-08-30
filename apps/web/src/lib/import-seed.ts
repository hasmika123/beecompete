/**
 * Extracted import payload → the admin competition form's initial values.
 *
 * WHY THIS EXISTS: reviewing a queued extraction used to mean editing raw JSON. It now opens the
 * SAME form used to add a competition by hand, pre-filled — which means something has to read an
 * untrusted, possibly-malformed payload into typed form state. That reading is the risky part, so
 * it lives here as pure functions with tests rather than inline in a client component.
 *
 * Two rules shape everything below:
 *
 *  1. **Never invent.** A field the payload doesn't state stays empty; a value of the wrong shape
 *     is dropped, not coerced. A guessed deadline on a minors-facing catalog can make a student
 *     miss a real one (the extractor follows the same rule — see tools/seeding prompt date rules).
 *  2. **Never silently drop.** The form posts a whole payload back on approve, so any key the form
 *     has no control for would vanish on save. {@link splitImportPayload} sets those aside as
 *     `extras`, and the approve action merges them back underneath the form's values.
 */

import { DEFAULT_TIMEZONE, instantToZonedWallClock } from '@/lib/dates';
import {
  COST_TYPES,
  ELIGIBILITY_BASES,
  type EligibilityBasis,
  DELIVERIES,
  ENTRY_PATHWAYS,
  KEY_DATE_TYPES,
  PARTICIPATION_MODES,
  RECURRENCES,
  RESOURCE_TYPES,
  SCOPE_LEVELS,
} from '@/lib/admin-types';

/**
 * Organizer dropdown value meaning "create a new organization from the extracted name". The form
 * posts it in the `organizerOrgId` slot and {@link buildImportApprovalPayload} swaps it for the
 * server's resolve-or-create fields — a sentinel rather than a second control, so the import form
 * keeps the SAME single Organizer field the create form has.
 */
export const CREATE_ORGANIZER_SENTINEL = '__import_new_org__';

/** The competition spine fields the form renders, as form-ready strings/arrays. */
export interface CompetitionSeed {
  name: string;
  slug: string;
  categoryId: string;
  organizerOrgId: string | null;
  officialUrl: string | null;
  logo: string | null;
  description: string | null;
  tags: string[] | null;
  participationMode: string;
  delivery: string;
  entryPathways: string[];
  costType: string;
  recurrence: string;
  evaluationType: string[] | null;
  /** Which axis the organizer states; null when the extraction didn't say (pre-0023 payloads). */
  eligibilityBasis: EligibilityBasis | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  minGrade: number | null;
  maxGrade: number | null;
  minAge: number | null;
  maxAge: number | null;
  attributes: Record<string, unknown> | null;
}

/** The first-edition block, as the form's `edition_*` fields want it. */
export interface EditionSeed {
  cycleLabel: string;
  scopeLevel: string;
  registrationUrl: string;
  entryFee: string;
  currency: string;
  prizeSummary: string;
  prizeValue: string;
  prizeCurrency: string;
  ageCutoffDate: string;
}

/** One editable key-date row: wall clock in `timezone`, or TBD (R1-18). */
export interface KeyDateSeed {
  type: string;
  date: string;
  /** Calendar day the key date ends on, for a multi-day row; '' when it is a single day. */
  endDate: string;
  time: string;
  timezone: string;
  tbd: boolean;
  label: string;
}

/**
 * A prep-resource row (books, past papers, guides, videos) the payload suggested. Optional
 * everywhere: an extraction routinely has none, and the form starts with one blank row when so.
 *
 * ⚠ `isAffiliate` is a CLAIM ABOUT THE LINK, not a wish. It is true only when the URL already
 * carries our Amazon Associates tag — a bare amazon.com link earns nothing and must not render the
 * disclosure, and an unflagged tagged link is an FTC problem (compliance.md, DQ10). The paste
 * prompt therefore emits plain links with `isAffiliate: false` and tells the curator to tick the
 * box at the same moment they swap the tagged URL in.
 */
export interface ResourceSeed {
  title: string;
  url: string;
  type: string;
  isAffiliate: boolean;
  imageUrl: string;
}

/**
 * A suggested FAQ entry. The ANSWER is prose we publish under our own name and it renders with
 * FAQPage structured data, so it carries the same rule as the description: our words, grounded in
 * stated facts. A curator reads every one before approval.
 */
export interface FaqSeed {
  question: string;
  answer: string;
}

export interface ImportSeed {
  competition: CompetitionSeed;
  /** null when the payload described no running — the form then offers to add one. */
  edition: EditionSeed | null;
  keyDates: KeyDateSeed[];
  /** Prep resources from the payload; empty when it suggested none. */
  resources: ResourceSeed[];
  /** Suggested FAQ entries; empty when the payload had none. */
  faqs: FaqSeed[];
  regionIds: string[];
  /** The organizer as extracted, when it hasn't already been resolved to an org id. */
  organizerName: string | null;
  /** Payload keys with no form control, preserved verbatim through approve. */
  extras: { competition: Record<string, unknown>; edition: Record<string, unknown> };
}

// --- primitives over untyped JSON -------------------------------------------------------------

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** A number the form can show. Numeric strings are accepted — extractors emit both. */
function int(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function decimalText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const s = text(value);
  return s !== null && Number.isFinite(Number(s)) ? s : '';
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return items.length ? items : null;
}

/**
 * An enum token the form's dropdown can actually show; an absent or unrecognized value becomes
 * `''`, which the form renders as an unanswered dropdown (owner 2026-08-28).
 *
 * This replaced a `token(value, allowed, fallback)` helper that substituted a default. Why the
 * defaults went: a payload that never mentioned recurrence used to
 * arrive at the form showing "Annual", indistinguishable from a payload that said so. The curator
 * reviewing it has no way to tell our guess from the source's fact, and publishes the guess. Blank
 * is the honest rendering of "the source didn't say", and the form's required-ring turns it into a
 * question instead of a silent default.
 */
function enumOrBlank(value: unknown, allowed: readonly string[]): string {
  const s = text(value);
  return s !== null && allowed.includes(s) ? s : '';
}

/** Like {@link enumOrBlank} but null rather than '' — for a field the form treats as absent. */
function optionalToken<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const s = text(value)?.toUpperCase();
  return s != null && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

// --- the mapping ------------------------------------------------------------------------------

/** Payload keys the form has a control for — everything else is preserved as an extra. */
const MAPPED_COMPETITION_KEYS = new Set([
  'slug',
  'name',
  'organizerOrgId',
  'organizerName',
  'confirmNewOrganizer',
  'officialUrl',
  'logo',
  'description',
  'categoryId',
  'tags',
  'participationMode',
  'teamSizeMin',
  'teamSizeMax',
  'delivery',
  'entryPathway',
  'entryPathways',
  'evaluationType',
  'eligibilityBasis',
  'minGrade',
  'maxGrade',
  'minAge',
  'maxAge',
  'costType',
  'recurrence',
  'attributes',
  // Seeding extras the form renders in their own sections.
  'resources',
  'faqs',
  'edition',
  'keyDates',
  'regionIds',
]);

/** Edition keys the first-edition step renders. `prizeValue`/`ageCutoffDate`/… ride along as extras. */
const MAPPED_EDITION_KEYS = new Set([
  'cycleLabel',
  'scopeLevel',
  'registrationUrl',
  'entryFee',
  'currency',
  'prizeSummary',
  'prizeValue',
  'prizeCurrency',
  'ageCutoffDate',
]);

function unmapped(
  source: Record<string, unknown> | null,
  mapped: Set<string>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (!mapped.has(key)) rest[key] = value;
  }
  return rest;
}

export function splitImportPayload(payload: Record<string, unknown>): ImportSeed {
  const edition = obj(payload.edition);
  return {
    competition: {
      name: text(payload.name) ?? '',
      slug: text(payload.slug) ?? '',
      categoryId: text(payload.categoryId) ?? '',
      organizerOrgId: text(payload.organizerOrgId),
      officialUrl: text(payload.officialUrl),
      logo: text(payload.logo),
      description: text(payload.description),
      tags: strings(payload.tags),
      participationMode: enumOrBlank(payload.participationMode, PARTICIPATION_MODES),
      delivery: enumOrBlank(payload.delivery, DELIVERIES),
      entryPathways: entryPathwaySeeds(payload),
      costType: enumOrBlank(payload.costType, COST_TYPES),
      recurrence: enumOrBlank(payload.recurrence, RECURRENCES),
      evaluationType: strings(payload.evaluationType),
      // Read-either-shape, same approach as the retired `summary` and the singular `entryPathway`:
      // the ~56 payloads extracted before 0023 carry no basis at all, and a missing one is NULL
      // ("not stated"), never a default to GRADE — defaulting is exactly how a derived grade range
      // would go on publishing itself as the organizer's rule.
      eligibilityBasis: optionalToken(payload.eligibilityBasis, ELIGIBILITY_BASES),
      teamSizeMin: int(payload.teamSizeMin),
      teamSizeMax: int(payload.teamSizeMax),
      minGrade: int(payload.minGrade),
      maxGrade: int(payload.maxGrade),
      minAge: int(payload.minAge),
      maxAge: int(payload.maxAge),
      attributes: obj(payload.attributes),
    },
    edition: edition && {
      cycleLabel: text(edition.cycleLabel) ?? '',
      scopeLevel: enumOrBlank(edition.scopeLevel, SCOPE_LEVELS),
      registrationUrl: text(edition.registrationUrl) ?? '',
      entryFee: decimalText(edition.entryFee),
      currency: (text(edition.currency) ?? '').toUpperCase(),
      prizeSummary: text(edition.prizeSummary) ?? '',
      prizeValue: int(edition.prizeValue) != null ? String(int(edition.prizeValue)) : '',
      prizeCurrency: text(edition.prizeCurrency) ?? '',
      // Already a plain calendar date in payloads (extractor rule: bare dates for cutoffs).
      ageCutoffDate: text(edition.ageCutoffDate) ?? '',
    },
    keyDates: keyDateSeeds(payload.keyDates),
    resources: resourceSeeds(payload.resources),
    faqs: faqSeeds(payload.faqs),
    regionIds: strings(payload.regionIds) ?? [],
    organizerName: text(payload.organizerOrgId) ? null : text(payload.organizerName),
    extras: {
      competition: unmapped(payload, MAPPED_COMPETITION_KEYS),
      edition: unmapped(edition, MAPPED_EDITION_KEYS),
    },
  };
}

/**
 * Extracted timeline rows → editable form rows. A row's stored instant is shown as the wall clock
 * in its OWN zone so the curator edits the day the source page stated.
 *
 * Rows with no `timezone` are read in UTC, not the admin default: the extractor emits
 * `T00:00:00Z` for a page that gives a day but no clock time, and Eastern would render that as the
 * PREVIOUS calendar day — turning "Nov. 3" on the page into "Nov 2" in the form on most date-only
 * extractions. (Same reasoning as the raw-JSON edition panel.)
 */
/**
 * Entry pathways, reading EITHER shape (`0024`, domain-model §7a.1).
 *
 * The ~46 queued extractions predate the change and carry a singular `entryPathway` string,
 * including the composite tokens the set model retired. Mapping them here rather than rewriting
 * stored payloads is what the plan calls for — the same treatment the retired `summary` got — so a
 * queued row still reviews correctly without a data migration. The expansion matches `0024`'s
 * backfill exactly: SCHOOL_OR_CHAPTER is both school routes, OPEN/EITHER is all three.
 */
function entryPathwaySeeds(payload: Record<string, unknown>): string[] {
  const many = strings(payload.entryPathways);
  if (many)
    return many.map((t) => t.toUpperCase()).filter((t) => ENTRY_PATHWAYS.includes(t as never));
  const single = text(payload.entryPathway)?.toUpperCase();
  if (single == null) return [];
  if (single === 'SCHOOL_OR_CHAPTER') return ['SCHOOL', 'CHAPTER'];
  if (single === 'OPEN' || single === 'EITHER') return ['INDIVIDUAL', 'SCHOOL', 'CHAPTER'];
  return ENTRY_PATHWAYS.includes(single as never) ? [single] : [];
}

function resourceSeeds(value: unknown): ResourceSeed[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): ResourceSeed[] => {
    const row = obj(raw);
    if (!row) return [];
    // Title AND url or nothing: the submit path skips incomplete rows anyway, so a half row would
    // only look like data the curator has to clear by hand.
    const title = text(row.title);
    const url = text(row.url);
    if (title === null || url === null) return [];
    const type = text(row.type)?.toUpperCase() ?? '';
    return [
      {
        title,
        url,
        // An unrecognized type falls back to OTHER rather than dropping the row — the link is the
        // valuable part and the curator can retype a dropdown in one click.
        type: (RESOURCE_TYPES as readonly string[]).includes(type) ? type : 'OTHER',
        isAffiliate: row.isAffiliate === true,
        imageUrl: text(row.imageUrl) ?? '',
      },
    ];
  });
}

function faqSeeds(value: unknown): FaqSeed[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): FaqSeed[] => {
    const row = obj(raw);
    if (!row) return [];
    // Both halves or neither: a question with no answer is worse than no row — it would publish an
    // unanswered question on the listing's FAQ tab.
    const question = text(row.question);
    const answer = text(row.answer);
    if (question === null || answer === null) return [];
    return [{ question, answer }];
  });
}

function keyDateSeeds(value: unknown): KeyDateSeed[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): KeyDateSeed[] => {
    const row = obj(raw);
    if (!row) return [];
    const type = text(row.type);
    // A row whose type isn't a real key date can't be posted back; the warnings surface it.
    if (type === null || !(KEY_DATE_TYPES as readonly string[]).includes(type)) return [];
    const timezone = text(row.timezone) ?? 'UTC';
    const wall = instantToZonedWallClock(text(row.startsAt), timezone);
    // The END day, read in the SAME zone as the start so a range never shifts a day relative to
    // it. Only the day survives into the form (the control is a date, not a datetime); the end
    // time is re-derived as end-of-day on save.
    const endWall = instantToZonedWallClock(text(row.endsAt), timezone);
    return [
      {
        type,
        date: wall ? wall.slice(0, 10) : '',
        endDate: endWall ? endWall.slice(0, 10) : '',
        time: wall ? wall.slice(11, 16) : '',
        timezone,
        tbd: wall === null,
        label: text(row.label) ?? '',
      },
    ];
  });
}

// --- what the curator should be told ----------------------------------------------------------

export interface ImportSeedWarning {
  key: string;
  message: string;
  /**
   * True for the handful the SERVER refuses outright — the rest are things a page simply didn't
   * say. Keeping the distinction visible matters: telling a curator "none of this blocks approval"
   * next to something that does is how a review screen loses their trust.
   */
  blocking?: boolean;
}

/**
 * Things about THIS payload a curator should see before approving. Advisory only — the import path
 * is deliberately lenient (an extraction routinely can't state a prize or a fee), so none of these
 * block approval; they say where to look.
 */
export function importSeedWarnings(
  payload: Record<string, unknown>,
  seed: ImportSeed,
): ImportSeedWarning[] {
  const warnings: ImportSeedWarning[] = [];

  if (seed.competition.categoryId === '') {
    warnings.push({
      key: 'category',
      message: 'No category was extracted — pick one below.',
      blocking: true,
    });
  }
  if (seed.competition.organizerOrgId === null && seed.organizerName === null) {
    warnings.push({
      key: 'organizer',
      message: 'No organizer was extracted. Approving needs one: pick or create it below.',
      blocking: true,
    });
  }
  if (!seed.edition) {
    warnings.push({
      key: 'edition',
      message:
        'No edition was extracted. Without a running the listing is published but invisible (the readiness gate hides it).',
    });
  }

  const rows = Array.isArray(payload.keyDates) ? payload.keyDates : [];
  const dropped = rows.length - seed.keyDates.length;
  if (dropped > 0) {
    warnings.push({
      key: 'keyDates',
      message: `${dropped} extracted key date${dropped === 1 ? '' : 's'} had an unusable type and ${dropped === 1 ? 'was' : 'were'} left out. Check the raw payload.`,
    });
  }
  if (
    seed.edition &&
    !seed.keyDates.some((r) => r.type === 'REG_CLOSE' || r.type === 'SUBMISSION_DUE')
  ) {
    warnings.push({
      key: 'deadline',
      message:
        'No registration-close or submission-due date, so the card and search will show no deadline.',
    });
  }
  if (seed.keyDates.length > 0 && seed.keyDates.every((r) => r.tbd)) {
    warnings.push({
      key: 'allTbd',
      message:
        'Every extracted date is TBD. That is the correct extraction for a page that never dated its key dates — it just means someone has to look them up.',
    });
  }

  const extraKeys = [
    ...Object.keys(seed.extras.competition),
    // `status` is an extra by DESIGN (the form derives it; an extracted value still rides through
    // and the server honors it) — every pipeline payload carries one, so warning on it would put
    // a false alarm on every single import review.
    ...Object.keys(seed.extras.edition)
      .filter((k) => k !== 'status')
      .map((k) => `edition.${k}`),
  ];
  if (extraKeys.length > 0) {
    warnings.push({
      key: 'extras',
      message: `Kept as-is (no field on this form): ${extraKeys.join(', ')}. Edit them in the Raw payload tab.`,
    });
  }

  return warnings;
}

/** Default timezone for a key-date row the curator ADDS (extracted rows keep their own). */
export const NEW_KEY_DATE_TIMEZONE = DEFAULT_TIMEZONE;
