import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_IDS, isCategorySlug } from './categories.ts';
import type { Config } from './config.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import type { Extraction } from './types.ts';

export type ExtractBackend = 'anthropic' | 'stub';

export interface ExtractInput {
  sourceUrl: string;
  pageText: string;
  /** Path of the input HTML file, if any — used to locate a sibling `.expected.json` for the stub. */
  inputPath?: string;
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
  const message = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(input.sourceUrl, input.pageText) }],
  });
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
 * forces `description` to null (curator-authored later), and coerces the confidence range.
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
    categoryId,
    description: null, // never carry model prose — S4 writes our own
    officialUrl: (payloadRaw.officialUrl as string | undefined) ?? sourceUrl,
  } as Extraction['payload'];

  const modelConfidence = clampUnit(obj.modelConfidence);
  return {
    payload,
    ...(modelConfidence !== undefined ? { modelConfidence } : {}),
    ...(typeof obj.reviewerNotes === 'string' ? { reviewerNotes: obj.reviewerNotes } : {}),
  };
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
