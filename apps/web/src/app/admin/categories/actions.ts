'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import type { Category, FormState } from '@/lib/admin-types';

export async function createCategory(_prev: FormState, form: FormData): Promise<FormState> {
  let created: Category;
  try {
    created = await adminFetch<Category>('/categories', {
      method: 'POST',
      body: {
        name: (form.get('name') as string)?.trim(),
        slug: (form.get('slug') as string)?.trim(),
        parentId: ((form.get('parentId') as string) || '').trim() || null,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath('/admin/categories');
  redirect(`/admin/categories/${created.id}`);
}

export async function updateCategory(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch(`/categories/${id}`, {
      method: 'PUT',
      body: {
        name: (form.get('name') as string)?.trim(),
        slug: (form.get('slug') as string)?.trim(),
        parentId: ((form.get('parentId') as string) || '').trim() || null,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath('/admin/categories');
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<void> {
  await adminFetch(`/categories/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/categories');
}

export async function putCategoryTemplate(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const raw = String(form.get('jsonSchema') ?? '');
  let jsonSchema: unknown;
  try {
    jsonSchema = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON Schema must be valid JSON.' };
  }
  // Round-trip uiHints instead of wiping it to null on every save. Empty field = null.
  const rawHints = String(form.get('uiHints') ?? '').trim();
  let uiHints: unknown = null;
  if (rawHints) {
    try {
      uiHints = JSON.parse(rawHints);
    } catch {
      return { ok: false, error: 'UI hints must be valid JSON.' };
    }
  }
  try {
    await adminFetch(`/categories/${id}/template`, {
      method: 'PUT',
      body: { jsonSchema, uiHints },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save failed' };
  }
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true };
}

export async function createRegion(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await adminFetch('/regions', {
      method: 'POST',
      body: {
        level: form.get('level'),
        name: (form.get('name') as string)?.trim(),
        code: ((form.get('code') as string) || '').trim() || null,
        parentId: ((form.get('parentId') as string) || '').trim() || null,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  revalidatePath('/admin/categories');
  return { ok: true };
}
