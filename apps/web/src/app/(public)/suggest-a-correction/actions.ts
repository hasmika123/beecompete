'use server';

import { publicFetch } from '@/lib/public-api';
import type { FormState } from '@/lib/admin-types';

/**
 * Public "suggest a correction" submit (R1-3b, DQ6). Builds the field-level diff from the
 * form's field/value rows and POSTs it to the public corrections API — no admin token, the
 * server only queues a PENDING proposal. The hidden `website` input is a honeypot: humans
 * never see it, naive bots fill it, and we silently drop those.
 */
export async function submitCorrection(_prev: FormState, form: FormData): Promise<FormState> {
  // Honeypot filled → pretend success, store nothing.
  if (String(form.get('website') ?? '').trim()) {
    return { ok: true };
  }

  const subjectType = String(form.get('subjectType') ?? '');
  const subjectId = String(form.get('subjectId') ?? '');
  const note = String(form.get('note') ?? '').trim();

  const payload: Record<string, string> = {};
  const fields = form.getAll('field');
  const values = form.getAll('value');
  fields.forEach((field, i) => {
    const key = String(field).trim();
    const value = String(values[i] ?? '').trim();
    if (key && value) payload[key] = value;
  });

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: 'Add at least one field with a suggested value.' };
  }

  try {
    await publicFetch('/corrections', {
      method: 'POST',
      body: { subjectType, subjectId, payload, note: note || undefined },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
  return { ok: true };
}
