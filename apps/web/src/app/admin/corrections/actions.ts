'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import type { FormState } from '@/lib/admin-types';

/** Approve, optionally with an edited diff (the curator's "edit then approve"). Redirects on success. */
export async function approveCorrection(
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
      return { ok: false, error: 'Diff must be valid JSON.' };
    }
  }
  try {
    await adminFetch(`/corrections/${id}/approve`, {
      method: 'POST',
      body: override, // undefined body = approve as-stored
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'approve failed' };
  }
  revalidatePath('/admin/corrections');
  redirect('/admin/corrections');
}

export async function rejectCorrection(id: string, note: string): Promise<void> {
  await adminFetch(`/corrections/${id}/reject`, { method: 'POST', body: { note } });
  revalidatePath('/admin/corrections');
}
