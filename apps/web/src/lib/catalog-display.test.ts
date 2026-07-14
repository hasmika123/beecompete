import { describe, expect, it } from 'vitest';
import { isHostMaintained } from '@/lib/catalog-display';

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
