import { describe, expect, it } from 'vitest';
import { zonedWallClockToInstant } from './dates';
import { importSeedWarnings, splitImportPayload } from './import-seed';

const CATEGORY = '5f1a4e2c-0000-4000-8000-000000000001';

/** A realistic pipeline extraction — the shape tools/seeding actually POSTs. */
const payload = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  slug: 'mathcounts',
  name: 'MATHCOUNTS',
  categoryId: CATEGORY,
  organizerName: 'MATHCOUNTS Foundation',
  participationMode: 'BOTH',
  delivery: 'IN_PERSON',
  entryPathway: 'SCHOOL_OR_CHAPTER',
  costType: 'PAID',
  recurrence: 'ANNUAL',
  minGrade: 6,
  maxGrade: 8,
  edition: {
    cycleLabel: '2026',
    status: 'OPEN',
    scopeLevel: 'NATIONAL',
    entryFee: 30,
    currency: 'usd',
  },
  keyDates: [{ type: 'REG_CLOSE', startsAt: '2026-11-03T04:59:00Z', timezone: 'America/New_York' }],
  ...over,
});

describe('splitImportPayload', () => {
  it('reads the spine, edition and timeline into form-ready values', () => {
    const seed = splitImportPayload(payload());
    expect(seed.competition.name).toBe('MATHCOUNTS');
    expect(seed.competition.minGrade).toBe(6);
    expect(seed.competition.participationMode).toBe('BOTH');
    expect(seed.organizerName).toBe('MATHCOUNTS Foundation');
    expect(seed.edition).toMatchObject({ cycleLabel: '2026', entryFee: '30', currency: 'USD' });
    expect(seed.keyDates).toEqual([
      {
        type: 'REG_CLOSE',
        date: '2026-11-02',
        endDate: '',
        time: '23:59',
        timezone: 'America/New_York',
        tbd: false,
        label: '',
      },
    ]);
  });

  it('reads a multi-day row’s end day in the row’s own zone', () => {
    const withRange = payload();
    (withRange.keyDates as Record<string, unknown>[])[0] = {
      type: 'ROUND_START',
      startsAt: '2027-03-20T16:00:00Z',
      endsAt: '2027-03-21T23:00:00Z',
      timezone: 'America/Los_Angeles',
    };
    const [row] = splitImportPayload(withRange).keyDates;
    // 23:00Z on the 21st is 16:00 PDT the SAME day — read in UTC it would still be the 21st, but
    // the zone is what keeps a range aligned with the start it is measured against.
    expect(row?.date).toBe('2027-03-20');
    expect(row?.endDate).toBe('2027-03-21');
  });

  it('round-trips a key date back to the same instant it came from', () => {
    const [row] = splitImportPayload(payload()).keyDates;
    expect(row).toBeDefined();
    if (!row) return;
    expect(zonedWallClockToInstant(`${row.date}T${row.time}`, row.timezone)).toBe(
      '2026-11-03T04:59:00.000Z',
    );
  });

  it('reads an undated row in UTC so a date-only extraction keeps its calendar day', () => {
    // The extractor emits T00:00:00Z for "Nov. 3" with no clock time. Read in Eastern that is
    // Nov 2 — the form would show the curator a day the source page never said.
    const seed = splitImportPayload(
      payload({ keyDates: [{ type: 'SUBMISSION_DUE', startsAt: '2026-11-03T00:00:00Z' }] }),
    );
    expect(seed.keyDates[0]).toMatchObject({ date: '2026-11-03', timezone: 'UTC' });
  });

  it('keeps a TBD key date undated rather than inventing one', () => {
    const seed = splitImportPayload(payload({ keyDates: [{ type: 'REG_CLOSE', startsAt: null }] }));
    expect(seed.keyDates[0]).toMatchObject({ tbd: true, date: '', time: '' });
  });

  it('drops values of the wrong shape instead of coercing them', () => {
    const seed = splitImportPayload(
      payload({
        name: 42,
        tags: ['math', '', 7],
        minGrade: 'not a grade',
        attributes: ['not', 'an', 'object'],
        keyDates: [{ type: 'WHENEVER' }, { type: 'RESULTS' }],
      }),
    );
    expect(seed.competition.name).toBe('');
    expect(seed.competition.tags).toEqual(['math']);
    expect(seed.competition.minGrade).toBeNull();
    expect(seed.competition.attributes).toBeNull();
    expect(seed.keyDates.map((r) => r.type)).toEqual(['RESULTS']);
  });

  // Owner 2026-08-28: these enums no longer get a substituted default. A payload that never said
  // "annual" used to reach the form showing Annual, indistinguishable from one that did — so a
  // curator could not tell our guess from the source's fact, and published the guess.
  it('leaves an absent or unknown enum UNANSWERED rather than substituting a default', () => {
    const seed = splitImportPayload(payload({ costType: 'FREEMIUM', delivery: null }));
    expect(seed.competition.costType).toBe('');
    expect(seed.competition.delivery).toBe('');
  });

  it('still reads a stated enum straight through', () => {
    const seed = splitImportPayload(payload({ costType: 'PAID', recurrence: 'ROLLING' }));
    expect(seed.competition.costType).toBe('PAID');
    expect(seed.competition.recurrence).toBe('ROLLING');
  });

  it('leaves an unstated edition scope level unanswered', () => {
    // 5 queued extractions have no scopeLevel and had been approving as NATIONAL. It is @NotNull
    // server-side, so the form now blocks on it instead of inventing one.
    const seed = splitImportPayload(payload({ edition: { cycleLabel: '2026' } }));
    expect(seed.edition?.scopeLevel).toBe('');
  });

  it('prefers an already-resolved organizer id over the extracted name', () => {
    const seed = splitImportPayload(payload({ organizerOrgId: 'org-1' }));
    expect(seed.competition.organizerOrgId).toBe('org-1');
    expect(seed.organizerName).toBeNull();
  });

  it('sets aside payload keys the form has no control for, so approve cannot drop them', () => {
    const seed = splitImportPayload(
      payload({
        reviewerNotes: 'fee unclear',
        edition: { cycleLabel: '2026', status: 'OPEN', scopeLevel: 'STATE', prizeValue: 500 },
      }),
    );
    expect(seed.extras.competition).toEqual({ reviewerNotes: 'fee unclear' });
    // `status` left the form 2026-08-22 (derived on create) — an extracted one is an extra now;
    // prizeValue gained a control the same day, so it is MAPPED, not an extra.
    expect(seed.extras.edition).toEqual({ status: 'OPEN' });
    expect(seed.edition?.prizeValue).toBe('500');
  });
});

