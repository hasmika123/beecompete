import { describe, expect, it } from 'vitest';
import { formatDate, keyDateZone, zonedWallClockToInstant } from '@/lib/dates';

// The admin write path: a wall-clock the curator typed + the IANA zone they picked → the correct
// UTC instant, independent of the server's own zone. DST-safe (two-pass Intl offset probe).
describe('zonedWallClockToInstant', () => {
  it('converts Eastern summer (EDT, UTC-4)', () => {
    // 7:00 PM EDT = 23:00 UTC same day
    expect(zonedWallClockToInstant('2026-07-15T19:00', 'America/New_York')).toBe(
      '2026-07-15T23:00:00.000Z',
    );
  });

  it('converts Eastern winter (EST, UTC-5) across the day boundary', () => {
    // 7:00 PM EST = 00:00 UTC the NEXT day
    expect(zonedWallClockToInstant('2026-01-15T19:00', 'America/New_York')).toBe(
      '2026-01-16T00:00:00.000Z',
    );
  });

  it('handles a half-hour zone (Asia/Kolkata, UTC+5:30)', () => {
    expect(zonedWallClockToInstant('2026-07-15T12:00', 'Asia/Kolkata')).toBe(
      '2026-07-15T06:30:00.000Z',
    );
  });

  it('is a no-op offset for UTC', () => {
    expect(zonedWallClockToInstant('2026-07-15T12:00', 'UTC')).toBe('2026-07-15T12:00:00.000Z');
  });

  it('resolves a spring-forward gap time deterministically (2:30 AM on 2026-03-08 EST→EDT)', () => {
    // 2:30 AM doesn't exist that night (clocks jump 2:00→3:00). The two-pass probe must still
    // yield ONE valid instant, not NaN or a throw. It lands on 06:30Z (the pre-jump EST
    // reading) — the exact value is locked here as a regression guard.
    expect(zonedWallClockToInstant('2026-03-08T02:30', 'America/New_York')).toBe(
      '2026-03-08T06:30:00.000Z',
    );
  });

  it('resolves a fall-back ambiguous time deterministically without throwing', () => {
    // 1:30 AM occurs twice on 2026-11-01; the converter must pick one instant, not error.
    expect(() => zonedWallClockToInstant('2026-11-01T01:30', 'America/New_York')).not.toThrow();
  });

  it('throws on a malformed datetime-local value', () => {
    expect(() => zonedWallClockToInstant('not-a-date', 'UTC')).toThrow();
  });
});

// The date-only sentinel (owner 2026-08-30). A key date with NO stored timezone is the extractor's
// day-only encoding — "the page said Nov 3, it named no clock time and no zone" — carried as UTC
// midnight. Reading it in Eastern (DEFAULT_TIMEZONE) lands a full calendar day early, which is what
// the public timeline, card deadline, At-a-glance cell and schema.org dates all used to do.
describe('keyDateZone', () => {
  it('reads a zoneless key date in UTC, not the Eastern default', () => {
    expect(keyDateZone(null)).toBe('UTC');
    expect(keyDateZone(undefined)).toBe('UTC');
  });

  it('keeps a stated zone — a real 11:59 PM ET deadline is unaffected', () => {
    expect(keyDateZone('America/New_York')).toBe('America/New_York');
  });

  it('renders a day-only deadline on the day the page stated', () => {
    // Nov 3 with no clock time and no zone. In Eastern this instant is Nov 2, 7:00 PM.
    expect(formatDate('2026-11-03T00:00:00Z', keyDateZone(null))).toBe('Nov 3, 2026');
  });

  it('does not roll a January 1 deadline back into the previous YEAR', () => {
    // The worst instance of the bug: "closes Jan 1, 2026" rendered as "Dec 31, 2025".
    expect(formatDate('2026-01-01T00:00:00Z', keyDateZone(null))).toBe('Jan 1, 2026');
  });

  it('still renders a zoned wall-clock deadline in its own zone', () => {
    // 11:59 PM ET on Nov 2 is 04:59 UTC on Nov 3 — it must read as Nov 2, not Nov 3.
    expect(formatDate('2026-11-03T04:59:00Z', keyDateZone('America/New_York'))).toBe('Nov 2, 2026');
  });
});
