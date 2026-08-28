/**
 * FormData → admin-API request shapes for the competition form.
 *
 * These live outside the server-action files because TWO write paths now post the SAME form: the
 * admin create flow (`POST /competitions/with-edition`) and import review, which approves a queued
 * extraction by sending the edited form back as the record's payload. A `'use server'` module can
 * only export async functions, so the shared pure builders had to move here.
 *
 * The field names are the contract with `components/admin/competition-form.tsx`: spine fields by
 * their API name, the first edition prefixed `edition_`, and key dates as indexed rows
 * (`keydate_0_type`, `keydate_0_date`, …).
 */

import { DEFAULT_TIMEZONE, zonedWallClockToInstant } from '@/lib/dates';
import { CREATE_ORGANIZER_SENTINEL } from '@/lib/import-seed';

export function str(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function num(form: FormData, key: string): number | undefined {
  const value = str(form, key);
  return value === undefined ? undefined : Number(value);
}

function list(form: FormData, key: string): string[] | undefined {
  const value = str(form, key);
  if (value === undefined) return undefined;
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Repeated form fields (checkbox groups) → array. Undefined when nothing is checked. */
function multi(form: FormData, key: string): string[] | undefined {
  const items = form.getAll(key).filter((v): v is string => typeof v === 'string' && v !== '');
  return items.length ? items : undefined;
}

/** Build the CompetitionRequest body from the form; throws a readable message on bad JSON. */
export function buildCompetitionBody(form: FormData): Record<string, unknown> {
  let attributes: unknown = undefined;
  const rawAttributes = str(form, 'attributes');
  if (rawAttributes) {
    try {
      attributes = JSON.parse(rawAttributes);
    } catch {
      throw new Error('Attributes must be valid JSON.');
    }
  }
  return {
    slug: str(form, 'slug'),
    name: str(form, 'name'),
    organizerOrgId: str(form, 'organizerOrgId') ?? null,
    officialUrl: str(form, 'officialUrl') ?? null,
    logo: str(form, 'logo') ?? null,
    description: str(form, 'description') ?? null,
    summary: str(form, 'summary') ?? null,
    categoryId: str(form, 'categoryId'),
    tags: list(form, 'tags') ?? null,
    participationMode: str(form, 'participationMode'),
    teamSizeMin: num(form, 'teamSizeMin') ?? null,
    teamSizeMax: num(form, 'teamSizeMax') ?? null,
    delivery: str(form, 'delivery'),
    entryPathway: str(form, 'entryPathway'),
    evaluationType: multi(form, 'evaluationType') ?? null,
    // '' (the "not stated" option) posts as null, not as an empty string: the server's enum
    // binding rejects '', and null IS the value we mean — nobody has recorded the rule.
    eligibilityBasis: str(form, 'eligibilityBasis') ?? null,
    minGrade: num(form, 'minGrade') ?? null,
    maxGrade: num(form, 'maxGrade') ?? null,
    minAge: num(form, 'minAge') ?? null,
    maxAge: num(form, 'maxAge') ?? null,
    costType: str(form, 'costType'),
    recurrence: str(form, 'recurrence'),
    attributes: attributes ?? null,
  };
}

export interface AwardJson {
  title: string;
  type: string;
  value?: number;
  currency?: string;
  detail?: string;
  /** How many of this award are given — "$2,500 × 6", one per category. Omitted = 1. */
  count?: number;
}

/** The row's winner count as arithmetic needs it — `count` is only ever stored when ≥ 2. */
export function awardCount(award: AwardJson): number {
  return typeof award.count === 'number' && award.count >= 2 ? Math.floor(award.count) : 1;
}

/** The awards rows as posted (one JSON field). Malformed → empty — it's our own hidden field. */
export function parseAwards(raw: string | undefined): AwardJson[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AwardJson[]) : [];
  } catch {
    return [];
  }
}

/**
 * How the card's prize line (`prize_summary` — the card renders it verbatim) is derived from the
 * awards rows (owner 2026-08-24): the row titles in order, the top money award's amount, the sum
 * of the money awards, or text the curator writes. Stored as `prize_display_mode` in the
 * edition's attributes bag (omitted for the default) so an edit round-trips the choice.
 */
export type PrizeDisplayMode = 'titles' | 'top' | 'total' | 'custom';

const PRIZE_MODES: readonly PrizeDisplayMode[] = ['titles', 'top', 'total', 'custom'];

export function asPrizeDisplayMode(value: unknown): PrizeDisplayMode {
  return PRIZE_MODES.includes(value as PrizeDisplayMode) ? (value as PrizeDisplayMode) : 'titles';
}

