import { describe, expect, it } from 'vitest';
import { zonedWallClockToInstant } from '@/lib/dates';

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
