import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_IDS, isCategorySlug } from './categories.ts';
import type { Config } from './config.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import type { TemplateMap } from './templates.ts';
import type { Extraction, SeedHints } from './types.ts';

export type ExtractBackend = 'anthropic' | 'stub';

export interface ExtractInput {
  sourceUrl: string;
  pageText: string;
  /** Path of the input HTML file, if any — used to locate a sibling `.expected.json` for the stub. */
  inputPath?: string;
  /** Known facts from the S2 master index, fed to the model as trusted guidance (#2). */
  hints?: SeedHints;
  /**
   * Category Templates for this run — the SERVER's copy when the API was reachable, the
   * checked-in mirror otherwise (templates.ts). The attributes half of the system prompt is
   * generated from it, so a stale map here silently narrows what gets extracted.
   */
  templates?: TemplateMap;
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

/**
 * Transport-level retries, handled by the SDK (connection drops, timeouts, 429, 5xx) with its own
 * exponential backoff and jitter. The default is 2, which a 50-page batch already exhausted twice
 * — both pages were lost to a bare "Connection error." after the fetch had already succeeded.
 * A re-ask is far cheaper than re-running a batch, and a genuinely dead endpoint still fails, just
 * a few seconds later.
 */
const SDK_MAX_RETRIES = 5;

/**
 * Re-rolls when the model returns something that is not parseable JSON. Distinct from the SDK
 * retries above: nothing is wrong with the transport, the model just formatted badly — in the
 * 50-page batch one page came back with a bare `"delivery": VIRTUAL,` (an unquoted enum) and the
 * whole record was lost to a single character. Sampling is non-deterministic, so simply asking
 * again usually lands, and the retry says what went wrong to make that likelier still.
 */
const MAX_PARSE_ATTEMPTS = 3;

/** The subset of the SDK surface this module uses — lets tests drive the retry loop with a fake. */
export interface MessageCreator {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/**
 * True for failures that mean "the model's output was not well-formed", which a re-roll can fix.
 *
 * Deliberately narrow. A wrong-but-parseable answer — an unknown `categorySlug`, a missing one —
 * is the model's considered response, not a formatting slip; re-rolling it burns tokens to paper
 * over a prompt problem someone should see. Only shape failures are retried.
 */
export function isMalformedOutputError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true; // JSON.parse
  const message = err instanceof Error ? err.message : '';
  return (
    message === 'no JSON object found in extraction response' ||
    message === 'extraction is not a JSON object'
  );
}

export async function anthropicExtract(
  input: ExtractInput,
  config: Config,
  client: MessageCreator = new Anthropic({
    apiKey: config.anthropicApiKey,
    maxRetries: SDK_MAX_RETRIES,
  }),
): Promise<Extraction> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const text = await callModel(input, config, client, attempt > 1 ? lastError : undefined);
    try {
      return normalize(parseJsonObject(text), input.sourceUrl);
    } catch (err) {
      // A malformed response is worth another sample; anything else is a real answer we should
      // surface immediately rather than pay for twice.
      if (!isMalformedOutputError(err)) throw err;
      lastError = err;
      if (attempt < MAX_PARSE_ATTEMPTS) {
        // Never silent: a retry that always fires means the prompt drifted, and that should be
        // visible in the run log rather than hidden behind an eventual success.
        process.stderr.write(
          `  unparseable extraction for ${input.sourceUrl} ` +
            `(attempt ${attempt}/${MAX_PARSE_ATTEMPTS}): ${(err as Error).message} — re-asking
`,
        );
      }
    }
  }

  throw new Error(
    `the model returned unparseable JSON ${MAX_PARSE_ATTEMPTS} times for ${input.sourceUrl}; ` +
      `last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/** One request/response round trip. Returns the response text; throws on unusable stop reasons. */
async function callModel(
  input: ExtractInput,
  config: Config,
  client: MessageCreator,
  previousFailure: unknown,
): Promise<string> {
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
      // change the prefix bytes and defeat the cache entirely. The retry note below is appended to
      // the USER turn for the same reason: it must not disturb the cached prefix.
      //
      // Default 5-minute TTL is deliberate: a batch run extracts a page every few seconds, so the
      // entry never goes cold, and the 1h TTL's 2x write premium would not pay for itself.
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(input.templates),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content:
            buildUserPrompt(input.sourceUrl, input.pageText, input.hints) +
            retryNote(previousFailure),
        },
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
  // is the token cap. Say so instead of making the next person debug the prompt. Not retried:
  // another sample of the same long page truncates the same way.
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

  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/** Tells the model how the previous attempt failed. Empty on the first attempt. */
function retryNote(previousFailure: unknown): string {
  if (previousFailure === undefined) return '';
  const reason =
    previousFailure instanceof Error ? previousFailure.message : String(previousFailure);
  return (
    `

RETRY: your previous response could not be parsed (${reason}). Reply with ONLY the JSON ` +
    'object — no prose, no code fence — and make sure every string and enum value is quoted.'
  );
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
 * coerces the confidence range, and SANITIZES free-text fields (M4): `<`, `>`, and control
 * characters are stripped from name, description, tags, resource titles, and every string inside
 * the `attributes` bag — page-injected markup never reaches the queue. Wrong-TYPED fields are passed through untouched so `validatePayload` can
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
    tags: Array.isArray(rest.tags) ? rest.tags.map((t) => sanitizeIfString(t)) : rest.tags,
    attributes: pruneNullProps(sanitizeDeep(rest.attributes)),
    categoryId,
    // Carried since 2026-08-28 (owner): the model writes ORIGINAL prose from the facts and S4
    // reviews it, matching the hand-paste path. It used to be forced to null, which in practice
    // meant every seeded listing arrived blank. Sanitized like every other free-text field — it is
    // model output derived from an untrusted page, so M4 applies to it exactly as it does to name.
    // `?? null` keeps the KEY present when the model wrote nothing: the submit contract asserts a
    // fixed field set, and an absent description is a stated null, not a missing field.
    description: sanitizeIfString(rest.description) ?? null,
    officialUrl: (payloadRaw.officialUrl as string | undefined) ?? sourceUrl,
    // The edition/key-date free text is model output from an untrusted page like everything
    // else, so it gets the same M4 treatment. Spreading `rest` would otherwise smuggle
    // unsanitized prose in through the newest fields.
    ...(rest.edition != null ? { edition: sanitizeEdition(rest.edition) } : {}),
    ...(Array.isArray(rest.keyDates) ? { keyDates: sanitizeKeyDates(rest.keyDates) } : {}),
    ...(Array.isArray(rest.resources) ? { resources: sanitizeResources(rest.resources) } : {}),
    ...(Array.isArray(rest.faqs) ? { faqs: sanitizeFaqs(rest.faqs) } : {}),
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
/**
 * Resource rows carry a model-written `title` from an untrusted page, so it gets the same M4
 * treatment as every other free-text field. `url` is deliberately NOT sanitized — stripping
 * characters out of a URL would quietly produce a different, possibly working, link; a malformed
 * one is rejected outright by validatePayload instead.
 *
 * `imageUrl` is DROPPED outright (2026-08-28). Both prompts forbid it, but a model that emits one
 * anyway must not have it published: an Amazon image id cannot be derived from an ASIN and an
 * og:image cannot be known without fetching, so any value here is a guess — and a guess fails
 * INVISIBLY, because ResourceArt swaps a broken image for the per-type art. The page would look
 * correct while every cover 404s. Dropped rather than rejected: it is a decorative field, and
 * failing a whole extraction over it would cost more than it saves. Real preview images are
 * fetched from the live page or licensed through the merchant's API — never inferred.
 */
function sanitizeResources(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) return row;
    const { imageUrl: _dropGuessedArt, ...r } = row as Record<string, unknown>;
    return { ...r, title: sanitizeIfString(r.title) };
  });
}

/** Both halves of an FAQ row are model prose derived from an untrusted page — M4 applies to both. */
function sanitizeFaqs(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) return row;
    const r = row as Record<string, unknown>;
    return { ...r, question: sanitizeIfString(r.question), answer: sanitizeIfString(r.answer) };
  });
}

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
