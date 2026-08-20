import { describe, expect, it } from 'vitest';
import { isHostMaintained, regionLabel } from '@/lib/catalog-display';

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
