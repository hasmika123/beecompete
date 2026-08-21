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
    minGrade: num(form, 'minGrade') ?? null,
    maxGrade: num(form, 'maxGrade') ?? null,
    minAge: num(form, 'minAge') ?? null,
    maxAge: num(form, 'maxAge') ?? null,
    costType: str(form, 'costType'),
    recurrence: str(form, 'recurrence'),
    attributes: attributes ?? null,
  };
}

/** The first-edition block of the combined create form — the year's running. */
export function buildFirstEdition(form: FormData): Record<string, unknown> {
  return {
    cycleLabel: str(form, 'edition_cycleLabel'),
    status: str(form, 'edition_status') ?? 'UPCOMING',
    scopeLevel: str(form, 'edition_scopeLevel') ?? 'NATIONAL',
    registrationUrl: str(form, 'edition_registrationUrl') ?? null,
    entryFee: num(form, 'edition_entryFee') ?? null,
    currency: str(form, 'edition_currency')?.toUpperCase() ?? null,
    prizeSummary: str(form, 'edition_prizeSummary') ?? null,
  };
}

/** The regions the first edition covers (a card fact) — the selected region ids. */
export function buildRegionIds(form: FormData): string[] {
  return form
    .getAll('edition_regionIds')
    .filter((v): v is string => typeof v === 'string' && v !== '');
}

/**
 * The first edition's typed key dates from the form's indexed row fields (`keydate_0_type`,
 * `keydate_0_date`, …) — item 21. Per row: TBD (checkbox) records the milestone with no date; a
 * typed wall-clock is converted in the admin's chosen zone (never the server's — same rule as
 * addKeyDate), with the time defaulting to end-of-day when only a date is given. Rows with neither
 * a date nor TBD are skipped (an empty "Add date" row posts nothing). The server re-validates the
 * list (including the REG_CLOSE/SUBMISSION_DUE requirement on the admin create path).
 */
export function buildKeyDates(form: FormData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; form.has(`keydate_${i}_type`); i++) {
    const type = str(form, `keydate_${i}_type`);
    const timezone = str(form, `keydate_${i}_timezone`) ?? DEFAULT_TIMEZONE;
    const tbd = form.get(`keydate_${i}_tbd`) != null;
    const date = str(form, `keydate_${i}_date`);
    if (type === undefined || (!tbd && date === undefined)) continue;
    rows.push({
      type,
      label: str(form, `keydate_${i}_label`) ?? null,
      startsAt:
        tbd || date === undefined
          ? null
          : zonedWallClockToInstant(
              `${date}T${str(form, `keydate_${i}_time`) ?? '23:59'}`,
              timezone,
            ),
      endsAt: null,
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

  if (str(form, 'edition_cycleLabel') !== undefined) {
    payload.edition = { ...extras.edition, ...buildFirstEdition(form) };
    const keyDates = buildKeyDates(form);
    if (keyDates.length > 0) payload.keyDates = keyDates;
    const regionIds = buildRegionIds(form);
    if (regionIds.length > 0) payload.regionIds = regionIds;
  }
  return payload;
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
