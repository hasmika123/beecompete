'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import type { FormState, Organization, Page } from '@/lib/admin-types';

/**
 * Live organizer lookup for the import-review org panel (resolve-or-create): the curator can search
 * for an existing org to reuse (writes organizerOrgId into the payload) instead of creating a new
 * one on approve. Server action so the admin API token stays server-side (BFF).
 */
export async function searchOrganizations(query: string): Promise<Organization[]> {
  const q = query.trim();
  if (!q) return [];
  const page = await adminFetch<Page<Organization>>(
    `/organizations?query=${encodeURIComponent(q)}&size=10`,
  );
  return page.content;
}

/** Approve, optionally with an edited payload (the curator's "edit then approve"). Redirects on success. */
export async function approveImport(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const raw = String(form.get('payload') ?? '');
  let override: unknown = undefined;
  if (raw.trim()) {
    try {
      override = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Payload must be valid JSON.' };
    }
  }
  try {
    await adminFetch(`/import-records/${id}/approve`, {
      method: 'POST',
      body: override, // undefined body = approve as-stored
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'approve failed' };
  }
  revalidatePath('/admin/import-records');
  redirect('/admin/import-records');
}

export async function rejectImport(id: string, note: string): Promise<void> {
  await adminFetch(`/import-records/${id}/reject`, { method: 'POST', body: { note } });
  revalidatePath('/admin/import-records');
}
