'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/admin-api';
import type { FormState } from '@/lib/admin-types';

function body(form: FormData) {
  return {
    level: form.get('level'),
    name: (form.get('name') as string)?.trim(),
    code: ((form.get('code') as string) || '').trim() || null,
    parentId: ((form.get('parentId') as string) || '').trim() || null,
  };
}

export async function createRegion(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await adminFetch('/regions', { method: 'POST', body: body(form) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath('/admin/regions');
  return { ok: true };
}

export async function updateRegion(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch(`/regions/${id}`, { method: 'PUT', body: body(form) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath('/admin/regions');
  return { ok: true };
}

export async function deleteRegion(id: string): Promise<void> {
  // The API 409s if the region has children or is still tagged on an edition — the manager
  // surfaces that message via toast.
  await adminFetch(`/regions/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/regions');
}
