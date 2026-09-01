import { describe, expect, it } from 'vitest';
import { gradesOverlap, locationsMatch, rankRelated, topUpRelated } from '@/lib/related';
import type { CompetitionDetail, CompetitionSummary } from '@/lib/catalog-types';

// #109 ranking. Minimal shapes: only the fields the ranker reads.

function summary(over: Partial<CompetitionSummary> & { id: string }): CompetitionSummary {
  return {
    slug: over.id,
    name: over.id,
    blurb: null,
    logo: null,
    category: { slug: 'math', name: 'Math' },
    organizer: null,
    tags: null,
    participationMode: 'individual',
    teamSizeMin: null,
    teamSizeMax: null,
    delivery: 'in_person',
    entryPathways: ['individual', 'school', 'chapter'],
    evaluationType: null,
    eligibilityBasis: null,
    minGrade: null,
    maxGrade: null,
    minAge: null,
    maxAge: null,
    costType: 'free',
    recurrence: 'annual',
    verificationState: 'unverified',
    provenance: null,
    nextDeadline: null,
    prizeSummary: null,
    regions: [],
    ...over,
  };
}

const CURRENT = {
  id: 'self',
  organizer: { name: 'MAA', type: 'nonprofit', verificationState: 'verified' },
  minGrade: 9,
  maxGrade: 10,
  delivery: 'in_person',
} as CompetitionDetail;

const org = { name: 'MAA', type: 'nonprofit', verificationState: 'verified' };

describe('rankRelated', () => {
  it('orders lexicographically: org beats grade beats location, whatever the lower bits say', () => {
    // grade+location but NO org must lose to org-only — the owner's priority order, not a
    // popularity count of matches.
    const gradeAndLoc = summary({
      id: 'grade-loc',
      minGrade: 9,
      maxGrade: 12,
      regions: ['Georgia'],
    });
    const orgOnly = summary({ id: 'org-only', organizer: org, minGrade: 1, maxGrade: 2 });
    const all3 = summary({
      id: 'all3',
      organizer: org,
      minGrade: 9,
      maxGrade: 12,
      regions: ['Georgia'],
    });
    const nothing = summary({ id: 'none', minGrade: 1, maxGrade: 2 });

    const out = rankRelated(CURRENT, ['Georgia'], [nothing, gradeAndLoc, orgOnly, all3]);
    expect(out.map((c) => c.id)).toEqual(['all3', 'org-only', 'grade-loc', 'none']);
  });

  it('excludes the viewed competition and keeps pool order on ties', () => {
    const a = summary({ id: 'a' });
    const b = summary({ id: 'b' });
    const self = summary({ id: 'self' });
    expect(rankRelated(CURRENT, [], [a, self, b]).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('caps at the target', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'].map((id) => summary({ id }));
    expect(rankRelated(CURRENT, [], pool, 4)).toHaveLength(4);
  });
});

describe('gradesOverlap', () => {
  it('overlaps on shared grades and treats null bounds as all-grades', () => {
    expect(gradesOverlap(CURRENT, summary({ id: 'x', minGrade: 10, maxGrade: 12 }))).toBe(true);
    expect(gradesOverlap(CURRENT, summary({ id: 'x', minGrade: 11, maxGrade: 12 }))).toBe(false);
    expect(gradesOverlap(CURRENT, summary({ id: 'x' }))).toBe(true); // null = all grades
  });
});

describe('locationsMatch', () => {
  it('matches a shared region name, or online-with-online, and nothing on absent data', () => {
    const here = { delivery: 'in_person', regionNames: ['Georgia'] };
    expect(locationsMatch(here, summary({ id: 'x', regions: ['Georgia', 'Ohio'] }))).toBe(true);
    expect(locationsMatch(here, summary({ id: 'x', regions: ['Ohio'] }))).toBe(false);
    expect(
      locationsMatch(
        { delivery: 'virtual', regionNames: [] },
        summary({ id: 'x', delivery: 'virtual' }),
      ),
    ).toBe(true);
    // In-person with no curated regions matches nothing — geography is a claim, not a default.
    expect(locationsMatch({ delivery: 'in_person', regionNames: [] }, summary({ id: 'x' }))).toBe(
      false,
    );
  });
});

describe('topUpRelated', () => {
  it('appends extras after the ranked picks, skipping duplicates and self', () => {
    const picked = [summary({ id: 'a' })];
    const extras = [
      summary({ id: 'self' }),
      summary({ id: 'a' }),
      summary({ id: 'b' }),
      summary({ id: 'c' }),
    ];
    expect(topUpRelated(picked, extras, 'self', 3).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('never exceeds the target even when picked is already full', () => {
    const picked = ['a', 'b', 'c', 'd'].map((id) => summary({ id }));
    expect(topUpRelated(picked, [summary({ id: 'e' })], 'self', 4).map((c) => c.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});
