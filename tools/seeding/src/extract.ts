import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_IDS, isCategorySlug } from './categories.ts';
import type { Config } from './config.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import type { Extraction, SeedHints } from './types.ts';

export type ExtractBackend = 'anthropic' | 'stub';

export interface ExtractInput {
  sourceUrl: string;
  pageText: string;
  /** Path of the input HTML file, if any — used to locate a sibling `.expected.json` for the stub. */
  inputPath?: string;
  /** Known facts from the S2 master index, fed to the model as trusted guidance (#2). */
  hints?: SeedHints;
}

/**
 * Turns page text into a normalized Extraction. Picks the backend:
 *   - `anthropic` when a key is present and offline isn't forced.
 *   - `stub` otherwise — reads a sibling `<input>.expected.json` fixture so the pipeline is fully
 *     exercisable offline / in CI without a network or an API key.
 */
export async function extract(
  input: ExtractInput,
  config: Config,
  opts: { offline: boolean },
): Promise<{ extraction: Extraction; backend: ExtractBackend }> {
  const useStub = opts.offline || !config.anthropicApiKey;
  if (useStub) {
    return { extraction: await stubExtract(input), backend: 'stub' };
  }
  return { extraction: await anthropicExtract(input, config), backend: 'anthropic' };
}

async function anthropicExtract(input: ExtractInput, config: Config): Promise<Extraction> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: config.anthropicModel,
      // Generous on purpose: max_tokens is a CAP, not a reservation — you are billed for tokens
      // actually generated, so headroom is free. 2048 was set before the payload carried the
      // edition + keyDates (S3 v1) and silently truncated real pages mid-JSON.
      max_tokens: 8192,
      // Cached: the system prompt is byte-identical on every extraction (no per-page
      // interpolation), so across a 400+ page batch it would otherwise be re-billed in full each
      // time. A breakpoint here bills it at ~0.1x on every call after the first. The per-page text
      // stays in the user turn, AFTER this prefix — putting anything page-specific above it would
      // change the prefix bytes and defeat the cache entirely.
      //
      // Default 5-minute TTL is deliberate: a batch run extracts a page every few seconds, so the
      // entry never goes cold, and the 1h TTL's 2x write premium would not pay for itself.
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: buildUserPrompt(input.sourceUrl, input.pageText, input.hints) },
      ],
    });
  } catch (err) {
    // H1: a retired/unknown model id 404s — surface an actionable message, not a bare API error.
    if (err instanceof Anthropic.NotFoundError) {
      throw new Error(
        `Anthropic model "${config.anthropicModel}" was not found (retired or unknown id). ` +
          'Set ANTHROPIC_MODEL to a current model id (see .env.example) and retry.',
      );
    }
    throw err;
  }
  // Truncation check BEFORE parsing. A cut-off response is still valid text, so JSON.parse
  // reports a position-N syntax error that reads like a model formatting bug — the actual cause
  // is the token cap. Say so instead of making the next person debug the prompt.
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      `extraction was truncated at the ${message.usage.output_tokens}-token cap — the JSON is ` +
        'incomplete. Raise max_tokens in extract.ts (or extract a shorter page).',
    );
  }
  // Without this, a refusal surfaces as the same confusing JSON parse error as a truncation.
  if (message.stop_reason === 'refusal') {
    throw new Error('the model declined to extract this page (stop_reason: refusal)');
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return normalize(parseJsonObject(text), input.sourceUrl);
}

/** Offline backend: load the expected extraction that ships next to the fixture HTML. */
async function stubExtract(input: ExtractInput): Promise<Extraction> {
  if (!input.inputPath) {
    throw new Error(
      'offline/stub extraction needs a file --input with a sibling <name>.expected.json (no ANTHROPIC_API_KEY set)',
    );
  }
  const expectedPath = input.inputPath.replace(/\.html?$/i, '.expected.json');
  let raw: string;
  try {
    raw = await readFile(expectedPath, 'utf8');
  } catch {
    throw new Error(
      `offline/stub extraction: expected fixture not found at ${expectedPath}. ` +
        'Provide it, or set ANTHROPIC_API_KEY to use the live LLM backend.',
    );
  }
  return normalize(JSON.parse(raw), input.sourceUrl);
}

/**
 * Normalizes raw model/fixture JSON into an Extraction: resolves `categorySlug` -> `categoryId`,
 * forces `description` to null (curator-authored later), coerces the confidence range, and
 * SANITIZES free-text fields (M4): `<`, `>`, and control characters are stripped from name,
 * summary, tags, and every string inside the `attributes` bag — page-injected markup never
 * reaches the queue. Wrong-TYPED fields are passed through untouched so `validatePayload` can
 * report them as validation errors instead of this module throwing (L3).
 */
