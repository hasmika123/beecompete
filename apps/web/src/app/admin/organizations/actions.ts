'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/admin-api';
import type { Organization, OrganizationFormState } from '@/lib/admin-types';

function body(form: FormData) {
  return {
    name: (form.get('name') as string)?.trim(),
    type: form.get('type'),
    domain: ((form.get('domain') as string) || '').trim() || null,
  };
}

/**
 * Returns the created organization rather than redirecting to its detail page (owner 2026-08-28).
 *
 * The redirect made this action unusable from anywhere but its own page: it unmounted the caller,
 * which is fatal when the caller is a half-filled competition form. Handing the row back instead
 * lets the form that asked for the organization show the result, keep its own state, and select
 * the new row on the spot — the refresh that used to be needed before it appeared in the dropdown.
 */
export async function createOrganization(
  _prev: OrganizationFormState,
  form: FormData,
): Promise<OrganizationFormState> {
  let created: Organization;
  try {
    created = await adminFetch<Organization>('/organizations', {
      method: 'POST',
      body: body(form),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  // Still revalidated: the organizations list and every server-rendered organizer dropdown must
  // include the new row on their next render. The caller doesn't WAIT for that — it already holds
  // the row — but a stale list one navigation later would be its own bug.
  revalidatePath('/admin/organizations');
  revalidatePath('/admin/competitions/new');
  return { ok: true, organization: created };
}

export async function updateOrganization(
  id: string,
  _prev: OrganizationFormState,
  form: FormData,
): Promise<OrganizationFormState> {
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
