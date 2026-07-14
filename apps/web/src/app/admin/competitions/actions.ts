'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
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

export async function createCompetition(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Competition;
  try {
    created = await adminFetch<Competition>('/competitions', {
      method: 'POST',
      body: buildBody(form),
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
