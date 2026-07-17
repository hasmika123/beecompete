import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { scoreConfidence } from '../src/confidence.ts';
import { normalize, sanitizeText } from '../src/extract.ts';
import { compareHints } from '../src/hints.ts';
import { dedupeByUrl } from '../src/input.ts';
import type { CompetitionPayload, Extraction, SeedHints } from '../src/types.ts';
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

test('dedupeByUrl collapses shared URLs (AMC family) but keeps distinct URLs and local files', () => {
  const items = dedupeByUrl([
    { source: 'https://maa.org/student-programs/amc' }, // AMC 10
    { source: 'https://maa.org/student-programs/amc/' }, // AMC 12 — trailing slash, same page
    { source: 'https://MAA.org/student-programs/amc' }, // AMC 8 — case-different host
    { source: 'https://www.mathcounts.org' }, // distinct
    { source: 'fixtures/sample-competition.html' }, // local path — never deduped
  ]);
  assert.deepEqual(
    items.map((i) => i.source),
    [
      'https://maa.org/student-programs/amc',
      'https://www.mathcounts.org',
      'fixtures/sample-competition.html',
    ],
  );
});

test('normalize prunes null-valued attribute props so a null optional key stays valid', async () => {
  // The LLM sometimes emits an unknown optional attribute as an explicit null (e.g.
  // "eligible_countries": null), which would fail the template's `type: array`. It must be dropped.
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  raw.payload.attributes = {
    ...raw.payload.attributes,
    eligible_countries: null,
    nested: { a: null, b: 1 },
  };
  const { payload } = normalize(raw, 'https://novamath.example.org');
  const attrs = payload.attributes as Record<string, unknown>;
  assert.equal('eligible_countries' in attrs, false);
  assert.deepEqual(attrs.nested, { b: 1 });
  assert.equal(validatePayload(payload).ok, true);
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

// --- M2: URL fields must be well-formed http(s) and within the server @Size cap ---

test('non-http(s) officialUrl fails validation (javascript: scheme)', async () => {
  const payload = { ...(await loadGoodPayload()), officialUrl: 'javascript:alert(1)' };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('officialUrl') && e.includes('http(s)')));
});

test('garbage logo URL fails validation', async () => {
  const payload = { ...(await loadGoodPayload()), logo: 'not a url at all' };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('logo') && e.includes('not a valid URL')));
});

test('officialUrl longer than the server 1000-char cap fails validation', async () => {
  const long = `https://example.org/${'a'.repeat(1000)}`;
  const payload = { ...(await loadGoodPayload()), officialUrl: long };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('officialUrl') && e.includes('1000')));
});

// --- M2: numeric range additions ---

test('teamSizeMin below 1 fails validation', async () => {
  const payload = {
    ...(await loadGoodPayload()),
    participationMode: 'TEAM' as const,
    teamSizeMin: 0,
    teamSizeMax: 4,
  };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('teamSizeMin must be >= 1')));
});

test('negative maxAge fails validation', async () => {
  const payload = { ...(await loadGoodPayload()), maxAge: -3 };
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('maxAge must be >= 0')));
});

test('teamSize fields with participationMode INDIVIDUAL warn but do not fail', async () => {
  const payload = { ...(await loadGoodPayload()), teamSizeMin: 2, teamSizeMax: 4 };
  const result = validatePayload(payload); // fixture participationMode is INDIVIDUAL
  assert.equal(result.ok, true, `unexpected errors: ${result.errors.join(' | ')}`);
  assert.ok(result.warnings.some((w) => w.includes('INDIVIDUAL')));
});

// --- L3: wrong-typed fields become validation errors, not TypeErrors ---

test('wrong-typed fields produce validation errors instead of throwing', async () => {
  const payload = {
    ...(await loadGoodPayload()),
    name: 42,
    minGrade: '6',
    tags: ['ok', 7],
  } as unknown as CompetitionPayload;
  const result = validatePayload(payload); // must not throw
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('name must be a string')));
  assert.ok(result.errors.some((e) => e.includes('minGrade must be a number')));
  assert.ok(result.errors.some((e) => e.includes('tags must be an array of strings')));
});

// --- M4: free-text sanitizing (angle brackets + control chars stripped in normalize) ---