export function normalize(raw: unknown, sourceUrl: string): Extraction {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('extraction is not a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  const payloadRaw = (obj.payload ?? {}) as Record<string, unknown>;

  // Accept either categorySlug (LLM output) or a pre-resolved categoryId (fixtures may use it).
  let categoryId = typeof payloadRaw.categoryId === 'string' ? payloadRaw.categoryId : undefined;
  const slug = payloadRaw.categorySlug;
  if (!categoryId && typeof slug === 'string') {
    if (!isCategorySlug(slug)) {
      throw new Error(`unknown categorySlug from extraction: "${slug}"`);
    }
    categoryId = CATEGORY_IDS[slug];
  }
  if (!categoryId) {
    throw new Error('extraction is missing categorySlug/categoryId');
  }

  const { categorySlug: _drop, ...rest } = payloadRaw;
  const payload = {
    ...rest,
    name: sanitizeIfString(rest.name),
    // The organizer the page states, verbatim (resolve-or-create by name on approve). We never
    // substitute the S2 index hint here — an unverified hint must not become catalog data; a page
    // that doesn't name its organizer stays null and is flagged for manual assignment (decision b).
    organizerName: sanitizeIfString(rest.organizerName),
    summary: sanitizeIfString(rest.summary),
    tags: Array.isArray(rest.tags) ? rest.tags.map((t) => sanitizeIfString(t)) : rest.tags,
    attributes: pruneNullProps(sanitizeDeep(rest.attributes)),
    categoryId,
    description: null, // never carry model prose — S4 writes our own
    officialUrl: (payloadRaw.officialUrl as string | undefined) ?? sourceUrl,
    // The edition/key-date free text is model output from an untrusted page like everything
    // else, so it gets the same M4 treatment. Spreading `rest` would otherwise smuggle
    // unsanitized prose in through the newest fields.
    ...(rest.edition != null ? { edition: sanitizeEdition(rest.edition) } : {}),
    ...(Array.isArray(rest.keyDates) ? { keyDates: sanitizeKeyDates(rest.keyDates) } : {}),
  } as Extraction['payload'];

  const modelConfidence = clampUnit(obj.modelConfidence);
  return {
    payload,
    ...(modelConfidence !== undefined ? { modelConfidence } : {}),
    ...(typeof obj.reviewerNotes === 'string' ? { reviewerNotes: obj.reviewerNotes } : {}),
  };
}

/** Sanitizes the edition's free-text fields; every other key passes through untouched. */
function sanitizeEdition(edition: unknown): unknown {
  if (typeof edition !== 'object' || edition === null) return edition;
  const e = edition as Record<string, unknown>;
  return {
    ...e,
    cycleLabel: sanitizeIfString(e.cycleLabel),
    prizeSummary: sanitizeIfString(e.prizeSummary),
  };
}

/** Same for each key date's label — the only free text on a timeline row. */
function sanitizeKeyDates(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) return row;
    const r = row as Record<string, unknown>;
    return { ...r, label: sanitizeIfString(r.label) };
  });
}

/** Strips `<`, `>`, and ASCII control characters from a string (M4). */
export function sanitizeText(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '<' || ch === '>') continue;
    if (code < 0x20 && ch !== '\n' && ch !== '\t') continue;
    if (code === 0x7f) continue;
    out += ch;
  }
  return out.trim();
}

function sanitizeIfString<T>(value: T): T {
  return (typeof value === 'string' ? sanitizeText(value) : value) as T;
}

/** Recursively sanitizes string values in the attributes bag (objects + arrays). */
function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeText(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Drops `null`/`undefined`-valued PROPERTIES from the attributes bag (recursively through nested
 * objects; array elements are left intact). The LLM sometimes emits an unknown optional attribute
 * as an explicit `null` (e.g. `"eligible_countries": null`), which fails the Category Template's
 * `type: array` and sends an otherwise-good record to INVALID. An absent key is the correct
 * encoding for "unknown", so we omit it — spine fields are untouched (their nulls are meaningful).
 */
export function pruneNullProps<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => pruneNullProps(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      out[k] = pruneNullProps(v);
    }
    return out as T;
  }
  return value;
}

function clampUnit(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

/** Extracts the first JSON object from an LLM response (tolerates code fences / stray prose). */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate!.indexOf('{');
  const end = candidate!.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in extraction response');
  }
  return JSON.parse(candidate!.slice(start, end + 1));
}