describe('importSeedWarnings', () => {
  /**
   * A token the payload STATED but we can't map renders blank — same as "the source never said".
   * Without a warning a curator can't tell which happened, so can't tell whether to read the page
   * or report an extractor bug. The key-date path has always warned; these did not.
   */
  it('names an unrecognised enum token rather than blanking it silently', () => {
    const p = payload({ delivery: 'ONLINE', costType: 'GRATIS' });
    const warnings = importSeedWarnings(p, splitImportPayload(p));
    const w = warnings.find((x) => x.key === 'unmappedEnums');
    expect(w).toBeDefined();
    expect(w!.message).toContain('delivery ("ONLINE")');
    expect(w!.message).toContain('entry fee type ("GRATIS")');
  });

  it('stays quiet when a field is simply absent — that is a different answer', () => {
    const p = payload();
    delete (p as Record<string, unknown>).delivery;
    const keys = importSeedWarnings(p, splitImportPayload(p)).map((x) => x.key);
    expect(keys).not.toContain('unmappedEnums');
  });

  it('names an unrecognised scope level from inside the edition', () => {
    const p = payload({ edition: { cycleLabel: '2026', scopeLevel: 'GALACTIC' } });
    const w = importSeedWarnings(p, splitImportPayload(p)).find((x) => x.key === 'unmappedEnums');
    expect(w?.message).toContain('scope level ("GALACTIC")');
  });

  it('says nothing about a complete extraction beyond what is genuinely missing', () => {
    const p = payload();
    expect(importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key)).toEqual([]);
  });

  it('flags a missing edition, category and organizer', () => {
    const p = payload({ edition: undefined, categoryId: null, organizerName: null });
    const keys = importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key);
    expect(keys).toContain('category');
    expect(keys).toContain('organizer');
    expect(keys).toContain('edition');
  });

  it('flags a timeline with no deadline key date', () => {
    const p = payload({ keyDates: [{ type: 'RESULTS', startsAt: '2026-12-01T00:00:00Z' }] });
    expect(importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key)).toContain('deadline');
  });

  // Prep resources ride the payload since 2026-08-28 (the paste prompt asks for ~5 links plus 2-3
  // Amazon ones). Before that they had no reader at all and were reported as a dropped field.
  it('reads prep resources into form rows', () => {
    const seed = splitImportPayload(
      payload({
        resources: [
          { title: 'Official past papers', url: 'https://example.org/past', type: 'PAST_PAPER' },
          { title: 'Prep book', url: 'https://www.amazon.com/dp/123', type: 'book' },
        ],
      }),
    );
    expect(seed.resources).toHaveLength(2);
    expect(seed.resources[0]).toMatchObject({ title: 'Official past papers', type: 'PAST_PAPER' });
    // Lowercase from a model is accepted — the form's dropdown is uppercase-only.
    expect(seed.resources[1]!.type).toBe('BOOK');
  });

  it('never flags a suggested resource as affiliate on its own', () => {
    // The prompt emits PLAIN Amazon links for a curator to swap for tagged ones. A link that earns
    // nothing must not render the affiliate disclosure (compliance DQ10), so the flag stays false
    // unless the payload says otherwise outright.
    const seed = splitImportPayload(
      payload({
        resources: [{ title: 'Prep book', url: 'https://www.amazon.com/dp/123', type: 'BOOK' }],
      }),
    );
    expect(seed.resources[0]!.isAffiliate).toBe(false);
  });

  it('drops half-written and unusable resource rows instead of coercing them', () => {
    const seed = splitImportPayload(
      payload({
        resources: [
          { title: 'No link here' },
          { url: 'https://example.org/no-title' },
          'not an object',
          { title: 'Odd type', url: 'https://example.org/x', type: 'PODCAST' },
        ],
      }),
    );
    expect(seed.resources).toHaveLength(1);
    // The link is the valuable part, so an unknown type falls back rather than losing the row.
    expect(seed.resources[0]).toMatchObject({ title: 'Odd type', type: 'OTHER' });
  });

  // `0024`: the ~46 queued extractions predate the set and carry a singular `entryPathway`,
  // including the composite tokens it retired. They must still review correctly without a data
  // migration, so the reader takes either shape and expands exactly like the migration's backfill.
  it('expands a legacy singular entryPathway, composites included', () => {
    const cases: [string, string[]][] = [
      ['INDIVIDUAL', ['INDIVIDUAL']],
      ['SCHOOL', ['SCHOOL']],
      ['SCHOOL_OR_CHAPTER', ['SCHOOL', 'CHAPTER']],
      ['OPEN', ['INDIVIDUAL', 'SCHOOL', 'CHAPTER']],
      ['EITHER', ['INDIVIDUAL', 'SCHOOL', 'CHAPTER']],
    ];
    for (const [stored, expected] of cases) {
      const seed = splitImportPayload(payload({ entryPathway: stored }));
      expect(seed.competition.entryPathways, stored).toEqual(expected);
    }
  });

  it('prefers the array shape and drops tokens it does not know', () => {
    expect(
      splitImportPayload(payload({ entryPathways: ['SCHOOL', 'CHAPTER'] })).competition
        .entryPathways,
    ).toEqual(['SCHOOL', 'CHAPTER']);
    expect(
      splitImportPayload(payload({ entryPathways: ['SCHOOL', 'NONSENSE'] })).competition
        .entryPathways,
    ).toEqual(['SCHOOL']);
    expect(
      splitImportPayload(payload({ entryPathway: 'NONSENSE' })).competition.entryPathways,
    ).toEqual([]);
  });

  it('reads FAQ rows into form rows', () => {
    const seed = splitImportPayload(
      payload({
        faqs: [
          { question: 'Who can enter?', answer: 'Students in grades 6-8.' },
          { question: 'What does it cost?', answer: 'There is a $30 entry fee.' },
        ],
      }),
    );
    expect(seed.faqs).toEqual([
      { question: 'Who can enter?', answer: 'Students in grades 6-8.' },
      { question: 'What does it cost?', answer: 'There is a $30 entry fee.' },
    ]);
  });

  it('drops an FAQ row missing either half', () => {
    // A question with no answer would publish as an unanswered question on the FAQ tab, with
    // FAQPage markup on it.
    const seed = splitImportPayload(
      payload({
        faqs: [
          { question: 'Unanswered?' },
          { answer: 'Orphan answer' },
          { question: 'Real?', answer: 'Yes.' },
        ],
      }),
    );
    expect(seed.faqs).toEqual([{ question: 'Real?', answer: 'Yes.' }]);
  });

  it('does not report resources as a dropped field', () => {
    // It is a mapped key now; before that the curator was told their links "WON'T be saved".
    const p = payload({ resources: [{ title: 'A', url: 'https://example.org/a', type: 'GUIDE' }] });
    const extras = importSeedWarnings(p, splitImportPayload(p)).find((w) => w.key === 'extras');
    expect(extras?.message ?? '').not.toContain('resources');
  });

  it('does not report faqs as a dropped field', () => {
    const p = payload({ faqs: [{ question: 'Q?', answer: 'A.' }] });
    const extras = importSeedWarnings(p, splitImportPayload(p)).find((w) => w.key === 'extras');
    expect(extras?.message ?? '').not.toContain('faqs');
  });

  it('flags rows it had to leave out and keys it is carrying through untouched', () => {
    const p = payload({ keyDates: [{ type: 'NONSENSE' }], reviewerNotes: 'x' });
    const keys = importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key);
    expect(keys).toContain('keyDates');
    expect(keys).toContain('extras');
  });
});
