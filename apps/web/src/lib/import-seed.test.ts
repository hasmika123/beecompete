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

  it('keeps a TBD milestone undated rather than inventing one', () => {
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

  it('falls back to a renderable token for an enum the dropdown does not know', () => {
    const seed = splitImportPayload(payload({ costType: 'FREEMIUM', delivery: null }));
    expect(seed.competition.costType).toBe('FREE');
    expect(seed.competition.delivery).toBe('IN_PERSON');
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

  it('flags a timeline with no deadline milestone', () => {
    const p = payload({ keyDates: [{ type: 'RESULTS', startsAt: '2026-12-01T00:00:00Z' }] });
    expect(importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key)).toContain('deadline');
  });

  it('flags rows it had to leave out and keys it is carrying through untouched', () => {
    const p = payload({ keyDates: [{ type: 'NONSENSE' }], reviewerNotes: 'x' });
    const keys = importSeedWarnings(p, splitImportPayload(p)).map((w) => w.key);
    expect(keys).toContain('keyDates');
    expect(keys).toContain('extras');
  });
});
