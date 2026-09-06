'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFetch } from '@/lib/admin-api';
import {
  buildCompetitionBody,
  buildEditionBody,
  buildFaqEdits,
  buildFaqs,
  buildFirstEdition,
  buildKeyDateEdits,
  buildKeyDates,
  buildRegionIds,
  buildResourceEdits,
  buildResources,
  removedIds,
  str,
  type RowEdit,
} from '@/lib/competition-payload';
import type {
  Competition,
  CompetitionDuplicates,
  Edition,
  FormState,
  ListingFormState,
  ListingStatus,
  Page,
  SavedRowIds,
} from '@/lib/admin-types';

/**
 * Duplicate candidates for the listing being typed (DQ4) — the same detection the save runs, asked
 * BEFORE submit so the form can show them and offer "not a duplicate" instead of a 409/422 after
 * the fact. Non-fatal: a failed check returns nothing rather than breaking the form — the server
 * gate still stands.
 */
export async function findCompetitionDuplicates(input: {
  name: string;
  officialUrl?: string | null;
  excludeId?: string | null;
  excludeImportRecordId?: string | null;
}): Promise<CompetitionDuplicates> {
  const params = new URLSearchParams({ name: input.name.trim() });
  if (input.officialUrl?.trim()) params.set('officialUrl', input.officialUrl.trim());
  if (input.excludeId) params.set('excludeId', input.excludeId);
  if (input.excludeImportRecordId) params.set('excludeImportRecordId', input.excludeImportRecordId);
  try {
    return await adminFetch<CompetitionDuplicates>(`/competitions/duplicates?${params}`);
  } catch {
    return { catalog: [], pending: [] };
  }
}

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

/**
 * The unified listing save (owner 2026-09-05): ONE submit from the listing page persists the
 * competition, its current season, the season's regions and timeline, and the prep resources +
 * FAQ — then, when a review button was pressed, moves the listing's status. The page used to
 * scatter these over four tabs and a separate season page, each with its own save.
 *
 * The API has no combined update, so this is SEQUENTIAL, and it fails honestly: the first write
 * that is refused ends the save with a message naming what did and did not land, and `saved`
 * records every row created or deleted before that point — so the form can stamp new rows with
 * their ids and a retry updates rather than duplicates. Rows are matched by id: a saved row is
 * PUT in place, a new one POSTed, and only a row the curator explicitly removed is DELETEd
 * (`*_removed`); nothing is inferred from a row's absence.
 */