/** "$5,000" — cents only when the value has them; falls back to "5000 USD" on a bad code. */
export function formatPrizeMoney(value: number, currencyCode?: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode ?? 'USD',
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currencyCode ?? ''}`.trim();
  }
}

/**
 * What an award is WORTH, as text — the money amount for a valued row, the curator's free-text
 * detail otherwise ("Gold medal + plaque", "8-week internship"). null when the row says neither,
 * which is the caller's cue to fall back. Exported so the awards editor's own row rendering and
 * the card derivation agree on what "the value" of a non-money award is.
 */
export function awardValueText(award: AwardJson): string | null {
  if (typeof award.value === 'number' && award.value > 0) {
    return formatPrizeMoney(award.value, award.currency);
  }
  const detail = award.detail?.trim();
  return detail ? detail : null;
}

/**
 * The edition's typed prize columns (card line, Awards tab headline), DERIVED from the awards
 * rows. Shared by the create form, the per-edition edit form, and the editor's live card preview
 * — one derivation, no drift. The rows themselves ride in `attributes.awards` (JSONB — H47
 * lifts them at Phase 3).
 *
 * ORDER, not magnitude (owner 2026-08-24): "top award" means the row the curator PUT FIRST, not
 * the largest number. The rows are hand-ordered and drag-reorderable precisely so first place
 * leads; picking the max instead silently overrode that whenever a lower-placed award happened
 * to carry more money (a $15k scholarship listed under a $10k first prize). `prizeValue` /
 * `prizeCurrency` follow the first MONEY row in that same order, so the card line and the
 * detail strip's amount can never disagree.
 */
export function derivedPrizeFields(
  awards: AwardJson[],
  mode: PrizeDisplayMode = 'titles',
  customText = '',
): {
  prizeSummary: string | null;
  prizeValue: number | null;
  prizeCurrency: string | null;
} {
  const custom = customText.trim().slice(0, 500);
  if (awards.length === 0) {
    // A custom line survives an empty rows editor — "Up to $5,000 in prizes" is a legitimate
    // card line for a competition whose per-place breakdown isn't curated yet.
    return {
      prizeSummary: mode === 'custom' && custom !== '' ? custom : null,
      prizeValue: null,
      prizeCurrency: null,
    };
  }
  const hasMoney = (a: AwardJson) => typeof a.value === 'number' && a.value > 0;
  // The lead money row = first in ORDER that carries an amount (see the note above).
  const lead = awards.find(hasMoney);
  // A multi-winner award carries its count in the fallback line — "Best in category ×6" is a
  // different (and bigger) fact than "Best in category".
  const titles = awards
    .map((a) => (awardCount(a) > 1 ? `${a.title} ×${awardCount(a)}` : a.title))
    .join(' · ')
    .slice(0, 500);
  let summary = titles; // every mode falls back to titles when its own inputs are missing
  if (mode === 'top') {
    // The first row's VALUE, whatever kind of award it is (owner 2026-08-24): the amount for a
    // money award, the free-text detail for a certificate/trophy/travel one — never the title,
    // which the mode's own name promises it will not show. A row with neither (an untyped
    // placeholder) keeps its title rather than rendering the card blank.
    const first = awards[0];
    if (first) {
      summary = awardValueText(first) ?? first.title;
      // A multi-winner money award shows the per-winner amount, said so — "$2,500" for a ×6 award
      // reads as the whole pot. Money only: "Gold medal each" is not English.
      if (hasMoney(first) && awardCount(first) > 1) summary = `${summary} each`;
    }
  } else if (mode === 'total' && lead) {
    // Sum only rows in the lead award's currency — adding 10,000 USD to 5,000 EUR would print a
    // number that is true in no currency. A ×6 award contributes six times: value is per winner.
    const sum = awards
      .filter((a) => hasMoney(a) && a.currency === lead.currency)
      .reduce((acc, a) => acc + (a.value as number) * awardCount(a), 0);
    summary = `${formatPrizeMoney(sum, lead.currency)} in prizes`;
  } else if (mode === 'custom' && custom !== '') {
    summary = custom;
  }
  return {
    prizeSummary: summary,
    prizeValue: lead?.value ?? null,
    prizeCurrency: lead?.currency ?? null,
  };
}

/**
 * Merge the display-mode marker into an attributes bag: stale marker cleared first, written
 * only when the mode is non-default — the bag carries choices, not defaults.
 */
export function withPrizeDisplayMode(
  attributes: Record<string, unknown>,
  mode: PrizeDisplayMode,
): Record<string, unknown> {
  const { prize_display_mode: _stale, ...rest } = attributes;
  return mode === 'titles' ? rest : { ...rest, prize_display_mode: mode };
}

/**
 * The prize block of the first edition — the derived typed columns, plus the awards rows
 * themselves riding in the attributes bag. No rows → no attributes key at all, so an untouched
 * Awards step stores nothing (and a malformed hidden field, already parsed to [], does the same).
 */
function prizeFromAwards(form: FormData): Record<string, unknown> {
  const awards = parseAwards(str(form, 'edition_awards'));
  const mode = asPrizeDisplayMode(str(form, 'edition_awardsMode'));
  const custom = str(form, 'edition_awardsCustom') ?? '';
  return awards.length === 0
    ? { ...derivedPrizeFields(awards, mode, custom) }
    : {
        ...derivedPrizeFields(awards, mode, custom),
        attributes: withPrizeDisplayMode({ awards }, mode),
      };
}

/** The first-edition block of the combined create form — the year's running. */
export function buildFirstEdition(form: FormData): Record<string, unknown> {
  return {
    cycleLabel: str(form, 'edition_cycleLabel'),
    // No status key AT ALL (not even null): create derives it from the key dates server-side,
    // and on import-approve this object is spread OVER extras.edition — an extracted status
    // must survive that spread, which a null here would clobber.
    scopeLevel: str(form, 'edition_scopeLevel') ?? 'NATIONAL',
    registrationUrl: str(form, 'edition_registrationUrl') ?? null,
    entryFee: num(form, 'edition_entryFee') ?? null,
    currency: str(form, 'edition_currency')?.toUpperCase() ?? null,
    ageCutoffDate: str(form, 'edition_ageCutoffDate') ?? null,
    // prize_summary / prize_value / prize_currency are DERIVED from the awards rows (owner
    // 2026-08-23) — the Awards step is the single editor, so the form never asks twice.
    ...prizeFromAwards(form),
  };
}

/**
 * Prep resources from the create form's indexed rows (`resource_0_title`, …) — the extras step,
 * 2026-08-25. A row needs BOTH a title and a URL to count (the pair is what the public row
 * renders); anything less is an abandoned blank and is skipped, so the empty seeded row posts
 * nothing. displayOrder numbers the KEPT rows — a skipped blank must not leave a hole.
 *
 * These do not ride the atomic create payload: the server keeps resources/FAQs as sub-resources
 * of an existing competition, so `createCompetition` posts them AFTER the create returns an id.
 */
export function buildResources(form: FormData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; form.has(`resource_${i}_title`); i++) {
    const title = str(form, `resource_${i}_title`);
    const url = str(form, `resource_${i}_url`);
    if (title === undefined || url === undefined) continue;
    rows.push({
      title,
      url,
      type: str(form, `resource_${i}_type`) ?? 'OTHER',
      // The affiliate-disclosure driver (🔒 affiliate links must be labeled) — checkbox
      // presence, the same contract as the key-date TBD flag.
      isAffiliate: form.get(`resource_${i}_affiliate`) != null,
      affiliateMeta: null,
      displayOrder: rows.length,
      imageUrl: str(form, `resource_${i}_image`) ?? null,
    });
  }
  return rows;
}

/** FAQ entries from the create form's indexed rows — same skip-the-incomplete rule as resources:
 *  a question without an answer (or vice versa) is an abandoned draft, not half a FAQ. */
export function buildFaqs(form: FormData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; form.has(`faq_${i}_question`); i++) {
    const question = str(form, `faq_${i}_question`);
    const answer = str(form, `faq_${i}_answer`);
    if (question === undefined || answer === undefined) continue;
    rows.push({ question, answer, displayOrder: rows.length });
  }
  return rows;
}

/** The regions the first edition covers (a card fact) — the selected region ids. */
export function buildRegionIds(form: FormData): string[] {
  return form
    .getAll('edition_regionIds')
    .filter((v): v is string => typeof v === 'string' && v !== '');
}

/** End-of-day in `timezone` for a row's end date, or null when absent/not after the start. */
function endsAtFor(
  form: FormData,
  i: number,
  timezone: string,
  startsAt: string | null,
): string | null {
  const endDate = str(form, `keydate_${i}_enddate`);
  if (endDate === undefined || startsAt === null) return null;
  const endsAt = zonedWallClockToInstant(`${endDate}T23:59`, timezone);
  // Both are Date#toISOString output — fixed-width UTC, so a string compare is chronological.
  return endsAt > startsAt ? endsAt : null;
}

/**
 * The first edition's typed key dates from the form's indexed row fields (`keydate_0_type`,
 * `keydate_0_date`, …) — item 21. Per row: TBD (checkbox) records the milestone with no date; a
 * typed wall-clock is converted in the admin's chosen zone (never the server's — same rule as
 * addKeyDate), with the time defaulting to end-of-day when only a date is given. Rows with neither
 * a date nor TBD are skipped (an empty "Add date" row posts nothing). The server re-validates the
 * list (including the REG_CLOSE/SUBMISSION_DUE requirement on the admin create path).
 *
 * A row may also carry an END date, for a milestone spanning days (a two-day finals). It posts as
 * end-of-day in the same zone, and ONLY when it is strictly after `startsAt` — the server's
 * {@code endsAt must be after startsAt} assertion. The form shows an inline error for an earlier
 * end rather than relying on that 400; this used to be hardcoded null, so a range entered at
 * create time was silently lost until someone re-edited the edition.
 */
export function buildKeyDates(form: FormData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; form.has(`keydate_${i}_type`); i++) {
    const type = str(form, `keydate_${i}_type`);
    const timezone = str(form, `keydate_${i}_timezone`) ?? DEFAULT_TIMEZONE;
    const tbd = form.get(`keydate_${i}_tbd`) != null;
    const date = str(form, `keydate_${i}_date`);
    if (type === undefined || (!tbd && date === undefined)) continue;
    const startsAt =
      tbd || date === undefined
        ? null
        : zonedWallClockToInstant(`${date}T${str(form, `keydate_${i}_time`) ?? '23:59'}`, timezone);
    rows.push({
      type,
      label: str(form, `keydate_${i}_label`) ?? null,
      startsAt,
      endsAt: endsAtFor(form, i, timezone, startsAt),
      timezone,
    });
  }
  return rows;
}

/**
 * The SAME form, submitted from import review: the edited values become the record's approve
 * payload (the "edit then approve" override the queue has always supported), so a curator reviews
 * a real listing form instead of raw JSON.
 *
 * Three things differ from the admin create path:
 *
 *  - **Extras are merged back underneath.** Anything the form has no control for (`reviewerNotes`,
 *    `edition.prizeValue`, …) rides through in a hidden field and is re-applied here, so approving
 *    can never quietly drop a key the extractor produced. Form values always win.
 *  - **Organizer resolve-or-create.** The dropdown's sentinel value becomes `organizerName` +
 *    `confirmNewOrganizer`, which is how the server creates the org on approve.
 *  - **The edition is optional.** An extraction of a page that describes no running is legitimate;
 *    with no cycle label there is no edition to create, and its dates/regions have nothing to hang
 *    off (the server rejects those without one), so they are dropped together.
 */
export function buildImportApprovalPayload(form: FormData): Record<string, unknown> {
  const extras = parseExtras(str(form, 'import_extras'));
  const competition = buildCompetitionBody(form);

  if (competition.organizerOrgId === CREATE_ORGANIZER_SENTINEL) {
    competition.organizerOrgId = null;
    competition.organizerName = str(form, 'import_organizerName') ?? null;
    competition.confirmNewOrganizer = true;
  }

  const payload: Record<string, unknown> = { ...extras.competition, ...competition };

  // Prep resources ride the approve payload since 2026-08-28 — the API creates them as
  // sub-resources once the competition exists. They are a MAPPED key now, so they no longer arrive
  // via `extras`: the form's rows are the only source, which is the point — a curator approves the
  // links they actually reviewed. Omitted entirely when there are none, so an approval that
  // touched no links sends no key rather than an empty list.
  const resources = buildResources(form);
  if (resources.length > 0) payload.resources = resources;
  const faqs = buildFaqs(form);
  if (faqs.length > 0) payload.faqs = faqs;

  if (str(form, 'edition_cycleLabel') !== undefined) {
    const edition: Record<string, unknown> = { ...extras.edition, ...buildFirstEdition(form) };
    // The edition `attributes` bag needs a real MERGE, not the spread's replace: the form side
    // only ever contributes the awards rows, while the extraction may carry other keys — a
    // curator who touched the Awards step must not thereby drop extractor keys (and an untouched
    // step contributes no bag at all, letting the extracted one ride through whole).
    const extracted = asRecordOrNull(extras.edition.attributes);
    const fromForm = asRecordOrNull(edition.attributes);
    if (extracted && fromForm) edition.attributes = { ...extracted, ...fromForm };
    payload.edition = edition;
    const keyDates = buildKeyDates(form);
    if (keyDates.length > 0) payload.keyDates = keyDates;
    const regionIds = buildRegionIds(form);
    if (regionIds.length > 0) payload.regionIds = regionIds;
  }
  return payload;
}

function asRecordOrNull(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** The hidden extras field is our own JSON; a malformed one means losing keys, so it's loud. */
function parseExtras(raw: string | undefined): {
  competition: Record<string, unknown>;
  edition: Record<string, unknown>;
} {
  const empty = { competition: {}, edition: {} };
  if (!raw) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The preserved payload fields could not be read. Use the Raw payload tab.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
  const shape = parsed as { competition?: unknown; edition?: unknown };
  const asObject = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return { competition: asObject(shape.competition), edition: asObject(shape.edition) };
}
