import { describe, expect, it } from 'vitest';
import { eligibilityLabel, isHostMaintained, regionLabel } from '@/lib/catalog-display';

// #77 (supersedes #76): a state abbreviates ONLY beside a city ("Austin, TX"); alone it keeps its
// full name. US country tag dropped on a US-only catalog. The distinction worth pinning is the
// tagged/untagged pair: tagged-country-only means "not state-restricted" and must read Nationwide,
// while UNTAGGED is missing data and must stay undefined. Collapsing them would invent a fact.
describe('regionLabel', () => {
  it('keeps a lone state at full name, no bare code', () => {
    expect(regionLabel(['Texas'])).toBe('Texas');
  });

  it('counts extra states behind the first full name', () => {
    expect(regionLabel(['Texas', 'California', 'New York'])).toBe('Texas +2');
  });

  it('abbreviates the state only when paired with a city', () => {
    expect(regionLabel(['Austin', 'Texas'])).toBe('Austin, TX');
  });

  it('pairs city + state regardless of tag order', () => {
    expect(regionLabel(['Texas', 'Austin'])).toBe('Austin, TX');
  });

  it('counts regions beyond the city+state pair', () => {
    expect(regionLabel(['Austin', 'Texas', 'California'])).toBe('Austin, TX +1');
  });

  it('drops the US country tag when a state survives it', () => {
    expect(regionLabel(['United States', 'Texas'])).toBe('Texas');
  });

  it('reads Nationwide when tagged at country level only', () => {
    expect(regionLabel(['United States'])).toBe('Nationwide');
  });

  it('stays undefined when untagged: missing data is not Nationwide', () => {
    expect(regionLabel([])).toBeUndefined();
  });

  it('passes a lone city through verbatim', () => {
    expect(regionLabel(['Austin'])).toBe('Austin');
  });

  it('shortens the seeded "Virtual / Online" region for the card slot', () => {
    expect(regionLabel(['Virtual / Online'])).toBe('Online');
  });

  it('never composes the virtual region as a city, no "Online, TX"', () => {
    expect(regionLabel(['Virtual / Online', 'Texas'])).toBe('Online +1');
  });
});

// R1-19: a competition's maintainer is DERIVED from its organizer org — host-maintained iff the
// org is claimed or verified; curated (or no org) otherwise. Competitions carry no trust state.
describe('isHostMaintained', () => {
  it('is false when there is no organizer', () => {
    expect(isHostMaintained({ organizer: null })).toBe(false);
    expect(isHostMaintained({})).toBe(false);
  });

  it('is false for a curated (unclaimed) organizer', () => {
    expect(isHostMaintained({ organizer: { verificationState: 'curated' } })).toBe(false);
  });

  it('is true for a claimed organizer', () => {
    expect(isHostMaintained({ organizer: { verificationState: 'claimed' } })).toBe(true);
  });

  it('is true for a verified organizer', () => {
    expect(isHostMaintained({ organizer: { verificationState: 'verified' } })).toBe(true);
  });

  it('is false for an unknown/legacy state', () => {
    expect(isHostMaintained({ organizer: { verificationState: 'unverified' } })).toBe(false);
  });
});

// Blueprints decision 99 (owner 2026-08-28): the card badge and the At-a-glance strip render the
// axis the ORGANIZER states. The case that matters is a listing carrying BOTH ranges where only
// one of them is the organizer's — the shape the seeding extractor produced for every age-gated
// competition it touched.
describe('eligibilityLabel', () => {
  const BJC = { minGrade: 7, maxGrade: 12, minAge: 13, maxAge: 18 };

  it('shows ONLY the ages for an age-based rule, never the derived grades', () => {
    // Breakthrough Junior Challenge: states ages 13–18. The stored grades 7–12 are ours, and
    // publishing them as the rule tells a 12-year-old in grade 7 they qualify when they do not.
    expect(eligibilityLabel({ ...BJC, eligibilityBasis: 'age' })).toBe('Ages 13–18');
  });

  it('shows ONLY the grades for a grade-based rule, never the derived ages', () => {
    expect(eligibilityLabel({ ...BJC, eligibilityBasis: 'grade' })).toBe('Grades 7–12');
  });

  it('shows both when the organizer states both', () => {
    expect(eligibilityLabel({ ...BJC, eligibilityBasis: 'both' })).toBe('Grades 7–12 · Ages 13–18');
  });

  it('reads open only when the organizer says so — never as a fallback', () => {
    expect(
      eligibilityLabel({
        eligibilityBasis: 'open',
        minGrade: null,
        maxGrade: null,
        minAge: null,
        maxAge: null,
      }),
    ).toBe('Open to all ages');
  });

  it('is undefined when nothing is on record, so callers say "Not stated"', () => {
    // The retired "All grades" fallback asserted a verified fact on ~21% of listings. Undefined
    // is the honest answer and it is what makes the strip say so.
    expect(
      eligibilityLabel({
        eligibilityBasis: null,
        minGrade: null,
        maxGrade: null,
        minAge: null,
        maxAge: null,
      }),
    ).toBeUndefined();
  });

  it('falls back to whatever IS recorded when the basis is unset (legacy rows)', () => {
    // Pre-0023 rows have no basis. Show what we have — but never invent the other axis.
    expect(
      eligibilityLabel({
        eligibilityBasis: null,
        minGrade: 9,
        maxGrade: 12,
        minAge: null,
        maxAge: null,
      }),
    ).toBe('Grades 9–12');
    expect(
      eligibilityLabel({
        eligibilityBasis: null,
        minGrade: null,
        maxGrade: null,
        minAge: 13,
        maxAge: null,
      }),
    ).toBe('Ages 13+');
  });
});