export async function updateListing(
  id: string,
  _prev: ListingFormState,
  form: FormData,
): Promise<ListingFormState> {
  const saved: SavedRowIds = {
    editionId: str(form, 'edition_id') ?? null,
    keyDates: {},
    resources: {},
    faqs: {},
    deleted: { keyDates: [], resources: [], faqs: [] },
  };
  const finish = () => {
    revalidatePath(`/admin/competitions/${id}`);
    revalidatePath('/admin/competitions');
    revalidatePath('/admin/review');
  };
  const failed = (what: string, e: unknown): ListingFormState => {
    finish();
    const detail = e instanceof Error ? e.message : 'request failed';
    return { ok: false, error: `${what} — ${detail}`, saved };
  };

  try {
    await adminFetch<Competition>(`/competitions/${id}`, {
      method: 'PUT',
      body: buildCompetitionBody(form),
    });
  } catch (e) {
    return failed('Nothing was saved: the listing itself was refused', e);
  }

  // The season: updated in place, or created for a listing that had none (the readiness gate
  // hides those — domain-model §8a — so giving it a season is what makes it publishable).
  let editionBody: Record<string, unknown>;
  try {
    editionBody = buildEditionBody(form);
  } catch (e) {
    return failed('The listing saved, but the season did not', e);
  }
  try {
    if (saved.editionId) {
      await adminFetch(`/editions/${saved.editionId}`, { method: 'PUT', body: editionBody });
    } else {
      const created = await adminFetch<Edition>(`/competitions/${id}/editions`, {
        method: 'POST',
        body: editionBody,
      });
      saved.editionId = created.id;
    }
  } catch (e) {
    return failed('The listing saved, but the season did not', e);
  }
  const editionId = saved.editionId;

  try {
    await adminFetch(`/editions/${editionId}/regions`, {
      method: 'PUT',
      body: { regionIds: buildRegionIds(form) },
    });
  } catch (e) {
    return failed('The listing and season saved, but the regions did not', e);
  }

  // Child rows: deletes first (a removed singleton must be gone before its replacement posts),
  // then updates and creates in display order.
  type Child = 'keyDates' | 'resources' | 'faqs';
  const children: Array<{
    kind: Child;
    noun: string;
    removedField: string;
    edits: RowEdit[];
    deletePath: (rowId: string) => string;
    putPath: (rowId: string) => string;
    postPath: string;
  }> = [
    {
      kind: 'keyDates',
      noun: 'a key date',
      removedField: 'keydate_removed',
      edits: buildKeyDateEdits(form),
      deletePath: (rowId) => `/key-dates/${rowId}`,
      putPath: (rowId) => `/key-dates/${rowId}`,
      postPath: `/editions/${editionId}/key-dates`,
    },
    {
      kind: 'resources',
      noun: 'a prep resource',
      removedField: 'resource_removed',
      edits: buildResourceEdits(form),
      deletePath: (rowId) => `/resources/${rowId}`,
      putPath: (rowId) => `/resources/${rowId}`,
      postPath: `/competitions/${id}/resources`,
    },
    {
      kind: 'faqs',
      noun: 'an FAQ entry',
      removedField: 'faq_removed',
      edits: buildFaqEdits(form),
      deletePath: (rowId) => `/faqs/${rowId}`,
      putPath: (rowId) => `/faqs/${rowId}`,
      postPath: `/competitions/${id}/faqs`,
    },
  ];
  for (const child of children) {
    for (const rowId of removedIds(form, child.removedField)) {
      try {
        await adminFetch(child.deletePath(rowId), { method: 'DELETE' });
        saved.deleted[child.kind].push(rowId);
      } catch (e) {
        return failed(`Most of the listing saved, but removing ${child.noun} was refused`, e);
      }
    }
    for (const row of child.edits) {
      try {
        if (row.id) {
          await adminFetch(child.putPath(row.id), { method: 'PUT', body: row.body });
        } else {
          const created = await adminFetch<{ id: string }>(child.postPath, {
            method: 'POST',
            body: row.body,
          });
          saved[child.kind][row.key] = created.id;
        }
      } catch (e) {
        return failed(`Most of the listing saved, but ${child.noun} was refused`, e);
      }
    }
  }

  // The review decision, LAST — it only makes sense once everything it judges has landed. The
  // same §8a moves the header used to offer status-only; here they ride with the save so a
  // reviewer's fixes can never be left behind by the publish click.
  const intent = form.get('listing_intent');
  const next: ListingStatus | null =
    intent === 'publish'
      ? 'PUBLISHED'
      : intent === 'review'
        ? 'IN_REVIEW'
        : intent === 'draft'
          ? 'DRAFT'
          : null;
  if (next) {
    try {
      await adminFetch(`/competitions/${id}/listing-status`, {
        method: 'PUT',
        body: { status: next },
      });
    } catch (e) {
      return failed('Everything saved, but the status change was refused', e);
    }
  }
  finish();
  const notice =
    next === 'PUBLISHED'
      ? 'Saved and published'
      : next === 'IN_REVIEW'
        ? 'Saved and submitted for review'
        : next === 'DRAFT'
          ? 'Saved and sent back to draft'
          : 'Saved';
  return { ok: true, saved, notice };
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

/** Candidates for "the listing this one duplicates" — the admin list search, a handful of rows. */
export async function searchCompetitions(query: string): Promise<Competition[]> {
  const q = query.trim();
  if (!q) return [];
  const page = await adminFetch<Page<Competition>>(
    `/competitions?query=${encodeURIComponent(q)}&size=8`,
  );
  return page.content;
}

/**
 * Retire this listing as a duplicate of `canonicalId` (DQ4 PR 2): archived + linked, so its slug
 * redirects permanently to the canonical. The server refuses self, an archived canonical, and a
 * canonical that is itself a duplicate.
 */
export async function markDuplicate(id: string, canonicalId: string): Promise<void> {
  await adminFetch(`/competitions/${id}/mark-duplicate`, {
    method: 'POST',
    body: { canonicalId },
  });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath(`/admin/competitions/${canonicalId}`);
  revalidatePath('/admin/competitions');
}

/** §8a lifecycle transition (item 14) — the server validates legality; illegal moves 409. */
export async function setListingStatus(id: string, status: ListingStatus): Promise<void> {
  await adminFetch(`/competitions/${id}/listing-status`, { method: 'PUT', body: { status } });
  revalidatePath(`/admin/competitions/${id}`);
  revalidatePath('/admin/competitions');
  revalidatePath('/admin/review');
}
