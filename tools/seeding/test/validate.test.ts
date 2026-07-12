import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { scoreConfidence } from '../src/confidence.ts';
import { normalize } from '../src/extract.ts';
import type { CompetitionPayload } from '../src/types.ts';
import { validatePayload } from '../src/validate.ts';

const fixtureUrl = new URL('../fixtures/sample-competition.expected.json', import.meta.url);

async function loadGoodPayload(): Promise<CompetitionPayload> {
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  return normalize(raw, 'https://novamath.example.org').payload;
}

test('normalize resolves categorySlug -> categoryId and nulls description', async () => {
  const extraction = normalize(
    JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8')),
    'https://novamath.example.org',
  );
  assert.equal(extraction.payload.categoryId, 'beec0000-0000-4000-8000-000000000001'); // math
  assert.equal(extraction.payload.description, null);
  assert.equal((extraction.payload as unknown as Record<string, unknown>).categorySlug, undefined);
});

test('a good extracted record passes schema + spine validation', async () => {
  const payload = await loadGoodPayload();
  const result = validatePayload(payload);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('confidence score for the good record is high and in [0,1]', async () => {
  const extraction = normalize(
    JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8')),
    'https://novamath.example.org',
  );
  const score = scoreConfidence(extraction);
  assert.ok(score > 0.8 && score <= 1, `expected high confidence, got ${score}`);
});

test('bad grade encoding fails validation (grade 13 is out of range)', async () => {
  const payload = { ...(await loadGoodPayload()), maxGrade: 13 };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes('grade encoding')),
    `expected a grade-encoding error, got: ${result.errors.join(' | ')}`,
  );
});

test('unknown enum token fails validation', async () => {
  const payload = { ...(await loadGoodPayload()), participationMode: 'SOLO' as never };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('participationMode')));
});

test('unknown evaluationType token fails validation', async () => {
  const payload = { ...(await loadGoodPayload()), evaluationType: ['quiz'] };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('evaluationType')));
});

test('attributes violating the category template schema fail (wrong type)', () => {
  // writing-essay template: word_limit must be an integer; a string must fail draft-2020-12.
  const payload: CompetitionPayload = {
    slug: 'young-writers-prize',
    name: 'Young Writers Prize',
    categoryId: 'beec0000-0000-4000-8000-000000000007', // writing-essay
    participationMode: 'INDIVIDUAL',
    delivery: 'VIRTUAL',
    entryPathway: 'INDIVIDUAL',
    costType: 'FREE',
    recurrence: 'ANNUAL',
    attributes: { word_limit: 'one thousand' },
  };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.startsWith('attributes')),
    `expected an attributes schema error, got: ${result.errors.join(' | ')}`,
  );
});

test('extra/unknown attribute keys are allowed (templates are permissive)', () => {
  const payload: CompetitionPayload = {
    slug: 'some-comp',
    name: 'Some Comp',
    categoryId: 'beec0000-0000-4000-8000-00000000000b', // other
    participationMode: 'TEAM',
    teamSizeMin: 2,
    teamSizeMax: 4,
    delivery: 'IN_PERSON',
    entryPathway: 'SCHOOL_OR_CHAPTER',
    costType: 'PAID',
    recurrence: 'ANNUAL',
    attributes: { some_new_field: 'value', topics: ['a', 'b'] },
  };
  assert.equal(validatePayload(payload).ok, true);
});