const BEL = String.fromCharCode(7);
const NUL = String.fromCharCode(0);

test('normalize strips angle brackets and control chars from free-text fields', () => {
  const extraction = normalize(
    {
      payload: {
        slug: 'evil-comp',
        name: `Evil <script>alert(1)</script>${BEL} Comp`,
        summary: `a${NUL}b <b>bold</b>`,
        categorySlug: 'math',
        tags: ['<i>tag</i>', 'clean'],
        participationMode: 'INDIVIDUAL',
        delivery: 'VIRTUAL',
        entryPathway: 'INDIVIDUAL',
        costType: 'FREE',
        recurrence: 'ANNUAL',
        attributes: { topics: ['<u>algebra</u>'], syllabus: `x${NUL}y` },
      },
    },
    'https://evil.example.org',
  );
  const p = extraction.payload;
  for (const value of [p.name, p.summary, p.tags?.[0]]) {
    const s = String(value);
    assert.ok(!s.includes('<') && !s.includes('>'), `expected no angle brackets in "${s}"`);
  }
  assert.ok(!String(p.name).includes(BEL));
  assert.ok(!String(p.summary).includes(NUL));
  const attrs = p.attributes as Record<string, unknown>;
  assert.equal((attrs.topics as string[])[0], 'ualgebra/u'); // brackets gone, text kept
  assert.equal(attrs.syllabus, 'xy'); // control char stripped
});

test('sanitizeText strips <, >, DEL, and C0 controls but keeps newlines/tabs', () => {
  const input = `a<b>c${String.fromCharCode(1)} de\nf\tg${String.fromCharCode(127)}`;
  assert.equal(sanitizeText(input), 'abc de\nf\tg');
});

// --- H3: confidence is penalty-only — model self-report can lower, never raise ---

test('model self-reported confidence can only lower the score, never raise it', () => {
  const sparsePayload = {
    slug: 'sparse-comp',
    name: 'Sparse Comp',
    categoryId: 'beec0000-0000-4000-8000-000000000001',
  } as CompetitionPayload;
  const noModel: Extraction = { payload: sparsePayload };
  const modelMax: Extraction = { payload: sparsePayload, modelConfidence: 1.0 };
  const modelLow: Extraction = { payload: sparsePayload, modelConfidence: 0.0 };

  const baseline = scoreConfidence(noModel); // = completeness
  assert.equal(
    scoreConfidence(modelMax),
    baseline,
    'an inflated self-report must not raise the score above completeness',
  );
  assert.ok(scoreConfidence(modelLow) < baseline, 'a low self-report must lower the score');
});

// --- #1 flagging: extraction vs. S2 master-index hints ---

test('compareHints flags cost/participation/category disagreements for the curator', async () => {
  const payload = await loadGoodPayload(); // FREE, INDIVIDUAL, math (categoryId ...001)
  const hints: SeedHints = { cost: 'paid', participation: 'team', categorySlug: 'robotics' };
  const warnings = compareHints(payload, hints);
  assert.ok(warnings.some((w) => w.includes('cost mismatch')));
  assert.ok(warnings.some((w) => w.includes('participation mismatch')));
  assert.ok(warnings.some((w) => w.includes('category mismatch')));
});

test('compareHints stays silent when hints agree or are absent/unknown', async () => {
  const payload = await loadGoodPayload();
  assert.deepEqual(compareHints(payload, {}), []);
  // Agreeing hints (fixture is FREE / INDIVIDUAL / math, organizer "Nova Math Foundation") + an
  // "unknown" placeholder → no flags. Organizer compare is case- and whitespace-insensitive.
  assert.deepEqual(
    compareHints(payload, {
      cost: 'free',
      participation: 'individual',
      categorySlug: 'math',
      organizer: 'nova   math   foundation',
      entryPathway: 'unknown',
    }),
    [],
  );
});

test('compareHints flags an organizer disagreement for the curator', async () => {
  const payload = await loadGoodPayload(); // organizerName "Nova Math Foundation"
  const warnings = compareHints(payload, { organizer: 'Rival Math Society' });
  assert.ok(
    warnings.some((w) => w.includes('organizer mismatch')),
    `expected an organizer mismatch, got: ${warnings.join(' | ')}`,
  );
});
