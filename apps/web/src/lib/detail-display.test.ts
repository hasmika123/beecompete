import { describe, expect, it } from 'vitest';
import {
  ageLabel,
  categoryAttributeRows,
  deadlineFact,
  editionStatusLabel,
  prizeLabel,
  regOpensAt,
} from '@/lib/detail-display';
import type { CompetitionDetail, EditionView } from '@/lib/catalog-types';

// #82 helpers. Minimal shapes: only the fields each helper reads.

const edition = (over: Partial<EditionView> = {}): EditionView =>
  ({ keyDates: [], ...over }) as EditionView;

const NOW = new Date('2026-08-18T00:00:00Z');
const kd = (type: string, startsAt: string | null) => ({
  type,
  label: null,
  startsAt,
  endsAt: null,
  timezone: 'America/New_York',
});

describe('regOpensAt', () => {
  it('returns the earliest FUTURE reg_open', () => {
    const eds = [
      edition({
        keyDates: [kd('reg_open', '2026-09-10T00:00:00Z'), kd('reg_open', '2026-09-01T00:00:00Z')],
      }),
    ];
    expect(regOpensAt(eds, NOW)?.iso).toBe('2026-09-01T00:00:00Z');
  });

  it('ignores past reg_open: registration already opened', () => {
    expect(
      regOpensAt([edition({ keyDates: [kd('reg_open', '2026-07-01T00:00:00Z')] })], NOW),
    ).toBeUndefined();
  });

  it('ignores TBD (null startsAt) reg_open', () => {
    expect(regOpensAt([edition({ keyDates: [kd('reg_open', null)] })], NOW)).toBeUndefined();
  });
});

describe('ageLabel', () => {
  const comp = (minAge: number | null, maxAge: number | null) =>
    ({ minAge, maxAge }) as CompetitionDetail;

  it('anchors the range to the cutoff date when present', () => {
    expect(ageLabel(comp(11, 14), edition({ ageCutoffDate: '2027-06-01' }))).toBe(
      '11–14 (as of Jun 1, 2027)',
    );
  });

  it('renders a bare range without a cutoff', () => {
    expect(ageLabel(comp(11, 14), edition())).toBe('11–14');
  });

  it('is undefined when the competition has no age gate', () => {
    expect(ageLabel(comp(null, null), edition({ ageCutoffDate: '2027-06-01' }))).toBeUndefined();
  });
});

describe('prizeLabel', () => {
  it('leads with the typed value and captions it with the summary', () => {
    expect(
      prizeLabel(edition({ prizeValue: 5000, prizeCurrency: 'USD', prizeSummary: 'Scholarships' })),
    ).toBe('$5,000 · Scholarships');
  });

  it('shows a whole-dollar amount without cents', () => {
    expect(prizeLabel(edition({ prizeValue: 5000, prizeCurrency: 'USD' }))).toBe('$5,000');
  });

  it('falls back to the summary, then Bragging rights', () => {
    expect(prizeLabel(edition({ prizeSummary: 'Medals' }))).toBe('Medals');
    expect(prizeLabel(edition())).toBe('Bragging rights');
  });
});

describe('editionStatusLabel', () => {
  it('labels every effective status the API can send', () => {
    expect(editionStatusLabel('open')).toBe('Open');
    expect(editionStatusLabel('upcoming')).toBe('Upcoming');
    expect(editionStatusLabel('ongoing')).toBe('In progress');
    expect(editionStatusLabel('closed')).toBe('Closed');
    expect(editionStatusLabel('archived')).toBe('Archived');
  });

  it('falls back to the raw token for an unknown status', () => {
    expect(editionStatusLabel('something_new')).toBe('something_new');
  });
});

// #89: the At-a-glance deadline cell pairs the relative value with the absolute date, so the
// relative wording can't hide WHEN the thing actually closes.
describe('deadlineFact', () => {
  const deadline = (iso: string) => ({ iso, kind: 'reg_close', timezone: 'America/New_York' });

  it('keeps the relative value and surfaces the date as a hint, inside the window', () => {
    expect(deadlineFact(deadline('2026-08-29T00:00:00Z'), NOW)).toEqual({
      value: '11 days to go',
      hint: 'Aug 28, 2026',
      urgent: false,
    });
  });

  it('marks an imminent deadline urgent, still with the date', () => {
    const fact = deadlineFact(deadline('2026-08-20T00:00:00Z'), NOW);
    expect(fact.urgent).toBe(true);
    expect(fact.hint).toBe('Aug 19, 2026');
  });

  it('adds NO hint beyond the window: the value is already the date', () => {
    expect(deadlineFact(deadline('2026-10-01T00:00:00Z'), NOW)).toEqual({
      value: 'Closes Sep 30, 2026',
      hint: undefined,
      urgent: false,
    });
  });

  // Calendar-day math happens in the DEADLINE's zone, not UTC (H1/M6): NOW is 2026-08-18T00:00Z,
  // which is still Aug 17 in New York — so an Aug-17-NY instant is "today" and Aug 18 is
  // "tomorrow". Both keep a hint; neither wording carries the date.
  it('says "Closes today" for a deadline later the same NY day', () => {
    const fact = deadlineFact(deadline('2026-08-18T02:00:00Z'), NOW);
    expect(fact.value).toBe('Closes today');
    expect(fact.urgent).toBe(true);
    expect(fact.hint).toBe('Aug 17, 2026');
  });
});

// #106: both the Details and About tabs read the attributes bag through these helpers.
describe('categoryAttributeRows', () => {
  it('humanizes keys word-by-word (NOT every letter) and drops eligibility keys', () => {
    expect(
      categoryAttributeRows({
        round_format: 'written exam',
        citizenship_countries: ['US'], // eligibility key — belongs to the Details tab
      }),
    ).toEqual([{ label: 'Round Format', value: 'written exam' }]);
  });

  it('renders arrays, booleans and numbers; skips empty and nested values', () => {
    expect(
      categoryAttributeRows({
        topics: ['algebra', 'geometry'],
        calculator_allowed: false,
        rounds: 3,
        blank: '',
        missing: null,
        nested: { a: 1 },
      }),
    ).toEqual([
      { label: 'Topics', value: 'algebra, geometry' },
      { label: 'Calculator Allowed', value: 'No' },
      { label: 'Rounds', value: '3' },
    ]);
  });

  it('returns nothing for a null bag', () => {
    expect(categoryAttributeRows(null)).toEqual([]);
  });
});
