import assert from 'node:assert/strict';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_SLUGS, CATEGORY_TEMPLATES } from '../src/categories.ts';
import type { Config } from '../src/config.ts';
import { anthropicExtract, isMalformedOutputError, type MessageCreator } from '../src/extract.ts';
import { buildSystemPrompt } from '../src/prompt.ts';
import { KEY_DATE_TYPES } from '../src/types.ts';

const CONFIG = { anthropicApiKey: 'test-key', anthropicModel: 'claude-sonnet-5' } as Config;
const INPUT = { sourceUrl: 'https://example.org/contest', pageText: 'a contest page' };

const GOOD_JSON = JSON.stringify({
  payload: { slug: 'x', name: 'X Contest', categorySlug: 'math' },
  modelConfidence: 0.8,
});
/** The real failure from the 50-page batch: an unquoted enum value. */
const UNQUOTED_ENUM = '{"payload": {"categorySlug": "math", "delivery": VIRTUAL}}';

function reply(text: string, stopReason: Anthropic.Message['stop_reason'] = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

/** Records every request so a test can assert on call count and on the retry note. */
function fakeClient(replies: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessageCreator = {
    messages: {
      create: async (body) => {
        calls.push(body);
        const next = replies[calls.length - 1];
        if (!next)
          throw new Error(
            `fake client called ${calls.length}x, only ${replies.length} replies queued`,
          );
        return next;
      },
    },
  };
  return { client, calls };
}

/** The retry path writes progress to stderr by design; keep the test output readable. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.stderr.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    return await fn();
  } finally {
    process.stderr.write = original;
  }
}

const userText = (body: Anthropic.MessageCreateParamsNonStreaming) =>
  String((body.messages[0] as { content: string }).content);

test('isMalformedOutputError covers shape failures only', () => {
  assert.equal(isMalformedOutputError(new SyntaxError('Unexpected token V')), true);
  assert.equal(
    isMalformedOutputError(new Error('no JSON object found in extraction response')),
    true,
  );
  assert.equal(isMalformedOutputError(new Error('extraction is not a JSON object')), true);
  // A wrong-but-parseable answer is the model's considered response, not a formatting slip —
  // re-rolling it would burn tokens papering over a prompt problem someone should see.
  assert.equal(
    isMalformedOutputError(new Error('unknown categorySlug from extraction: "chess"')),
    false,
  );
  assert.equal(
    isMalformedOutputError(new Error('extraction is missing categorySlug/categoryId')),
    false,
  );
});

test('an unparseable response is re-asked, and the retry succeeds', async () => {
  const { client, calls } = fakeClient([reply(UNQUOTED_ENUM), reply(GOOD_JSON)]);
  const extraction = await quietly(() => anthropicExtract(INPUT, CONFIG, client));
  assert.equal(calls.length, 2);
  assert.equal(extraction.payload.name, 'X Contest');
});

test('the retry tells the model what went wrong, and only on the retry', async () => {
  const { client, calls } = fakeClient([reply(UNQUOTED_ENUM), reply(GOOD_JSON)]);
  await quietly(() => anthropicExtract(INPUT, CONFIG, client));
  assert.ok(!userText(calls[0]!).includes('RETRY:'), 'first attempt must be the plain prompt');
  assert.match(userText(calls[1]!), /RETRY: your previous response could not be parsed/);
});

test('the cached system prefix is byte-identical across the retry', async () => {
  // The retry note goes in the USER turn on purpose: a changed system prefix would miss the
  // prompt cache on every re-ask, which is when tokens are already being spent twice.
  const { client, calls } = fakeClient([reply(UNQUOTED_ENUM), reply(GOOD_JSON)]);
  await quietly(() => anthropicExtract(INPUT, CONFIG, client));
  assert.deepEqual(calls[0]!.system, calls[1]!.system);
});

test('giving up after the attempt cap reports the last parse error', async () => {
  const { client, calls } = fakeClient([
    reply(UNQUOTED_ENUM),
    reply(UNQUOTED_ENUM),
    reply(UNQUOTED_ENUM),
  ]);
  await assert.rejects(
    () => quietly(() => anthropicExtract(INPUT, CONFIG, client)),
    /unparseable JSON 3 times for https:\/\/example\.org\/contest/,
  );
  assert.equal(calls.length, 3);
});

test('a wrong-but-parseable answer fails immediately instead of being paid for twice', async () => {
  const { client, calls } = fakeClient([
    reply('{"payload": {"categorySlug": "underwater-basket-weaving"}}'),
  ]);
  await assert.rejects(() => anthropicExtract(INPUT, CONFIG, client), /unknown categorySlug/);
  assert.equal(calls.length, 1);
});

test('a truncated response is not retried — another sample truncates the same way', async () => {
  const { client, calls } = fakeClient([reply('{"payload": {', 'max_tokens')]);
  await assert.rejects(
    () => anthropicExtract(INPUT, CONFIG, client),
    /truncated at the 20-token cap/,
  );
  assert.equal(calls.length, 1);
});

test('a refusal is not retried either', async () => {
  const { client, calls } = fakeClient([reply('', 'refusal')]);
  await assert.rejects(
    () => anthropicExtract(INPUT, CONFIG, client),
    /declined to extract this page/,
  );
  assert.equal(calls.length, 1);
});

// --- prompt coverage (2026-08-26) -------------------------------------------------------------
// Background: the attributes guidance used to be hand-written. It named example keys for three
// categories out of eleven and never mentioned the judging or contact keys at all, so eight
// categories' facts and six universal ones were never extracted. Nothing failed — templates are
// `additionalProperties: true`, so an absent key is indistinguishable from "the page didn't say".
// The guidance is generated from CATEGORY_TEMPLATES now.
//
// ⚠ READ BEFORE TRUSTING THESE: the first two tests CANNOT fail while the guidance is generated —
// adding a key to a template adds it to the prompt in the same breath. They were written as a
// drift guard, which they are not; verified by adding a key and watching them pass. What they
// DO lock in is the generation itself: rewrite renderAttributeGuidance back into a hand-listed
// subset and they go red. That is worth having (it is the exact regression above) but it is a
// different thing, so do not read a green run here as "the mirror matches the server".
//
// The mirror CAN still drift, and nothing offline catches it: categories.ts is a copy of what the
// API's changesets did to category_template, and a new changeset that adds a key leaves this file
// silently behind — which is precisely how 0015/0017/0019 went unextracted. The only authority is
// the API. When you touch a template changeset, update categories.ts in the same PR; to check the
// current state, query the running DB:
//   select jsonb_object_keys(json_schema->'properties') from category_template ...
// The last two tests are ordinary assertions on hand-written prose and fail normally.

test('the system prompt names every key of every category template', () => {
  const prompt = buildSystemPrompt();
  const missing: string[] = [];
  for (const slug of CATEGORY_SLUGS) {
    const props = CATEGORY_TEMPLATES[slug].properties as Record<string, unknown>;
    for (const key of Object.keys(props)) {
      if (!prompt.includes(key)) missing.push(`${slug}.${key}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `keys the prompt never names: ${missing.join(', ')} — renderAttributeGuidance has stopped deriving its list from CATEGORY_TEMPLATES`,
  );
});

test('the system prompt lists every category slug that has its own keys', () => {
  const prompt = buildSystemPrompt();
  for (const slug of CATEGORY_SLUGS) {
    const props = CATEGORY_TEMPLATES[slug].properties as Record<string, unknown>;
    const ownKeys = Object.keys(props).length;
    if (ownKeys > 0) assert.ok(prompt.includes(slug), `prompt never mentions category ${slug}`);
  }
});

test('the system prompt asks for CUSTOM milestones rather than dropping them', () => {
  const prompt = buildSystemPrompt();
  // Every key-date type must reach the model...
  for (const type of KEY_DATE_TYPES) {
    assert.ok(prompt.includes(type), `key-date type ${type} missing from the prompt`);
  }
  // ...and CUSTOM needs an actual INSTRUCTION, not just membership in the token list: it was in
  // the enum for months while the only guidance was a parenthetical about the label field, so
  // non-standard milestones were silently dropped.
  assert.match(prompt, /emit it as CUSTOM/i);
  assert.match(prompt, /startsAt: null/);
});

test('the system prompt states the boolean-vs-prose split that 0022 introduced', () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /student_status_required is a BOOLEAN/);
  assert.match(prompt, /other_eligibility_requirements/);
});
