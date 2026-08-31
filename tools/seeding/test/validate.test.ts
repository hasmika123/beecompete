import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { scoreConfidence } from '../src/confidence.ts';
import { normalize, sanitizeText } from '../src/extract.ts';
import { compareHints } from '../src/hints.ts';
import { dedupeByUrl } from '../src/input.ts';
import type { CompetitionPayload, Extraction, SeedHints, SeedPayload } from '../src/types.ts';
import { validatePayload } from '../src/validate.ts';

const fixtureUrl = new URL('../fixtures/sample-competition.expected.json', import.meta.url);

async function loadGoodPayload(): Promise<SeedPayload> {
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  return normalize(raw, 'https://novamath.example.org').payload;
}

test('normalize resolves categorySlug -> categoryId; an absent description stays a stated null', async () => {
  const extraction = normalize(
    JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8')),
    'https://novamath.example.org',
  );
  assert.equal(extraction.payload.categoryId, 'beec0000-0000-4000-8000-000000000001'); // math
  // The fixture writes none. The KEY still has to be there — the submit contract pins the field set.
  assert.equal(extraction.payload.description, null);
  assert.equal((extraction.payload as unknown as Record<string, unknown>).categorySlug, undefined);
});

// Descriptions ride through since 2026-08-28 (owner): the extractor writes original prose from the
// facts, matching the hand-paste prompt. It used to be forced to null here, which meant every
// seeded listing reached the queue blank.
test('normalize carries a model-written description, sanitized', async () => {
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  raw.payload.description = 'A written <script>alert(1)</script> maths contest for grades 9-12.';
  const { payload } = normalize(raw, 'https://novamath.example.org');
  assert.equal(
    payload.description,
    'A written scriptalert(1)/script maths contest for grades 9-12.',
    'description must survive normalize, with M4 stripping < and >',
  );
});

test('normalize sanitizes resource titles but never rewrites their URLs', async () => {
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  raw.payload.resources = [
    { title: 'Past <b>papers</b>', url: 'https://example.org/past?a=1&b=2', type: 'PAST_PAPER' },
  ];
  const { payload } = normalize(raw, 'https://novamath.example.org');
  const rows = (payload as unknown as Record<string, unknown>).resources as Record<
    string,
    unknown
  >[];
  assert.equal(rows[0]!.title, 'Past bpapers/b');
  // Stripping characters out of a URL would silently produce a DIFFERENT link.
  assert.equal(rows[0]!.url, 'https://example.org/past?a=1&b=2');
});

test('validatePayload rejects unusable resource rows and any self-declared affiliate link', async () => {
  const payload = await loadGoodPayload();
  const p = payload as unknown as Record<string, unknown>;
  p.resources = [
    { title: 'No url', type: 'GUIDE' },
    { title: 'Bad url', url: 'not-a-url', type: 'GUIDE' },
    { title: 'Bad type', url: 'https://example.org/x', type: 'PODCAST' },
    { title: 'Tagged', url: 'https://amazon.com/dp/1', type: 'BOOK', isAffiliate: true },
  ];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('resources[0].url')));
  assert.ok(errors.some((e) => e.includes('resources[1].url')));
  assert.ok(errors.some((e) => e.includes('resources[2].type')));
  // The affiliate flag is a legal claim; the extractor has no business making it.
  assert.ok(errors.some((e) => e.includes('resources[3].isAffiliate')));
});

test('normalize drops a guessed resource imageUrl', async () => {
  // Both prompts forbid it. A model that emits one anyway must not have it published: the value
  // can only be a guess, and ResourceArt's onError fallback makes a guessed URL fail INVISIBLY.
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  raw.payload.resources = [
    {
      title: 'Prep book',
      url: 'https://www.amazon.com/dp/123',
      type: 'BOOK',
      imageUrl: 'https://m.media-amazon.com/images/I/totally-made-up.jpg',
    },
  ];
  const { payload } = normalize(raw, 'https://novamath.example.org');
  const rows = (payload as unknown as Record<string, unknown>).resources as Record<
    string,
    unknown
  >[];
  assert.equal(rows[0]!.imageUrl, undefined);
  assert.equal(rows[0]!.url, 'https://www.amazon.com/dp/123', 'the link itself is untouched');
});

