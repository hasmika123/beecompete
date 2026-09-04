import type { Config } from './config.ts';
import type { SeedHints } from './types.ts';

/**
 * "Is this competition already known?" — the seeding tool's pre-check (DQ4,
 * docs/duplicate-detection-plan.md). Before an item is fetched and extracted, ask the API's
 * duplicate detection (`GET /api/v1/admin/competitions/duplicates`) with the page URL and the
 * index-hint name. A LIVE catalog listing with the same name key or URL key, or a record already
 * PENDING in the import queue, means the item is skipped — no fetch, no LLM call, no second queue
 * row for a curator to wade through.
 *
 * Detection is the SERVER's (the same rules the write gate and the queue use); this module only
 * asks the question and words the answer. It never blocks on its own judgment: a failed lookup
 * (API down, bad token) is reported as a warning and the item proceeds, because the approve path
 * still gates duplicates — this is an economy, not the guard.
 */

/** Mirrors the API's MatchReason enum. */
export type MatchReason =
  'NAME_EXACT' | 'URL_EXACT' | 'DOMAIN_EXACT' | 'NAME_SIMILAR' | 'SLUG_TAKEN';

export interface DuplicatesResponse {
  catalog: Array<{
    id: string;
    slug: string;
    name: string;
    archivedAt: string | null;
    reasons: MatchReason[];
  }>;
  pending: Array<{
    importRecordId: string;
    name: string | null;
    sourceUrl: string | null;
    reasons: MatchReason[];
  }>;
}

export type KnownVerdict =
  /** A live listing carries this name or URL — extracting it again would only make a duplicate. */
  | { kind: 'listed'; name: string; slug: string; reasons: MatchReason[] }
  /** Somebody already queued this page/name; it is waiting for a curator. */
  | { kind: 'pending'; name: string; importRecordId: string; reasons: MatchReason[] };

/**
 * The verdict for a source URL + optional hint name, or null when the catalog and queue hold
 * nothing EXACT. Similar names are deliberately ignored here: they are a curator's call, and
 * skipping an extraction over a look-alike would silently drop real competitions (AMC 8 vs AMC 10).
 */
export function decideKnown(found: DuplicatesResponse): KnownVerdict | null {
  const listed = found.catalog.find(
    (c) =>
      c.archivedAt === null &&
      (c.reasons.includes('NAME_EXACT') || c.reasons.includes('URL_EXACT')),
  );
  if (listed) {
    return { kind: 'listed', name: listed.name, slug: listed.slug, reasons: listed.reasons };
  }
  const pending = found.pending.find(
    (p) => p.reasons.includes('NAME_EXACT') || p.reasons.includes('URL_EXACT'),
  );
  if (pending) {
    return {
      kind: 'pending',
      name: pending.name ?? pending.sourceUrl ?? '(untitled record)',
      importRecordId: pending.importRecordId,
      reasons: pending.reasons,
    };
  }
  return null;
}

export function describeKnown(verdict: KnownVerdict): string {
  const why = verdict.reasons.map((r) => r.toLowerCase().replace('_', ' ')).join(' + ');
  return verdict.kind === 'listed'
    ? `already listed as "${verdict.name}" [${verdict.slug}] (${why}) — skipped; pass --include-known to extract anyway`
    : `already waiting in the import queue as "${verdict.name}" (${verdict.importRecordId}; ${why}) — skipped; pass --include-known to queue another`;
}

/**
 * Asks the API. Returns the verdict, null when nothing exact is known, or `{ error }` when the
 * lookup itself failed (reported as a warning by the caller; the item proceeds).
 */
export async function checkKnown(
  sourceUrl: string,
  hints: SeedHints | undefined,
  config: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<KnownVerdict | null | { error: string }> {
  if (!config.adminToken) {
    return { error: 'ADMIN_API_TOKEN not set — known-listing pre-check skipped' };
  }
  const params = new URLSearchParams({ officialUrl: sourceUrl });
  if (hints?.name?.trim()) params.set('name', hints.name.trim());
  const url = `${config.apiBase}/api/v1/admin/competitions/duplicates?${params}`;
  try {
    const res = await fetchImpl(url, { headers: { 'x-admin-token': config.adminToken } });
    if (!res.ok) {
      return { error: `known-listing pre-check failed: ${res.status} ${res.statusText}` };
    }
    const body = (await res.json()) as DuplicatesResponse;
    return decideKnown(body);
  } catch (err) {
    return {
      error: `known-listing pre-check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
