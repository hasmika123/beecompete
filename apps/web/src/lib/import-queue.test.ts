import { describe, expect, it } from 'vitest';
import { parseOrigin, parseSort, parseStatus, summarizeImportRow } from './import-queue';

describe('parseSort', () => {
  it('reads a whole ordering out of one param', () => {
    expect(parseSort('CONFIDENCE:desc')).toMatchObject({ sort: 'CONFIDENCE', desc: true });
    expect(parseSort('NAME:asc')).toMatchObject({ sort: 'NAME', desc: false });
  });

  it('falls back to queue order for anything hand-typed or missing', () => {
    for (const value of [undefined, '', 'nonsense', 'DROP TABLE:desc', 'CREATED_AT']) {
      expect(parseSort(value).value).toBe('CREATED_AT:asc');
    }
  });
});

describe('parseStatus / parseOrigin', () => {
  it('defaults to the pending tab and to "any origin"', () => {
    expect(parseStatus(undefined)).toBe('PENDING');
    expect(parseStatus('nope')).toBe('PENDING');
    expect(parseStatus('REJECTED')).toBe('REJECTED');
    expect(parseOrigin(undefined)).toBeNull();
    expect(parseOrigin('')).toBeNull();
    expect(parseOrigin('USER_REQUEST')).toBe('USER_REQUEST');
  });
});

describe('summarizeImportRow', () => {
  it('pulls the triage facts out of a payload', () => {
    const summary = summarizeImportRow({
      name: 'Science Olympiad',
      slug: 'science-olympiad',
      categoryId: 'cat-1',
      organizerName: 'Science Olympiad Inc.',
      edition: { cycleLabel: '2026' },
      keyDates: [
        { type: 'REG_OPEN', startsAt: '2026-09-01T00:00:00Z' },
        { type: 'REG_CLOSE', startsAt: '2026-11-03T04:59:00Z', timezone: 'America/New_York' },
      ],
    });
    expect(summary).toMatchObject({
      title: 'Science Olympiad',
      cycleLabel: '2026',
      hasEdition: true,
      keyDateCount: 2,
      deadline: { kind: 'dated', timezone: 'America/New_York' },
    });
  });

  it('prefers REG_CLOSE over SUBMISSION_DUE, matching what the public card would show', () => {
    const summary = summarizeImportRow({
      keyDates: [
        { type: 'SUBMISSION_DUE', startsAt: '2026-01-01T00:00:00Z' },
        { type: 'REG_CLOSE', startsAt: '2026-02-02T00:00:00Z' },
      ],
    });
    expect(summary.deadline).toMatchObject({ kind: 'dated', startsAt: '2026-02-02T00:00:00Z' });
  });

  it('falls back to SUBMISSION_DUE when there is no registration close', () => {
    const summary = summarizeImportRow({
      keyDates: [{ type: 'SUBMISSION_DUE', startsAt: '2026-01-01T00:00:00Z' }],
    });
    expect(summary.deadline).toMatchObject({ kind: 'dated', startsAt: '2026-01-01T00:00:00Z' });
  });

  it('distinguishes an undated deadline from no deadline at all', () => {
    expect(summarizeImportRow({ keyDates: [{ type: 'REG_CLOSE' }] }).deadline).toEqual({
      kind: 'tbd',
    });
    expect(summarizeImportRow({ keyDates: [{ type: 'RESULTS' }] }).deadline).toEqual({
      kind: 'none',
    });
    expect(summarizeImportRow({}).deadline).toEqual({ kind: 'none' });
  });

  it('reads a zone-less instant in UTC so a date-only extraction keeps its day', () => {
    const summary = summarizeImportRow({
      keyDates: [{ type: 'REG_CLOSE', startsAt: '2026-11-03T00:00:00Z' }],
    });
    expect(summary.deadline).toMatchObject({ timezone: 'UTC' });
  });

  it('stays renderable for a garbage payload', () => {
    const summary = summarizeImportRow({ name: 7, edition: [], keyDates: 'soon' });
    expect(summary).toMatchObject({
      title: '(untitled)',
      hasEdition: false,
      keyDateCount: 0,
      deadline: { kind: 'none' },
    });
  });
});