test('validatePayload rejects FAQ rows missing either half', async () => {
  const payload = await loadGoodPayload();
  const p = payload as unknown as Record<string, unknown>;
  p.faqs = [
    { question: 'No answer?' },
    { answer: 'No question.' },
    { question: 'x'.repeat(501), answer: 'Too long a question.' },
  ];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('faqs[0].answer')));
  assert.ok(errors.some((e) => e.includes('faqs[1].question')));
  assert.ok(errors.some((e) => e.includes('faqs[2].question')));
});

test('normalize sanitizes both halves of an FAQ row', async () => {
  const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  raw.payload.faqs = [{ question: 'Who <b>enters</b>?', answer: 'Grades <i>9-12</i>.' }];
  const { payload } = normalize(raw, 'https://novamath.example.org');
  const rows = (payload as unknown as Record<string, unknown>).faqs as Record<string, unknown>[];
  assert.equal(rows[0]!.question, 'Who benters/b?');
  assert.equal(rows[0]!.answer, 'Grades i9-12/i.');
});

test('validatePayload accepts a well-formed faq list', async () => {
  const payload = await loadGoodPayload();
  const p = payload as unknown as Record<string, unknown>;
  p.faqs = [{ question: 'Who can enter?', answer: 'Students in grades 9-12.' }];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, true, `expected valid, got: ${errors.join(' | ')}`);
});

test('validatePayload accepts a well-formed resource list', async () => {
  const payload = await loadGoodPayload();
  const p = payload as unknown as Record<string, unknown>;
  p.resources = [
    { title: 'Official past papers', url: 'https://example.org/past', type: 'PAST_PAPER' },
    {
      title: 'Prep book',
      url: 'https://www.amazon.com/dp/0977304561',
      type: 'BOOK',
      isAffiliate: false,
    },
  ];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, true, `expected valid, got: ${errors.join(' | ')}`);
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
    entryPathways: ['INDIVIDUAL'],
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
    entryPathways: ['SCHOOL', 'CHAPTER'],
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
        organizerName: `a${NUL}b <b>bold</b>`,
        categorySlug: 'math',
        tags: ['<i>tag</i>', 'clean'],
        participationMode: 'INDIVIDUAL',
        delivery: 'VIRTUAL',
        entryPathways: ['INDIVIDUAL'],
        costType: 'FREE',
        recurrence: 'ANNUAL',
        attributes: { topics: ['<u>algebra</u>'], syllabus: `x${NUL}y` },
      },
    },
    'https://evil.example.org',
  );
  const p = extraction.payload;
  for (const value of [p.name, p.organizerName, p.tags?.[0]]) {
    const s = String(value);
    assert.ok(!s.includes('<') && !s.includes('>'), `expected no angle brackets in "${s}"`);
  }
  assert.ok(!String(p.name).includes(BEL));
  assert.ok(!String(p.organizerName).includes(NUL));
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
      // The S2 index hint stays a single word; only the PAYLOAD became a set.
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

// ---------------------------------------------------------------------------
// S3 v1 — first edition + key dates
// ---------------------------------------------------------------------------

test('the fixture carries a valid edition + key dates, including a TBD row', async () => {
  const payload = await loadGoodPayload();
  const result = validatePayload(payload);
  assert.equal(result.ok, true, `expected valid, got: ${result.errors.join(' | ')}`);
  assert.equal(payload.edition?.cycleLabel, '2026');
  // The undated RESULTS row survives normalize as an explicit null — that is the TBD encoding
  // (R1-18), not a dropped field.
  const results = payload.keyDates?.find((d) => d.type === 'RESULTS');
  assert.equal(results?.startsAt ?? null, null);
  assert.equal(results?.label, 'Winners announced');
});

test('key dates without an edition are an error, not a silent drop', async () => {
  const payload = await loadGoodPayload();
  delete payload.edition;
  const result = validatePayload(payload);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes('keyDates present without an edition')),
    `expected the orphan-dates error, got: ${result.errors.join(' | ')}`,
  );
});

test('no edition at all is a warning — the listing would stay hidden', async () => {
  const payload = await loadGoodPayload();
  delete payload.edition;
  delete payload.keyDates;
  const result = validatePayload(payload);
  assert.equal(result.ok, true); // not fatal: a curator can add the edition at S4
  assert.ok(
    result.warnings.some((w) => w.includes('no edition extracted')),
    `expected the hidden-listing warning, got: ${result.warnings.join(' | ')}`,
  );
});

