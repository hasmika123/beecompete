import { describe, expect, it } from 'vitest';
import {
  asText,
  fromLocalInputValue,
  timelineFlags,
  toLocalInputValue,
  type RawKeyDateRow,
} from './import-edition';

describe('asText', () => {
  it('accepts only non-empty strings — extracted payloads are untyped JSON', () => {
    expect(asText('2026')).toBe('2026');
    expect(asText('')).toBeNull();
    expect(asText(null)).toBeNull();
    expect(asText(undefined)).toBeNull();
    expect(asText(42)).toBeNull();
    expect(asText({})).toBeNull();
  });
});

describe('toLocalInputValue / fromLocalInputValue', () => {
  it('round-trips an instant through the local input format', () => {
    const iso = '2026-11-01T04:59:00.000Z';
    const local = toLocalInputValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Same wall-clock minute back out, so editing then saving an untouched field is a no-op.
    expect(toLocalInputValue(fromLocalInputValue(local))).toBe(local);
  });

  it('treats TBD and unparseable values as an empty input, never a fabricated date', () => {
    expect(toLocalInputValue(null)).toBe('');
    expect(toLocalInputValue('')).toBe('');
    expect(toLocalInputValue('sometime in the fall')).toBe('');
  });

  it('maps an empty input back to null — clearing a date means TBD, not epoch zero', () => {
    expect(fromLocalInputValue('')).toBeNull();
    expect(fromLocalInputValue('not a date')).toBeNull();
  });
});

describe('timelineFlags', () => {
  const row = (type: string, startsAt?: string | null): RawKeyDateRow => ({ type, startsAt });

  it('flags a timeline with no deadline row', () => {
    // The card/search deadline reads REG_CLOSE → SUBMISSION_DUE only; a ROUND_START is not one.
    expect(timelineFlags([row('ROUND_START', '2026-03-01T00:00:00Z')]).missingDeadline).toBe(true);
    expect(timelineFlags([row('REG_CLOSE', '2026-03-01T00:00:00Z')]).missingDeadline).toBe(false);
    expect(timelineFlags([row('SUBMISSION_DUE', null)]).missingDeadline).toBe(false);
  });

  it('counts a TBD deadline as present — the row is what the card reads', () => {
    // R1-18: an undated REG_CLOSE still renders "Deadline · TBD" rather than nothing.
    const flags = timelineFlags([row('REG_CLOSE', null)]);
    expect(flags.missingDeadline).toBe(false);
    expect(flags.allTbd).toBe(true);
  });

  it('flags an all-TBD timeline, but only when there is something to flag', () => {
    expect(timelineFlags([row('REG_CLOSE', null), row('RESULTS', null)]).allTbd).toBe(true);
    expect(
      timelineFlags([row('REG_CLOSE', null), row('RESULTS', '2026-05-01T00:00:00Z')]).allTbd,
    ).toBe(false);
    // No rows at all is not "all TBD" — the empty-timeline case is reported separately.
    expect(timelineFlags([]).allTbd).toBe(false);
  });

  it('ignores rows whose type is missing or not a string', () => {
    const rows = [{ startsAt: '2026-01-01T00:00:00Z' }, { type: 7 }, row('REG_CLOSE', null)];
    const flags = timelineFlags(rows as RawKeyDateRow[]);
    expect(flags.missingDeadline).toBe(false);
    // Only the one usable row counts toward allTbd; the junk rows don't make it false.
    expect(flags.allTbd).toBe(true);
  });
});
