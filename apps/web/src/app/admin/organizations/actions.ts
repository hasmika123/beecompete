'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import type { FormState, Organization } from '@/lib/admin-types';

function body(form: FormData) {
  return {
    name: (form.get('name') as string)?.trim(),
    type: form.get('type'),
    domain: ((form.get('domain') as string) || '').trim() || null,
  };
}

export async function createOrganization(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Organization;
  try {
    created = await adminFetch<Organization>('/organizations', {
      method: 'POST',
      body: body(form),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath('/admin/organizations');
  redirect(`/admin/organizations/${created.id}`);
}

export async function updateOrganization(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch(`/organizations/${id}`, { method: 'PUT', body: body(form) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${id}`);
  return { ok: true };
}

export async function setOrganizationVerification(id: string, state: string): Promise<void> {
  await adminFetch(`/organizations/${id}/verification`, { method: 'PUT', body: { state } });
  revalidatePath(`/admin/organizations/${id}`);
  revalidatePath('/admin/organizations');
}

export async function archiveOrganization(id: string): Promise<void> {
  await adminFetch(`/organizations/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${id}`);
}

export async function restoreOrganization(id: string): Promise<void> {
  await adminFetch(`/organizations/${id}/restore`, { method: 'POST' });
  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${id}`);
}