test('edition enums, money pairing and caps mirror the server rules', async () => {
  const payload = await loadGoodPayload();
  payload.edition = {
    cycleLabel: '',
    status: 'SOMEDAY' as never,
    scopeLevel: 'PLANETARY' as never,
    entryFee: 25,
    prizeValue: 500,
    prizeCurrency: 'dollars',
  };
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  for (const expected of [
    'edition.cycleLabel is required',
    'edition.status must be one of',
    'edition.scopeLevel must be one of',
    'edition.entryFee needs edition.currency',
    'edition.prizeCurrency must be a 3-letter uppercase ISO code',
  ]) {
    assert.ok(
      errors.some((e) => e.includes(expected)),
      `missing "${expected}" in: ${errors.join(' | ')}`,
    );
  }
});

test('key-date instants must parse, and endsAt requires a startsAt', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [
    { type: 'REG_CLOSE', startsAt: 'next tuesday' },
    { type: 'RESULTS', endsAt: '2026-12-01T00:00:00Z' },
    { type: 'NOT_A_TYPE' as never },
  ];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('keyDates[0].startsAt is not a valid ISO-8601 instant')));
  assert.ok(errors.some((e) => e.includes('keyDates[1].endsAt requires a startsAt')));
  assert.ok(errors.some((e) => e.includes('keyDates[2].type must be one of')));
});

test('an all-TBD timeline is valid but flagged for curator lookup', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [{ type: 'REG_CLOSE' }, { type: 'RESULTS' }];
  const { ok, warnings } = validatePayload(payload);
  // TBD is the CORRECT output for an undated page — never an error, or the extractor would be
  // pushed toward guessing deadlines.
  assert.equal(ok, true);
  assert.ok(
    warnings.some((w) => w.includes('every key date is TBD')),
    `expected the all-TBD warning, got: ${warnings.join(' | ')}`,
  );
});

test('two REG_CLOSE rows warn — the earliest would silently become the deadline', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [
    { type: 'REG_CLOSE', startsAt: '2026-10-01T00:00:00Z' },
    { type: 'REG_CLOSE', startsAt: '2026-11-03T00:00:00Z' },
  ];
  const { ok, warnings } = validatePayload(payload);
  assert.equal(ok, true);
  assert.ok(
    warnings.some((w) => w.includes('2 REG_CLOSE rows') && w.includes('deadline')),
    `expected the duplicate-type warning, got: ${warnings.join(' | ')}`,
  );
});

test('repeated ROUND_START and CUSTOM rows are exempt', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [
    { type: 'REG_CLOSE', startsAt: '2026-11-03T00:00:00Z' },
    { type: 'ROUND_START', startsAt: '2027-03-01T00:00:00Z', label: 'Semifinal' },
    { type: 'ROUND_START', startsAt: '2027-04-01T00:00:00Z', label: 'Final' },
    { type: 'CUSTOM', startsAt: '2026-09-01T00:00:00Z', label: 'Early-bird deadline' },
    { type: 'CUSTOM', startsAt: '2026-09-15T00:00:00Z', label: 'Info session' },
  ];
  const { warnings } = validatePayload(payload);
  assert.ok(!warnings.some((w) => w.includes('rows — only one is meaningful')));
});

test('a grade range with no eligibilityBasis warns — the form field is required', async () => {
  const payload = await loadGoodPayload();
  payload.eligibilityBasis = null;
  payload.minGrade = 9;
  payload.maxGrade = 12;
  const { ok, warnings } = validatePayload(payload);
  // Not an error: a null basis is legitimate on its own, and the curator decides.
  assert.equal(ok, true);
  assert.ok(
    warnings.some((w) => w.includes('eligibilityBasis is null') && w.includes('GRADE')),
    `expected the missing-basis warning, got: ${warnings.join(' | ')}`,
  );
});

test('an age range with no basis names AGE, and both ranges name BOTH', async () => {
  const base = await loadGoodPayload();
  const ages = { ...base, eligibilityBasis: null, minGrade: null, maxGrade: null, minAge: 13 };
  assert.ok(validatePayload(ages).warnings.some((w) => w.includes('AGE')));
  const both = { ...base, eligibilityBasis: null, minGrade: 9, minAge: 13 };
  assert.ok(validatePayload(both).warnings.some((w) => w.includes('BOTH')));
});

test('no basis and no ranges is silent — "the source never said" is a real answer', async () => {
  const payload = await loadGoodPayload();
  Object.assign(payload, {
    eligibilityBasis: null,
    minGrade: null,
    maxGrade: null,
    minAge: null,
    maxAge: null,
  });
  assert.ok(!validatePayload(payload).warnings.some((w) => w.includes('eligibilityBasis is null')));
});

