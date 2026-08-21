import assert from 'node:assert/strict';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../src/config.ts';
import { anthropicExtract, isMalformedOutputError, type MessageCreator } from '../src/extract.ts';

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
