'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { DEFAULT_TIMEZONE, zonedWallClockToInstant } from '@/lib/dates';
import type { Competition, FormState } from '@/lib/admin-types';

function str(form: FormData, key: string): string | undefined {
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
function buildBody(form: FormData): Record<string, unknown> {
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

/** The first-edition block of the combined create form (create only) — the year's running. */
function buildFirstEdition(form: FormData): Record<string, unknown> {
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
function regionIds(form: FormData): string[] {
  return form
    .getAll('edition_regionIds')
    .filter((v): v is string => typeof v === 'string' && v !== '');
}

/**
 * The first edition's typed key dates from the create form's indexed row fields
 * (`keydate_0_type`, `keydate_0_date`, …) — item 21. Per row: TBD (checkbox) records the
 * milestone with no date; a typed wall-clock is converted in the admin's chosen zone (never the
 * server's — same rule as addKeyDate), with the time defaulting to end-of-day when only a date is
 * given. Rows with neither a date nor TBD are skipped (an empty "Add date" row posts nothing).
 * The server re-validates the list (including the REG_CLOSE/SUBMISSION_DUE requirement).
 */
function buildKeyDates(form: FormData): Record<string, unknown>[] {
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

export async function createCompetition(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Competition;
  try {
    // Atomic combined create (competition + first edition + typed key dates) so a new
    // listing is complete-by-default and never lands as a zombie (no edition → invisible).
    created = await adminFetch<Competition>('/competitions/with-edition', {
      method: 'POST',
      body: {
        competition: buildBody(form),
        edition: buildFirstEdition(form),
        keyDates: buildKeyDates(form),
        regionIds: regionIds(form),
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath('/admin/competitions');
  redirect(`/admin/competitions/${created.id}`);
}

export async function updateCompetition(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch<Competition>(`/competitions/${id}`, { method: 'PUT', body: buildBody(form) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
  return { ok: true };
}

export async function setCompetitionVerification(id: string, state: string): Promise<void> {
  await adminFetch(`/competitions/${id}/verification`, { method: 'PUT', body: { state } });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}

export async function archiveCompetition(id: string): Promise<void> {
  await adminFetch(`/competitions/${id}`, { method: 'DELETE' });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}

export async function restoreCompetition(id: string): Promise<void> {
  await adminFetch(`/competitions/${id}/restore`, { method: 'POST' });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}