test('an unlabelled ROUND_START warns — the timeline can only say "Round begins"', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [
    { type: 'REG_CLOSE', startsAt: '2026-03-01T00:00:00Z' },
    { type: 'ROUND_START', startsAt: '2026-04-01T00:00:00Z', endsAt: '2026-04-02T00:00:00Z' },
  ];
  const { ok, warnings } = validatePayload(payload);
  // Not an error: the server accepts the row and a curator can name it at review.
  assert.equal(ok, true);
  assert.ok(
    warnings.some((w) => w.includes('ROUND_START with no label')),
    `expected the unlabelled-round warning, got: ${warnings.join(' | ')}`,
  );
});

test('a LABELLED round is accepted without the warning', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [
    { type: 'REG_CLOSE', startsAt: '2026-03-01T00:00:00Z' },
    { type: 'ROUND_START', startsAt: '2026-04-01T00:00:00Z', label: 'National Finals' },
  ];
  const { warnings } = validatePayload(payload);
  assert.ok(
    !warnings.some((w) => w.includes('no label')),
    `expected no unlabelled warning, got: ${warnings.join(' | ')}`,
  );
});

test('a timeline with no deadline row warns that the card will show none', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [{ type: 'ROUND_START', startsAt: '2026-03-01T00:00:00Z' }];
  const { ok, warnings } = validatePayload(payload);
  assert.equal(ok, true);
  assert.ok(
    warnings.some((w) => w.includes('no REG_CLOSE or SUBMISSION_DUE')),
    `expected the missing-deadline warning, got: ${warnings.join(' | ')}`,
  );
});

test('a FREE competition charging a fee is surfaced as a contradiction', async () => {
  const payload = await loadGoodPayload(); // costType FREE
  payload.edition = {
    cycleLabel: '2026',
    status: 'OPEN',
    scopeLevel: 'NATIONAL',
    entryFee: 40,
    currency: 'USD',
  };
  const { ok, warnings } = validatePayload(payload);
  assert.equal(ok, true); // the server can't catch this for imports, so we warn rather than block
  assert.ok(
    warnings.some((w) => w.includes('costType is FREE but edition.entryFee is 40')),
    `expected the free-vs-fee warning, got: ${warnings.join(' | ')}`,
  );
});

test('edition + key-date free text is sanitized like every other field (M4)', async () => {
  const extraction = normalize(
    {
      payload: {
        slug: 'x',
        name: 'X',
        categorySlug: 'math',
        edition: {
          cycleLabel: '2026<script>',
          status: 'OPEN',
          scopeLevel: 'NATIONAL',
          prizeSummary: 'a <b>prize',
        },
        keyDates: [{ type: 'RESULTS', label: 'winners <em>announced' }],
      },
    },
    'https://example.org',
  );
  assert.equal(extraction.payload.edition?.cycleLabel, '2026script');
  assert.equal(extraction.payload.edition?.prizeSummary, 'a bprize');
  assert.equal(extraction.payload.keyDates?.[0]?.label, 'winners emannounced');
});

test('a bare calendar date is rejected for startsAt — Date.parse accepts it, the server does not', async () => {
  const payload = await loadGoodPayload();
  // Regression: the first live submit emitted "2026-11-03" here. Date.parse() reads that as UTC
  // midnight so the old check passed, then approve 422'd on java.time.Instant. The pre-flight gate
  // must catch it, not the server.
  payload.keyDates = [{ type: 'REG_CLOSE', startsAt: '2026-11-03' }];
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  assert.ok(
    errors.some(
      (e) => e.includes('is a date without a time') && e.includes('2026-11-03T00:00:00Z'),
    ),
    `expected the date-without-time error suggesting a full instant, got: ${errors.join(' | ')}`,
  );
});

test('a full instant still passes, and ageCutoffDate stays a plain date', async () => {
  const payload = await loadGoodPayload();
  payload.keyDates = [{ type: 'REG_CLOSE', startsAt: '2026-11-03T00:00:00Z' }];
  payload.edition = {
    cycleLabel: '2026',
    status: 'OPEN',
    scopeLevel: 'NATIONAL',
    // LocalDate server-side — a bare date is correct here and must NOT be flagged.
    ageCutoffDate: '2026-09-01',
  };
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, true, `expected valid, got: ${errors.join(' | ')}`);
});
