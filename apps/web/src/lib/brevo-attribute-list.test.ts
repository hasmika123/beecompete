import { describe, expect, it } from 'vitest';
import {
  addToAttributeList,
  attributeListHas,
  encodeAttributeList,
  parseAttributeList,
  sanitizeEntry,
} from './brevo-attribute-list';

describe('parseAttributeList', () => {
  it('decodes the delimiter-wrapped form without empty edge entries', () => {
    expect(parseAttributeList('|AMC 10|MATHCOUNTS|')).toEqual(['AMC 10', 'MATHCOUNTS']);
  });

  it('treats unset / blank / non-string values as an empty list', () => {
    // Covers a contact created before multi-value encoding, and Brevo returning a non-string.
    expect(parseAttributeList(undefined)).toEqual([]);
    expect(parseAttributeList('')).toEqual([]);
    expect(parseAttributeList('   ')).toEqual([]);
    expect(parseAttributeList(42)).toEqual([]);
  });

  it('reads a legacy single unwrapped value as one entry', () => {
    // Contacts captured before this change stored the bare name — they must not be lost.
    expect(parseAttributeList('AMC 10')).toEqual(['AMC 10']);
  });
});

describe('encodeAttributeList', () => {
  it('wraps entries so a segment can match the first and last safely', () => {
    expect(encodeAttributeList(['AMC 10', 'MATHCOUNTS'])).toBe('|AMC 10|MATHCOUNTS|');
  });

  it('round-trips through parse', () => {
    const values = ['AMC 10', 'Science Olympiad'];
    expect(parseAttributeList(encodeAttributeList(values))).toEqual(values);
  });

  it('encodes an empty list as an empty string, not a stray delimiter', () => {
    expect(encodeAttributeList([])).toBe('');
  });
});

describe('attributeListHas', () => {
  it('matches case-insensitively', () => {
    expect(attributeListHas(['AMC 10'], 'amc 10')).toBe(true);
  });

  it('does not treat a prefix as a match', () => {
    // The delimiter wrapping exists precisely so "AMC 10" never matches "AMC 10/12".
    expect(attributeListHas(['AMC 10/12'], 'AMC 10')).toBe(false);
  });
});

describe('addToAttributeList', () => {
  it('appends a new entry', () => {
    expect(addToAttributeList(['AMC 10'], 'MATHCOUNTS')).toEqual(['AMC 10', 'MATHCOUNTS']);
  });

  it('returns the SAME list when the value is already present, so callers can skip the write', () => {
    const existing = ['AMC 10'];
    expect(addToAttributeList(existing, 'AMC 10')).toBe(existing);
    expect(addToAttributeList(existing, 'amc 10')).toBe(existing);
  });

  it('ignores an empty value', () => {
    const existing = ['AMC 10'];
    expect(addToAttributeList(existing, '   ')).toBe(existing);
  });

  it('replaces a delimiter inside a name so it cannot split into two entries', () => {
    expect(addToAttributeList([], 'Math|Science Bowl')).toEqual(['Math/Science Bowl']);
  });

  it('drops the oldest entries rather than exceeding the Brevo text limit', () => {
    // 150 chars + index stays under the 200-char per-entry cap, so each stays DISTINCT. (At 200+
    // the cap truncates them all to the same string and they dedupe instead of accumulating.)
    const long = 'x'.repeat(150);
    let list: string[] = [];
    for (let i = 0; i < 80; i++) list = addToAttributeList(list, `${long}${i}`);

    expect(encodeAttributeList(list).length).toBeLessThanOrEqual(9000);
    // Newest survives, oldest was evicted.
    expect(attributeListHas(list, `${long}79`)).toBe(true);
    expect(attributeListHas(list, `${long}0`)).toBe(false);
  });
});

describe('sanitizeEntry', () => {
  it('trims and truncates to the per-entry cap', () => {
    expect(sanitizeEntry('  AMC 10  ')).toBe('AMC 10');
    expect(sanitizeEntry('y'.repeat(300))).toHaveLength(200);
  });
});
