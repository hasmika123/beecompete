import { describe, expect, it } from 'vitest';
import type { Competition, Edition, Faq, KeyDate, Resource } from '@/lib/admin-types';
import { currentEdition, seedFromListing } from '@/lib/listing-seed';

// Minimal factories — the seed reads a handful of fields; cast the rest.
const competition = (over: Partial<Competition> = {}): Competition =>
  ({
    id: 'c1',
    name: 'Math Olympiad',
    slug: 'math-olympiad',
    categoryId: 'cat-1',
    organizerOrgId: 'org-1',
    entryPathways: ['INDIVIDUAL'],
    attributes: { contact_email: 'info@example.org' },
    ...over,
  }) as Competition;

const edition = (over: Partial<Edition> = {}): Edition =>
  ({
    id: 'e1',
    cycleLabel: '2026',
    status: 'OPEN',
    scopeLevel: 'NATIONAL',
    archivedAt: null,
    registrationUrl: null,
    entryFee: null,
    currency: null,
    ageCutoffDate: null,
    prizeSummary: null,
    prizeValue: null,
    prizeCurrency: null,
    attributes: null,
    ...over,
  }) as Edition;

describe('currentEdition', () => {
  it('picks the newest live season, numeric-aware', () => {
    const picked = currentEdition([
      edition({ id: 'old', cycleLabel: '2025' }),
      edition({ id: 'new', cycleLabel: '2026' }),
      edition({ id: 'older', cycleLabel: '9' }),
    ]);
    expect(picked?.id).toBe('new');
  });

  it('never picks an archived season, and returns null when none is live', () => {
    expect(
      currentEdition([
        edition({ id: 'gone', cycleLabel: '2027', archivedAt: '2026-01-01T00:00:00Z' }),
      ]),
    ).toBeNull();
    expect(
      currentEdition([
        edition({ id: 'gone', cycleLabel: '2027', archivedAt: '2026-01-01T00:00:00Z' }),
        edition({ id: 'live', cycleLabel: '2026' }),
      ])?.id,
    ).toBe('live');
  });

  it('breaks a label tie by run status — an open season over a closed one', () => {
    const picked = currentEdition([
      edition({ id: 'closed', cycleLabel: '2026', status: 'CLOSED' }),
      edition({ id: 'open', cycleLabel: '2026', status: 'OPEN' }),
    ]);
    expect(picked?.id).toBe('open');
  });
});

describe('seedFromListing', () => {
  const base = {
    competition: competition(),
    edition: edition({
      registrationUrl: 'https://reg.example',
      entryFee: 25,
      currency: 'USD',
      prizeSummary: '$1,000 in prizes',
      prizeValue: 1000,
      prizeCurrency: 'USD',
      attributes: {
        awards: [{ title: 'First place', type: 'monetary', value: 1000, currency: 'USD' }],
        prize_display_mode: 'total',
        aime_cutoff: 'top 2.5%',
      },
    }),
    keyDates: [] as KeyDate[],
    regionIds: ['r-us'],
    resources: [] as Resource[],
    faqs: [] as Faq[],
  };

  it('reads the season into the form-ready strings the edition step wants', () => {
    const seed = seedFromListing(base);
    expect(seed.edition).toMatchObject({
      cycleLabel: '2026',
      status: 'OPEN',
      scopeLevel: 'NATIONAL',
      registrationUrl: 'https://reg.example',
      entryFee: '25',
      currency: 'USD',
      prizeSummary: '$1,000 in prizes',
      prizeValue: '1000',
    });
    expect(seed.regionIds).toEqual(['r-us']);
    expect(seed.competition.name).toBe('Math Olympiad');
    expect(seed.organizerName).toBeNull();
  });

  it('splits the season bag: awards + display mode for the editor, the rest kept aside', () => {
    const seed = seedFromListing(base);
    expect(seed.edition?.awards).toEqual([
      { title: 'First place', type: 'monetary', value: 1000, currency: 'USD' },
    ]);
    expect(seed.edition?.prizeDisplayMode).toBe('total');
    // Neither the rows nor the mode leak into what the save merges back under them.
    expect(seed.edition?.keepAttributes).toEqual({ aime_cutoff: 'top 2.5%' });
  });

  it('leaves awards undefined for a season saved before the rows editor', () => {
    const seed = seedFromListing({ ...base, edition: edition({ prizeSummary: 'Medals' }) });
    expect(seed.edition?.awards).toBeUndefined();
    expect(seed.edition?.keepAttributes).toEqual({});
  });

  it('seeds an empty season for a listing that has none', () => {
    const seed = seedFromListing({ ...base, edition: null });
    expect(seed.edition).toBeNull();
    expect(seed.keyDates).toEqual([]);
  });

  it('shows each key date as the wall clock in its own zone, and carries its id', () => {
    const seed = seedFromListing({
      ...base,
      keyDates: [
        {
          id: 'kd-1',
          type: 'REG_CLOSE',
          label: null,
          // 23:59 Eastern on Mar 3 is 04:59 UTC on Mar 4 — the form must show Mar 3.
          startsAt: '2026-03-04T04:59:00Z',
          endsAt: null,
          timezone: 'America/New_York',
        },
        {
          id: 'kd-2',
          type: 'RESULTS',
          label: 'Finalists announced',
          startsAt: null,
          endsAt: null,
          timezone: null,
        },
      ],
    });
    expect(seed.keyDates[0]).toEqual({
      id: 'kd-1',
      type: 'REG_CLOSE',
      date: '2026-03-03',
      endDate: '',
      time: '23:59',
      timezone: 'America/New_York',
      tbd: false,
      label: '',
    });
    // No zone stored → read in UTC (the public timeline's rule), and a null start is TBD.
    expect(seed.keyDates[1]).toMatchObject({
      id: 'kd-2',
      tbd: true,
      date: '',
      timezone: 'UTC',
      label: 'Finalists announced',
    });
  });

  it('orders resources and FAQs by displayOrder and carries their ids', () => {
    const seed = seedFromListing({
      ...base,
      resources: [
        {
          id: 'r2',
          title: 'Second',
          url: 'https://b',
          type: 'GUIDE',
          isAffiliate: true,
          affiliateMeta: null,
          displayOrder: 1,
          imageUrl: null,
        },
        {
          id: 'r1',
          title: 'First',
          url: 'https://a',
          type: 'BOOK',
          isAffiliate: false,
          affiliateMeta: null,
          displayOrder: 0,
          imageUrl: 'https://img',
        },
      ],
      faqs: [
        { id: 'f2', question: 'Q2', answer: 'A2', displayOrder: 1 },
        { id: 'f1', question: 'Q1', answer: 'A1', displayOrder: 0 },
      ],
    });
    expect(seed.resources.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(seed.resources[0]).toMatchObject({ imageUrl: 'https://img', isAffiliate: false });
    expect(seed.faqs.map((f) => f.id)).toEqual(['f1', 'f2']);
  });
});
