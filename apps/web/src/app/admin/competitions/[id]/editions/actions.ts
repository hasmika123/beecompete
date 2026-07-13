'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import { DEFAULT_TIMEZONE, zonedWallClockToInstant } from '@/lib/dates';
import type { Edition, FormState } from '@/lib/admin-types';

function str(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}
function num(form: FormData, key: string): number | undefined {
  const v = str(form, key);
  return v === undefined ? undefined : Number(v);
}

function buildEdition(form: FormData): Record<string, unknown> {
  let attributes: unknown = undefined;
  const raw = str(form, 'attributes');
  if (raw) {
    try {
      attributes = JSON.parse(raw);
    } catch {
      throw new Error('Attributes must be valid JSON.');
    }
  }
  return {
    cycleLabel: str(form, 'cycleLabel'),
    status: str(form, 'status'),
    registrationUrl: str(form, 'registrationUrl') ?? null,
    entryFee: num(form, 'entryFee') ?? null,
    currency: str(form, 'currency') ?? null,
    ageCutoffDate: str(form, 'ageCutoffDate') ?? null,
    prizeSummary: str(form, 'prizeSummary') ?? null,
    prizeValue: num(form, 'prizeValue') ?? null,
    prizeCurrency: str(form, 'prizeCurrency') ?? null,
    scopeLevel: str(form, 'scopeLevel'),
    advancesToEditionId: str(form, 'advancesToEditionId') ?? null,
    attributes: attributes ?? null,
  };
}

export async function createEdition(
  competitionId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  let created: Edition;
  try {
    created = await adminFetch<Edition>(`/competitions/${competitionId}/editions`, {
      method: 'POST',
      body: buildEdition(form),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath(`/admin/competitions/${competitionId}`);
  redirect(`/admin/competitions/${competitionId}/editions/${created.id}`);
}

export async function updateEdition(
  competitionId: string,
  editionId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch(`/editions/${editionId}`, { method: 'PUT', body: buildEdition(form) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath(`/admin/competitions/${competitionId}/editions/${editionId}`);
  return { ok: true };
}

// --- Key dates ---

export async function addKeyDate(
  competitionId: string,
  editionId: string,
  form: FormData,
): Promise<void> {
  const startsAtLocal = String(form.get('startsAt') ?? '').trim();
  const endsAtLocal = String(form.get('endsAt') ?? '').trim();
  // The admin's chosen IANA zone (never the server's) determines the instant for the wall-clock
  // they typed — the old `new Date(local).toISOString()` used the server zone (UTC in prod).
  const timezone = String(form.get('timezone') || DEFAULT_TIMEZONE);
  await adminFetch(`/editions/${editionId}/key-dates`, {
    method: 'POST',
    body: {
      type: form.get('type'),
      label: String(form.get('label') ?? '').trim() || null,
      startsAt: startsAtLocal ? zonedWallClockToInstant(startsAtLocal, timezone) : null,
      endsAt: endsAtLocal ? zonedWallClockToInstant(endsAtLocal, timezone) : null,
      timezone,
    },
  });
  revalidatePath(`/admin/competitions/${competitionId}/editions/${editionId}`);
}

export async function deleteKeyDate(
  competitionId: string,
  editionId: string,
  keyDateId: string,
): Promise<void> {
  await adminFetch(`/key-dates/${keyDateId}`, { method: 'DELETE' });
  revalidatePath(`/admin/competitions/${competitionId}/editions/${editionId}`);
}

// --- Region tags (set as a whole list) ---

export async function setEditionRegions(
  competitionId: string,
  editionId: string,
  regionIds: string[],
): Promise<void> {
  await adminFetch(`/editions/${editionId}/regions`, { method: 'PUT', body: { regionIds } });
  revalidatePath(`/admin/competitions/${competitionId}/editions/${editionId}`);
}
