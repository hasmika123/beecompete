'use server';

import { isHoneypotTripped } from '@/lib/honeypot';
import { publicFetch } from '@/lib/public-api';
import type { FormState } from '@/lib/admin-types';

/**
 * Public "Request a Competition" submit (R1-15b, DQ15). POSTs the wizard fields to the public
 * intake, which queues them in the import/curation queue for a curator to review — nothing is
 * published directly. No PII collected (the request is about the competition, not the person).
 * The hidden `website` input is a honeypot (bots fill it → silently dropped).
 */
export async function submitCompetitionRequest(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  if (isHoneypotTripped(form)) {
    return { ok: true };
  }

  const value = (key: string) => {
    const v = String(form.get(key) ?? '').trim();
    return v ? v : undefined;
  };

  const name = value('name');
  if (!name) {
    return { ok: false, error: 'Please add the competition name.' };
  }

  try {
    await publicFetch('/competition-requests', {
      method: 'POST',
      body: {
        name,
        organizerName: value('organizerName'),
        officialUrl: value('officialUrl'),
        categorySlug: value('category'),
        grades: value('grades'),
        deadline: value('deadline'),
        details: value('details'),
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Something went wrong — please try again.',
    };
  }
  return { ok: true };
}
