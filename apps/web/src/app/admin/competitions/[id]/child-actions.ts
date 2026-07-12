'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch } from '@/lib/admin-api';

function revalidate(competitionId: string) {
  revalidatePath(`/admin/competitions/${competitionId}`);
}

// --- FAQ ---

export async function addFaq(competitionId: string, form: FormData): Promise<void> {
  await adminFetch(`/competitions/${competitionId}/faqs`, {
    method: 'POST',
    body: {
      question: form.get('question'),
      answer: form.get('answer'),
      displayOrder: Number(form.get('displayOrder') ?? 0) || 0,
    },
  });
  revalidate(competitionId);
}

export async function deleteFaq(competitionId: string, faqId: string): Promise<void> {
  await adminFetch(`/faqs/${faqId}`, { method: 'DELETE' });
  revalidate(competitionId);
}

// --- Resource ---

export async function addResource(competitionId: string, form: FormData): Promise<void> {
  await adminFetch(`/competitions/${competitionId}/resources`, {
    method: 'POST',
    body: {
      title: form.get('title'),
      url: form.get('url'),
      type: form.get('type'),
      isAffiliate: form.get('isAffiliate') === 'on',
      displayOrder: Number(form.get('displayOrder') ?? 0) || 0,
    },
  });
  revalidate(competitionId);
}

export async function deleteResource(competitionId: string, resourceId: string): Promise<void> {
  await adminFetch(`/resources/${resourceId}`, { method: 'DELETE' });
  revalidate(competitionId);
}
