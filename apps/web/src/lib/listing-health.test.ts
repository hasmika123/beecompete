import { describe, expect, it } from 'vitest';
import type { Competition, Edition, Faq, Resource } from '@/lib/admin-types';
import { listingHealth } from '@/lib/listing-health';

// Minimal factories — the checklist only reads a handful of fields; cast the rest.
const comp = (over: Partial<Competition> = {}): Competition =>
  ({
    organizerOrgId: null,
    summary: null,
    description: null,
    ...over,
  }) as Competition;

const edition = (over: Partial<Edition> = {}): Edition =>
  ({ archivedAt: null, registrationUrl: null, ...over }) as Edition;

const ok = (checks: ReturnType<typeof listingHealth>, key: string) =>
  checks.find((c) => c.key === key)?.ok;

describe('listingHealth', () => {
  it('flags everything false for a bare competition', () => {
    const checks = listingHealth(comp(), [], [], []);
    expect(checks.every((c) => !c.ok)).toBe(true);
    expect(ok(checks, 'organizer')).toBe(false);
  });

  it('passes every check for a fully populated listing', () => {
    const checks = listingHealth(
      comp({ organizerOrgId: 'org-1', summary: 'Short blurb', description: 'Long write-up' }),
      [edition({ registrationUrl: 'https://reg.example' })],
      [{ id: 'f1' } as Faq],
      [{ id: 'r1' } as Resource],
    );
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it('does not count an archived edition (or its registration URL)', () => {
    const checks = listingHealth(
      comp(),
      [edition({ archivedAt: '2026-07-01T00:00:00Z', registrationUrl: 'https://reg.example' })],
      [],
      [],
    );
    expect(ok(checks, 'edition')).toBe(false);
    expect(ok(checks, 'regUrl')).toBe(false);
  });
});
