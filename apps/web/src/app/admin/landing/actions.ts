'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/admin-api';
import type { FormState } from '@/lib/admin-types';

export async function putHeroCard(
  position: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch(`/hero-cards/${position}`, {
      method: 'PUT',
      body: {
        imageKey: (form.get('imageKey') as string)?.trim(),
        altText: (form.get('altText') as string)?.trim(),
        linkUrl: ((form.get('linkUrl') as string) || '').trim() || null,
        description: ((form.get('description') as string) || '').trim() || null,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save failed' };
  }
  revalidatePath('/admin/landing');
  return { ok: true };
}

export async function setFeaturedSlots(competitionIds: string[]): Promise<void> {
  await adminFetch('/featured-slots', { method: 'PUT', body: { competitionIds } });
  revalidatePath('/admin/landing');
}
