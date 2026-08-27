'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import {
  buildCompetitionBody,
  buildFaqs,
  buildFirstEdition,
  buildKeyDates,
  buildRegionIds,
  buildResources,
} from '@/lib/competition-payload';
import type { Competition, FormState, ListingStatus } from '@/lib/admin-types';

export async function createCompetition(_prev: FormState, form: FormData): Promise<FormState> {
  const requested = buildCompetitionBody(form);
  // Which submit button was pressed (§8a lifecycle, item 14). Absent — the primary "Publish now"
  // button posts no listing_intent — means PUBLISHED, the same default the API applies to a null.
  const intent = form.get('listing_intent');
  const listingStatus = intent === 'draft' ? 'DRAFT' : intent === 'review' ? 'IN_REVIEW' : null;
  let created: Competition;
  try {
    // Atomic combined create (competition + first edition + typed key dates) so a new
    // listing is complete-by-default and never lands as a zombie (no edition → invisible).
    created = await adminFetch<Competition>('/competitions/with-edition', {
      method: 'POST',
      body: {
        competition: requested,
        edition: buildFirstEdition(form),
        keyDates: buildKeyDates(form),
        regionIds: buildRegionIds(form),
        listingStatus,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'create failed' };
  }
  // Resources + FAQs are sub-resources of an existing competition, so they post AFTER the atomic
  // create returns an id (2026-08-25). A failure here must NOT fail the create — the listing
  // exists, and returning an error would invite a retry that creates it twice. Failures are
  // counted onto the redirect instead, where the toast names them; the edit page's managers are
  // the retry path and are exactly where the redirect lands.
  let extrasFailed = 0;
  for (const resource of buildResources(form)) {
    try {
      await adminFetch(`/competitions/${created.id}/resources`, {
        method: 'POST',
        body: resource,
      });
    } catch {
      extrasFailed++;
    }
  }
  for (const faq of buildFaqs(form)) {
    try {
      await adminFetch(`/competitions/${created.id}/faqs`, { method: 'POST', body: faq });
    } catch {
      extrasFailed++;
    }
  }
  revalidatePath('/admin/competitions');
  // The slug is assigned, not typed, so the curator has never seen it. Carry it to the listing
  // page to announce — and flag when the server had to suffix it because the URL was taken,
  // which is otherwise completely silent.
  const params = new URLSearchParams({ created: created.slug });
  if (created.slug !== requested.slug) params.set('urlAdjusted', '1');
  if (extrasFailed > 0) params.set('extrasFailed', String(extrasFailed));
  redirect(`/admin/competitions/${created.id}?${params}`);
}

export async function updateCompetition(
  id: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await adminFetch<Competition>(`/competitions/${id}`, {
      method: 'PUT',
      body: buildCompetitionBody(form),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'update failed' };
  }
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
  return { ok: true };
}

export async function setCompetitionVerification(id: string, state: string): Promise<void> {
  await adminFetch(`/competitions/${id}/verification`, { method: 'PUT', body: { state } });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}

export async function archiveCompetition(id: string): Promise<void> {
  await adminFetch(`/competitions/${id}`, { method: 'DELETE' });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}

export async function restoreCompetition(id: string): Promise<void> {
  await adminFetch(`/competitions/${id}/restore`, { method: 'POST' });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
}

/** §8a lifecycle transition (item 14) — the server validates legality; illegal moves 409. */
export async function setListingStatus(id: string, status: ListingStatus): Promise<void> {
  await adminFetch(`/competitions/${id}/listing-status`, { method: 'PUT', body: { status } });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
  revalidatePath('/admin/review');
}
