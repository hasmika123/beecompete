'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import {
  buildCompetitionBody,
  buildFirstEdition,
  buildKeyDates,
  buildRegionIds,
} from '@/lib/competition-payload';
import type { Competition, FormState } from '@/lib/admin-types';

export async function createCompetition(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Competition;
  try {
    // Atomic combined create (competition + first edition + typed key dates) so a new
    // listing is complete-by-default and never lands as a zombie (no edition → invisible).
    created = await adminFetch<Competition>('/competitions/with-edition', {
      method: 'POST',
      body: {
        competition: buildCompetitionBody(form),
        edition: buildFirstEdition(form),
        keyDates: buildKeyDates(form),
        regionIds: buildRegionIds(form),
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
    await adminFetch<Competition>(`/competitions/${id}`, {
      method: 'PUT',
      body: buildCompetitionBody(form),
    });
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
