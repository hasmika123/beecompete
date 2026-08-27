import { CATEGORY_IDS, CATEGORY_TEMPLATES, type CategorySlug } from './categories.ts';
import type { Config } from './config.ts';

/**
 * Category Templates resolved from the SERVER rather than the checked-in mirror.
 *
 * Why this exists: `categories.ts` is a hand-maintained copy of what the API's changesets did to
 * `category_template`, and it silently fell three changesets behind (`0015` judging, `0017`
 * eligibility catch-all, `0019` contact). Nothing failed — templates carry
 * `additionalProperties: true`, so a key the mirror doesn't know about is indistinguishable from
 * "the page didn't mention it". The cost was invisible and total: six keys the model was never
 * told about were never extracted, for months.
 *
 * The mirror cannot be made authoritative, because there are TWO writers — Liquibase changesets
 * and the admin template editor (a curator can tighten a schema at runtime). The only authority is
 * the database. So on a real run we ask the API, which the tool is already authenticated against
 * for submit; the mirror stays as the offline fallback and is reported as possibly-stale when used.
 *
 * ⚠ Fetch failure is NOT fatal. A seeding run that stops because a template endpoint blipped is
 * worse than one that proceeds on a mirror which is usually correct — but it must say so loudly,
 * because "extracted fewer fields than it could have" leaves no trace in the output.
 */

export type TemplateMap = Record<CategorySlug, Record<string, unknown>>;

/** The admin DTO — CategoryAdminController.TemplateResponse. Note: NO slug, only categoryId. */
interface TemplateResponse {
  id: string;
  categoryId: string;
  jsonSchema: Record<string, unknown>;
  uiHints: Record<string, unknown> | null;
}

const ID_TO_SLUG = new Map<string, CategorySlug>(
  (Object.entries(CATEGORY_IDS) as [CategorySlug, string][]).map(([slug, id]) => [
    id.toLowerCase(),
    slug,
  ]),
);

export interface TemplateResolution {
  templates: TemplateMap;
  /** 'server' when fetched, 'mirror' when we fell back to categories.ts. */
  source: 'server' | 'mirror';
  /** Human-readable lines for the run log — why we fell back, and what drifted. */
  notes: string[];
}

/**
 * Property-key diff between the mirror and the server, per category. Keys only: a type change
 * (0022's string -> boolean) matters too, but keys are what the prompt is generated from and what
 * silently vanishes, and a full schema diff would drown the signal in `$schema`/format noise.
 */
export function diffTemplateKeys(mirror: TemplateMap, server: TemplateMap): string[] {
  const out: string[] = [];
  for (const slug of Object.keys(server) as CategorySlug[]) {
    const props = (s: TemplateMap) =>
      Object.keys((s[slug]?.properties as Record<string, unknown>) ?? {});
    const mine = new Set(props(mirror));
    const theirs = new Set(props(server));
    const missing = [...theirs].filter((k) => !mine.has(k));
    const extra = [...mine].filter((k) => !theirs.has(k));
    if (missing.length) out.push(`${slug}: mirror is MISSING ${missing.join(', ')}`);
    if (extra.length) out.push(`${slug}: mirror has stale ${extra.join(', ')}`);
  }
  return out;
}

async function fetchTemplates(config: Config): Promise<TemplateResponse[]> {
  const url = `${config.apiBase}/api/v1/admin/categories/templates`;
  const res = await fetch(url, {
    // Lowercase to match submit.ts exactly — same gate, same header.
    headers: config.adminToken ? { 'x-admin-token': config.adminToken } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error('expected a JSON array of templates');
  return body as TemplateResponse[];
}

/**
 * The templates this run should use. Never throws — the worst case is the mirror plus a warning.
 *
 * @param offline skip the network entirely (--offline, or no admin token to authenticate with).
 */
export async function resolveTemplates(
  config: Config,
  offline: boolean,
): Promise<TemplateResolution> {
  const mirror = CATEGORY_TEMPLATES as TemplateMap;
  const fellBack = (why: string): TemplateResolution => ({
    templates: mirror,
    source: 'mirror',
    notes: [
      `Category Templates: using the CHECKED-IN MIRROR (${why}).`,
      '  It may be behind the server. Fields it does not know about are never extracted —',
      '  silently, because templates allow additional properties. Re-run against the API to be sure.',
    ],
  });

  if (offline) return fellBack('offline run');
  if (!config.adminToken) return fellBack('no ADMIN_API_TOKEN to authenticate with');

  let fetched: TemplateResponse[];
  try {
    fetched = await fetchTemplates(config);
  } catch (err) {
    return fellBack(`could not reach ${config.apiBase}: ${(err as Error).message}`);
  }

  const templates = { ...mirror } as TemplateMap;
  const notes: string[] = [];
  const unknown: string[] = [];
  for (const t of fetched) {
    const slug = ID_TO_SLUG.get(String(t.categoryId).toLowerCase());
    // A category created through the admin tool has a UUID this build has never heard of. Its
    // template is unusable here (nothing maps a run's categorySlug to it), but it is a signal the
    // launch taxonomy grew, so say so rather than dropping it on the floor.
    if (!slug) unknown.push(String(t.categoryId));
    else if (t.jsonSchema) templates[slug] = t.jsonSchema;
  }

  const drift = diffTemplateKeys(mirror, templates);
  if (drift.length) {
    notes.push(
      'Category Templates: server and tools/seeding/src/categories.ts DISAGREE —',
      ...drift.map((d) => `  ${d}`),
      '  This run uses the SERVER copy, so extraction is correct. Refresh the mirror anyway:',
      '  it is the offline fallback and the source the extraction prompt is generated from.',
    );
  }
  if (unknown.length) {
    notes.push(
      `Category Templates: ${unknown.length} template(s) for categories this build does not know ` +
        `(${unknown.join(', ')}) — the taxonomy grew; update CATEGORY_IDS.`,
    );
  }
  return { templates, source: 'server', notes };
}
